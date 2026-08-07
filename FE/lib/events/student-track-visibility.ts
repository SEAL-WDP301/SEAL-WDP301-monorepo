/** Flow B: tracks hidden until organizer reveals (lottery) or first round opens. */
export function isDeferredTrackEvent(
  event?: { deferredTrackAssignment?: boolean | null } | null,
): boolean {
  return Boolean(event?.deferredTrackAssignment);
}

/** Track name is shown only after the team has been assigned a track. */
export function getVisibleStudentTrackName(opts: {
  trackName?: string | null;
  trackPending?: boolean;
  teamTrackId?: number | null;
}): string | undefined {
  if (opts.trackPending || opts.teamTrackId == null) return undefined;
  const name = opts.trackName?.trim();
  return name || undefined;
}

export function getTrackPendingMessage(deferred?: boolean): string {
  if (deferred) {
    return "The organizer will draw or announce the track and problem statement once before the competition. The assigned track remains unchanged throughout the event.";
  }
  return "The problem statement is not ready. Please wait for the organizer to update it.";
}

export function getTrackPendingTitle(deferred?: boolean): string {
  return deferred ? "No track or problem statement assigned" : "No problem statement or track available";
}
