"use client";

import { useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

function GoogleCalendarCallbackContent() {
  const searchParams = useSearchParams();
  const status =
    searchParams.get("status") === "connected" ? "connected" : "error";

  useEffect(() => {
    window.opener?.postMessage(
      { type: "seal-google-calendar", status },
      window.location.origin,
    );
    window.close();
  }, [status]);

  return (
    <main className="grid min-h-screen place-items-center p-6 text-center">
      <div>
        <h1 className="text-xl font-semibold">
          {status === "connected"
            ? "Google Calendar connected"
            : "Google Calendar connection failed"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You can close this window and return to the event form.
        </p>
      </div>
    </main>
  );
}

export default function GoogleCalendarCallbackPage() {
  return (
    <Suspense fallback={null}>
      <GoogleCalendarCallbackContent />
    </Suspense>
  );
}
