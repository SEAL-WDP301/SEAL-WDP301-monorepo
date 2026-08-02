import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { TeamMemberStatus, TeamStatus } from "@prisma/client";
import { AnalyticsOrganizerRepository } from "../repositories/analytics.organizer.repository";
import { OrganizerEventAccessService } from "./organizer-event-access.service";
import { RegistrationsOrganizerService } from "./registrations.organizer.service";

describe("RegistrationsOrganizerService", () => {
  const repository = { findRegistrationDetails: jest.fn() };
  const eventAccess = { ensureEventAccess: jest.fn() };
  const service = new RegistrationsOrganizerService(
    repository as unknown as AnalyticsOrganizerRepository,
    eventAccess as unknown as OrganizerEventAccessService,
  );

  const registration = {
    id: 12,
    userId: 7,
    eventId: 3,
    hasTeam: true,
    skills: "React, NestJS",
    note: null,
    reviewedAt: null,
    createdAt: new Date("2026-07-01T08:00:00.000Z"),
    reviewedBy: null,
    track: { id: 4, name: "Web" },
    event: {
      id: 3,
      name: "SEAL",
      season: "Summer",
      year: 2026,
      maxMembersPerTeam: 4,
    },
    user: {
      id: 7,
      name: "Student One",
      email: "student@example.com",
      avatarUrl: null,
      studentProfile: {
        studentCode: "SE123",
        studentType: "fpt",
        universityName: "FPT University",
        phone: "0900000000",
        githubUsername: "student-one",
      },
      teamMemberships: [
        {
          role: "leader",
          status: TeamMemberStatus.accepted,
          joinedAt: new Date("2026-07-01T08:05:00.000Z"),
          team: {
            id: 20,
            eventId: 3,
            name: "Seal Team",
            status: TeamStatus.approved,
            leaderId: 7,
            updatedAt: new Date("2026-07-02T08:00:00.000Z"),
            eliminationReason: null,
            leader: {
              id: 7,
              name: "Student One",
              email: "student@example.com",
              avatarUrl: null,
            },
            members: [
              {
                id: 30,
                role: "leader",
                status: TeamMemberStatus.accepted,
                joinedAt: new Date("2026-07-01T08:05:00.000Z"),
                user: {
                  id: 7,
                  name: "Student One",
                  email: "student@example.com",
                  avatarUrl: null,
                  studentProfile: {
                    studentCode: "SE123",
                    universityName: "FPT University",
                  },
                },
              },
            ],
          },
        },
      ],
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    repository.findRegistrationDetails.mockResolvedValue(registration);
    eventAccess.ensureEventAccess.mockResolvedValue(undefined);
  });

  it("uses the newly registered active team instead of an older rejected team", async () => {
    const originalMembership = registration.user.teamMemberships[0];
    repository.findRegistrationDetails.mockResolvedValue({
      ...registration,
      user: {
        ...registration.user,
        teamMemberships: [
          {
            ...originalMembership,
            joinedAt: new Date("2026-07-01T00:00:00.000Z"),
            team: {
              ...originalMembership.team,
              id: 10,
              status: TeamStatus.rejected,
              updatedAt: new Date("2026-07-02T00:00:00.000Z"),
            },
          },
          {
            ...originalMembership,
            joinedAt: new Date("2026-08-01T00:00:00.000Z"),
            team: {
              ...originalMembership.team,
              id: 11,
              name: "Second Chance Team",
              status: TeamStatus.pending,
              updatedAt: new Date("2026-08-01T00:00:00.000Z"),
            },
          },
        ],
      },
    });

    const result = await service.getRegistration(42, registration.id);

    expect(result.status).toBe("PENDING");
    expect(result.team?.id).toBe(11);
  });

  it("returns details containing answers, team and chronological history", async () => {
    const result = await service.getRegistration(42, 12);

    expect(eventAccess.ensureEventAccess).toHaveBeenCalledWith(42, 3);
    expect(result.answers).toEqual(
      expect.arrayContaining([
        { label: "Selected track", value: "Web" },
        { label: "Skills and experience", value: "React, NestJS" },
      ]),
    );
    expect(result.team).toMatchObject({
      id: 20,
      name: "Seal Team",
      role: "LEADER",
      status: "HAS_TEAM",
    });
    expect(result.history.map((item) => item.action)).toEqual([
      "REGISTRATION_SUBMITTED",
      "TEAM_JOINED",
    ]);
  });

  it("returns null for the team endpoint when the student has no team", async () => {
    repository.findRegistrationDetails.mockResolvedValue({
      ...registration,
      hasTeam: false,
      user: { ...registration.user, teamMemberships: [] },
    });
    await expect(service.getRegistration(42, 12)).resolves.toMatchObject({
      team: null,
      teamStatus: "NO_TEAM",
    });
  });

  it("rejects access before returning registration data", async () => {
    eventAccess.ensureEventAccess.mockRejectedValue(new ForbiddenException());
    await expect(service.getRegistration(42, 12)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("returns a structured not-found error", async () => {
    repository.findRegistrationDetails.mockResolvedValue(null);
    await expect(service.getRegistration(42, 999)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
