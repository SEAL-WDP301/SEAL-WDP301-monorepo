"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Users, FileText, Settings, Calendar, GitMerge, Trophy, Loader2, Trash2, MapPin, Phone, Scale, Building, Map, Link as LinkIcon, Info, Mail, AlertCircle, Clock, ImageIcon } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import { enqueueSnackbar } from "notistack";
import { useState } from "react";
import { getEventMapUrl } from "@/lib/events/location";
import {
  isOnlineMeetingPublished,
  OnlineMeetingCard,
} from "@/components/events/online-meeting-card";

import {
  createGoogleCalendarMeeting,
  deleteOrganizerEvent,
  getOrganizerEvent,
  updateOrganizerEventStatus,
  type EventStatus,
} from "@/lib/api/organizer-events.api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function EventOverviewPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.id as string;
  const queryClient = useQueryClient();
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const { data: event, isLoading, isError } = useQuery({
    queryKey: ["organizerEvent", eventId],
    queryFn: () => getOrganizerEvent(eventId),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (newStatus: EventStatus) => {
      const updatedEvent = await updateOrganizerEventStatus(eventId, newStatus);
      let meetingCreated = false;
      let meetingCreationFailed = false;

      if (newStatus === "ongoing" && !event?.calendarMeeting) {
        const storedLocation = (() => {
          if (typeof event?.location !== "string") return null;
          try {
            return JSON.parse(event.location) as {
              createGoogleMeetOnOngoing?: boolean;
              meetingStartDate?: string;
              meetingEndDate?: string;
              timeZone?: string;
            };
          } catch {
            return null;
          }
        })();

        if (storedLocation?.createGoogleMeetOnOngoing) {
          try {
            await createGoogleCalendarMeeting(eventId, {
              meetingStartDate:
                storedLocation.meetingStartDate || event?.startDate || undefined,
              meetingEndDate:
                storedLocation.meetingEndDate || event?.endDate || undefined,
              attendeeEmails: [],
              sendInvitations: true,
              notifyParticipants: true,
              timeZone: storedLocation.timeZone || "Asia/Ho_Chi_Minh",
            });
            meetingCreated = true;
          } catch {
            meetingCreationFailed = true;
          }
        }
      }

      return { updatedEvent, meetingCreated, meetingCreationFailed };
    },
    onSuccess: ({ meetingCreated, meetingCreationFailed }) => {
      enqueueSnackbar('Event status updated successfully', { variant: 'success' });
      if (meetingCreated) {
        enqueueSnackbar("Google Meet created for the ongoing event", {
          variant: "success",
        });
      }
      if (meetingCreationFailed) {
        enqueueSnackbar(
          "Event is ongoing, but Google Meet creation failed. Check the Google Calendar connection and try again.",
          { variant: "warning" },
        );
      }
      queryClient.invalidateQueries({ queryKey: ["organizerEvent", eventId] });
      queryClient.invalidateQueries({ queryKey: ["organizerEvents"] });
      queryClient.invalidateQueries({ queryKey: ["publicEvent", eventId] });
      queryClient.invalidateQueries({ queryKey: ["studentOnlineMeeting", eventId] });
    },
    onError: (error: { response?: { data?: { message?: string } } }) => {
      enqueueSnackbar(error.response?.data?.message || 'Failed to update status', { variant: 'error' });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteOrganizerEvent(eventId),
    onSuccess: () => {
      enqueueSnackbar("Event deleted successfully", { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["organizerEvents"] });
      router.push("/organizer/events");
    },
    onError: (error: { response?: { data?: { message?: string } } }) => {
      enqueueSnackbar(error.response?.data?.message || "Failed to delete event", { variant: "error" });
    },
  });

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (isError || !event) {
    return (
      <div className="text-center text-red-500 bg-red-500/10 p-6 rounded-xl border border-red-500/20 max-w-lg mx-auto mt-20">
        Failed to load event details.
      </div>
    );
  }

  const parseJSON = (str: any) => {
    if (typeof str !== 'string') return str;
    try { return JSON.parse(str); } catch { return null; }
  };

  const loc = parseJSON(event.location);
  const contacts = parseJSON(event.contact) || [];
  const rules = parseJSON(event.rules) || [];
  const imageUrl = event.imageUrl || event.image_url || null;
  const eventMapUrl = getEventMapUrl(loc);
  const meetingIsPublished = isOnlineMeetingPublished(event.status);
  const publishedMeeting = meetingIsPublished
    ? event.calendarMeeting ||
      (loc?.meetingUrl
        ? {
            platform: loc.meetingPlatform,
            meetUrl: loc.meetingUrl,
          }
        : null)
    : null;

  return (
    <div className="space-y-8 pb-12">
      {/* Cover Image Header */}
      <div className="relative w-full h-[280px] md:h-[360px] rounded-3xl overflow-hidden border border-border shadow-2xl bg-zinc-950">
        {imageUrl ? (
          <>
            {/* Blurred ambient background */}
            <div className="absolute inset-0">
              <img
                src={imageUrl}
                alt=""
                className="w-full h-full object-cover blur-[80px] opacity-60 scale-125 saturate-150"
              />
            </div>

            {/* Clear image on the right fading in */}
            <div className="absolute inset-y-0 right-0 w-full md:w-[65%] pointer-events-none">
              <img
                src={imageUrl}
                alt={event.name}
                className="w-full h-full object-cover object-right-center md:object-center"
                style={{
                  WebkitMaskImage: "linear-gradient(to right, transparent 0%, black 35%, black 100%)",
                  maskImage: "linear-gradient(to right, transparent 0%, black 35%, black 100%)"
                }}
              />
            </div>
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 via-purple-500/20 to-orange-500/20 flex items-center justify-center">
            <ImageIcon className="h-20 w-20 text-muted-foreground/30" />
          </div>
        )}

        {/* Gradients to ensure text is always readable */}
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-transparent w-full md:w-[70%]" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent md:hidden" />

        <div className="absolute bottom-6 left-6 right-6 flex flex-col md:flex-row md:items-end justify-between gap-6 z-10">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-background/50 backdrop-blur-md border border-border text-xs font-bold tracking-wider mb-4 shadow-sm">
              <span className="relative flex size-2">
                <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${event.status === 'active' || event.status === 'ongoing' ? 'bg-green-400' : 'bg-zinc-400'}`} />
                <span className={`relative inline-flex size-2 rounded-full ${event.status === 'active' || event.status === 'ongoing' ? 'bg-green-500' : 'bg-zinc-500'}`} />
              </span>
              {(event.status ?? "draft").toUpperCase()}
            </div>
            <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-foreground shadow-sm">{event.name}</h1>
            <p className="text-muted-foreground mt-2 font-medium">Season {event.season} {event.year}</p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={event.status}
              onChange={(e) => updateStatusMutation.mutate(e.target.value as EventStatus)}
              disabled={updateStatusMutation.isPending}
              className="bg-background/80 backdrop-blur-md border border-border rounded-xl text-sm uppercase font-semibold focus:ring-blue-500 focus:border-blue-500 px-4 py-2.5 cursor-pointer shadow-sm hover:bg-background/90 transition-colors"
            >
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="ongoing">Ongoing</option>
              <option value="closed">Closed</option>
            </select>
            {event.status === "draft" ? (
              <Link href={`/organizer/events/${eventId}/edit`}>
                <Button className="gap-2 rounded-xl h-10 shadow-sm">
                  <Settings className="h-4 w-4" />
                  Edit Event
                </Button>
              </Link>
            ) : (
              <Button
                className="gap-2 rounded-xl h-10 shadow-sm"
                title="Event must have Draft status before it can be edited"
                onClick={() => enqueueSnackbar("Event must have Draft status before it can be edited.", { variant: "warning" })}
              >
                <Settings className="h-4 w-4" />
                Edit Event
              </Button>
            )}
            <Button variant="destructive" className="gap-2 rounded-xl h-10 shadow-sm" onClick={() => setIsDeleteOpen(true)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {event.status === "ongoing" &&
      loc?.createGoogleMeetOnOngoing &&
      !event.calendarMeeting ? (
        <GlassCard className="flex flex-col gap-4 rounded-[20px] border border-amber-500/25 bg-amber-500/5 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
            <div>
              <p className="font-semibold text-foreground">
                Google Meet has not been created
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Check the Google Calendar connection, then retry.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            disabled={updateStatusMutation.isPending}
            onClick={() => updateStatusMutation.mutate("ongoing")}
          >
            {updateStatusMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : null}
            Retry Google Meet
          </Button>
        </GlassCard>
      ) : null}

      <OnlineMeetingCard
        meeting={publishedMeeting}
        eventStatus={event.status}
      />

      {/* Quick Stats Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {[
          { title: "Total Teams", value: String(event._count?.teams ?? 0), icon: Users, color: "text-blue-500", bg: "bg-blue-500/10" },
          { title: "Submissions", value: String(event._count?.submissions ?? 0), icon: FileText, color: "text-green-500", bg: "bg-green-500/10" },
          { title: "Tracks", value: String(event.tracks?.length ?? 0), icon: GitMerge, color: "text-purple-500", bg: "bg-purple-500/10" },
          { title: "Prize Pool", value: "🏆", icon: Trophy, color: "text-orange-500", bg: "bg-orange-500/10" },
        ].map((stat, i) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <GlassCard className="p-6 rounded-[24px] hover:bg-white/[0.02] transition-colors border-border/50 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-2xl ${stat.bg} ${stat.color}`}>
                  <stat.icon className="h-6 w-6" />
                </div>
              </div>
              <h3 className="text-3xl font-bold mb-1">{stat.value}</h3>
              <p className="text-sm text-muted-foreground">{stat.title}</p>
            </GlassCard>
          </motion.div>
        ))}
      </div>

      {/* Main Content Details */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column (Wider) */}
        <div className="lg:col-span-2 space-y-6">
          <GlassCard className="p-8 rounded-[24px] border-border/50 shadow-sm">
            <h3 className="text-xl font-semibold mb-6 flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-500" />
              Event Description
            </h3>
            <p className="font-medium text-foreground leading-relaxed whitespace-pre-wrap">
              {event.description || "No description provided for this event."}
            </p>
          </GlassCard>

          {loc && (
            <GlassCard className="p-8 rounded-[24px] border-border/50 shadow-sm">
              <h3 className="text-xl font-semibold mb-6 flex items-center gap-2">
                <MapPin className="h-5 w-5 text-green-500" />
                Location & Venue
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {loc.venueName && (
                  <div className="bg-muted/30 p-4 rounded-xl border border-border/30">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-2"><Building className="h-3 w-3" /> Venue</p>
                    <p className="font-semibold">{loc.venueName}</p>
                    {loc.room && <p className="text-sm text-muted-foreground mt-1">Room: {loc.room}</p>}
                  </div>
                )}
                {loc.address && (
                  <div className="bg-muted/30 p-4 rounded-xl border border-border/30">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-2"><Map className="h-3 w-3" /> Address</p>
                    <p className="font-semibold text-sm">{loc.address}</p>
                    {eventMapUrl && (
                      <a href={eventMapUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline mt-2 inline-flex items-center gap-1">
                        View on Map <LinkIcon className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                )}
                {meetingIsPublished && loc.meetingPlatform && (
                  <div className="bg-muted/30 p-4 rounded-xl border border-border/30 md:col-span-2">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-2"><Phone className="h-3 w-3" /> Virtual Meeting</p>
                    <p className="font-semibold">{loc.meetingPlatform}</p>
                    {loc.meetingUrl && (
                      <a href={loc.meetingUrl} target="_blank" rel="noreferrer" className="text-sm text-blue-500 hover:underline break-all mt-1 inline-block">
                        {loc.meetingUrl}
                      </a>
                    )}
                  </div>
                )}
              </div>
              {loc.note && (
                <div className="mt-4 p-4 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-start gap-3">
                  <Info className="h-5 w-5 text-orange-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-orange-600 dark:text-orange-400 font-medium">{loc.note}</p>
                </div>
              )}
            </GlassCard>
          )}

          {rules.length > 0 && (
            <GlassCard className="p-8 rounded-[24px] border-border/50 shadow-sm">
              <h3 className="text-xl font-semibold mb-6 flex items-center gap-2">
                <Scale className="h-5 w-5 text-purple-500" />
                Rules & Guidelines
              </h3>
              <div className="space-y-6">
                {rules.map((ruleGroup: any, idx: number) => (
                  <div key={idx}>
                    <h4 className="font-bold text-foreground mb-3">{ruleGroup.title || ruleGroup.name || `Rule Group ${idx + 1}`}</h4>
                    <ul className="space-y-2">
                      {(ruleGroup.rules || []).map((rule: string, rIdx: number) => (
                        <li key={rIdx} className="text-sm text-muted-foreground flex items-start gap-2">
                          <span className="text-purple-500 mt-1 shrink-0">•</span>
                          <span>{rule}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </GlassCard>
          )}
        </div>

        {/* Right Column (Narrower) */}
        <div className="space-y-6">
          <GlassCard className="p-8 rounded-[24px] border-border/50 shadow-sm">
            <h3 className="text-xl font-semibold mb-6 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-orange-500" />
              Timeline
            </h3>
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-muted/30 border border-border/30">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Start Date</p>
                <p className="font-semibold text-lg">{event.startDate ? new Date(event.startDate).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' }) : "TBA"}</p>
              </div>
              <div className="p-4 rounded-xl bg-muted/30 border border-border/30">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">End Date</p>
                <p className="font-semibold text-lg">{event.endDate ? new Date(event.endDate).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' }) : "TBA"}</p>
              </div>
              <div className="p-4 rounded-xl bg-muted/30 border border-border/30">
                <p className="text-xs font-bold text-red-500/80 uppercase tracking-wider mb-1">Registration Deadline</p>
                <p className="font-semibold text-lg">{event.registrationDeadline ? new Date(event.registrationDeadline).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' }) : "TBA"}</p>
              </div>
            </div>
          </GlassCard>

          <GlassCard className="p-8 rounded-[24px] border-border/50 shadow-sm">
            <h3 className="text-xl font-semibold mb-6 flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              Prize Structure
            </h3>
            <div className="space-y-3">
              {event.prizes && event.prizes.length > 0 ? (
                event.prizes.map((prize: any, idx: number) => {
                  let colors = "from-muted/30 to-transparent border-border/30 text-foreground";
                  let titleColor = "text-muted-foreground";
                  const nameLower = prize.name.toLowerCase();
                  
                  if (nameLower.includes("1st") || nameLower.includes("first")) {
                    colors = "from-yellow-500/10 to-transparent border-yellow-500/20 text-foreground";
                    titleColor = "text-yellow-600";
                  } else if (nameLower.includes("2nd") || nameLower.includes("second")) {
                    colors = "from-slate-400/10 to-transparent border-slate-400/20 text-foreground";
                    titleColor = "text-slate-500";
                  } else if (nameLower.includes("3rd") || nameLower.includes("third")) {
                    colors = "from-orange-700/10 to-transparent border-orange-700/20 text-foreground";
                    titleColor = "text-orange-600";
                  }
                  
                  return (
                    <div key={idx} className={`p-4 rounded-xl bg-gradient-to-r border ${colors}`}>
                      <p className={`text-xs font-bold uppercase tracking-wider mb-1 flex justify-between ${titleColor}`}>
                        {prize.name} <Trophy className="h-3 w-3" />
                      </p>
                      <p className="font-bold text-lg">{prize.description || `${prize.quantity} winner(s)`}</p>
                    </div>
                  );
                })
              ) : (
                <div className="p-4 rounded-xl bg-muted/30 border border-border/30">
                  <p className="text-muted-foreground text-center">TBA</p>
                </div>
              )}
            </div>
          </GlassCard>

          {contacts.length > 0 && (
            <GlassCard className="p-8 rounded-[24px] border-border/50 shadow-sm">
              <h3 className="text-xl font-semibold mb-6 flex items-center gap-2">
                <Phone className="h-5 w-5 text-zinc-500" />
                Contact Info
              </h3>
              <div className="space-y-4">
                {contacts.map((contact: any, idx: number) => (
                  <div key={idx} className="p-4 rounded-xl bg-muted/30 border border-border/30 text-sm">
                    <p className="font-bold text-foreground mb-2">{contact.label || contact.name}</p>
                    {contact.email && (
                      <p className="flex items-center gap-2 text-muted-foreground mb-1">
                        <Mail className="h-3.5 w-3.5" /> <a href={`mailto:${contact.email}`} className="hover:text-blue-500">{contact.email}</a>
                      </p>
                    )}
                    {contact.phone && (
                      <p className="flex items-center gap-2 text-muted-foreground mb-1">
                        <Phone className="h-3.5 w-3.5" /> <a href={`tel:${contact.phone}`} className="hover:text-blue-500">{contact.phone}</a>
                      </p>
                    )}
                    {contact.responseTime && (
                      <p className="flex items-center gap-2 text-muted-foreground mt-2 pt-2 border-t border-border/50 text-xs">
                        <Clock className="h-3 w-3" /> {contact.responseTime}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </GlassCard>
          )}
        </div>
      </div>

      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete event</DialogTitle>
            <DialogDescription>
              This will permanently delete {event.name}. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)} disabled={deleteMutation.isPending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  Delete
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
