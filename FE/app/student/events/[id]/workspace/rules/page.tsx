"use client";

import { useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

export default function WorkspaceRulesPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const eventId = params.id as string;
  const roundId = searchParams.get("roundId");

  useEffect(() => {
    const targetUrl = `/student/events/${eventId}/workspace/submissions${roundId ? `?roundId=${roundId}` : ""}`;
    router.replace(targetUrl);
  }, [eventId, roundId, router]);

  return null;
}
