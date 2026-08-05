/** Parse SSE `data:` payload; returns null for heartbeats / non-JSON noise. */
export function parseSseJsonData(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.startsWith(":")) return null;
  if (!(trimmed.startsWith("{") || trimmed.startsWith("["))) return null;

  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function isSseControlPayload(data: Record<string, unknown>): boolean {
  const type = data.type;
  return type === "ping" || type === "connected" || type === "heartbeat";
}
