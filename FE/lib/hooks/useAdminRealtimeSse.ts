"use client";

import { useEffect, useRef } from "react";
import { fetchEventSource } from "@microsoft/fetch-event-source";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/stores/auth.store";
import {
  isSseControlPayload,
  parseSseJsonData,
} from "@/lib/sse/parse-sse-data";

interface UseAdminRealtimeSseProps {
  eventId?: number;
  roundId?: number;
  onEventUpdate?: (data: any) => void;
  onRoundUpdate?: (data: any) => void;
}

export function useAdminRealtimeSse({
  eventId,
  roundId,
  onEventUpdate,
  onRoundUpdate,
}: UseAdminRealtimeSseProps = {}) {
  const token = useAuthStore((state) => state.accessToken);
  const queryClient = useQueryClient();
  const baseURL =
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.API_BASE_URL ||
    "http://localhost:3000/api";

  const eventCtrlRef = useRef<AbortController | null>(null);
  const roundCtrlRef = useRef<AbortController | null>(null);

  // Subscribe to Event-level SSE Stream (Team Registrations)
  useEffect(() => {
    if (!token || !eventId) return;

    if (eventCtrlRef.current) {
      eventCtrlRef.current.abort();
    }
    const ctrl = new AbortController();
    eventCtrlRef.current = ctrl;

    const connectEventStream = async () => {
      try {
        await fetchEventSource(`${baseURL}/organizer/events/${eventId}/stream`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "text/event-stream",
          },
          signal: ctrl.signal,
          onmessage(ev) {
            if (!ev.data) return;
            const payload = parseSseJsonData(ev.data);
            if (!payload || isSseControlPayload(payload)) return;

            queryClient.invalidateQueries({ queryKey: ["organizerTeams"] });
            queryClient.invalidateQueries({ queryKey: ["organizerEvent"] });

            if (onEventUpdate) {
              onEventUpdate(payload);
            }
          },
        });
      } catch (err: any) {
        if (err.name !== "AbortError") {
          console.warn("[SSE Admin Event] Stream connection note:", err?.message || err);
        }
      }
    };

    connectEventStream();

    return () => {
      ctrl.abort();
    };
  }, [token, eventId, baseURL, queryClient, onEventUpdate]);

  // Subscribe to Round-level SSE Stream (Submissions)
  useEffect(() => {
    if (!token || !roundId) return;

    if (roundCtrlRef.current) {
      roundCtrlRef.current.abort();
    }
    const ctrl = new AbortController();
    roundCtrlRef.current = ctrl;

    const connectRoundStream = async () => {
      try {
        await fetchEventSource(`${baseURL}/organizer/events/rounds/${roundId}/stream`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "text/event-stream",
          },
          signal: ctrl.signal,
          onmessage(ev) {
            if (!ev.data) return;
            const payload = parseSseJsonData(ev.data);
            if (!payload || isSseControlPayload(payload)) return;

            queryClient.invalidateQueries({ queryKey: ["organizerSubmissions"] });
            queryClient.invalidateQueries({ queryKey: ["organizerRound"] });

            if (onRoundUpdate) {
              onRoundUpdate(payload);
            }
          },
        });
      } catch (err: any) {
        if (err.name !== "AbortError") {
          console.warn("[SSE Admin Round] Stream connection note:", err?.message || err);
        }
      }
    };

    connectRoundStream();

    return () => {
      ctrl.abort();
    };
  }, [token, roundId, baseURL, queryClient, onRoundUpdate]);
}
