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
    return "Track và đề thi sẽ được BTC bốc thăm / công bố một lần trước khi thi. Sau khi gán, track giữ nguyên suốt cuộc thi.";
  }
  return "Đề thi chưa sẵn sàng. Vui lòng chờ organizer cập nhật.";
}

export function getTrackPendingTitle(deferred?: boolean): string {
  return deferred ? "Chưa có track / đề thi" : "Chưa có đề / track";
}
