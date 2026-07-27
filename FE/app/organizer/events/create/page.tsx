"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import EventForm from "../components/event-form";

export default function CreateEventPage() {
    return (
        <div className="p-8 max-w-7xl mx-auto">
            <div className="mb-8">
                <Link href="/organizer/events" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Events
                </Link>
                <h1 className="text-3xl font-bold text-foreground tracking-tight">Create New Event</h1>
                <p className="text-muted-foreground mt-1 text-sm">
                    Set up a new hackathon, define tracks, and configure rounds.
                </p>
            </div>
            
            <EventForm />
        </div>
    );
}
