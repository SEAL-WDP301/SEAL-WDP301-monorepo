"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CalendarDays, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { getPublicEvents, isAutomationEvent } from "@/lib/api/public-events.api";

function getLocationLabel(location: unknown) {
    if (!location) return "Online";
    
    let locObj = location;
    if (typeof location === "string") {
        if (!location.trim()) return "Online";
        try {
            locObj = JSON.parse(location);
        } catch {
            return location; // Return raw string if not JSON
        }
    }
    
    if (locObj && typeof locObj === "object") {
        const value = locObj as { name?: string; venueName?: string; meetingPlatform?: string };
        return value.name || value.venueName || value.meetingPlatform || "Online";
    }
    
    return "Online";
}

export default function FeaturedHero() {
    const { data: events, isLoading } = useQuery({
        queryKey: ['publicEvents'],
        queryFn: getPublicEvents,
        staleTime: 5 * 60 * 1000, // 5 minutes
    });

    if (isLoading) {
        return (
            <section className="relative overflow-hidden bg-background py-24 sm:py-32 flex justify-center items-center min-h-[600px]">
                <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-orange-500"></div>
            </section>
        );
    }

    const latestEvent = events?.find(
        event => !isAutomationEvent(event) && (event.status === "active" || event.status === "ongoing")
    ) ?? events?.find(event => !isAutomationEvent(event));

    if (!latestEvent) {
        return null; // or a fallback static hero
    }

    const imageUrl = latestEvent.image_url || latestEvent.imageUrl || latestEvent.icons?.[0]?.url || "/images/rag_system.png";
    
    let formattedDate = `${latestEvent.season || ''} ${latestEvent.year || ''}`;
    let formattedEndDate = "End: TBA";
    try {
        if (latestEvent.registrationDeadline) {
            formattedDate = `Deadline: ${format(new Date(latestEvent.registrationDeadline), "MMM dd, yyyy")}`;
        }
        if (latestEvent.endDate) {
            formattedEndDate = `End: ${format(new Date(latestEvent.endDate), "MMM dd, yyyy")}`;
        }
    } catch {
        // fallback to season/year if parsing fails
    }

    return (
        <section className="relative overflow-hidden bg-background py-24 sm:py-32">
            {/* Background Grid and Glow */}
            <div className="absolute inset-0 seal-grid opacity-50"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-orange-500/10 blur-[120px] pointer-events-none"></div>

            <div className="container relative z-10 mx-auto px-6 lg:px-8 grid gap-12 lg:grid-cols-2 lg:items-center">
                {/* Left Column: Image */}
                <div className="relative aspect-square md:aspect-[4/3] w-full overflow-hidden rounded-2xl border border-border shadow-2xl seal-glow-soft">
                    <Image 
                        src={imageUrl} 
                        alt={latestEvent.name || "Event Image"} 
                        fill 
                        className="object-cover" 
                        sizes="(max-width: 1024px) 100vw, 50vw"
                        priority
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-background/10" />
                    <div className="absolute left-5 top-5 inline-flex items-center gap-2 rounded-full border border-green-400/30 bg-background/80 px-4 py-2 text-sm font-semibold text-green-400 shadow-lg backdrop-blur-md">
                        <span className="relative flex size-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                            <span className="relative inline-flex size-2 rounded-full bg-green-500" />
                        </span>
                        {latestEvent.status === "active" ? "LIVE" : "ONGOING"}
                    </div>
                </div>

                {/* Right Column: Content */}
                <div className="flex flex-col items-start text-left">
                    {/* Headlines */}
                    <h1 className="mb-6 max-w-4xl font-sans text-5xl font-black tracking-tight text-foreground sm:text-6xl lg:text-7xl text-balance">
                        {latestEvent.name}
                    </h1>

                    <p className="mb-10 max-w-2xl text-lg text-muted-foreground sm:text-xl">
                        {latestEvent.description || "Join a community of innovators and future-proof your skills with cutting-edge technologies that are reshaping our digital landscape."}
                    </p>

                    {/* Metadata */}
                    <div className="mb-12 flex flex-wrap items-center gap-6 text-sm font-medium text-muted-foreground">
                        <div className="flex items-center gap-2 rounded-xl bg-card/50 px-4 py-2 border border-border backdrop-blur-sm">
                            <CalendarDays className="size-4 text-orange-500" />
                            <span>{formattedDate}</span>
                        </div>
                        <div className="flex items-center gap-2 rounded-xl bg-card/50 px-4 py-2 border border-border backdrop-blur-sm">
                            <CalendarDays className="size-4 text-orange-500" />
                            <span>{formattedEndDate}</span>
                        </div>
                        <div className="flex items-center gap-2 rounded-xl bg-card/50 px-4 py-2 border border-border backdrop-blur-sm">
                            <MapPin className="size-4 text-orange-500" />
                            <span>{getLocationLabel(latestEvent.location)}</span>
                        </div>
                    </div>

                    {/* CTA */}
                    <Button 
                        asChild
                        size="lg" 
                        className="relative h-14 rounded-lg bg-orange-500 px-8 text-lg font-bold text-primary-foreground transition-all duration-300 hover:scale-105 hover:bg-orange-600 hover:shadow-[0_0_40px_-10px_rgba(243,112,33,0.8)]"
                    >
                        <Link href={`/home/events/${latestEvent.id}`}>
                            View detail
                            <ArrowRight className="size-5" aria-hidden="true" />
                        </Link>
                    </Button>
                </div>
            </div>
        </section>
    );
}
