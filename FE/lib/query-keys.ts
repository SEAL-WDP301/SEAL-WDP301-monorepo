export const queryKeys = {
  // User Profile
  user: ['userProfile'] as const,
  pendingInvitations: ['pendingInvitations'] as const,

  // Organizer Events & Management
  organizerEvent: (eventId: string | number) => ['organizerEvent', String(eventId)] as const,
  organizerTeams: (eventId: string | number) => ['organizerTeams', String(eventId)] as const,
  organizerTeamsMessages: (eventId: string | number) => ['organizerTeamsMessages', String(eventId)] as const,
  detailedRankings: (eventId: string | number, roundId: string | number) =>
    ['detailedRankings', String(eventId), String(roundId)] as const,
  submissions: (eventId: string | number, roundId?: string | number) =>
    ['submissions', String(eventId), roundId ? String(roundId) : 'all'] as const,

  // Public Events
  publicEvent: (eventId: string | number) => ['publicEvent', String(eventId)] as const,

  // Student Workspace
  studentEventStatus: (eventId: string | number) => ['studentEventStatus', String(eventId)] as const,
  studentOnlineMeeting: (eventId: string | number) => ['studentOnlineMeeting', String(eventId)] as const,
  studentAssignedMentor: (eventId: string | number) => ['studentAssignedMentor', String(eventId)] as const,
  workspace: (eventId: string | number) => ['workspace', String(eventId)] as const,
  githubCommits: (teamId: string | number) => ['githubCommits', String(teamId)] as const,

  // Stakeholder (Judge / Mentor)
  judgeEvents: ['judgeEvents'] as const,
  mentorTeams: (eventId: string | number) => ['mentorTeams', String(eventId)] as const,
};
