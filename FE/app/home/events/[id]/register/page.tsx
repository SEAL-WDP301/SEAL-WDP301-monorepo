"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

/** Legacy route — registration is a popup on the event page. */
export default function EventRegistrationRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.id as string;

  useEffect(() => {
    if (!eventId) return;
    router.replace(`/home/events/${eventId}?register=1`);
  }, [eventId, router]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center bg-background">
      <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-orange-500" />
    </div>
  );
}
