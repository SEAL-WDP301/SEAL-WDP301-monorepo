import { Injectable } from "@nestjs/common";
import { RoundStatus } from "@prisma/client";
import { PrismaService } from "../../../database/prisma/prisma.service";
import type {
  AssistantIntent,
  AssistantResolveResult,
} from "./assistant.types";

export type AssistantAudience =
  | "guest"
  | "student"
  | "mentor"
  | "judge"
  | "mentor_judge"
  | "organizer"
  | "admin";

@Injectable()
export class AssistantRoleResolverService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveAudience(user?: {
    id: number;
    role?: string;
  } | null): Promise<AssistantAudience> {
    if (!user?.id) return "guest";
    const role = (user.role || "").toLowerCase();
    if (role === "admin") return "admin";
    if (role === "organizer") return "organizer";
    if (role === "student") return "student";
    if (role === "stakeholder") {
      const [mentorCount, judgeCount] = await Promise.all([
        this.prisma.mentorAssignment.count({ where: { mentorId: user.id } }),
        this.prisma.judgeAssignment.count({ where: { judgeId: user.id } }),
      ]);
      if (mentorCount > 0 && judgeCount > 0) return "mentor_judge";
      if (judgeCount > 0) return "judge";
      if (mentorCount > 0) return "mentor";
      return "mentor"; // stakeholder with no assignments yet
    }
    return "guest";
  }

  async resolveRoleIntent(input: {
    audience: AssistantAudience;
    intent: AssistantIntent;
    userId: number;
    eventId?: number;
    message: string;
  }): Promise<AssistantResolveResult | null> {
    switch (input.intent) {
      case "mentor_my_teams":
        return this.mentorMyTeams(input.userId, input.eventId);
      case "mentor_pending_feedback":
        return this.mentorPendingFeedback(input.userId, input.eventId);
      case "judge_my_assignments":
        return this.judgeMyAssignments(input.userId, input.eventId);
      case "judge_pending_scoring":
        return this.judgePendingScoring(input.userId, input.eventId);
      case "judge_rubric":
        return this.judgeRubric(input.userId, input.eventId, input.message);
      case "org_my_events":
        return this.orgMyEvents(input.userId, input.audience === "admin");
      case "org_event_ops":
        return this.orgEventOps(
          input.userId,
          input.audience === "admin",
          input.eventId,
          input.message,
        );
      case "org_rubric":
        return this.orgRubric(
          input.userId,
          input.audience === "admin",
          input.eventId,
          input.message,
        );
      default:
        return null;
    }
  }

  private async mentorMyTeams(
    mentorId: number,
    eventId?: number,
  ): Promise<AssistantResolveResult> {
    const teams = await this.prisma.team.findMany({
      where: {
        mentorAssignments: { some: { mentorId } },
        ...(eventId ? { eventId } : {}),
      },
      select: {
        id: true,
        name: true,
        status: true,
        event: { select: { id: true, name: true } },
        track: { select: { name: true } },
        _count: { select: { submissions: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 20,
    });

    return {
      intent: "mentor_my_teams",
      facts: {
        count: teams.length,
        teams: teams.map((t) => ({
          teamId: t.id,
          teamName: t.name,
          teamStatus: t.status,
          eventId: t.event.id,
          eventName: t.event.name,
          trackName: t.track?.name ?? null,
          submissionCount: t._count.submissions,
        })),
      },
      cards: teams.slice(0, 8).map((t) => ({
        type: "action" as const,
        title: `${t.name} · ${t.event.name}`,
        subtitle: `${t._count.submissions} submission(s) · ${t.status}`,
        href: `/mentor/events/${t.event.id}/teams/${t.id}`,
        primary: true,
      })),
      quickReplies: [
        "Team nào thiếu feedback",
        "Submission của team tôi",
        "Event đang mở",
      ],
      fallbackReply:
        teams.length === 0
          ? "Bạn chưa được assign team mentor nào."
          : `Bạn đang mentor ${teams.length} team. Mở card để vào workspace từng team.`,
    };
  }

  private async mentorPendingFeedback(
    mentorId: number,
    eventId?: number,
  ): Promise<AssistantResolveResult> {
    const submissions = await this.prisma.submission.findMany({
      where: {
        team: {
          mentorAssignments: { some: { mentorId } },
          ...(eventId ? { eventId } : {}),
        },
        mentorFeedbacks: { none: { mentorId } },
      },
      select: {
        id: true,
        team: {
          select: {
            id: true,
            name: true,
            event: { select: { id: true, name: true } },
          },
        },
        round: { select: { name: true } },
      },
      orderBy: { submittedAt: "desc" },
      take: 15,
    });

    return {
      intent: "mentor_pending_feedback",
      facts: {
        pendingCount: submissions.length,
        items: submissions.map((s) => ({
          submissionId: s.id,
          teamId: s.team.id,
          teamName: s.team.name,
          eventId: s.team.event.id,
          eventName: s.team.event.name,
          roundName: s.round.name,
        })),
      },
      cards: submissions.slice(0, 8).map((s) => ({
        type: "action" as const,
        title: `${s.team.name} · ${s.round.name}`,
        subtitle: "Chưa có feedback từ bạn",
        href: `/mentor/events/${s.team.event.id}/teams/${s.team.id}`,
        primary: true,
      })),
      quickReplies: ["Team của tôi", "AI overview mentoring"],
      fallbackReply:
        submissions.length === 0
          ? "Không có submission nào của team bạn đang thiếu feedback."
          : `Có ${submissions.length} submission chưa có feedback mentor. Mở team để draft/gửi feedback.`,
    };
  }

  private async judgeMyAssignments(
    judgeId: number,
    eventId?: number,
  ): Promise<AssistantResolveResult> {
    const assignments = await this.prisma.judgeAssignment.findMany({
      where: {
        judgeId,
        ...(eventId ? { round: { eventId } } : {}),
      },
      include: {
        round: {
          select: {
            id: true,
            name: true,
            status: true,
            eventId: true,
            event: { select: { name: true } },
          },
        },
        track: { select: { name: true } },
      },
      take: 30,
    });

    const items = assignments.map((a) => ({
      roundId: a.round.id,
      roundName: a.round.name,
      roundStatus: a.round.status,
      eventId: a.round.eventId,
      eventName: a.round.event.name,
      trackName: a.track?.name ?? "All tracks",
    }));

    return {
      intent: "judge_my_assignments",
      facts: { count: items.length, assignments: items },
      cards: items.slice(0, 8).map((i) => ({
        type: "action" as const,
        title: `${i.eventName} · ${i.roundName}`,
        subtitle: `${i.trackName} · ${i.roundStatus}`,
        href: `/judge/events/${i.eventId}/evalution`,
        primary: true,
      })),
      quickReplies: [
        "Bài chưa chấm",
        "Rubric round của tôi",
        "Mở trang đánh giá",
      ],
      fallbackReply:
        items.length === 0
          ? "Bạn chưa được assign round/track chấm nào."
          : `Bạn được assign ${items.length} nhiệm vụ chấm. Mở Evaluation để chấm bài.`,
    };
  }

  private async judgePendingScoring(
    judgeId: number,
    eventId?: number,
  ): Promise<AssistantResolveResult> {
    const assignments = await this.prisma.judgeAssignment.findMany({
      where: {
        judgeId,
        ...(eventId ? { round: { eventId } } : {}),
      },
      include: {
        round: {
          select: { id: true, name: true, eventId: true, event: { select: { name: true } } },
        },
        track: { select: { id: true, name: true } },
      },
      take: 20,
    });

    const pending: Array<{
      submissionId: number;
      teamName: string;
      eventId: number;
      eventName: string;
      roundName: string;
    }> = [];

    for (const a of assignments) {
      const hasGlobal = a.trackId == null;
      const subs = await this.prisma.submission.findMany({
        where: {
          roundId: a.roundId,
          status: { not: "disqualified" },
          team: {
            status: "approved",
            ...(!hasGlobal && a.trackId
              ? { trackId: a.trackId }
              : {}),
          },
          scores: { none: { judgeId } },
        },
        select: {
          id: true,
          team: { select: { name: true } },
        },
        take: 8,
      });
      for (const s of subs) {
        pending.push({
          submissionId: s.id,
          teamName: s.team.name,
          eventId: a.round.eventId,
          eventName: a.round.event.name,
          roundName: a.round.name,
        });
      }
      if (pending.length >= 12) break;
    }

    return {
      intent: "judge_pending_scoring",
      facts: { pendingCount: pending.length, items: pending.slice(0, 12) },
      cards: pending.slice(0, 8).map((p) => ({
        type: "action" as const,
        title: `${p.teamName} · ${p.roundName}`,
        subtitle: p.eventName,
        href: `/judge/events/${p.eventId}/evalution`,
        primary: true,
      })),
      quickReplies: ["Round tôi được assign", "Rubric round của tôi"],
      fallbackReply:
        pending.length === 0
          ? "Không thấy submission nào bạn còn thiếu điểm (theo assignment hiện tại)."
          : `Có khoảng ${pending.length}+ bài chưa có điểm từ bạn. Mở Evaluation để chấm / dùng AI Suggest.`,
    };
  }

  private async judgeRubric(
    judgeId: number,
    eventId: number | undefined,
    message: string,
  ): Promise<AssistantResolveResult> {
    const assignments = await this.prisma.judgeAssignment.findMany({
      where: {
        judgeId,
        ...(eventId ? { round: { eventId } } : {}),
      },
      include: {
        round: {
          select: {
            id: true,
            name: true,
            eventId: true,
            event: { select: { name: true } },
          },
        },
        track: { select: { id: true, name: true } },
      },
      take: 10,
    });

    if (assignments.length === 0) {
      return {
        intent: "judge_rubric",
        facts: { allowed: false, reason: "No judge assignments" },
        cards: [
          {
            type: "action",
            title: "Judge events",
            href: "/judge/events",
            primary: true,
          },
        ],
        quickReplies: ["Round tôi được assign"],
        fallbackReply:
          "Bạn chưa được assign round nào nên chưa có rubric để xem.",
      };
    }

    const picked =
      assignments.find((a) =>
        message.toLowerCase().includes(a.round.name.toLowerCase()),
      ) || assignments[0];

    const criteria = await this.prisma.criterion.findMany({
      where: {
        roundId: picked.roundId,
        trackId: null,
      },
      select: {
        name: true,
        description: true,
        maxScore: true,
        weight: true,
        track: { select: { name: true } },
      },
      orderBy: { id: "asc" },
      take: 30,
    });

    return {
      intent: "judge_rubric",
      facts: {
        allowed: true,
        eventId: picked.round.eventId,
        eventName: picked.round.event.name,
        roundId: picked.round.id,
        roundName: picked.round.name,
        trackName: picked.track?.name ?? "All tracks",
        criteria: criteria.map((c) => ({
          name: c.name,
          description: (c.description || "").slice(0, 220),
          maxScore: Number(c.maxScore),
          weight: Number(c.weight),
          trackName: c.track?.name ?? null,
        })),
        note: "Rubric visible because this judge is assigned to the round.",
      },
      cards: [
        {
          type: "action",
          title: `Chấm · ${picked.round.name}`,
          href: `/judge/events/${picked.round.eventId}/evalution`,
          primary: true,
        },
      ],
      quickReplies: ["Bài chưa chấm", "Round tôi được assign"],
      fallbackReply:
        criteria.length === 0
          ? `${picked.round.event.name} / ${picked.round.name}: chưa có criterion trên hệ thống.`
          : `${picked.round.event.name} · ${picked.round.name}: có ${criteria.length} tiêu chí (ví dụ ${criteria
              .slice(0, 3)
              .map((c) => `${c.name} max ${c.maxScore}`)
              .join("; ")}). Mở Evaluation để chấm theo rubric.`,
    };
  }

  private async orgMyEvents(
    userId: number,
    allEvents: boolean,
  ): Promise<AssistantResolveResult> {
    const events = await this.prisma.event.findMany({
      where: allEvents ? undefined : { createdById: userId },
      select: {
        id: true,
        name: true,
        status: true,
        registrationDeadline: true,
        _count: { select: { teams: true, rounds: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 20,
    });

    return {
      intent: "org_my_events",
      facts: {
        count: events.length,
        events: events.map((e) => ({
          id: e.id,
          name: e.name,
          status: e.status,
          teams: e._count.teams,
          rounds: e._count.rounds,
          registrationDeadline: e.registrationDeadline?.toISOString() ?? null,
        })),
      },
      cards: events.slice(0, 8).map((e) => ({
        type: "action" as const,
        title: e.name,
        subtitle: `${e.status} · ${e._count.teams} teams · ${e._count.rounds} rounds`,
        href: `/organizer/events/${e.id}/overview`,
        primary: true,
      })),
      quickReplies: [
        "Tình trạng event này",
        "Rubric/criteria event",
        "Assign judge/mentor",
      ],
      fallbackReply:
        events.length === 0
          ? "Bạn chưa có event nào trên hệ thống."
          : `Bạn quản lý ${events.length} event. Mở overview để xem vận hành.`,
    };
  }

  private async orgEventOps(
    userId: number,
    allEvents: boolean,
    eventId: number | undefined,
    message: string,
  ): Promise<AssistantResolveResult> {
    const event = await this.findManagedEvent(
      userId,
      allEvents,
      eventId,
      message,
    );
    if (!event) {
      return {
        intent: "org_event_ops",
        facts: { missing: true },
        cards: [
          {
            type: "action",
            title: "My events",
            href: "/organizer/events",
            primary: true,
          },
        ],
        quickReplies: ["Event của tôi"],
        fallbackReply: "Bạn đang hỏi event nào? Nêu tên event bạn quản lý.",
      };
    }

    const [teamCount, submissionCount, judgeCount, mentorCount, rounds] =
      await Promise.all([
        this.prisma.team.count({ where: { eventId: event.id } }),
        this.prisma.submission.count({
          where: { round: { eventId: event.id } },
        }),
        this.prisma.judgeAssignment.count({
          where: { round: { eventId: event.id } },
        }),
        this.prisma.mentorAssignment.count({
          where: { team: { eventId: event.id } },
        }),
        this.prisma.round.findMany({
          where: { eventId: event.id },
          select: {
            id: true,
            name: true,
            status: true,
            submissionDeadline: true,
          },
          orderBy: { roundNumber: "asc" },
        }),
      ]);

    const openRound = rounds.find((r) => r.status === RoundStatus.open);

    return {
      intent: "org_event_ops",
      facts: {
        eventId: event.id,
        name: event.name,
        status: event.status,
        teamCount,
        submissionCount,
        judgeAssignmentCount: judgeCount,
        mentorAssignmentCount: mentorCount,
        rounds,
      },
      cards: [
        {
          type: "action",
          title: "Overview",
          href: `/organizer/events/${event.id}/overview`,
          primary: true,
        },
        {
          type: "action",
          title: "Submissions",
          href: openRound
            ? `/organizer/events/${event.id}/rounds/${openRound.id}/submissions`
            : `/organizer/events/${event.id}/overview`,
        },
        {
          type: "action",
          title: "Stakeholders",
          href: openRound
            ? `/organizer/events/${event.id}/rounds/${openRound.id}/stakeholders`
            : `/organizer/events/${event.id}/overview`,
        },
      ],
      quickReplies: ["Rubric/criteria event", "Event của tôi", "Bulk reminder"],
      fallbackReply: `${event.name} (${event.status}): ${teamCount} teams, ${submissionCount} submissions, ${judgeCount} judge assignments, ${mentorCount} mentor assignments, ${rounds.length} rounds.`,
    };
  }

  private async orgRubric(
    userId: number,
    allEvents: boolean,
    eventId: number | undefined,
    message: string,
  ): Promise<AssistantResolveResult> {
    const event = await this.findManagedEvent(
      userId,
      allEvents,
      eventId,
      message,
    );
    if (!event) {
      return {
        intent: "org_rubric",
        facts: { missing: true },
        cards: [
          {
            type: "action",
            title: "My events",
            href: "/organizer/events",
            primary: true,
          },
        ],
        quickReplies: ["Event của tôi"],
        fallbackReply: "Chỉ tổ chức/admin của event mới xem được rubric setup.",
      };
    }

    const rounds = await this.prisma.round.findMany({
      where: { eventId: event.id },
      select: { id: true, name: true, status: true },
      orderBy: { roundNumber: "asc" },
    });
    const round =
      rounds.find((r) =>
        message.toLowerCase().includes(r.name.toLowerCase()),
      ) || rounds[0];

    if (!round) {
      return {
        intent: "org_rubric",
        facts: { eventId: event.id, name: event.name, criteria: [] },
        cards: [
          {
            type: "action",
            title: event.name,
            href: `/organizer/events/${event.id}/overview`,
            primary: true,
          },
        ],
        quickReplies: ["Tình trạng event này"],
        fallbackReply: `${event.name}: chưa có round/criteria.`,
      };
    }

    const criteria = await this.prisma.criterion.findMany({
      where: { roundId: round.id, trackId: null },
      select: {
        name: true,
        description: true,
        maxScore: true,
        weight: true,
        track: { select: { name: true } },
      },
      orderBy: { id: "asc" },
      take: 40,
    });

    return {
      intent: "org_rubric",
      facts: {
        allowed: true,
        eventId: event.id,
        eventName: event.name,
        roundId: round.id,
        roundName: round.name,
        criteria: criteria.map((c) => ({
          name: c.name,
          description: (c.description || "").slice(0, 220),
          maxScore: Number(c.maxScore),
          weight: Number(c.weight),
          trackName: c.track?.name ?? null,
        })),
      },
      cards: [
        {
          type: "action",
          title: `Criteria · ${round.name}`,
          href: `/organizer/events/${event.id}/rounds/${round.id}/criteria`,
          primary: true,
        },
      ],
      quickReplies: ["Tình trạng event này", "Event của tôi"],
      fallbackReply:
        criteria.length === 0
          ? `${event.name} / ${round.name}: chưa setup criterion.`
          : `${event.name} · ${round.name}: ${criteria.length} tiêu chí đã setup. Mở trang Criteria để chỉnh.`,
    };
  }

  private async findManagedEvent(
    userId: number,
    allEvents: boolean,
    eventId: number | undefined,
    message: string,
  ) {
    if (eventId) {
      return this.prisma.event.findFirst({
        where: {
          id: eventId,
          ...(allEvents ? {} : { createdById: userId }),
        },
        select: { id: true, name: true, status: true },
      });
    }

    const events = await this.prisma.event.findMany({
      where: allEvents ? undefined : { createdById: userId },
      select: { id: true, name: true, status: true },
      take: 40,
    });
    const hit = events.find((e) =>
      message.toLowerCase().includes(e.name.toLowerCase()),
    );
    return hit || null;
  }
}
