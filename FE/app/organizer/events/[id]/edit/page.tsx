"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import EventForm from "../../components/event-form";
import { getOrganizerEvent } from "@/lib/api/organizer-events.api";

export default function EditEventPage() {
    const params = useParams();
    const eventId = params.id as string;

    const { data: event, isLoading, isError } = useQuery({
        queryKey: ['organizerEvent', eventId],
        queryFn: () => getOrganizerEvent(eventId),
    });

    if (isLoading) {
        return (
            <div className="p-8 flex justify-center items-center h-full">
                <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (isError || !event) {
        return (
            <div className="p-8">
                <div className="text-center text-red-500 bg-red-500/10 p-6 rounded-xl border border-red-500/20 max-w-lg mx-auto mt-20">
                    Failed to load event details.
                    <br />
                    <Link href={`/organizer/events/${eventId}`} className="text-blue-500 hover:underline mt-4 block">
                        &larr; Back to Event Control Room
                    </Link>
                </div>
            </div>
        );
    }

    if (event.status !== "draft") {
        return (
            <div className="p-8">
                <div className="mx-auto mt-20 max-w-lg rounded-xl border border-amber-500/20 bg-amber-500/10 p-6 text-center text-amber-500">
                    Event must have Draft status before it can be edited.
                    <Link href={`/organizer/events/${eventId}`} className="mt-4 block text-blue-500 hover:underline">
                        &larr; Back to Event Control Room
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-5xl mx-auto">
            <div className="mb-8">
                <Link href={`/organizer/events/${eventId}`} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Control Room
                </Link>
                <h1 className="text-3xl font-bold text-foreground tracking-tight">Edit Event: {event.name}</h1>
                <p className="text-muted-foreground mt-1 text-sm">
                    Update the general settings and prizes for this event. Tracks and Rounds cannot be edited here.
                </p>
            </div>
            
            <EventForm initialData={event} />
        </div>
    );
}
