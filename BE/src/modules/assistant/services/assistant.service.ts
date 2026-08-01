import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from "@nestjs/common";
import { RedisService } from "../../../core/redis/redis.service";
import { AssistantChatDto } from "../dto/assistant-chat.dto";
import { AssistantAiService } from "./assistant.ai.service";
import { AssistantResolverService } from "./assistant.resolver.service";
import {
  AssistantAudience,
  AssistantRoleResolverService,
} from "./assistant.role-resolver.service";
import type { AssistantIntent } from "./assistant.types";

const ROLE_INTENTS = new Set<AssistantIntent>([
  "mentor_my_teams",
  "mentor_pending_feedback",
  "judge_my_assignments",
  "judge_pending_scoring",
  "judge_rubric",
  "org_my_events",
  "org_event_ops",
  "org_rubric",
]);

@Injectable()
export class AssistantService {
  private readonly logger = new Logger(AssistantService.name);

  constructor(
    private readonly resolver: AssistantResolverService,
    private readonly roleResolver: AssistantRoleResolverService,
    private readonly ai: AssistantAiService,
    private readonly redis: RedisService,
  ) {}

  async chat(
    dto: AssistantChatDto,
    user?: { id: number; role?: string } | null,
    meta?: { ip?: string },
  ) {
    await this.assertRateLimit(user?.id, meta?.ip);

    const message = dto.message.trim();
    const audience = await this.roleResolver.resolveAudience(user);
    const catalog = await this.resolver.listCatalog();
    const pageEventId = dto.context?.eventId;
    const focusEventId = dto.context?.focusEventId;
    const namedEvent = this.matchEventFromText(message, catalog);

    let intent: AssistantIntent = "clarify";
    let eventId: number | undefined = pageEventId;
    let usedAiIntent = false;

    const canSeeInternalRubric =
      audience === "judge" ||
      audience === "mentor_judge" ||
      audience === "organizer" ||
      audience === "admin";

    const roleRule = this.matchRoleRuleIntent(message, audience);
    const scoringBlock =
      !canSeeInternalRubric && this.matchBlockedScoring(message);

    if (scoringBlock) {
      intent = scoringBlock;
      eventId = eventId || namedEvent?.id || focusEventId || pageEventId;
    } else if (roleRule && roleRule.confidence >= 0.72) {
      intent = roleRule.intent;
      eventId = eventId || namedEvent?.id || focusEventId;
    } else if (namedEvent && this.isMostlyEventName(message, namedEvent.name)) {
      intent =
        audience === "organizer" || audience === "admin"
          ? "org_event_ops"
          : "event_overview";
      eventId = namedEvent.id;
    } else {
      const ruleIntent = this.matchRuleIntent(
        message,
        Boolean(user?.id),
        audience,
      );

      if (ruleIntent && ruleIntent.confidence >= 0.7) {
        intent = ruleIntent.intent;
        eventId = eventId || ruleIntent.eventId || namedEvent?.id;
      } else {
        const classified = await this.ai.classifyIntent({
          message,
          catalog,
          contextEventId: pageEventId || focusEventId,
          focusEventId,
          history: (dto.history || []).slice(-6),
          audience,
        });
        if (classified && classified.confidence >= 0.45) {
          if (
            classified.intent === "blocked_scoring_config" &&
            canSeeInternalRubric
          ) {
            intent =
              audience === "organizer" || audience === "admin"
                ? "org_rubric"
                : "judge_rubric";
          } else {
            intent = classified.intent;
          }
          usedAiIntent = true;
          eventId =
            eventId ||
            classified.eventIdHint ||
            namedEvent?.id ||
            catalog.find(
              (e) =>
                classified.eventNameHint &&
                e.name
                  .toLowerCase()
                  .includes(classified.eventNameHint.toLowerCase()),
            )?.id;
        } else if (ruleIntent) {
          intent = ruleIntent.intent;
          eventId = eventId || ruleIntent.eventId || namedEvent?.id;
        } else if (namedEvent) {
          intent = this.intentFromNamedEventMessage(message, audience);
          eventId = namedEvent.id;
        }
      }

      if (!eventId && focusEventId && this.looksLikeFollowUp(message)) {
        eventId = focusEventId;
        if (intent === "clarify" || intent === "list_open_events") {
          intent = this.followUpIntent(message, audience);
        }
      }

      if (
        !eventId &&
        this.looksLikeFollowUp(message) &&
        focusEventId &&
        (intent === "clarify" ||
          intent === "event_overview" ||
          intent === "how_to_register" ||
          intent === "event_staff" ||
          intent === "event_prizes" ||
          intent === "org_event_ops")
      ) {
        eventId = focusEventId;
        intent = this.followUpIntent(message, audience);
      }
    }

    if (
      intent !== "blocked_scoring_config" &&
      !ROLE_INTENTS.has(intent) &&
      /(moi nhat|newest|latest event|event moi)/i.test(this.normalize(message)) &&
      !namedEvent
    ) {
      intent = "event_overview";
      const newest = await this.resolver.findNewestPublicEventId();
      eventId = newest || eventId;
    }

    const personalGuard = this.matchRuleIntent(
      message,
      Boolean(user?.id),
      audience,
    );
    if (personalGuard?.intent === "my_profile" && intent !== "my_profile") {
      intent = "my_profile";
    } else if (
      personalGuard &&
      (personalGuard.intent === "my_awards" ||
        personalGuard.intent === "my_results" ||
        personalGuard.intent === "my_registrations") &&
      (intent === "clarify" ||
        intent === "list_open_events" ||
        intent === "event_prizes" ||
        intent === "event_overview" ||
        intent === "how_to_register")
    ) {
      intent = personalGuard.intent;
    }

    let resolved =
      user?.id && ROLE_INTENTS.has(intent)
        ? await this.roleResolver.resolveRoleIntent({
            audience,
            intent,
            userId: user.id,
            eventId,
            message,
          })
        : null;

    if (!resolved) {
      resolved = await this.resolver.resolve({
        intent,
        message,
        eventId,
        userId: user?.id,
      });
    }

    let reply = resolved.fallbackReply;
    let usedAiWording = false;
    if (
      resolved.intent !== "out_of_scope" &&
      resolved.intent !== "blocked_scoring_config"
    ) {
      const aiReply = await this.ai.wording({
        message,
        intent: resolved.intent,
        facts: resolved.facts,
        locale: dto.locale,
      });
      if (aiReply) {
        reply = aiReply;
        usedAiWording = true;
      }
    }

    const firstListedEventId = Array.isArray(resolved.facts.events)
      ? Number((resolved.facts.events as Array<{ id?: number }>)[0]?.id)
      : NaN;

    const nextFocus =
      (typeof resolved.facts.eventId === "number"
        ? resolved.facts.eventId
        : undefined) ||
      eventId ||
      (Number.isFinite(firstListedEventId) ? firstListedEventId : undefined) ||
      focusEventId ||
      null;

    return {
      reply,
      intent: resolved.intent,
      audience,
      usedAi: { intent: usedAiIntent, wording: usedAiWording },
      factsUsed: resolved.facts,
      cards: resolved.cards,
      quickReplies: resolved.quickReplies,
      needsLogin: resolved.needsLogin || false,
      focusEventId: nextFocus,
    };
  }

  private matchEventFromText(
    message: string,
    catalog: Array<{ id: number; name: string }>,
  ): { id: number; name: string } | null {
    const normalizedMsg = this.normalize(message);
    if (!normalizedMsg) return null;

    const ranked = [...catalog]
      .map((e) => ({
        e,
        nameNorm: this.normalize(e.name),
      }))
      .filter((x) => x.nameNorm.length >= 3)
      .sort((a, b) => b.nameNorm.length - a.nameNorm.length);

    for (const { e, nameNorm } of ranked) {
      if (normalizedMsg === nameNorm) return e;
      if (normalizedMsg.includes(nameNorm)) return e;
      const tokens = nameNorm.split(" ").filter((t) => t.length >= 3);
      if (
        tokens.length >= 2 &&
        tokens.every((t) => normalizedMsg.includes(t))
      ) {
        return e;
      }
    }
    return null;
  }

  private isMostlyEventName(message: string, eventName: string): boolean {
    const msg = this.normalize(message);
    const name = this.normalize(eventName);
    if (!msg || !name) return false;
    if (msg === name) return true;
    if (
      /(giai|prize|award|deadline|han |dang ky|register|faq|the le|rubric|tieu chi|mentor|judge|nop bai|submit|team|diem|thong tin cua)/i.test(
        msg,
      )
    ) {
      return false;
    }
    const stripped = msg
      .replace(/^(ve|ve event|event|cuoc thi|hackathon)\s+/i, "")
      .trim();
    return stripped === name || msg.length <= name.length + 12;
  }

  private intentFromNamedEventMessage(
    message: string,
    audience: AssistantAudience,
  ): AssistantIntent {
    const m = this.normalize(message);
    if (audience === "organizer" || audience === "admin") {
      if (/rubric|tieu chi|criteria|cach cham/i.test(m)) return "org_rubric";
      if (/tinh trang|ops|submission|team|assign/i.test(m)) return "org_event_ops";
      return "org_event_ops";
    }
    if (/dang ky|register/i.test(m)) return "how_to_register";
    if (/deadline|han /i.test(m)) return "event_deadline";
    if (/faq|the le|quy dinh|rules/i.test(m)) return "event_faq";
    if (/mentor|giam khao|judge|thay co|coach/i.test(m)) return "event_staff";
    if (/giai thuong|prize|award hang muc/i.test(m)) return "event_prizes";
    if (/nop |submit/i.test(m)) return "submission_howto";
    return "event_overview";
  }

  private matchRoleRuleIntent(
    message: string,
    audience: AssistantAudience,
  ): { intent: AssistantIntent; confidence: number } | null {
    const m = this.normalize(message);
    const isMentor = audience === "mentor" || audience === "mentor_judge";
    const isJudge = audience === "judge" || audience === "mentor_judge";
    const isOrg = audience === "organizer" || audience === "admin";

    if (isMentor) {
      if (
        /(team nao thieu feedback|thieu feedback|pending feedback|chua feedback)/i.test(
          m,
        )
      ) {
        return { intent: "mentor_pending_feedback", confidence: 0.93 };
      }
      if (
        /(team cua toi|team toi mentor|assigned teams|submission cua team)/i.test(
          m,
        )
      ) {
        return { intent: "mentor_my_teams", confidence: 0.9 };
      }
    }

    if (isJudge) {
      if (
        /(bai chua cham|chua cham|pending scoring|con thieu diem)/i.test(m)
      ) {
        return { intent: "judge_pending_scoring", confidence: 0.93 };
      }
      if (
        /(rubric|tieu chi cham|criteria|bang diem|max score|weight)/i.test(m)
      ) {
        return { intent: "judge_rubric", confidence: 0.92 };
      }
      if (
        /(round toi|assignment cua toi|toi duoc assign|round cham)/i.test(m)
      ) {
        return { intent: "judge_my_assignments", confidence: 0.9 };
      }
    }

    if (isOrg) {
      if (/(rubric|tieu chi|criteria|cach cham|setup cham)/i.test(m)) {
        return { intent: "org_rubric", confidence: 0.92 };
      }
      if (
        /(tinh trang event|ops event|bao nhieu team|submission status|assign judge|assign mentor)/i.test(
          m,
        )
      ) {
        return { intent: "org_event_ops", confidence: 0.9 };
      }
      if (/(event cua toi|my events|event toi quan ly)/i.test(m)) {
        return { intent: "org_my_events", confidence: 0.9 };
      }
    }

    return null;
  }

  private matchBlockedScoring(message: string): AssistantIntent | null {
    const m = this.normalize(message);
    if (
      /(diem cua toi|diem toi|my score|ket qua cua toi|xem diem|diem da cong bo)/i.test(
        m,
      )
    ) {
      return null;
    }
    if (
      /(rubric|tieu chi cham|cach cham|cham diem the nao|trong so|weight criterion|scoring config|bang diem judge|cong thuc cham|admin setup cham|cau hinh cham)/i.test(
        m,
      )
    ) {
      return "blocked_scoring_config";
    }
    return null;
  }

  private looksLikeFollowUp(message: string): boolean {
    const m = this.normalize(message);
    return /(nay|ay|do|kia|this|that|cuoc thi|event nay|them thong tin|tom tat|chi tiet|biet them|tell me more|summary|overview)/i.test(
      m,
    );
  }

  private followUpIntent(
    message: string,
    audience: AssistantAudience,
  ): AssistantIntent {
    const m = this.normalize(message);
    if (audience === "organizer" || audience === "admin") {
      if (/rubric|tieu chi|criteria/i.test(m)) return "org_rubric";
      return "org_event_ops";
    }
    if (/dang ky|register/i.test(m)) return "how_to_register";
    if (/deadline|han /i.test(m)) return "event_deadline";
    if (/faq|the le|quy dinh/i.test(m)) return "event_faq";
    if (/mentor|giam khao|judge|thay co/i.test(m)) return "event_staff";
    if (
      /(giai thuong|prize|giai )/i.test(m) &&
      /(cua (toi|minh)|ma (toi|minh)|toi (da |co |dat )|toi dat)/i.test(m)
    ) {
      return "my_awards";
    }
    if (/giai thuong|prize/i.test(m)) return "event_prizes";
    if (/nop |submit/i.test(m)) return "submission_howto";
    return "event_overview";
  }

  private normalize(value: string): string {
    return value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  private matchRuleIntent(
    message: string,
    loggedIn: boolean,
    audience: AssistantAudience,
  ): { intent: AssistantIntent; confidence: number; eventId?: number } | null {
    const m = this.normalize(message);

    if (
      /(bai tap|homework|code giup|viet code|giai bai|debug giup)/i.test(m)
    ) {
      return { intent: "out_of_scope", confidence: 0.95 };
    }
    if (/(moi nhat|newest|latest event|event moi)/i.test(m)) {
      return { intent: "event_overview", confidence: 0.86 };
    }
    if (
      loggedIn &&
      /(thong tin (ca nhan )?cua (toi|minh)|check (duoc )?thong tin|thong tin (toi|minh)|toi ten (la )?gi|ten toi la gi|tai khoan cua (toi|minh)|profile cua (toi|minh)|ho so cua (toi|minh)|cua (toi|minh) ma|xem thong tin cua (toi|minh)|ban co (xem|check) (duoc )?thong tin)/i.test(
        m,
      )
    ) {
      return { intent: "my_profile", confidence: 0.96 };
    }
    if (
      loggedIn &&
      /(xem (team|event) cua (toi|minh))/i.test(m)
    ) {
      if (/(team)/i.test(m)) {
        return { intent: "my_team_status", confidence: 0.9 };
      }
      if (audience === "organizer" || audience === "admin") {
        return { intent: "org_my_events", confidence: 0.94 };
      }
      if (audience === "mentor" || audience === "mentor_judge") {
        return { intent: "mentor_my_teams", confidence: 0.94 };
      }
      if (audience === "judge") {
        return { intent: "judge_my_assignments", confidence: 0.94 };
      }
      return { intent: "my_registrations", confidence: 0.94 };
    }
    if (
      /(tom tat|chi tiet|thong tin ve|overview|tell me about|biet them)/i.test(
        m,
      ) &&
      !/(cua toi|cua minh|tai khoan|profile)/i.test(m)
    ) {
      return { intent: "event_overview", confidence: 0.78 };
    }
    if (
      /(event nao|su kien nao|con mo|dang mo|open event|accepting|nhan team|dang ky duoc)/i.test(
        m,
      )
    ) {
      return { intent: "list_open_events", confidence: 0.9 };
    }
    if (
      /(cach dang ky|dang ky the|register how|how to register|muon dang ky)/i.test(
        m,
      )
    ) {
      return { intent: "how_to_register", confidence: 0.88 };
    }
    if (/(deadline|han chot|han dang ky|han nop|submission deadline)/i.test(m)) {
      return { intent: "event_deadline", confidence: 0.88 };
    }
    if (/(faq|the le|quy dinh|rules|bao nhieu thanh vien|team size)/i.test(m)) {
      return { intent: "event_faq", confidence: 0.85 };
    }
    if (
      /(mentor|giam khao|judge|thay co|co van|ai cham|ai lam giam khao)/i.test(m)
    ) {
      return { intent: "event_staff", confidence: 0.9 };
    }
    const asksOwnAwards =
      /(giai cao nhat|giai toi dat|award cua (toi|minh)|toi dat giai|thanh tich cua (toi|minh)|my award|giai da dat|giai (thuong )?(ma )?(toi|minh) (co|dat)|giai (thuong )?cua (toi|minh)|nhung giai (thuong )?(ma )?(toi|minh)|toi (da )?dat (duoc )?(nhung )?giai|toi co (nhung )?giai|giai (toi|minh) co)/i.test(
        m,
      ) ||
      (/(giai thuong|giai |award|prize|thanh tich)/i.test(m) &&
        /(cua (toi|minh)|ma (toi|minh)|toi (da |co |dat )|(toi|minh) dat)/i.test(
          m,
        ));
    if (asksOwnAwards) {
      return { intent: "my_awards", confidence: 0.95 };
    }
    if (
      /(diem cua toi|diem toi|my score|ket qua cua toi|xem diem|diem da cong bo|ket qua da cong bo)/i.test(
        m,
      )
    ) {
      return { intent: "my_results", confidence: 0.9 };
    }
    if (
      /(giai thuong|prize|co giai gi|hang muc giai)/i.test(m) &&
      !/(cua (toi|minh)|ma (toi|minh)|toi (da |co |dat )|toi dat)/i.test(m)
    ) {
      return { intent: "event_prizes", confidence: 0.86 };
    }
    if (/(nop bai|submit|github hay file|submission)/i.test(m)) {
      return { intent: "submission_howto", confidence: 0.85 };
    }
    if (
      loggedIn &&
      /(team cua toi|event cua toi|my team|my events|dang o event|toi dang ky event|su kien cua toi)/i.test(
        m,
      )
    ) {
      if (/^team|team cua|status|trang thai/i.test(m) && !/event cua/i.test(m)) {
        return { intent: "my_team_status", confidence: 0.85 };
      }
      if (audience === "organizer" || audience === "admin") {
        return { intent: "org_my_events", confidence: 0.9 };
      }
      if (audience === "mentor" || audience === "mentor_judge") {
        return { intent: "mentor_my_teams", confidence: 0.9 };
      }
      return { intent: "my_registrations", confidence: 0.9 };
    }
    if (/(team cua toi|event cua toi|my team|my events)/i.test(m)) {
      return { intent: "my_registrations", confidence: 0.8 };
    }

    return null;
  }

  private async assertRateLimit(userId?: number, ip?: string) {
    const cooldownKey = userId
      ? `assistant:cooldown:user:${userId}`
      : `assistant:cooldown:ip:${ip || "unknown"}`;
    const dailyKey = userId
      ? `assistant:daily:user:${userId}`
      : `assistant:daily:ip:${ip || "unknown"}`;

    const gotCooldown = await this.redis.setNx(cooldownKey, "1", 2);
    if (!gotCooldown) {
      throw new HttpException(
        "Please wait a moment before sending another message.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const existing = await this.redis.get(dailyKey);
    let count = existing ? Number(existing) + 1 : 1;
    if (!Number.isFinite(count) || count < 1) count = 1;
    await this.redis.set(dailyKey, String(count), 24 * 60 * 60);

    const maxDaily = userId ? 40 : 20;
    if (count > maxDaily) {
      throw new HttpException(
        "Daily assistant limit reached. Try again tomorrow.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
}
