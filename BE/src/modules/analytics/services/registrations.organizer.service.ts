import { Injectable, NotFoundException } from "@nestjs/common";
import { TeamMemberStatus, TeamStatus } from "@prisma/client";
import { AnalyticsOrganizerRepository } from "../repositories/analytics.organizer.repository";
import { OrganizerEventAccessService } from "./organizer-event-access.service";

type RegistrationRecord = NonNullable<
  Awaited<ReturnType<AnalyticsOrganizerRepository["findRegistrationDetails"]>>
>;

@Injectable()
export class RegistrationsOrganizerService {
  constructor(
    private readonly repository: AnalyticsOrganizerRepository,
    private readonly eventAccess: OrganizerEventAccessService,
  ) {}

  async getRegistration(organizerId: number, registrationId: number) {
    const registration = await this.findRegistration(registrationId);
    await this.eventAccess.ensureEventAccess(organizerId, registration.eventId);
    return this.toDetails(registration);
  }

  private async findRegistration(registrationId: number) {
    const registration =
      await this.repository.findRegistrationDetails(registrationId);
    if (!registration) {
      throw new NotFoundException({
        errorCode: "REGISTRATION_NOT_FOUND",
        message: "Registration not found",
      });
    }
    return registration;
  }

  private getMembership(registration: RegistrationRecord) {
    return registration.user.teamMemberships.find(
      (membership) =>
        membership.team.eventId === registration.eventId &&
        membership.status !== TeamMemberStatus.rejected,
    );
  }

  private getStatus(registration: RegistrationRecord) {
    const teamStatus = this.getMembership(registration)?.team.status;
    if (teamStatus === TeamStatus.approved) return "APPROVED";
    if (
      teamStatus === TeamStatus.rejected ||
      teamStatus === TeamStatus.disqualified
    ) {
      return "REJECTED";
    }
    return "PENDING";
  }

  private toAnswers(registration: RegistrationRecord) {
    return [
      { label: "Selected track", value: registration.track.name },
      {
        label: "Registration type",
        value: registration.hasTeam ? "Team" : "Individual",
      },
      ...(registration.skills?.trim()
        ? [
            {
              label: "Skills and experience",
              value: registration.skills.trim(),
            },
          ]
        : []),
    ];
  }

  private toTeam(registration: RegistrationRecord) {
    const membership = this.getMembership(registration);
    if (!membership) return null;

    const team = membership.team;
    const acceptedMembers = team.members.filter(
      (member) => member.status === TeamMemberStatus.accepted,
    );
    const maxMembers = team.track.maxMembersPerTeam;
    const status =
      team.status === TeamStatus.rejected ||
      team.status === TeamStatus.disqualified
        ? "TEAM_DISBANDED"
        : maxMembers && acceptedMembers.length >= maxMembers
          ? "TEAM_FULL"
          : "HAS_TEAM";

    return {
      id: team.id,
      name: team.name,
      status,
      teamStatus: team.status.toUpperCase(),
      role: membership.role === "leader" ? "LEADER" : "MEMBER",
      maxMembers,
      leader: team.leader,
      members: team.members.map((member) => ({
        id: member.id,
        role: member.role.toUpperCase(),
        status: member.status.toUpperCase(),
        joinedAt: member.joinedAt.toISOString(),
        user: member.user,
      })),
    };
  }

  private toHistory(registration: RegistrationRecord) {
    const membership = this.getMembership(registration);
    const history = [
      {
        id: `registration-${registration.id}-submitted`,
        action: "REGISTRATION_SUBMITTED",
        actor: registration.user.name,
        time: registration.createdAt.toISOString(),
        note: null as string | null,
      },
    ];

    if (membership) {
      history.push({
        id: `registration-${registration.id}-team`,
        action: "TEAM_JOINED",
        actor: registration.user.name,
        time: membership.joinedAt.toISOString(),
        note: `Joined ${membership.team.name} as ${membership.role}.`,
      });
    }

    if (registration.reviewedAt) {
      history.push({
        id: `registration-${registration.id}-reviewed`,
        action: `REGISTRATION_${this.getStatus(registration)}`,
        actor:
          registration.reviewedBy?.name ??
          registration.reviewedBy?.email ??
          "Organizer",
        time: registration.reviewedAt.toISOString(),
        note: registration.note,
      });
    }

    return history.sort((a, b) => a.time.localeCompare(b.time));
  }

  private toDetails(registration: RegistrationRecord) {
    const team = this.toTeam(registration);
    const profile = registration.user.studentProfile;
    const status = this.getStatus(registration);
    const completedProfileFields = [
      registration.user.name,
      registration.user.email,
      profile?.studentCode,
      profile?.universityName,
      profile?.phone,
      profile?.githubUsername,
    ].filter(Boolean).length;

    return {
      id: registration.id,
      student: {
        id: registration.user.id,
        fullName: registration.user.name,
        email: registration.user.email,
        studentId: profile?.studentCode ?? "",
        department: "",
        school: profile?.universityName ?? "",
        phone: profile?.phone ?? null,
        avatarUrl: registration.user.avatarUrl,
        profileCompletion: Math.round((completedProfileFields / 6) * 100),
      },
      event: {
        id: registration.event.id,
        name: registration.event.name,
        track: registration.track.name,
        season: registration.event.season,
        year: registration.event.year,
      },
      registeredAt: registration.createdAt.toISOString(),
      eligibility: status === "REJECTED" ? "NOT_ELIGIBLE" : "ELIGIBLE",
      eligibilityReason: status === "REJECTED" ? registration.note : null,
      teamStatus: team?.status ?? "NO_TEAM",
      team,
      status,
      reviewedBy: registration.reviewedBy?.name ?? null,
      reviewedAt: registration.reviewedAt?.toISOString() ?? null,
      rejectionReason: status === "REJECTED" ? registration.note : null,
      answers: this.toAnswers(registration),
      history: this.toHistory(registration),
    };
  }
}
