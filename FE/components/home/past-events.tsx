"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { CalendarDays, Calendar, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { getPublicEvents } from "@/lib/api/public-events.api";
import type { OrganizerEvent } from "@/lib/api/organizer-events.api";
import { TeamCapacity } from "@/components/events/team-capacity";

const EVENT_SEASONS = ["All", "Spring", "Summer", "Fall"];

export default function PastEvents() {
  const [activeTab, setActiveTab] = useState("All");

  const { data: events, isLoading, isError } = useQuery({
    queryKey: ["publicEvents"],
    queryFn: getPublicEvents,
    staleTime: 5 * 60 * 1000,
  });

  const publicEvents = events ?? [];
  const filteredEvents =
    activeTab === "All"
      ? publicEvents
      : publicEvents.filter((event) => event.season === activeTab);

  const getStatusBadge = (status?: string) => {
    if (!status) return null;
    switch (status) {
      case "active":
        return (
          <Badge className="bg-emerald-500/90 text-white font-bold text-[11px] px-3 py-1 shadow-md backdrop-blur-md border border-emerald-400/30 flex items-center gap-1.5 rounded-full">
            <span className="relative flex size-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-white" />
            </span>
            REGISTRATION OPEN
          </Badge>
        );
      case "ongoing":
        return (
          <Badge className="bg-amber-500/90 text-white font-bold text-[11px] px-3 py-1 shadow-md backdrop-blur-md border border-amber-400/30 flex items-center gap-1.5 rounded-full">
            <span className="relative flex size-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-300 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-white" />
            </span>
            ONGOING
          </Badge>
        );
      case "closed":
      case "completed":
        return (
          <Badge className="bg-muted/80 text-muted-foreground font-semibold text-[11px] px-3 py-1 shadow-sm backdrop-blur-md border border-border rounded-full">
            FINISHED
          </Badge>
        );
      default:
        return (
          <Badge className="bg-blue-500/90 text-white font-semibold text-[11px] px-3 py-1 shadow-sm backdrop-blur-md border border-blue-400/30 rounded-full">
            {status.toUpperCase()}
          </Badge>
        );
    }
  };

  return (
    <section className="bg-background pb-32 pt-16 sm:pb-36">
      <div className="container mx-auto px-6 lg:px-12">
        {/* Section Header */}
        <div className="mb-10 border-b border-border pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Our Competitions
            </h2>
            <p className="mt-2 text-muted-foreground text-sm sm:text-base">
              Explore hackathons and see what our community has built.
            </p>
          </div>

          {/* Filter / Tabs */}
          <div className="flex flex-wrap gap-2">
            {EVENT_SEASONS.map((season) => (
              <button
                key={season}
                onClick={() => setActiveTab(season)}
                className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                  activeTab === season
                    ? "bg-orange-500 text-white shadow-md shadow-orange-500/20"
                    : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground border border-border"
                }`}
              >
                {season}
              </button>
            ))}
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex justify-center items-center h-48">
            <div className="h-9 w-9 animate-spin rounded-full border-b-2 border-orange-500"></div>
          </div>
        )}

        {isError && (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-6 py-5 text-sm text-red-400">
            Failed to load public competitions list. Please check your network connection.
          </div>
        )}

        {!isLoading && !isError && filteredEvents.length === 0 && (
          <div className="rounded-2xl border border-border bg-card/50 px-6 py-10 text-center text-sm text-muted-foreground">
            No public competitions found matching the selected season filter.
          </div>
        )}

        {/* Grid */}
        {!isLoading && !isError && filteredEvents.length > 0 && (
          <div className="grid gap-8 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {filteredEvents.map((event: OrganizerEvent) => {
              const eventImageUrl =
                event.imageUrl || event.image_url || event.icons?.[0]?.url || "";

              return (
                <Link
                  key={event.id}
                  href={`/home/events/${event.id}`}
                  className="group flex flex-col overflow-hidden rounded-3xl border border-border/80 bg-card/60 backdrop-blur-xl shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:border-orange-500/40 hover:shadow-2xl hover:shadow-orange-500/10 cursor-pointer block text-left"
                >
                  {/* Header Image (16:9) */}
                  <div className="relative aspect-video w-full overflow-hidden bg-muted">
                    {eventImageUrl ? (
                      <img
                        src={eventImageUrl}
                        alt={event.name}
                        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center bg-muted/60">
                        <span className="text-3xl font-black text-muted-foreground/30">
                          {event.season} {event.year}
                        </span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent opacity-60" />

                    {/* Top Overlay Badge */}
                    <div className="absolute left-4 top-4 z-10">
                      {getStatusBadge(event.status)}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex flex-1 flex-col p-6">
                    {/* Season Tag */}
                    <div className="mb-2.5 flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-[10px] font-extrabold uppercase tracking-wider text-orange-500">
                        {event.season} Season
                      </span>
                    </div>

                    {/* Title with word-break safety */}
                    <h3 className="mb-3 text-xl font-extrabold text-foreground transition-colors duration-300 group-hover:text-orange-500 [word-break:normal] [overflow-wrap:break-word] hyphens-none">
                      {event.name}
                    </h3>

                    {/* Description */}
                    <p className="mb-6 text-xs sm:text-sm text-muted-foreground line-clamp-3 leading-relaxed">
                      {event.description}
                    </p>

                    {/* Dates */}
                    <div className="mt-auto mb-5 flex flex-wrap gap-2 text-xs font-semibold text-muted-foreground">
                      <div className="flex items-center gap-1.5 rounded-xl border border-border bg-background/50 px-3 py-1.5 shadow-sm">
                        <Calendar className="size-3.5 text-orange-500 shrink-0" />
                        <span className="truncate">
                          Reg:{" "}
                          {event.registrationDeadline
                            ? format(new Date(event.registrationDeadline), "MMM dd, yyyy")
                            : "TBA"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 rounded-xl border border-border bg-background/50 px-3 py-1.5 shadow-sm">
                        <CalendarDays className="size-3.5 text-orange-500 shrink-0" />
                        <span className="truncate">
                          End:{" "}
                          {event.endDate
                            ? format(new Date(event.endDate), "MMM dd, yyyy")
                            : "TBA"}
                        </span>
                      </div>
                    </div>

                    {/* Team Capacity Progress */}
                    <TeamCapacity
                      className="mb-5"
                      registeredTeams={event.registeredTeams}
                      maxTeams={event.maxTeams}
                    />

                    {/* Footer Card Action Button */}
                    <div className="border-t border-border pt-4">
                      <div className="w-full rounded-xl border border-border bg-card group-hover:bg-orange-500 group-hover:text-white group-hover:border-orange-500 transition-all duration-300 font-bold text-xs py-2.5 px-4 flex items-center justify-center gap-2 text-foreground">
                        View Details
                        <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
