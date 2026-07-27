import { axiosClient } from "@/lib/axios";
import type { OrganizerEvent } from "@/lib/api/organizer-events.api";

export type PublicEvent = OrganizerEvent & {
  imageUrl?: string | null;
};

type PublicEventsResponse =
  | PublicEvent[]
  | {
    data?: PublicEvent[] | { events?: PublicEvent[] };
    events?: PublicEvent[];
  };

function normalizePublicEvents(payload: PublicEventsResponse): PublicEvent[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.events)) return payload.events;
  if (payload.data && !Array.isArray(payload.data) && Array.isArray(payload.data.events)) {
    return payload.data.events;
  }
  return [];
}

export function isAutomationEvent(event: PublicEvent): boolean {
  const searchableText = `${event.name} ${event.description ?? ""}`;
  return /\bE2E\b|automation scripts?/i.test(searchableText);
}

export async function getPublicEvents() {
  const res = await axiosClient.get<PublicEventsResponse>("/public/events");
  return normalizePublicEvents(res.data);
}

export async function getPublicEvent(eventId: string | number) {
  const res = await axiosClient.get<{ data: PublicEvent }>(
    `/public/events/${eventId}`,
  );
  return res.data.data;
}
