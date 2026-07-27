import { redirect } from 'next/navigation';

export default function JudgeEventRedirect({ params }: { params: { eventId: string } }) {
  redirect(`/judge/events/${params.eventId}/dashboard`);
}
