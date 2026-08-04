/** Flow B: tracks hidden until organizer opens a round. */
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
    return "Đề thi chưa được công bố. Chờ BTC mở vòng để nhận đề và bắt đầu làm bài.";
  }
  return "Đề thi chưa sẵn sàng. Vui lòng chờ organizer cập nhật.";
}

export function getTrackPendingTitle(deferred?: boolean): string {
  return deferred ? "Chưa có đề thi" : "Chưa có đề / track";
}
