"use client";

import React, { useEffect, useRef, useState } from "react";
import { fetchEventSource } from "@microsoft/fetch-event-source";
import { useQueryClient } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/lib/stores/auth.store";
import { axiosClient } from "@/lib/axios";
import { Bell } from "lucide-react";
import {
  isSseControlPayload,
  parseSseJsonData,
} from "@/lib/sse/parse-sse-data";

const baseURL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000/api";

class FatalError extends Error {}

export function SseProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const ctrlRef = useRef<AbortController | null>(null);
  const pathname = usePathname();
  const [tokenVersion, setTokenVersion] = useState(0);

  // Reactively subscribe to accessToken from Zustand store
  const token = useAuthStore((state) => state.accessToken);

  useEffect(() => {
    const handleTokenRefreshed = () => setTokenVersion((v) => v + 1);
    window.addEventListener("token-refreshed", handleTokenRefreshed);
    return () => window.removeEventListener("token-refreshed", handleTokenRefreshed);
  }, []);

  useEffect(() => {
    // Only connect if we have a token and are not on an auth page
    if (!token || pathname.startsWith("/auth") || pathname.startsWith("/login") || pathname.startsWith("/register")) {
      return;
    }

    if (ctrlRef.current) {
      ctrlRef.current.abort();
    }

    ctrlRef.current = new AbortController();

    const connect = async () => {
      try {
        await fetchEventSource(`${baseURL}/notifications/stream`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "text/event-stream",
          },
          signal: ctrlRef.current?.signal,
          async onopen(response) {
            if (response.ok && response.headers.get("content-type")?.includes("text/event-stream")) {
              return; // everything's good
            } else if (response.status === 401) {
              // Trigger a token refresh via axios interceptor
              axiosClient.get("/users/profile").catch(() => {});
              throw new FatalError("Unauthorized - token expired");
            } else if (response.status >= 400 && response.status < 500 && response.status !== 429) {
              throw new FatalError(`SSE Connection failed with status: ${response.status}`);
            } else {
              throw new Error("Unexpected response from SSE endpoint");
            }
          },
          onmessage(ev) {
            if (!ev.data) return;

            const data = parseSseJsonData(ev.data);
            if (!data || isSseControlPayload(data)) return;

            const title =
              typeof data.title === "string" ? data.title : "New Notification";
            const content =
              typeof data.content === "string" ? data.content : undefined;
            const id = typeof data.id === "number" ? data.id : undefined;

            enqueueSnackbar(
              <div className="flex flex-col gap-1 max-w-sm">
                <div className="font-bold text-sm text-foreground flex items-center gap-2">
                  <Bell className="size-4 text-orange-500 shrink-0 animate-bounce" />
                  <span>{title}</span>
                </div>
                {content && (
                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                    {content}
                  </p>
                )}
              </div>,
              {
                variant: "default",
                autoHideDuration: 6000,
                key: id ? `notification-${id}` : `notif-${Date.now()}`,
                preventDuplicate: true,
                anchorOrigin: { vertical: "top", horizontal: "right" },
              },
            );

            queryClient.invalidateQueries({ queryKey: ["userNotifications"] });
          },
          onerror(err) {
            if (err instanceof FatalError) {
              throw err;
            }
          },
          onclose() {
            // Connection closed by server
          },
        });
      } catch {
        // Fatal error outside fetchEventSource
      }
    };

    connect();

    return () => {
      if (ctrlRef.current) {
        ctrlRef.current.abort();
        ctrlRef.current = null;
      }
    };
  }, [token, queryClient, pathname, tokenVersion]);

  return <>{children}</>;
}
