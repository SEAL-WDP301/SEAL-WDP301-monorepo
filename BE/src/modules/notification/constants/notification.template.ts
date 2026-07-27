import { NotificationType } from "@prisma/client";

export const NotificationTemplates = {
  [NotificationType.registration_received]: (eventName: string) => ({
    title: "Registration Received",
    content: `We have received your registration for ${eventName}. It is currently under review.`,
  }),
  [NotificationType.registration_approved]: (eventName: string) => ({
    title: "Registration Approved",
    content: `Congratulations! Your registration for ${eventName} has been approved.`,
  }),
  [NotificationType.registration_rejected]: (eventName: string, reason?: string) => ({
    title: "Registration Rejected",
    content: `We regret to inform you that your registration for ${eventName} has been rejected.${reason ? ` Reason: ${reason}` : ""}`,
  }),
  [NotificationType.team_assigned]: (status: string, reason?: string) => ({
    title: `Team Status Updated: ${status}`,
    content: `Your team status has been updated to ${status}.${reason ? ` Reason: ${reason}` : ""}`,
  }),
  [NotificationType.round_opened]: (roundName: string) => ({
    title: "Round Opened",
    content: `The round ${roundName} is now open. You can start submitting your work.`,
  }),
  [NotificationType.round_result]: (teamName: string, roundName: string, trackName: string, isAdvanced: boolean) => ({
    title: isAdvanced ? `Advanced from ${roundName}` : `Round result: ${roundName}`,
    content: isAdvanced
      ? `Congratulations! Team "${teamName}" advanced from ${roundName} in ${trackName}.`
      : `Team "${teamName}" did not advance from ${roundName} in ${trackName}.`,
  }),
  [NotificationType.finalist]: (teamName: string) => ({
    title: "Finalist Announcement",
    content: `Congratulations! Team "${teamName}" has been selected as a finalist.`,
  }),
  [NotificationType.final_result]: (teamName: string, result: string) => ({
    title: "Final Result",
    content: `The final result for team "${teamName}" is: ${result}.`,
  }),
  [NotificationType.judge_assigned]: (eventName: string, roundName: string) => ({
    title: "Assigned as Judge",
    content: `You have been assigned as a judge for ${roundName} in event ${eventName}.`,
  }),
  [NotificationType.mentor_assigned]: (eventName: string, teamName: string) => ({
    title: "Assigned as Mentor",
    content: `You have been assigned as a mentor for team "${teamName}" in event ${eventName}.`,
  }),
  [NotificationType.team_invite_accepted]: (userName: string, teamName: string) => ({
    title: "Team Invitation Accepted",
    content: `${userName} has accepted the invitation to join team "${teamName}".`,
  }),
  [NotificationType.team_invite_rejected]: (userName: string, teamName: string) => ({
    title: "Team Invitation Rejected",
    content: `${userName} has rejected the invitation to join team "${teamName}".`,
  }),
  [NotificationType.team_leadership_transfer]: (teamName: string) => ({
    title: "Leadership Transferred",
    content: `You are now the leader of team "${teamName}".`,
  }),
  [NotificationType.deadline_reminder]: (taskName: string, deadline: string) => ({
    title: "Deadline Reminder",
    content: `Reminder: The deadline for ${taskName} is ${deadline}.`,
  }),
  [NotificationType.github_repo_created]: (repoUrl: string) => ({
    title: "GitHub Repository Ready",
    content: `Your team repository has been created. Push your project code to this repository before the submission deadline.`,
  }),
  [NotificationType.bulk_reminder_unsubmitted]: (teamName: string, roundName: string, eventName: string, deadline: string, timeRemaining: string) => ({
    title: `⚠️ Urgent Reminder: Submission Deadline for ${roundName}`,
    content: `Hello ${teamName} team members,\n\nThis is a reminder that your team HAS NOT YET SUBMITTED for the ${roundName} round of ${eventName}.\n\n⏰ Deadline: ${deadline}\n⏳ Time Remaining: ${timeRemaining}\n\nPlease submit your files or code repositories before the deadline. Submissions after this time will not be accepted and may lead to elimination.`,
  }),
  [NotificationType.bulk_reminder_submitted]: (teamName: string, roundName: string, eventName: string, deadline: string, timeRemaining: string) => ({
    title: `ℹ️ Reminder: Review your submission for ${roundName}`,
    content: `Hello ${teamName} team members,\n\nWe have received your submission for the ${roundName} round of ${eventName}.\n\n⏰ The system will close at: ${deadline}\n⏳ Time Remaining: ${timeRemaining}\n\nWe recommend that you double-check your uploaded files and links to ensure judges can access them. You can still make changes until the deadline.`,
  }),
  [NotificationType.event_published]: (eventName: string, startTime: string) => ({
    title: `New event: ${eventName}`,
    content: `${eventName} starts ${startTime}. View the event page for schedule and meeting details.`,
  }),
};
