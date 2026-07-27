"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { CalendarDays, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { getPublicEvents, isAutomationEvent } from "@/lib/api/public-events.api";
import type { OrganizerEvent } from "@/lib/api/organizer-events.api";

const EVENT_SEASONS = ["All", "Spring", "Summer", "Fall"];

export default function PastEvents() {
    const [activeTab, setActiveTab] = useState("All");

    const { data: events, isLoading, isError } = useQuery({
      queryKey: ['publicEvents'],
      queryFn: getPublicEvents,
      staleTime: 5 * 60 * 1000, // 5 minutes
    });

    const publicEvents = events ?? [];
    const filteredEvents = activeTab === "All"
        ? publicEvents
        : publicEvents.filter((event) => event.season === activeTab);

    return (
        <section className="bg-background pb-32 pt-20 sm:pb-36">
            <div className="container mx-auto px-6 lg:px-8">
                {/* Section Header */}
                <div className="mb-12 border-b border-border pb-6">
                    <h2 className="text-3xl font-semibold text-foreground">Our Competitions</h2>
                    <p className="mt-2 text-muted-foreground">Explore events and see what our community has built.</p>
                </div>

                {/* Filter / Tabs */}
                <div className="mb-10 flex flex-wrap gap-2">
                    {EVENT_SEASONS.map(season => (
                        <button
                            key={season}
                            onClick={() => setActiveTab(season)}
                            className={`rounded-full px-5 py-2 text-sm font-medium transition-all ${
                                activeTab === season 
                                    ? "bg-orange-500 text-primary-foreground" 
                                    : "bg-card text-muted-foreground hover:bg-card/80 hover:text-foreground border border-border"
                            }`}
                        >
                            {season}
                        </button>
                    ))}
                </div>

                {/* Loading State */}
                {isLoading && (
                    <div className="flex justify-center items-center h-40">
                        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-orange-500"></div>
                    </div>
                )}

                {isError && (
                    <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-6 py-5 text-sm text-red-200">
                        Không tải được danh sách event. Kiểm tra backend API `/public/events` và biến môi trường `NEXT_PUBLIC_API_BASE_URL`.
                    </div>
                )}

                {!isLoading && !isError && filteredEvents.length === 0 && (
                    <div className="rounded-2xl border border-border bg-card/50 px-6 py-8 text-sm text-muted-foreground">
                        Chưa có event public nào cho bộ lọc này. Nếu bạn vừa tạo event trong organizer, hãy kiểm tra status của event không còn là draft.
                    </div>
                )}

                {/* Grid */}
                {!isLoading && !isError && filteredEvents.length > 0 && (
                    <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                        {filteredEvents.map((event: OrganizerEvent) => (
                            <div 
                                key={event.id} 
                                className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card/50 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-orange-500/50 hover:shadow-2xl hover:shadow-orange-500/10"
                            >
                                {/* Header Image (16:9) */}
                                <div className="relative aspect-video w-full overflow-hidden bg-muted flex items-center justify-center">
                                    {(event.imageUrl || event.image_url || event.icons?.[0]?.url) ? (
                                        <img 
                                            src={event.imageUrl || event.image_url || event.icons?.[0]?.url || ""} 
                                            alt={event.name} 
                                            className="absolute inset-0 h-full w-full object-cover"
                                        />
                                    ) : (
                                        <>
                                            {/* Fallback pattern for events without images */}
                                            <div className="absolute inset-0 opacity-20 seal-grid"></div>
                                            <span className="text-4xl font-bold text-muted-foreground/30 relative z-10">{event.season} {event.year}</span>
                                        </>
                                    )}
                                    
                                </div>

                                {/* Content */}
                                <div className="flex flex-1 flex-col p-6">
                                    {/* Tags */}
                                    <div className="mb-3 flex flex-wrap gap-2">
                                        <span className="text-xs font-semibold text-orange-500">
                                            #{event.season}
                                        </span>
                                        {event.status === 'closed' && (
                                            <span className="text-xs font-semibold text-muted-foreground">
                                                #Finished
                                            </span>
                                        )}
                                        {event.status === 'active' && (
                                            <span className="text-xs font-semibold text-blue-500">
                                                #Active
                                            </span>
                                        )}
                                        {event.status === 'ongoing' && (
                                            <span className="text-xs font-semibold text-yellow-500">
                                                #Ongoing
                                            </span>
                                        )}
                                    </div>

                                    {/* Title */}
                                    <h3 className="mb-3 text-xl font-bold text-card-foreground transition-colors duration-300 group-hover:text-orange-500">
                                        {event.name}
                                    </h3>

                                    {/* Description */}
                                    <p className="mb-6 text-sm text-muted-foreground line-clamp-3">
                                        {event.description}
                                    </p>

                                    <div className="mb-6 flex flex-wrap gap-2 text-xs font-medium text-muted-foreground">
                                        <div className="flex items-center gap-2 rounded-lg border border-border px-2 py-2">
                                            <Calendar className="size-4 shrink-0 text-orange-500" />
                                            <span className="truncate">Reg: {event.registrationDeadline ? format(new Date(event.registrationDeadline), 'MMM dd, yyyy') : 'TBA'}</span>
                                        </div>
                                        <div className="flex items-center gap-2 rounded-lg border border-border px-2 py-2">
                                            <CalendarDays className="size-4 shrink-0 text-orange-500" />
                                            <span className="truncate">End: {event.endDate ? format(new Date(event.endDate), 'MMM dd, yyyy') : 'TBA'}</span>
                                        </div>
                                    </div>

                                    {/* Footer Card */}
                                    <div className="mt-auto flex items-center justify-between border-t border-border pt-4">
                                        <span className={`text-sm font-medium flex items-center gap-1.5 ${
                                            event.status === 'active' ? 'text-blue-500' :
                                            event.status === 'ongoing' ? 'text-yellow-500' :
                                            event.status === 'closed' ? 'text-muted-foreground' : 'text-muted-foreground'
                                        }`}>
                                            <span className={`size-2 rounded-full ${
                                                event.status === 'active' ? 'bg-blue-500 animate-pulse' :
                                                event.status === 'ongoing' ? 'bg-yellow-500 animate-pulse' :
                                                event.status === 'closed' ? 'bg-muted-foreground' : 'bg-muted-foreground'
                                            }`}></span>
                                            {event.status === 'closed' ? 'Ended' : event.status === 'active' ? 'Registration Open' : 'Ongoing'}
                                        </span>
                                        <Link href={`/home/events/${event.id}`}>
                                            <Button 
                                                variant="outline" 
                                                size="sm" 
                                                className="border-border bg-transparent text-foreground hover:bg-foreground hover:text-background"
                                            >
                                                View Details
                                            </Button>
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
}
