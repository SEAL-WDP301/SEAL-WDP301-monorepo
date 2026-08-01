export function shouldSyncGoogleCalendarMeeting({
  createGoogleMeet,
  eventStatus,
  hasExistingMeeting,
}: {
  createGoogleMeet: boolean;
  eventStatus?: string;
  hasExistingMeeting: boolean;
}) {
  return (
    createGoogleMeet && (hasExistingMeeting || eventStatus === "ongoing")
  );
}
