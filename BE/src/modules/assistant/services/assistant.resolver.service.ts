import { Injectable } from "@nestjs/common";
import {
  EventStatus,
  RoundStatus,
  TeamMemberStatus,
  TeamStatus,
} from "@prisma/client";
import { PrismaService } from "../../../database/prisma/prisma.service";
import type {
  AssistantCard,
  AssistantIntent,
  AssistantResolveResult,
} from "./assistant.types";

type FaqItem = { question: string; answer: string };

@Injectable()
export class AssistantResolverService {
  constructor(private readonly prisma: PrismaService) {}

  async listCatalog() {
    const events = await this.prisma.event.findMany({
      where: {
        status: {
          in: [EventStatus.active, EventStatus.ongoing, EventStatus.closed],
        },
      },
      select: { id: true, name: true },
      orderBy: { createdAt: "desc" },
      take: 40,
    });
    return events;
  }

  async findNewestPublicEventId(): Promise<number | undefined> {
    const event = await this.prisma.event.findFirst({
      where: {
        status: {
          in: [EventStatus.active, EventStatus.ongoing, EventStatus.closed],
        },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    return event?.id;
  }

  async resolve(input: {
    intent: AssistantIntent;
    message: string;
    eventId?: number;
    userId?: number;
  }): Promise<AssistantResolveResult> {
    switch (input.intent) {
      case "list_open_events":
        return this.resolveOpenEvents();
      case "event_overview":
        return this.resolveEventOverview(input.eventId, input.message);
      case "event_deadline":
        return this.resolveDeadlines(input.eventId, input.message);
      case "event_faq":
        return this.resolveFaq(input.eventId, input.message);
      case "how_to_register":
        return this.resolveHowToRegister(input.eventId, input.message);
      case "my_profile":
        return this.resolveMyProfile(input.userId);
      case "my_registrations":
        return this.resolveMyRegistrations(input.userId);
      case "my_team_status":
        return this.resolveMyTeamStatus(input.userId, input.eventId, input.message);
      case "submission_howto":
        return this.resolveSubmissionHowto(
          input.userId,
          input.eventId,
          input.message,
        );
      case "event_staff":
        return this.resolveEventStaff(input.eventId, input.message, input.userId);
      case "event_prizes":
        return this.resolveEventPrizes(input.eventId, input.message);
      case "my_awards":
        return this.resolveMyAwards(input.userId);
      case "my_results":
        return this.resolveMyResults(input.userId, input.eventId, input.message);
      case "blocked_scoring_config":
        return this.resolveBlockedScoringConfig(
          input.userId,
          input.eventId,
          input.message,
        );
      case "out_of_scope":
        return {
          intent: "out_of_scope",
          facts: { outOfScope: true },
          cards: [
            {
              type: "action",
              title: "Xem các event",
              href: "/home",
              primary: true,
            },
          ],
          quickReplies: [
            "Event đang mở",
            "Giải tôi đã đạt",
            "Mentor/Judge event này",
            "Điểm đã công bố",
          ],
          fallbackReply:
            "Mình chỉ hỗ trợ thông tin có trên nền tảng SEAL mà bạn được phép xem (event public, đăng ký, team, kết quả đã công bố). Câu hỏi ngoài hệ thống mình không trả lời được.",
        };
      case "clarify":
      default:
        return this.resolveClarify(input.message);
    }
  }

  private async resolveOpenEvents(): Promise<AssistantResolveResult> {
    const now = new Date();
    const events = await this.prisma.event.findMany({
      where: { status: EventStatus.active },
      select: {
        id: true,
        name: true,
        registrationDeadline: true,
        maxTeams: true,
        status: true,
        season: true,
        year: true,
      },
      orderBy: { registrationDeadline: "asc" },
      take: 20,
    });

    const open = events.filter((e) => {
      if (!e.registrationDeadline) return true;
      return e.registrationDeadline.getTime() >= now.getTime();
    });

    const occupied = open.length
      ? await this.prisma.team.groupBy({
          by: ["eventId"],
          where: {
            eventId: { in: open.map((e) => e.id) },
            status: { in: [TeamStatus.pending, TeamStatus.approved] },
          },
          _count: { _all: true },
        })
      : [];
    const countMap = new Map(
      occupied.map((o) => [o.eventId, o._count._all]),
    );

    const items = open.map((e) => {
      const registered = countMap.get(e.id) || 0;
      const slots =
        e.maxTeams == null ? null : Math.max(0, e.maxTeams - registered);
      const daysLeft = e.registrationDeadline
        ? Math.max(
            0,
            Math.ceil(
              (e.registrationDeadline.getTime() - now.getTime()) /
                (1000 * 60 * 60 * 24),
            ),
          )
        : null;
      return {
        id: e.id,
        name: e.name,
        registrationDeadline: e.registrationDeadline?.toISOString() ?? null,
        daysLeft,
        remainingTeamSlots: slots,
        isFull: slots === 0,
      };
    });

    const cards: AssistantCard[] = items.slice(0, 5).flatMap((e) => [
      {
        type: "event",
        title: e.name,
        subtitle: e.daysLeft != null ? `Còn ~${e.daysLeft} ngày đăng ký` : "Đang mở đăng ký",
        href: `/home/events/${e.id}`,
        primary: true,
      },
      {
        type: "action",
        title: `Đăng ký · ${e.name}`,
        subtitle: e.isFull ? "Đã đủ slot team" : "Tạo / tham gia team",
        href: `/home/events/${e.id}/register`,
      },
    ]);

    return {
      intent: "list_open_events",
      facts: {
        openCount: items.length,
        events: items,
      },
      cards,
      quickReplies: ["Cách đăng ký", "Deadline gần nhất", "Event của tôi"],
      fallbackReply:
        items.length === 0
          ? "Hiện chưa có event nào còn mở đăng ký. Bạn xem lại danh sách event trên trang chủ nhé."
          : `Hiện có ${items.length} event còn mở đăng ký. Bấm "Xem thể lệ" để đọc nội dung cuộc thi trước, rồi đăng ký trên trang event.`,
    };
  }

  private async resolveEventOverview(
    eventId: number | undefined,
    message: string,
  ): Promise<AssistantResolveResult> {
    const event = await this.findEvent(eventId, message);
    if (!event) return this.resolveClarify(message);

    const desc = (event.description || "").replace(/\s+/g, " ").trim();
    const cards: AssistantCard[] = [
      {
        type: "event",
        title: event.name,
        subtitle: "Xem thể lệ & nội dung",
        href: `/home/events/${event.id}`,
        primary: true,
      },
    ];
    if (this.isRegistrationOpen(event)) {
      cards.push({
        type: "action",
        title: "Đăng ký team",
        href: `/home/events/${event.id}/register`,
      });
    }

    const now = new Date();
    const daysLeft = event.registrationDeadline
      ? Math.max(
          0,
          Math.ceil(
            (event.registrationDeadline.getTime() - now.getTime()) /
              (1000 * 60 * 60 * 24),
          ),
        )
      : null;
    const roundSummary = event.rounds.slice(0, 4).map((r) => ({
      name: r.name,
      status: r.status,
      submissionType: r.submissionType,
      submissionDeadline: r.submissionDeadline?.toISOString() ?? null,
    }));
    const prizes = (event.prizes || []).map((p) => ({
      name: p.name,
      description: p.description,
      quantity: p.quantity,
    }));

    return {
      intent: "event_overview",
      facts: {
        eventId: event.id,
        name: event.name,
        status: event.status,
        descriptionPreview: desc.slice(0, 700),
        registrationDeadline:
          event.registrationDeadline?.toISOString() ?? null,
        registrationDaysLeft: daysLeft,
        registrationOpen: this.isRegistrationOpen(event),
        minMembersPerTeam: event.minMembersPerTeam,
        maxMembersPerTeam: event.maxMembersPerTeam,
        tracks: event.tracks.map((t) => t.name),
        rounds: roundSummary,
        prizes,
        summaryInstruction:
          "Summarize this event for the student using description, tracks, deadlines, rounds, and prize names if any. Do NOT invent rubrics or scoring formulas.",
      },
      cards,
      quickReplies: [
        "Deadline đăng ký",
        "Cách đăng ký",
        "FAQ event này",
        "Tóm tắt lại ngắn hơn",
      ],
      fallbackReply: [
        `${event.name} (${event.status}).`,
        desc
          ? desc.slice(0, 280)
          : "Chưa có mô tả chi tiết trên hệ thống — mở trang event để đọc thể lệ.",
        event.tracks.length
          ? `Track: ${event.tracks.map((t) => t.name).join(", ")}.`
          : null,
        event.registrationDeadline
          ? `Hạn đăng ký còn ~${daysLeft} ngày.`
          : null,
        `Team ${event.minMembersPerTeam}-${event.maxMembersPerTeam} thành viên.`,
        "Bấm card để xem thể lệ đầy đủ trước khi đăng ký.",
      ]
        .filter(Boolean)
        .join(" "),
    };
  }

  private async resolveDeadlines(
    eventId: number | undefined,
    message: string,
  ): Promise<AssistantResolveResult> {
    const event = await this.findEvent(eventId, message);
    if (!event) {
      const open = await this.resolveOpenEvents();
      return {
        ...open,
        intent: "event_deadline",
        fallbackReply:
          open.facts.openCount === 0
            ? "Hiện chưa có deadline đăng ký sắp tới từ event đang mở."
            : "Dưới đây là các event còn mở và thời hạn đăng ký. Chọn event để xem chi tiết thể lệ.",
      };
    }

    const now = new Date();
    const regDays = event.registrationDeadline
      ? Math.max(
          0,
          Math.ceil(
            (event.registrationDeadline.getTime() - now.getTime()) /
              (1000 * 60 * 60 * 24),
          ),
        )
      : null;

    const rounds = event.rounds
      .filter((r) => r.submissionDeadline)
      .map((r) => ({
        name: r.name,
        status: r.status,
        submissionDeadline: r.submissionDeadline?.toISOString() ?? null,
        submissionType: r.submissionType,
      }));

    return {
      intent: "event_deadline",
      facts: {
        eventId: event.id,
        name: event.name,
        registrationDeadline:
          event.registrationDeadline?.toISOString() ?? null,
        registrationDaysLeft: regDays,
        registrationOpen: this.isRegistrationOpen(event),
        rounds,
      },
      cards: [
        {
          type: "event",
          title: event.name,
          subtitle: "Xem timeline & thể lệ",
          href: `/home/events/${event.id}`,
          primary: true,
        },
        {
          type: "action",
          title: "Lịch / schedule workspace",
          href: `/student/events/${event.id}/workspace/schedule`,
        },
      ],
      quickReplies: ["Cách đăng ký", "Cách nộp bài", "FAQ event này"],
      fallbackReply: event.registrationDeadline
        ? `${event.name}: hạn đăng ký khoảng ${regDays} ngày nữa (${event.registrationDeadline.toLocaleString("vi-VN")}). Mở trang event để xem đầy đủ các mốc round.`
        : `${event.name}: chưa có registration deadline trên hệ thống. Bạn xem trang event để biết lịch mới nhất.`,
    };
  }

  private async resolveFaq(
    eventId: number | undefined,
    message: string,
  ): Promise<AssistantResolveResult> {
    const event = await this.findEvent(eventId, message);
    if (!event) return this.resolveClarify(message);

    const faqs = this.normalizeFaq(event.faq);
    const matched = this.matchFaq(faqs, message);
    const top = matched.slice(0, 3);

    return {
      intent: "event_faq",
      facts: {
        eventId: event.id,
        name: event.name,
        minMembersPerTeam: event.minMembersPerTeam,
        maxMembersPerTeam: event.maxMembersPerTeam,
        matchedFaq: top,
        faqCount: faqs.length,
        rulesPreview: (event.rules || "").replace(/\s+/g, " ").trim().slice(0, 300),
      },
      cards: [
        {
          type: "event",
          title: `${event.name} · Thể lệ & FAQ`,
          href: `/home/events/${event.id}`,
          primary: true,
        },
        {
          type: "action",
          title: "Rules trong workspace",
          href: `/student/events/${event.id}/workspace/rules`,
        },
      ],
      quickReplies: ["Cách đăng ký", "Deadline", "Event đang mở"],
      fallbackReply:
        top.length > 0
          ? `Theo FAQ của ${event.name}: ${top[0].question} — ${top[0].answer.slice(0, 220)} Bạn nên đọc đầy đủ trên trang event.`
          : `${event.name}: team ${event.minMembersPerTeam}-${event.maxMembersPerTeam} thành viên. Mở trang event để đọc FAQ/thể lệ đầy đủ trước khi đăng ký.`,
    };
  }

  private async resolveHowToRegister(
    eventId: number | undefined,
    message: string,
  ): Promise<AssistantResolveResult> {
    const event = await this.findEvent(eventId, message);
    if (!event) {
      const open = await this.resolveOpenEvents();
      return {
        intent: "how_to_register",
        facts: {
          step: "pick_event_first",
          openEvents: open.facts.events,
        },
        cards: open.cards.slice(0, 4),
        quickReplies: ["Event đang mở", "Deadline gần nhất"],
        fallbackReply:
          "Để đăng ký: chọn event còn mở → đọc thể lệ trên trang event → bấm Đăng ký team. Mình không đăng ký hộ bạn trong chat.",
      };
    }

    const open = this.isRegistrationOpen(event);
    const cards: AssistantCard[] = [
      {
        type: "event",
        title: `Đọc thể lệ · ${event.name}`,
        subtitle: "Nên đọc trước khi đăng ký",
        href: `/home/events/${event.id}`,
        primary: true,
      },
    ];
    if (open) {
      cards.push({
        type: "action",
        title: "Đăng ký team",
        href: `/home/events/${event.id}/register`,
      });
    }

    return {
      intent: "how_to_register",
      facts: {
        eventId: event.id,
        name: event.name,
        registrationOpen: open,
        registrationDeadline:
          event.registrationDeadline?.toISOString() ?? null,
        minMembersPerTeam: event.minMembersPerTeam,
        maxMembersPerTeam: event.maxMembersPerTeam,
        tracks: event.tracks.map((t) => ({ id: t.id, name: t.name })),
        steps: [
          "Open event detail and read rules/FAQ",
          "Click Register and create/join a team",
          "Choose track and invite members if needed",
        ],
      },
      cards,
      quickReplies: ["FAQ event này", "Deadline đăng ký", "Event của tôi"],
      fallbackReply: open
        ? `Đăng ký ${event.name}: (1) mở trang event đọc thể lệ, (2) bấm Đăng ký team, (3) chọn track và mời thành viên (${event.minMembersPerTeam}-${event.maxMembersPerTeam} người). Mình chỉ điều hướng, không đăng ký hộ.`
        : `${event.name} hiện không còn mở đăng ký trên hệ thống. Bạn vẫn có thể xem thể lệ trên trang event.`,
    };
  }

  private async resolveMyProfile(
    userId?: number,
  ): Promise<AssistantResolveResult> {
    if (!userId) {
      return {
        intent: "my_profile",
        facts: { needsLogin: true },
        needsLogin: true,
        cards: [
          {
            type: "action",
            title: "Đăng nhập",
            href: "/login?next=/student/profile",
            primary: true,
          },
        ],
        quickReplies: ["Event đang mở", "Cách đăng ký"],
        fallbackReply:
          "Để xem thông tin cá nhân (tên, email, hồ sơ), hãy đăng nhập trước.",
      };
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatarUrl: true,
        studentProfile: {
          select: {
            studentType: true,
            studentCode: true,
            universityName: true,
            phone: true,
            githubUsername: true,
          },
        },
        stakeholderProfile: {
          select: {
            jobTitle: true,
            organization: true,
            bio: true,
          },
        },
      },
    });

    if (!user) {
      return {
        intent: "my_profile",
        facts: { missing: true },
        cards: [],
        quickReplies: ["Event đang mở"],
        fallbackReply: "Không tìm thấy hồ sơ tài khoản trên hệ thống.",
      };
    }

    const role = String(user.role || "").toLowerCase();
    const profileHref =
      role === "organizer" || role === "admin"
        ? "/organizer/profile"
        : role === "stakeholder"
          ? "/stakeholder/profile"
          : "/student/profile";

    const student = user.studentProfile;
    const stakeholder = user.stakeholderProfile;
    const facts = {
      name: user.name,
      email: user.email,
      role: user.role,
      hasAvatar: Boolean(user.avatarUrl),
      student: student
        ? {
            studentType: student.studentType,
            studentCode: student.studentCode,
            universityName: student.universityName,
            phone: student.phone,
            githubUsername: student.githubUsername,
          }
        : null,
      stakeholder: stakeholder
        ? {
            jobTitle: stakeholder.jobTitle,
            organization: stakeholder.organization,
            bio: stakeholder.bio,
          }
        : null,
    };

    const detailBits: string[] = [
      `Tên: ${user.name}`,
      `Email: ${user.email}`,
      `Vai trò: ${user.role}`,
    ];
    if (student) {
      detailBits.push(`MSSV/mã: ${student.studentCode}`);
      if (student.universityName) {
        detailBits.push(`Trường: ${student.universityName}`);
      }
      if (student.phone) detailBits.push(`SĐT: ${student.phone}`);
      if (student.githubUsername) {
        detailBits.push(`GitHub: ${student.githubUsername}`);
      }
    }
    if (stakeholder) {
      if (stakeholder.jobTitle) detailBits.push(`Chức danh: ${stakeholder.jobTitle}`);
      if (stakeholder.organization) {
        detailBits.push(`Tổ chức: ${stakeholder.organization}`);
      }
    }

    return {
      intent: "my_profile",
      facts,
      cards: [
        {
          type: "info",
          title: user.name,
          subtitle: `${user.email} · ${user.role}`,
          href: profileHref,
          primary: true,
        },
        {
          type: "action",
          title: "Mở trang hồ sơ",
          href: profileHref,
        },
        {
          type: "action",
          title: "Event / team của tôi",
          href: "/home",
        },
      ],
      quickReplies: [
        "Event của tôi",
        "Giải tôi đã đạt",
        "Điểm đã công bố",
      ],
      fallbackReply: `Thông tin tài khoản của bạn trên SEAL: ${detailBits.join(" · ")}. Mở trang hồ sơ để chỉnh sửa.`,
    };
  }

  private async resolveMyRegistrations(
    userId?: number,
  ): Promise<AssistantResolveResult> {
    if (!userId) {
      return {
        intent: "my_registrations",
        facts: { needsLogin: true },
        cards: [
          {
            type: "action",
            title: "Đăng nhập",
            href: "/login?next=/home",
            primary: true,
          },
        ],
        quickReplies: ["Event đang mở", "Cách đăng ký"],
        needsLogin: true,
        fallbackReply:
          "Để xem event/team của bạn, hãy đăng nhập tài khoản sinh viên trước.",
      };
    }

    const memberships = await this.prisma.teamMember.findMany({
      where: { userId, status: TeamMemberStatus.accepted },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            status: true,
            event: { select: { id: true, name: true, status: true } },
          },
        },
      },
      take: 20,
    });

    const led = await this.prisma.team.findMany({
      where: { leaderId: userId },
      select: {
        id: true,
        name: true,
        status: true,
        event: { select: { id: true, name: true, status: true } },
      },
      take: 20,
    });

    const map = new Map<
      number,
      {
        teamId: number;
        teamName: string;
        teamStatus: string;
        eventId: number;
        eventName: string;
        eventStatus: string;
      }
    >();

    for (const t of led) {
      map.set(t.id, {
        teamId: t.id,
        teamName: t.name,
        teamStatus: t.status,
        eventId: t.event.id,
        eventName: t.event.name,
        eventStatus: t.event.status,
      });
    }
    for (const m of memberships) {
      map.set(m.team.id, {
        teamId: m.team.id,
        teamName: m.team.name,
        teamStatus: m.team.status,
        eventId: m.team.event.id,
        eventName: m.team.event.name,
        eventStatus: m.team.event.status,
      });
    }

    const items = [...map.values()];
    const cards: AssistantCard[] = items.slice(0, 6).map((i) => ({
      type: "event",
      title: `${i.eventName} · ${i.teamName}`,
      subtitle: `Team: ${i.teamStatus}`,
      href: `/student/events/${i.eventId}/workspace`,
      primary: true,
    }));

    return {
      intent: "my_registrations",
      facts: { count: items.length, items },
      cards:
        cards.length > 0
          ? cards
          : [
              {
                type: "action",
                title: "Xem event đang mở",
                href: "/home",
                primary: true,
              },
            ],
      quickReplies: ["Cách nộp bài", "Deadline gần nhất", "Event đang mở"],
      fallbackReply:
        items.length === 0
          ? "Bạn chưa có team/event nào. Hãy xem event đang mở, đọc thể lệ, rồi đăng ký trên trang event."
          : `Bạn đang liên kết với ${items.length} team/event. Mở workspace để tiếp tục.`,
    };
  }

  private async resolveMyTeamStatus(
    userId: number | undefined,
    eventId: number | undefined,
    message: string,
  ): Promise<AssistantResolveResult> {
    if (!userId) {
      return this.resolveMyRegistrations(undefined);
    }
    const event = await this.findEvent(eventId, message);
    if (!event) {
      return {
        ...(await this.resolveMyRegistrations(userId)),
        intent: "my_team_status",
        fallbackReply:
          "Bạn đang hỏi status team — chọn giúp event (hoặc hỏi “event của tôi”).",
      };
    }

    const team = await this.prisma.team.findFirst({
      where: {
        eventId: event.id,
        OR: [
          { leaderId: userId },
          { members: { some: { userId, status: TeamMemberStatus.accepted } } },
        ],
      },
      select: {
        id: true,
        name: true,
        status: true,
        track: { select: { name: true } },
      },
    });

    if (!team) {
      return {
        intent: "my_team_status",
        facts: {
          eventId: event.id,
          name: event.name,
          hasTeam: false,
          registrationOpen: this.isRegistrationOpen(event),
        },
        cards: [
          {
            type: "event",
            title: event.name,
            href: `/home/events/${event.id}`,
            primary: true,
          },
          ...(this.isRegistrationOpen(event)
            ? [
                {
                  type: "action" as const,
                  title: "Đăng ký team",
                  href: `/home/events/${event.id}/register`,
                },
              ]
            : []),
        ],
        quickReplies: ["Cách đăng ký", "FAQ event này"],
        fallbackReply: `Trong ${event.name}, bạn chưa thuộc team nào trên hệ thống.`,
      };
    }

    return {
      intent: "my_team_status",
      facts: {
        eventId: event.id,
        eventName: event.name,
        hasTeam: true,
        teamId: team.id,
        teamName: team.name,
        teamStatus: team.status,
        trackName: team.track?.name ?? null,
      },
      cards: [
        {
          type: "action",
          title: "Mở workspace",
          href: `/student/events/${event.id}/workspace`,
          primary: true,
        },
        {
          type: "action",
          title: "My team",
          href: `/student/events/${event.id}/workspace/my-team`,
        },
      ],
      quickReplies: ["Cách nộp bài", "Deadline", "FAQ event này"],
      fallbackReply: `Team ${team.name} ở ${event.name} đang status “${team.status}”${team.track ? ` · track ${team.track.name}` : ""}.`,
    };
  }

  private async resolveSubmissionHowto(
    userId: number | undefined,
    eventId: number | undefined,
    message: string,
  ): Promise<AssistantResolveResult> {
    const event = await this.findEvent(eventId, message);
    if (!event) return this.resolveClarify(message);

    const activeRound =
      event.rounds.find((r) => r.status === RoundStatus.open) ||
      event.rounds.find((r) => r.status === RoundStatus.closed) ||
      event.rounds[0];

    const cards: AssistantCard[] = [
      {
        type: "action",
        title: "Trang nộp bài",
        href: `/student/events/${event.id}/workspace/submissions`,
        primary: true,
      },
      {
        type: "event",
        title: "Xem thể lệ event",
        href: `/home/events/${event.id}`,
      },
    ];

    if (!userId) {
      return {
        intent: "submission_howto",
        facts: {
          needsLogin: true,
          eventId: event.id,
          name: event.name,
          activeRound: activeRound
            ? {
                name: activeRound.name,
                submissionType: activeRound.submissionType,
                submissionDeadline:
                  activeRound.submissionDeadline?.toISOString() ?? null,
              }
            : null,
        },
        cards: [
          {
            type: "action",
            title: "Đăng nhập để nộp bài",
            href: `/login?next=/student/events/${event.id}/workspace/submissions`,
            primary: true,
          },
          ...cards,
        ],
        needsLogin: true,
        quickReplies: ["Event của tôi", "Deadline"],
        fallbackReply: `Nộp bài cho ${event.name} nằm trong workspace sau khi đăng nhập${activeRound ? ` (round ${activeRound.name}, loại ${activeRound.submissionType})` : ""}.`,
      };
    }

    return {
      intent: "submission_howto",
      facts: {
        eventId: event.id,
        name: event.name,
        activeRound: activeRound
          ? {
              name: activeRound.name,
              status: activeRound.status,
              submissionType: activeRound.submissionType,
              submissionDeadline:
                activeRound.submissionDeadline?.toISOString() ?? null,
            }
          : null,
        tip:
          activeRound?.submissionType === "github_link"
            ? "Round này nhận GitHub link"
            : activeRound?.submissionType === "file"
              ? "Round này nhận file đính kèm (zip/pdf/...)"
              : "Xem loại nộp trên trang submissions",
      },
      cards,
      quickReplies: ["Deadline", "Team của tôi", "FAQ event này"],
      fallbackReply: activeRound
        ? `${event.name}: vào Workspace → Submissions để nộp cho “${activeRound.name}” (loại ${activeRound.submissionType}).`
        : `${event.name}: mở Workspace → Submissions để xem round hiện tại.`,
    };
  }

  private async resolveEventStaff(
    eventId: number | undefined,
    message: string,
    userId?: number,
  ): Promise<AssistantResolveResult> {
    const event = await this.findEvent(eventId, message);
    if (!event) return this.resolveClarify(message);

    const judges = await this.prisma.judgeAssignment.findMany({
      where: { round: { eventId: event.id } },
      include: {
        judge: {
          select: {
            id: true,
            name: true,
            stakeholderProfile: {
              select: {
                jobTitle: true,
                organization: true,
                isPublic: true,
              },
            },
          },
        },
        round: { select: { name: true } },
        track: { select: { name: true } },
      },
      take: 40,
    });

    const mentors = await this.prisma.mentorAssignment.findMany({
      where: { team: { eventId: event.id } },
      include: {
        mentor: {
          select: {
            id: true,
            name: true,
            stakeholderProfile: {
              select: {
                jobTitle: true,
                organization: true,
                isPublic: true,
              },
            },
          },
        },
        team: { select: { id: true, name: true } },
      },
      take: 40,
    });

    const judgeMap = new Map<
      number,
      { name: string; title?: string | null; org?: string | null; rounds: string[] }
    >();
    for (const j of judges) {
      const profile = j.judge.stakeholderProfile;
      const showDetails = profile?.isPublic !== false;
      const existing = judgeMap.get(j.judge.id) || {
        name: j.judge.name || "Judge",
        title: showDetails ? profile?.jobTitle : null,
        org: showDetails ? profile?.organization : null,
        rounds: [] as string[],
      };
      const label = [j.round.name, j.track?.name].filter(Boolean).join(" · ");
      if (label && !existing.rounds.includes(label)) existing.rounds.push(label);
      judgeMap.set(j.judge.id, existing);
    }

    const mentorMap = new Map<
      number,
      { name: string; title?: string | null; org?: string | null; teamCount: number }
    >();
    for (const m of mentors) {
      const profile = m.mentor.stakeholderProfile;
      const showDetails = profile?.isPublic !== false;
      const existing = mentorMap.get(m.mentor.id) || {
        name: m.mentor.name || "Mentor",
        title: showDetails ? profile?.jobTitle : null,
        org: showDetails ? profile?.organization : null,
        teamCount: 0,
      };
      existing.teamCount += 1;
      mentorMap.set(m.mentor.id, existing);
    }

    let myMentor: { name: string; teamName: string } | null = null;
    if (userId) {
      const myTeam = await this.prisma.team.findFirst({
        where: {
          eventId: event.id,
          OR: [
            { leaderId: userId },
            { members: { some: { userId, status: TeamMemberStatus.accepted } } },
          ],
        },
        select: {
          name: true,
          mentorAssignments: {
            take: 1,
            include: {
              mentor: { select: { name: true } },
            },
          },
        },
      });
      if (myTeam?.mentorAssignments?.[0]?.mentor?.name) {
        myMentor = {
          name: myTeam.mentorAssignments[0].mentor.name,
          teamName: myTeam.name,
        };
      }
    }

    const judgeList = [...judgeMap.values()].slice(0, 12);
    const mentorList = [...mentorMap.values()].slice(0, 12);

    return {
      intent: "event_staff",
      facts: {
        eventId: event.id,
        name: event.name,
        judgeCount: judgeMap.size,
        mentorCount: mentorMap.size,
        judges: judgeList,
        mentors: mentorList,
        myMentor,
        note: "Only public display names / public profile fields. No emails, no rubric/scoring config.",
      },
      cards: [
        {
          type: "event",
          title: `${event.name} · Thể lệ`,
          href: `/home/events/${event.id}`,
          primary: true,
        },
        ...(userId
          ? [
              {
                type: "action" as const,
                title: "Mentor hub / workspace",
                href: `/student/events/${event.id}/workspace/mentor`,
              },
            ]
          : []),
      ],
      quickReplies: ["Giải thưởng event", "Cách đăng ký", "Điểm đã công bố"],
      fallbackReply:
        judgeMap.size + mentorMap.size === 0
          ? `${event.name}: hiện chưa thấy mentor/judge được gán trên hệ thống (hoặc chưa công bố). Bạn xem trang event hoặc hỏi BTC.`
          : `${event.name}: có ${judgeMap.size} giám khảo và ${mentorMap.size} mentor được gán.${
              myMentor
                ? ` Mentor của team bạn (${myMentor.teamName}): ${myMentor.name}.`
                : ""
            } Chi tiết profile public xem trên platform; mình không lộ cấu hình chấm điểm nội bộ.`,
    };
  }

  private async resolveEventPrizes(
    eventId: number | undefined,
    message: string,
  ): Promise<AssistantResolveResult> {
    const event = await this.findEvent(eventId, message);
    if (!event) return this.resolveClarify(message);

    const prizes = await this.prisma.eventPrize.findMany({
      where: { eventId: event.id },
      select: { name: true, description: true, quantity: true },
      orderBy: { id: "asc" },
    });

    return {
      intent: "event_prizes",
      facts: {
        eventId: event.id,
        name: event.name,
        prizes,
      },
      cards: [
        {
          type: "event",
          title: `${event.name} · Xem thể lệ & giải`,
          href: `/home/events/${event.id}`,
          primary: true,
        },
      ],
      quickReplies: ["Mentor/Judge event này", "Cách đăng ký", "Giải tôi đã đạt"],
      fallbackReply:
        prizes.length === 0
          ? `${event.name}: chưa có danh sách giải thưởng trên hệ thống. Xem trang event để biết cập nhật từ BTC.`
          : `${event.name} có ${prizes.length} hạng mục giải: ${prizes
              .map((p) => p.name)
              .join(", ")}. Mở trang event để đọc mô tả đầy đủ.`,
    };
  }

  private async resolveMyAwards(
    userId?: number,
  ): Promise<AssistantResolveResult> {
    if (!userId) {
      return {
        intent: "my_awards",
        facts: { needsLogin: true },
        needsLogin: true,
        cards: [
          {
            type: "action",
            title: "Đăng nhập",
            href: "/login?next=/home",
            primary: true,
          },
        ],
        quickReplies: ["Event đang mở", "Event của tôi"],
        fallbackReply:
          "Để xem giải thưởng bạn đã đạt, hãy đăng nhập tài khoản sinh viên.",
      };
    }

    const teams = await this.prisma.team.findMany({
      where: {
        awardId: { not: null },
        OR: [
          { leaderId: userId },
          { members: { some: { userId, status: TeamMemberStatus.accepted } } },
        ],
      },
      select: {
        id: true,
        name: true,
        event: { select: { id: true, name: true, status: true } },
        award: { select: { id: true, name: true, description: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 20,
    });

    const items = teams
      .filter((t) => t.award)
      .map((t) => ({
        eventId: t.event.id,
        eventName: t.event.name,
        teamName: t.name,
        awardName: t.award!.name,
        awardDescription: t.award!.description,
      }));

    return {
      intent: "my_awards",
      facts: { count: items.length, awards: items },
      cards:
        items.length > 0
          ? items.slice(0, 6).map((i) => ({
              type: "info" as const,
              title: `Giải: ${i.awardName}`,
              subtitle: `${i.eventName} · team ${i.teamName}${
                i.awardDescription ? ` · ${i.awardDescription}` : ""
              }`,
              href: `/student/events/${i.eventId}/workspace`,
              primary: true,
            }))
          : [
              {
                type: "action",
                title: "Event của tôi",
                href: "/home",
                primary: true,
              },
            ],
      quickReplies: ["Điểm đã công bố", "Event của tôi", "Event đang mở"],
      fallbackReply:
        items.length === 0
          ? "Hiện mình chưa thấy giải thưởng nào gắn với team bạn trên hệ thống. Khi BTC công bố và gán award, bạn hỏi lại hoặc mở workspace event tương ứng."
          : `Bạn đã đạt ${items.length} giải trên SEAL: ${items
              .slice(0, 5)
              .map((i) => `${i.awardName} (${i.eventName}, team ${i.teamName})`)
              .join("; ")}.`,
    };
  }

  private async resolveMyResults(
    userId: number | undefined,
    eventId: number | undefined,
    message: string,
  ): Promise<AssistantResolveResult> {
    if (!userId) {
      return {
        intent: "my_results",
        facts: { needsLogin: true },
        needsLogin: true,
        cards: [
          {
            type: "action",
            title: "Đăng nhập",
            href: "/login?next=/home",
            primary: true,
          },
        ],
        quickReplies: ["Event của tôi", "Giải tôi đã đạt"],
        fallbackReply: "Đăng nhập để xem kết quả/điểm đã được công bố của bạn.",
      };
    }

    const event = eventId ? await this.findEvent(eventId, message) : null;

    const teamRounds = await this.prisma.teamRound.findMany({
      where: {
        round: {
          status: RoundStatus.results_published,
          ...(event ? { eventId: event.id } : {}),
        },
        team: {
          OR: [
            { leaderId: userId },
            {
              members: {
                some: { userId, status: TeamMemberStatus.accepted },
              },
            },
          ],
        },
      },
      select: {
        score: true,
        status: true,
        team: {
          select: {
            name: true,
            event: { select: { id: true, name: true } },
            award: { select: { name: true } },
          },
        },
        round: { select: { id: true, name: true, eventId: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 15,
    });

    const items = teamRounds.map((tr) => ({
      eventId: tr.team.event.id,
      eventName: tr.team.event.name,
      teamName: tr.team.name,
      roundName: tr.round.name,
      score: tr.score != null ? Number(tr.score) : null,
      teamRoundStatus: tr.status,
      awardName: tr.team.award?.name ?? null,
    }));

    if (items.length === 0) {
      return {
        intent: "my_results",
        facts: {
          publishedCount: 0,
          eventId: event?.id ?? null,
          eventName: event?.name ?? null,
        },
        cards: event
          ? [
              {
                type: "event",
                title: event.name,
                href: `/home/events/${event.id}`,
                primary: true,
              },
            ]
          : [
              {
                type: "action",
                title: "Event của tôi",
                href: "/home",
                primary: true,
              },
            ],
        quickReplies: ["Giải tôi đã đạt", "Event của tôi", "Deadline"],
        fallbackReply: event
          ? `${event.name}: chưa có round nào công bố kết quả cho team bạn (hoặc bạn chưa thuộc team). Khi BTC publish results, mình sẽ dẫn bạn tới trang điểm.`
          : "Chưa thấy kết quả đã công bố cho team bạn. Hỏi theo tên event hoặc đợi BTC publish results.",
      };
    }

    return {
      intent: "my_results",
      facts: {
        publishedCount: items.length,
        results: items.map(({ score, ...rest }) => ({
          ...rest,
          hasScore: score != null,
          score,
        })),
        privacyNote:
          "Scores are only linked when round status is results_published. Rubric config stays hidden.",
      },
      cards: items.slice(0, 6).map((i) => ({
        type: "action" as const,
        title: `${i.eventName} · ${i.roundName}`,
        subtitle:
          i.score != null
            ? `Xem điểm đã công bố${i.awardName ? ` · ${i.awardName}` : ""}`
            : "Xem kết quả đã công bố",
        href: `/student/events/${i.eventId}/workspace/submissions`,
        primary: true,
      })),
      quickReplies: ["Giải tôi đã đạt", "Mentor/Judge event này", "Event của tôi"],
      fallbackReply: `Có ${items.length} kết quả đã công bố. Mở trang Submissions/workspace để tự xem điểm — mình không đọc hộ chi tiết rubric nội bộ.`,
    };
  }

  private async resolveBlockedScoringConfig(
    userId: number | undefined,
    eventId: number | undefined,
    message: string,
  ): Promise<AssistantResolveResult> {
    const event = await this.findEvent(eventId, message);
    if (
      userId &&
      /(điểm của tôi|điểm tôi|my score|kết quả của tôi|xem điểm)/i.test(message)
    ) {
      return this.resolveMyResults(userId, event?.id, message);
    }

    const published = event
      ? await this.prisma.round.count({
          where: {
            eventId: event.id,
            status: RoundStatus.results_published,
          },
        })
      : 0;

    const cards: AssistantCard[] = [];
    if (event) {
      cards.push({
        type: "event",
        title: `${event.name} · Thể lệ công khai`,
        href: `/home/events/${event.id}`,
        primary: true,
      });
      if (published > 0 && userId) {
        cards.push({
          type: "action",
          title: "Xem kết quả đã công bố",
          href: `/student/events/${event.id}/workspace/submissions`,
        });
      }
    }

    return {
      intent: "blocked_scoring_config",
      facts: {
        blocked: true,
        reason: "Internal scoring/rubric configuration is not publicly answerable",
        eventId: event?.id ?? null,
        eventName: event?.name ?? null,
        hasPublishedRounds: published > 0,
        allowedAlternative:
          published > 0
            ? "Navigate to published results page for the student's own scores"
            : "Wait until results are published; only public rules/FAQ are available",
      },
      cards,
      quickReplies: [
        "Điểm đã công bố",
        "FAQ event này",
        "Giải thưởng event",
        "Mentor/Judge event này",
      ],
      fallbackReply:
        published > 0
          ? "Mình không giải thích cấu hình chấm/rubric nội bộ do admin setup. Nếu kết quả đã công bố, hãy mở trang điểm/kết quả của bạn trên workspace để tự xem."
          : "Mình không trả lời cách chấm điểm, rubric hay config chấm nội bộ của event. Bạn có thể đọc thể lệ/FAQ công khai; điểm chỉ xem được sau khi BTC công bố kết quả.",
    };
  }

  private async resolveClarify(message: string): Promise<AssistantResolveResult> {
    const normalized = message
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (
      /(thong tin|profile|tai khoan|ho so|toi ten).*(toi|minh)|(toi|minh).*(ten|profile|thong tin)/i.test(
        normalized,
      )
    ) {
      return {
        intent: "clarify",
        facts: {
          missing: true,
          hint: "Prefer my_profile",
          userMessage: message.slice(0, 200),
        },
        cards: [
          {
            type: "action",
            title: "Mở hồ sơ của tôi",
            href: "/student/profile",
            primary: true,
          },
        ],
        quickReplies: ["Thông tin của tôi", "Event của tôi", "Giải tôi đã đạt"],
        fallbackReply:
          "Bạn đang hỏi thông tin cá nhân (tên, email, hồ sơ). Thử hỏi “Thông tin của tôi”. Event đã đăng ký hỏi “Event của tôi”.",
      };
    }
    if (
      /(giai|award|prize|thanh tich).*(toi|minh)|(toi|minh).*(giai|award|prize)/i.test(
        normalized,
      )
    ) {
      return {
        intent: "clarify",
        facts: {
          missing: true,
          hint: "Prefer my_awards",
          userMessage: message.slice(0, 200),
        },
        cards: [
          {
            type: "action",
            title: "Xem giải tôi đã đạt",
            href: "/home",
            primary: true,
          },
        ],
        quickReplies: ["Giải tôi đã đạt", "Điểm đã công bố", "Event của tôi"],
        fallbackReply:
          "Bạn đang hỏi giải/thành tích của chính bạn. Thử hỏi “Giải tôi đã đạt” hoặc “Điểm đã công bố”.",
      };
    }

    const open = await this.resolveOpenEvents();
    return {
      intent: "clarify",
      facts: {
        missing: true,
        hint: "Need event name/context",
        openEvents: open.facts.events,
        userMessage: message.slice(0, 200),
      },
      cards: open.cards.slice(0, 4),
      quickReplies: ["Event đang mở", "Cách đăng ký", "Event của tôi"],
      fallbackReply:
        "Bạn đang hỏi event nào ạ? Chọn một event bên dưới hoặc hỏi “event nào còn mở đăng ký”.",
    };
  }

  private async findEvent(eventId: number | undefined, message: string) {
    if (eventId) {
      return this.loadEventById(eventId);
    }

    const catalog = await this.listCatalog();
    const normalizedMsg = message
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const ranked = [...catalog]
      .map((e) => ({
        e,
        nameNorm: e.name
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9\s]/g, " ")
          .replace(/\s+/g, " ")
          .trim(),
      }))
      .filter((x) => x.nameNorm.length >= 3)
      .sort((a, b) => b.nameNorm.length - a.nameNorm.length);

    for (const { e, nameNorm } of ranked) {
      if (
        normalizedMsg === nameNorm ||
        normalizedMsg.includes(nameNorm)
      ) {
        return this.loadEventById(e.id);
      }
      const tokens = nameNorm.split(" ").filter((t) => t.length >= 3);
      if (
        tokens.length >= 2 &&
        tokens.every((t) => normalizedMsg.includes(t))
      ) {
        return this.loadEventById(e.id);
      }
    }
    return null;
  }

  private loadEventById(eventId: number) {
    return this.prisma.event.findFirst({
      where: {
        id: eventId,
        status: {
          in: [EventStatus.active, EventStatus.ongoing, EventStatus.closed],
        },
      },
      include: {
        tracks: { select: { id: true, name: true } },
        prizes: {
          select: { name: true, description: true, quantity: true },
        },
        rounds: {
          select: {
            id: true,
            name: true,
            status: true,
            submissionType: true,
            submissionDeadline: true,
          },
          orderBy: { roundNumber: "asc" },
        },
      },
    });
  }

  private isRegistrationOpen(event: {
    status: EventStatus;
    registrationDeadline: Date | null;
  }) {
    if (event.status !== EventStatus.active) return false;
    if (!event.registrationDeadline) return true;
    return event.registrationDeadline.getTime() >= Date.now();
  }

  private normalizeFaq(faq: unknown): FaqItem[] {
    if (!Array.isArray(faq)) return [];
    return faq
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const row = item as Record<string, unknown>;
        const question = String(
          row.question || row.q || row.title || "",
        ).trim();
        const answer = String(
          row.answer || row.a || row.content || "",
        ).trim();
        if (!question || !answer) return null;
        return { question, answer };
      })
      .filter((x): x is FaqItem => Boolean(x));
  }

  private matchFaq(faqs: FaqItem[], message: string): FaqItem[] {
    if (faqs.length === 0) return [];
    const tokens = message
      .toLowerCase()
      .split(/[^a-z0-9à-ỹ]+/i)
      .filter((t) => t.length >= 3);
    if (tokens.length === 0) return faqs.slice(0, 3);

    return faqs
      .map((f) => {
        const hay = `${f.question} ${f.answer}`.toLowerCase();
        const score = tokens.reduce(
          (s, t) => (hay.includes(t) ? s + 1 : s),
          0,
        );
        return { f, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.f);
  }
}
