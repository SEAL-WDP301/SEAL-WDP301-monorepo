"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Calendar, MapPin, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { getPublicEvents, isAutomationEvent } from "@/lib/api/public-events.api";
import { TeamCapacity } from "@/components/events/team-capacity";

function getLocationLabel(location: unknown) {
  if (!location) return "Online";

  let locObj = location;
  if (typeof location === "string") {
    if (!location.trim()) return "Online";
    try {
      locObj = JSON.parse(location);
    } catch {
      return location;
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
    queryKey: ["publicEvents"],
    queryFn: getPublicEvents,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <section className="relative overflow-hidden py-20 flex justify-center items-center min-h-[450px]">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-orange-500"></div>
      </section>
    );
  }

  const latestEvent =
    events?.find(
      (event) => !isAutomationEvent(event) && (event.status === "active" || event.status === "ongoing"),
    ) ?? events?.find((event) => !isAutomationEvent(event));

  if (!latestEvent) {
    return null;
  }

  const imageUrl =
    latestEvent.image_url ||
    latestEvent.imageUrl ||
    latestEvent.icons?.[0]?.url ||
    "/images/rag_system.png";

  let formattedDate = `${latestEvent.season || ""} ${latestEvent.year || ""}`;
  let formattedEndDate = "End: TBA";
  try {
    if (latestEvent.registrationDeadline) {
      formattedDate = `Deadline: ${format(new Date(latestEvent.registrationDeadline), "MMM dd, yyyy")}`;
    }
    if (latestEvent.endDate) {
      formattedEndDate = `End: ${format(new Date(latestEvent.endDate), "MMM dd, yyyy")}`;
    }
  } catch {
    // fallback
  }

  return (
    <section className="relative overflow-hidden py-12 md:py-16 bg-background">
      {/* Background Subtle Glow */}
      <div className="absolute top-1/2 left-1/4 -translate-y-1/2 h-[400px] w-[400px] rounded-full bg-orange-500/10 blur-[130px] pointer-events-none" />
      <div className="absolute top-1/2 right-10 -translate-y-1/2 h-[350px] w-[350px] rounded-full bg-amber-500/10 blur-[120px] pointer-events-none" />

      <div className="container relative z-10 mx-auto px-6 lg:px-12">
        <div className="grid gap-10 lg:grid-cols-12 lg:items-center">
          
          {/* Left Column: Image Card */}
          <div className="lg:col-span-6 relative group">
            <div className="relative aspect-[16/10] md:aspect-[4/3] w-full overflow-hidden rounded-3xl border border-border/80 bg-card shadow-2xl transition-all duration-300 group-hover:border-orange-500/40">
              <Image
                src={imageUrl}
                alt={latestEvent.name || "Event Image"}
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-105"
                sizes="(max-width: 1024px) 100vw, 50vw"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent opacity-80" />

              {/* Status Badge Overlay */}
              <div className="absolute left-4 top-4 flex items-center gap-2">
                <Badge className="bg-emerald-500/90 text-white font-bold text-xs px-3 py-1 shadow-lg backdrop-blur-md border border-emerald-400/40 flex items-center gap-1.5 rounded-full">
                  <span className="relative flex size-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-75" />
                    <span className="relative inline-flex size-2 rounded-full bg-white" />
                  </span>
                  {latestEvent.status === "active" ? "FEATURED EVENT" : "ONGOING"}
                </Badge>
              </div>
            </div>
          </div>

          {/* Right Column: Event Info Content */}
          <div className="lg:col-span-6 flex flex-col items-start space-y-5">
            
            {/* Category / Sub-tag */}
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-orange-500">
              <Sparkles className="size-4" />
              <span>SEAL Hackathon Competition</span>
            </div>

            {/* Title with word-break safety to prevent word-splitting mid-word */}
            <h1 className="font-sans text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-foreground leading-[1.15] [word-break:normal] [overflow-wrap:break-word] hyphens-none">
              {latestEvent.name}
            </h1>

            {/* Description */}
            <p className="text-base text-muted-foreground leading-relaxed line-clamp-4">
              {latestEvent.description ||
                "Join a community of innovators and future-proof your skills with cutting-edge technologies reshaping the digital landscape."}
            </p>

            {/* Metadata Pills */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <div className="flex items-center gap-2 rounded-xl bg-card/80 px-3.5 py-2 border border-border text-xs font-semibold text-foreground shadow-sm">
                <Calendar className="size-4 text-orange-500" />
                <span>{formattedDate}</span>
              </div>

              <div className="flex items-center gap-2 rounded-xl bg-card/80 px-3.5 py-2 border border-border text-xs font-semibold text-foreground shadow-sm">
                <Calendar className="size-4 text-orange-500" />
                <span>{formattedEndDate}</span>
              </div>

              <div className="flex items-center gap-2 rounded-xl bg-card/80 px-3.5 py-2 border border-border text-xs font-semibold text-foreground shadow-sm">
                <MapPin className="size-4 text-orange-500" />
                <span>{getLocationLabel(latestEvent.location)}</span>
              </div>

              <TeamCapacity
                compact
                registeredTeams={latestEvent.registeredTeams}
                maxTeams={latestEvent.maxTeams}
              />
            </div>

            {/* Action CTA */}
            <div className="pt-2">
              <Button
                asChild
                size="lg"
                variant="orange"
                className="h-12 rounded-xl px-7 text-base font-bold shadow-[0_0_20px_rgba(243,112,33,0.3)] transition-all duration-300 hover:shadow-[0_0_30px_rgba(243,112,33,0.5)] hover:scale-105"
              >
                <Link href={`/home/events/${latestEvent.id}`} className="flex items-center gap-2 group">
                  View Detail
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
            </div>

          </div>

        </div>
      </div>
    </section>
  );
}
