import { redirect } from "next/navigation";

export default async function OrganizerEventRoot({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  redirect(`/organizer/events/${resolvedParams.id}/overview`);
}
