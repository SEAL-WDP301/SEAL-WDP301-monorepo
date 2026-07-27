"use client";

import { useQuery } from "@tanstack/react-query";

import {
  OnlineMeetingCard,
  type OnlineMeetingDetails,
} from "@/components/events/online-meeting-card";
import { getPublicEvent } from "@/lib/api/public-events.api";

function getLocationMeeting(location?: string | null): OnlineMeetingDetails | null {
  if (!location) return null;

  try {
    const parsed = JSON.parse(location) as {
      meetingPlatform?: string;
      meetingUrl?: string;
    };
    return parsed.meetingUrl
      ? { platform: parsed.meetingPlatform, meetUrl: parsed.meetingUrl }
      : null;
  } catch {
    return null;
  }
}

export function PublicEventOnlineMeetingCard({
  eventId,
}: {
  eventId: string | number;
}) {
  const { data: event } = useQuery({
    queryKey: ["publicEvent", String(eventId)],
    queryFn: () => getPublicEvent(eventId),
    retry: false,
  });

  return (
    <OnlineMeetingCard
      meeting={
        event?.calendarMeeting || getLocationMeeting(event?.location) || null
      }
      eventStatus={event?.status}
    />
  );
}
