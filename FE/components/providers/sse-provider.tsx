"use client";

import React, { useEffect, useRef, useState } from "react";
import { fetchEventSource } from "@microsoft/fetch-event-source";
import { useQueryClient } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/lib/stores/auth.store";
import { axiosClient } from "@/lib/axios";

const baseURL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000/api";

class FatalError extends Error {}

export function SseProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const ctrlRef = useRef<AbortController | null>(null);
  const pathname = usePathname();
  const [tokenVersion, setTokenVersion] = useState(0);

  useEffect(() => {
    const handleTokenRefreshed = () => setTokenVersion(v => v + 1);
    window.addEventListener('token-refreshed', handleTokenRefreshed);
    return () => window.removeEventListener('token-refreshed', handleTokenRefreshed);
  }, []);

  useEffect(() => {
    // Only connect if we have a token and are not on an auth page
    const token = useAuthStore.getState().accessToken;
    
    if (!token || pathname.startsWith('/auth')) {
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
            if (response.ok && response.headers.get('content-type')?.includes('text/event-stream')) {
              return; // everything's good
            } else if (response.status === 401) {
              // Trigger a token refresh via axios interceptor
              axiosClient.get('/users/profile').catch(() => {});
              // Stop this connection, wait for token-refreshed event to trigger a reconnect
              throw new FatalError("Unauthorized - token expired");
            } else if (response.status >= 400 && response.status < 500 && response.status !== 429) {
              // client-side errors are usually non-retriable:
              throw new FatalError(`SSE Connection failed with status: ${response.status}`);
            } else {
              // fallback to let it retry or fail
              throw new Error("Unexpected response from SSE endpoint");
            }
          },
          onmessage(ev) {
            try {
              if (!ev.data) return;
              const data = JSON.parse(ev.data);
              
              enqueueSnackbar(data.title || "You have a new notification!", {
                variant: "info",
                autoHideDuration: 5000,
                key: data.id ? `notification-${data.id}` : undefined,
                preventDuplicate: true,
              });

              queryClient.invalidateQueries({ queryKey: ["userNotifications"] });
            } catch (e) {
              console.error("Failed to parse SSE data", e);
            }
          },
          onerror(err) {
            if (err instanceof FatalError) {
              throw err; // Rethrow to stop retries entirely
            }
            // For other errors, do nothing to automatically retry
          },
          onclose() {
            // Connection closed by server
          }
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
  }, [queryClient, pathname, tokenVersion]);

  return <>{children}</>;
}
