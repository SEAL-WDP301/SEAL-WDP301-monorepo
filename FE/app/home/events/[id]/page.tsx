"use client";

import * as Accordion from "@radix-ui/react-accordion";
import { useQuery } from "@tanstack/react-query";
import { axiosClient } from "@/lib/axios";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { useEffect, useRef, useState } from "react";
import { enqueueSnackbar } from "notistack";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { EventRegisterDialog } from "@/components/events/event-register-dialog";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Award,
  BellRing,
  Building2,
  Calendar,
  ChevronDown,
  CircleHelp,
  Clock,
  ExternalLink,
  FileText,
  GraduationCap,
  Headphones,
  Mail,
  MapPin,
  Phone,
  Scale,
  Trophy,
  Users,
  Video,
  type LucideIcon,
} from "lucide-react";
import { getStudentAssignedMentor, getMentorTeams } from "@/lib/api/mentor.api";
import { getStudentOnlineMeeting } from "@/lib/api/student-events.api";
import { useAuthStore } from "@/lib/stores/auth.store";
import { getEventMapUrl } from "@/lib/events/location";
import {
  isOnlineMeetingPublished,
  OnlineMeetingCard,
  type OnlineMeetingDetails,
} from "@/components/events/online-meeting-card";
import {
  calculatePrizePoolTotals,
  formatPrizeAmount,
  getPrizePlacementLabel,
} from "@/lib/events/prizes";

type EventTrack = {
  id: number | string;
  name: string;
  description?: string | null;
};

type EventAchievement = {
  id: number;
  name: string;
  track?: { id: number; name: string } | null;
  award?: { id: number; name: string; description?: string | null } | null;
};

type EventDetail = {
  id: number | string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  image_url?: string | null;
  season?: string | null;
  year?: number | string | null;
  status?: string | null;
  registrationDeadline?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  maxTeams?: number | null;
  minMembersPerTeam?: number;
  maxMembersPerTeam?: number;
  registeredTeams?: number;
  remainingTeamSlots?: number | null;
  isTeamRegistrationFull?: boolean;
  prizes?: {
    id: number;
    name: string;
    description?: string;
    quantity: number;
    amount: number;
    placement?: number | null;
    currency: string;
  }[];
  prizePoolTotals?: Array<{ currency: string; amount: number }>;
  eventAchievements?: EventAchievement[];
  githubOrgUrl?: string | null;
  deferredTrackAssignment?: boolean;
  tracks?: EventTrack[];
  rounds?: Array<{ id?: number | string; status?: string | null }>;
  ruleGroups?: ApiRuleGroup[];
  rules?: ApiRuleGroup[] | ApiRuleRecord | string[] | string | null;
  faqItems?: ApiFAQItem[];
  faq?: ApiFAQItem[] | null;
  faqs?: ApiFAQItem[] | null;
  contact?: ApiContact[] | ApiContact | string[] | string | null;
  contacts?: ApiContact[] | ApiContact | string[] | string | null;
  support?: ApiSupport | null;
  location?: ApiLocation | string | null;
  venue?: ApiLocation | string | null;
  calendarMeeting?: OnlineMeetingDetails | null;
};

function isRegistrationOpen(event: EventDetail) {
  if (event.status?.toLowerCase() !== "active") return false;
  if (event.isTeamRegistrationFull) return false;

  const now = new Date();

  if (event.registrationDeadline) {
    const deadline = new Date(event.registrationDeadline);
    if (!Number.isNaN(deadline.getTime()) && now > deadline) return false;
  }

  if (event.startDate) {
    const startDate = new Date(event.startDate);
    if (!Number.isNaN(startDate.getTime()) && now >= startDate) return false;
  }

  return true;
}

type UserAccount = {
  role?: string | null;
};

type PendingInvitation = {
  team?: {
    eventId?: number | string;
  };
};

type JudgeEvent = {
  id?: number | string;
};

type MentorTeam = {
  eventId?: number | string;
  event?: {
    id?: number | string;
  };
};

type RuleGroup = {
  title: string;
  icon: LucideIcon;
  items: string[];
};

type FAQItem = {
  question: string;
  answer: string;
};

type ApiRuleGroup = {
  title?: string | null;
  name?: string | null;
  category?: string | null;
  items?: string[] | null;
  rules?: string[] | null;
  content?: string | string[] | null;
  description?: string | null;
};

type ApiRuleRecord = {
  teamRules?: string[] | null;
  submissionRules?: string[] | null;
  judgingRules?: string[] | null;
  disqualificationRules?: string[] | null;
  requirements?: string[] | null;
};

type ApiFAQItem = {
  question?: string | null;
  q?: string | null;
  title?: string | null;
  answer?: string | null;
  a?: string | null;
  content?: string | null;
};

type ApiLocation = {
  type?: "online" | "offline" | "hybrid" | string | null;
  name?: string | null;
  venueName?: string | null;
  room?: string | null;
  hall?: string | null;
  address?: string | null;
  mapUrl?: string | null;
  meetingPlatform?: string | null;
  platform?: string | null;
  meetingUrl?: string | null;
  note?: string | null;
};

type ApiContact = {
  label?: string | null;
  type?: string | null;
  name?: string | null;
  title?: string | null;
  email?: string | null;
  phone?: string | null;
  detail?: string | null;
  responseTime?: string | null;
};

type ApiSupport = {
  organizer?: ApiContact | null;
  technical?: ApiContact | null;
  mentorNote?: string | null;
  contacts?: ApiContact[] | null;
};

function getInitials(name?: string | null) {
  return (name || "M")
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function toStringList(value?: string | string[] | null) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  return value
    .split(/\r?\n/)
    .map((item) => item.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean);
}

function getRuleIcon(title: string) {
  const normalizedTitle = title.toLowerCase();
  if (normalizedTitle.includes("team")) return Users;
  if (
    normalizedTitle.includes("submission") ||
    normalizedTitle.includes("requirement")
  )
    return FileText;
  if (normalizedTitle.includes("judg") || normalizedTitle.includes("score"))
    return Scale;
  if (
    normalizedTitle.includes("disqualification") ||
    normalizedTitle.includes("violation")
  )
    return AlertTriangle;
  return FileText;
}

function parseJsonSafe<T>(jsonStr: string | null | undefined, fallback: T): T {
  if (!jsonStr) return fallback;
  try {
    return JSON.parse(jsonStr) as T;
  } catch {
    return fallback;
  }
}

function normalizeRuleGroups(event: EventDetail): RuleGroup[] {
  let groupSource =
    event.ruleGroups ??
    (Array.isArray(event.rules) && typeof event.rules[0] === "object"
      ? (event.rules as ApiRuleGroup[])
      : undefined);

  if (!groupSource && typeof event.rules === "string") {
    const parsed = parseJsonSafe<unknown>(event.rules, null);
    if (Array.isArray(parsed)) {
      groupSource = parsed as ApiRuleGroup[];
    }
  }

  if (groupSource?.length) {
    return groupSource
      .map((group) => {
        const title = group.title || group.name || group.category || "Rules";
        const items = [
          ...(group.items ?? []),
          ...(group.rules ?? []),
          ...toStringList(group.content),
          ...toStringList(group.description),
        ].filter(Boolean);

        return {
          title,
          icon: getRuleIcon(title),
          items,
        };
      })
      .filter((group) => group.items.length > 0);
  }

  if (Array.isArray(event.rules) || typeof event.rules === "string") {
    const items = toStringList(event.rules as string | string[]);
    return items.length
      ? [{ title: "Rules & Requirements", icon: FileText, items }]
      : [];
  }

  if (event.rules && typeof event.rules === "object") {
    const ruleRecord = event.rules as ApiRuleRecord;
    return [
      { title: "Team Rules", icon: Users, items: ruleRecord.teamRules ?? [] },
      {
        title: "Submission Rules",
        icon: FileText,
        items: ruleRecord.submissionRules ?? [],
      },
      {
        title: "Judging Rules",
        icon: Scale,
        items: ruleRecord.judgingRules ?? [],
      },
      {
        title: "Disqualification Rules",
        icon: AlertTriangle,
        items: ruleRecord.disqualificationRules ?? [],
      },
      {
        title: "Requirements",
        icon: FileText,
        items: ruleRecord.requirements ?? [],
      },
    ].filter((group) => group.items.length > 0);
  }

  return [];
}

function normalizeFaqItems(event: EventDetail): FAQItem[] {
  return (event.faqItems ?? event.faq ?? event.faqs ?? [])
    .map((faq) => ({
      question: faq.question || faq.q || faq.title || "",
      answer: faq.answer || faq.a || faq.content || "",
    }))
    .filter((faq) => faq.question && faq.answer);
}

function normalizeLocation(event: EventDetail): ApiLocation | null {
  const location = event.location ?? event.venue;
  if (!location) return null;
  if (typeof location === "string") {
    const parsed = parseJsonSafe<unknown>(location, null);
    if (parsed && typeof parsed === "object") return parsed as ApiLocation;
    return { name: location };
  }
  return location as ApiLocation;
}

function parseContactText(value: string): ApiContact {
  const email = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
  const phone = value.match(/phone\s*:\s*([+\d][\d\s().-]{6,})/i)?.[1]?.trim();
  const name = value.match(/name\s*:\s*([^¶\n\r|;]+)/i)?.[1]?.trim();
  const label = value.match(/(?:label|type)\s*:\s*([^¶\n\r|;]+)/i)?.[1]?.trim();
  const supportHours = value
    .match(/support\s*hours\s*:\s*([^¶\n\r|;]+)/i)?.[1]
    ?.trim();
  const cleanedDetail = value
    .replace(/email\s*:\s*/gi, "")
    .replace(/phone\s*:\s*[+\d][\d\s().-]{6,}/gi, "")
    .replace(/support\s*hours\s*:\s*[^¶\n\r|;]+/gi, "")
    .replace(/name\s*:\s*[^¶\n\r|;]+/gi, "")
    .replace(/(?:label|type)\s*:\s*[^¶\n\r|;]+/gi, "")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "")
    .replace(/[¶|;]/g, "\n")
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean)
    .join(" · ");

  return {
    label: label || "Event contact",
    name,
    email,
    phone,
    detail:
      [
        cleanedDetail && cleanedDetail !== email ? cleanedDetail : undefined,
        supportHours ? `Support hours: ${supportHours}` : undefined,
      ]
        .filter(Boolean)
        .join(" · ") || undefined,
  };
}

function normalizeContactValue(
  value?: ApiContact[] | ApiContact | string[] | string | null,
): ApiContact[] {
  if (!value) return [];
  if (typeof value === "string") {
    const parsed = parseJsonSafe<unknown>(value, null);
    if (Array.isArray(parsed)) return parsed as ApiContact[];
    if (parsed && typeof parsed === "object") return [parsed as ApiContact];
  }
  const items = Array.isArray(value) ? value : [value];
  return items.map((item) =>
    typeof item === "string" ? parseContactText(item) : item,
  );
}

function normalizeContacts(event: EventDetail): ApiContact[] {
  const supportContacts = [
    event.support?.organizer,
    event.support?.technical,
    ...(event.support?.contacts ?? []),
  ].filter(Boolean) as ApiContact[];

  return [
    ...normalizeContactValue(event.contact),
    ...normalizeContactValue(event.contacts),
    ...supportContacts,
  ].filter(Boolean);
}

function SectionHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-6">
      {eyebrow ? (
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-orange-400">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="text-2xl font-bold tracking-tight text-foreground">
        {title}
      </h2>
      {subtitle ? (
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}

function RulesSection({ groups }: { groups: RuleGroup[] }) {
  if (!groups.length) return null;

  return (
    <section className="mb-12">
      <div className="rounded-3xl border border-orange-500/20 bg-card/70 p-6 shadow-lg shadow-black/10 md:p-8">
        <div className="mb-7 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <SectionHeader
            eyebrow="Participant Guide"
            title="Rules & Requirements"
            subtitle="Key rules for teams, submissions, judging, and disqualification review."
          />
          <Badge variant="highlight" className="w-fit">
            Important
          </Badge>
        </div>

        <div className="grid gap-4 grid-cols-1">
          {groups.map((group) => {
            const Icon = group.icon;

            return (
              <article
                key={group.title}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition-colors hover:border-orange-500/30"
              >
                <div className="mb-4 flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-2xl border border-orange-500/20 bg-orange-500/10 text-orange-400">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-base font-semibold text-foreground">
                    {group.title}
                  </h3>
                </div>

                <ul className="space-y-3">
                  {group.items.map((item) => (
                    <li
                      key={item}
                      className="flex gap-3 text-sm leading-6 text-muted-foreground"
                    >
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-orange-400" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function SupportLocationSection({
  location,
  contacts,
  mentorNote,
  hasFaq,
}: {
  location: ApiLocation | null;
  contacts: ApiContact[];
  mentorNote?: string | null;
  hasFaq: boolean;
}) {
  if (!location && contacts.length === 0 && !mentorNote) return null;
  const venueName = location?.venueName || location?.name;
  const room = location?.room || location?.hall;
  const platform = location?.meetingPlatform || location?.platform;
  const mapUrl = getEventMapUrl(location);
  const hasVenueInfo = Boolean(
    venueName || room || location?.address || location?.note,
  );
  const hasOnlineInfo = Boolean(platform || location?.meetingUrl);

  return (
    <section className="mb-12">
      <div className="rounded-3xl border border-border bg-card/70 p-6 shadow-lg shadow-black/10 md:p-8">
        <SectionHeader
          eyebrow="Help Desk"
          title="Event Support & Location"
          subtitle="Access venue details and connect with event support contacts before and during the competition."
        />

        <div className="grid items-stretch gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          {location ? (
            <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card/80">
              <header className="flex items-center gap-4 border-b border-border px-5 py-5 sm:px-6">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-orange-500/10 text-orange-400">
                  <MapPin className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg font-bold text-foreground">
                    Venue Details
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {location.type
                      ? `${location.type.charAt(0).toUpperCase()}${location.type.slice(1)} event location`
                      : "Event location information"}
                  </p>
                </div>
              </header>

              <div className="flex flex-1 flex-col p-5 sm:p-6">
                {hasVenueInfo ? (
                  <dl className="space-y-5">
                    {venueName ? (
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted text-orange-400">
                          <Building2 className="h-4 w-4" />
                        </div>
                        <div>
                          <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-orange-400">
                            Venue
                          </dt>
                          <dd className="mt-1 font-semibold leading-6 text-foreground">
                            {venueName}
                          </dd>
                        </div>
                      </div>
                    ) : null}
                    {room ? (
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted text-orange-400">
                          <Users className="h-4 w-4" />
                        </div>
                        <div>
                          <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-orange-400">
                            Room / Hall
                          </dt>
                          <dd className="mt-1 font-semibold leading-6 text-foreground">
                            {room}
                          </dd>
                        </div>
                      </div>
                    ) : null}
                    {location.address ? (
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted text-orange-400">
                          <MapPin className="h-4 w-4" />
                        </div>
                        <div>
                          <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-orange-400">
                            Address
                          </dt>
                          <dd className="mt-1 leading-6 text-muted-foreground">
                            {location.address}
                          </dd>
                        </div>
                      </div>
                    ) : null}
                  </dl>
                ) : null}

                {hasOnlineInfo ? (
                  <div className="mt-5 rounded-xl border border-border bg-muted/30 p-4 text-sm">
                    <div className="mb-2 flex items-center gap-2 font-semibold text-foreground">
                      <Video className="h-4 w-4 text-orange-400" />
                      Online Event Access
                    </div>
                    {platform ? (
                      <p className="text-muted-foreground">{platform}</p>
                    ) : null}
                    {location.meetingUrl ? (
                      <a
                        href={location.meetingUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-flex text-orange-400 hover:text-orange-300"
                      >
                        Open meeting link
                      </a>
                    ) : null}
                  </div>
                ) : null}

                {location.note ? (
                  <div className="mt-5 border-l-4 border-orange-400 bg-orange-500/5 px-4 py-3 text-sm leading-6 text-muted-foreground">
                    {location.note}
                  </div>
                ) : null}

                {mapUrl ? (
                  <div className="mt-auto pt-8">
                    <Button
                      asChild
                      variant="outline"
                      className="w-full border-orange-500/30 text-orange-400 hover:bg-orange-500/10"
                    >
                      <a href={mapUrl} target="_blank" rel="noreferrer">
                        View Venue Map
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                ) : null}
              </div>
            </article>
          ) : null}

          {contacts.length > 0 || mentorNote ? (
            <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card/80">
              <header className="flex items-center gap-4 border-b border-border px-5 py-5 sm:px-6">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-orange-500/10 text-orange-400">
                  <Headphones className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg font-bold text-foreground">
                    Contact Support
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Dedicated organizer and technical assistance
                  </p>
                </div>
              </header>

              <div className="flex flex-1 flex-col p-5 sm:p-6">
                {contacts.length > 0 ? (
                  <div className="grid items-stretch gap-4 sm:grid-cols-2">
                    {contacts.map((contact, index) => (
                      <ContactRow
                        key={`${contact.email || contact.phone || contact.name || contact.title}-${index}`}
                        contact={contact}
                      />
                    ))}
                  </div>
                ) : null}

                {mentorNote ? (
                  <div className="mt-4 rounded-xl border border-orange-500/20 bg-orange-500/10 p-4 text-sm leading-6 text-foreground">
                    {mentorNote}
                  </div>
                ) : null}

                {hasFaq ? (
                  <div className="mt-auto pt-6">
                    <div className="flex flex-col gap-5 rounded-xl border border-border bg-background/70 p-5 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-start gap-3">
                        <CircleHelp className="mt-0.5 h-6 w-6 shrink-0 text-orange-400" />
                        <div>
                          <p className="font-semibold text-foreground">
                            Need immediate help?
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Check the frequently asked questions first.
                          </p>
                        </div>
                      </div>
                      <Button asChild variant="secondary" className="shrink-0">
                        <a
                          href="#event-faq"
                          onClick={(event) => {
                            event.preventDefault();
                            document
                              .getElementById("event-faq")
                              ?.scrollIntoView({
                                behavior: "smooth",
                                block: "start",
                              });
                          }}
                        >
                          View FAQ
                        </a>
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            </article>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function ContactRow({ contact }: { contact: ApiContact }) {
  const label = contact.label || contact.type || "Contact";
  const title = contact.name || contact.title;
  const note = [contact.detail, contact.responseTime]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className="flex h-full flex-col rounded-xl border border-border bg-muted/25 p-5">
      <div className="mb-5 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {label}
        </p>
        <Headphones className="h-4 w-4 text-orange-400/70" />
      </div>

      {title ? (
        <p className="mb-5 text-base font-semibold leading-6 text-foreground">
          {title}
        </p>
      ) : null}

      <div className="mt-auto grid gap-3 text-sm">
        {contact.email ? (
          <a
            href={`mailto:${contact.email}`}
            className="flex min-w-0 items-center gap-2 text-muted-foreground transition-colors hover:text-orange-300"
          >
            <Mail className="h-3.5 w-3.5 shrink-0 text-orange-400" />
            <span className="truncate">{contact.email}</span>
          </a>
        ) : null}

        {contact.phone ? (
          <a
            href={`tel:${contact.phone.replace(/\s/g, "")}`}
            className="flex min-w-0 items-center gap-2 text-muted-foreground transition-colors hover:text-orange-300"
          >
            <Phone className="h-3.5 w-3.5 shrink-0 text-orange-400" />
            <span>{contact.phone}</span>
          </a>
        ) : null}

        {note ? (
          <p className="flex items-start gap-2 text-muted-foreground">
            <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-orange-400" />
            <span>{note}</span>
          </p>
        ) : null}
      </div>
    </article>
  );
}

function FAQSection({ items }: { items: FAQItem[] }) {
  if (!items.length) return null;

  return (
    <section id="event-faq" className="mb-4 scroll-mt-24">
      <SectionHeader
        eyebrow="FAQ"
        title="Frequently Asked Questions"
        subtitle="Quick answers for participants before and during the competition."
      />

      <Accordion.Root type="single" collapsible className="space-y-3">
        {items.map((faq, index) => (
          <Accordion.Item
            key={faq.question}
            value={`faq-${index}`}
            className="group overflow-hidden rounded-2xl border border-white/10 bg-card/70 transition-colors hover:border-orange-500/30"
          >
            <Accordion.Header>
              <Accordion.Trigger className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-orange-500/5">
                <span className="text-sm font-semibold text-foreground sm:text-base">
                  {faq.question}
                </span>
                <ChevronDown className="h-4 w-4 shrink-0 text-orange-400 transition-transform duration-300 group-data-[state=open]:rotate-180" />
              </Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Content className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
              <div className="border-t border-white/10 px-5 pb-5 pt-4">
                <p className="text-sm leading-6 text-muted-foreground">
                  {faq.answer}
                </p>
              </div>
            </Accordion.Content>
          </Accordion.Item>
        ))}
      </Accordion.Root>
    </section>
  );
}

export default function EventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const eventId = params.id as string;
  const [registerOpen, setRegisterOpen] = useState(false);

  // Fetch Current User
  const { data: user } = useQuery<UserAccount | null>({
    queryKey: ["userProfile"],
    queryFn: async () => {
      const token = useAuthStore.getState().accessToken;
      if (!token) return null;
      const res = await axiosClient.get("/users/profile");
      return res.data?.data;
    },
  });

  const userRole = user?.role?.toLowerCase();

  // Fetch Public Event Details
  const { data: event, isLoading: isEventLoading } = useQuery<EventDetail>({
    queryKey: ["publicEvent", eventId],
    queryFn: async () => {
      const res = await axiosClient.get(`/public/events/${eventId}`);
      return res.data.data;
    },
  });

  // Deep-link fallback: /register page redirects here with ?register=1
  useEffect(() => {
    if (searchParams.get("register") === "1" && userRole === "student") {
      setRegisterOpen(true);
    }
  }, [searchParams, userRole]);

  const handleRegisterOpenChange = (open: boolean) => {
    setRegisterOpen(open);
    if (!open && searchParams.get("register") === "1") {
      router.replace(pathname, { scroll: false });
    }
  };

  // Fetch Student Registration Status (Only if student)
  const { data: studentInfo, isLoading: isStudentLoading } = useQuery({
    queryKey: ["studentEventStatus", eventId],
    queryFn: async () => {
      const res = await axiosClient.get(`/student/teams/status/${eventId}`);
      return res.data.data;
    },
    enabled: !!user && user.role === "student",
  });

  const isStudentParticipant = Boolean(
    studentInfo?.individualRegistration || studentInfo?.teamInfo,
  );
  const { data: studentOnlineMeeting } = useQuery({
    queryKey: ["studentOnlineMeeting", eventId],
    queryFn: () => getStudentOnlineMeeting(eventId),
    enabled:
      userRole === "student" &&
      isStudentParticipant &&
      isOnlineMeetingPublished(event?.status),
    retry: false,
  });

  // Fetch Pending Invitations to check if we need to show an alert
  const { data: pendingInvitations } = useQuery({
    queryKey: ["pendingInvitations"],
    queryFn: async () => {
      const res = await axiosClient.get("/student/teams/invitations/pending");
      return res.data.data;
    },
    enabled: !!user && userRole === "student",
  });

  const teamStatus = studentInfo?.teamInfo?.team?.status;
  const hasApprovedTeam =
    !!studentInfo?.teamInfo?.team && teamStatus === "approved";

  const { data: assignedMentor, isLoading: isMentorLoading } = useQuery({
    queryKey: ["studentAssignedMentor", eventId],
    queryFn: () => getStudentAssignedMentor(eventId),
    enabled: !!user && userRole === "student" && hasApprovedTeam,
    retry: false,
  });

  // Fetch Stakeholder Data
  const { data: judgeEvents } = useQuery<JudgeEvent[]>({
    queryKey: ["judgeEvents"],
    queryFn: async () => {
      const res = await axiosClient.get("/judge/events");
      return res.data?.data ?? [];
    },
    enabled: !!user && userRole === "stakeholder",
  });

  const { data: mentorTeams } = useQuery<MentorTeam[]>({
    queryKey: ["mentorTeams", eventId],
    queryFn: () => getMentorTeams(eventId),
    enabled: !!user && userRole === "stakeholder",
  });

  const isJudgeForEvent = judgeEvents?.some(
    (e) => Number(e.id) === Number(eventId),
  );
  const isMentorForEvent = mentorTeams?.some(
    (t) =>
      Number(t.event?.id) === Number(eventId) ||
      Number(t.eventId) === Number(eventId),
  );

  const notificationShown = useRef(false);

  useEffect(() => {
    if (userRole === "stakeholder" && !notificationShown.current) {
      if (isJudgeForEvent && isMentorForEvent) {
        enqueueSnackbar(
          "You have been assigned as both a Mentor and Judge for this event!",
          { variant: "info", preventDuplicate: true },
        );
        notificationShown.current = true;
      } else if (isJudgeForEvent) {
        enqueueSnackbar("You have been assigned as a Judge for this event!", {
          variant: "info",
          preventDuplicate: true,
        });
        notificationShown.current = true;
      } else if (isMentorForEvent) {
        enqueueSnackbar("You have been assigned as a Mentor for this event!", {
          variant: "info",
          preventDuplicate: true,
        });
        notificationShown.current = true;
      }
    }
  }, [userRole, isJudgeForEvent, isMentorForEvent]);

  const eventPendingInvitations =
    (pendingInvitations as PendingInvitation[] | undefined)?.filter(
      (inv) => Number(inv.team?.eventId) === Number(eventId),
    ) || [];

  if (isEventLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="flex-1 flex justify-center items-center">
          <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-orange-500"></div>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="flex-1 flex justify-center items-center">
          <p className="text-xl text-muted-foreground">Event not found.</p>
        </div>
      </div>
    );
  }

  const eventRuleGroups = normalizeRuleGroups(event);
  const eventFaqItems = normalizeFaqItems(event);
  const eventLocation = normalizeLocation(event);
  const eventContacts = normalizeContacts(event);
  const mentorSupportNote = event.support?.mentorNote;
  const eventImageUrl = event.imageUrl || event.image_url;
  const prizePoolTotals = calculatePrizePoolTotals(event.prizes);
  const onlineMeeting: OnlineMeetingDetails | null = isOnlineMeetingPublished(
    event.status,
  )
    ? event.calendarMeeting ||
      studentOnlineMeeting ||
      (eventLocation?.meetingUrl
        ? {
            platform: eventLocation.meetingPlatform || eventLocation.platform,
            meetUrl: eventLocation.meetingUrl,
          }
        : null)
    : null;
  const publicEventLocation = (() => {
    if (onlineMeeting) {
      return {
        ...(eventLocation || {}),
        meetingPlatform: onlineMeeting.platform || "Google Meet",
        meetingUrl:
          onlineMeeting.meetUrl || onlineMeeting.htmlLink || undefined,
      };
    }

    if (!eventLocation) return null;
    return {
      ...eventLocation,
      meetingPlatform: undefined,
      platform: undefined,
      meetingUrl: undefined,
    };
  })();

  // Render Action Button based on Role
  const renderActionButton = () => {
    // 1. Unauthenticated
    if (!user) {
      if (event.isTeamRegistrationFull) {
        return (
          <Button size="lg" disabled className="w-full sm:w-auto px-8">
            Event Full ({event.registeredTeams ?? event.maxTeams}/
            {event.maxTeams} Teams)
          </Button>
        );
      }

      return (
        <>
          <Link href="/login">
            <Button
              size="lg"
              className="w-full sm:w-auto px-8 bg-orange-500 hover:bg-orange-600"
            >
              Login to Register
            </Button>
          </Link>
          {event.githubOrgUrl && (
            <a
              href={event.githubOrgUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto"
            >
              <Button
                variant="outline"
                size="sm"
                className="h-10 w-full rounded-xl border-border/80 bg-card/80 px-4 text-sm font-semibold text-foreground shadow-sm backdrop-blur-sm transition-all hover:bg-accent hover:text-accent-foreground sm:w-auto"
              >
                <ExternalLink className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
                GitHub
              </Button>
            </a>
          )}
        </>
      );
    }

    // 2. Organizer or Admin
    if (userRole === "organizer" || userRole === "admin") {
      return (
        <>
          <Link href={`/organizer/events/${eventId}`}>
            <Button
              size="lg"
              className="w-full sm:w-auto px-8 bg-blue-600 hover:bg-blue-700"
            >
              Manage Event (Admin)
            </Button>
          </Link>
          {event.githubOrgUrl && (
            <a
              href={event.githubOrgUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto"
            >
              <Button
                variant="outline"
                size="sm"
                className="h-10 w-full rounded-xl border-border/80 bg-card/80 px-4 text-sm font-semibold text-foreground shadow-sm backdrop-blur-sm transition-all hover:bg-accent hover:text-accent-foreground sm:w-auto"
              >
                <ExternalLink className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
                GitHub
              </Button>
            </a>
          )}
        </>
      );
    }

    // 3. Student
    if (userRole === "student") {
      if (isStudentLoading) {
        return <Button disabled>Loading status...</Button>;
      }

      // Check if student is already registered
      if (studentInfo?.individualRegistration || studentInfo?.teamInfo) {
        const teamInfo = studentInfo.teamInfo;
        const memberStatus = teamInfo?.status;
        const teamStatus = teamInfo?.team?.status || "registered";
        const displayStatus =
          memberStatus === "pending" ? "Invitation Pending" : teamStatus;
        const canEnterWorkspace = ["active", "ongoing"].includes(
          event.status?.toLowerCase() || "",
        );

        return (
          <>
            <div className="flex min-h-10 w-full flex-col justify-between gap-2 rounded-lg border border-border/60 bg-card/55 px-4 py-2 shadow-sm backdrop-blur-md sm:w-auto sm:flex-row sm:items-center">
              <div className="flex items-center gap-3">
                <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Users className="h-4 w-4 text-orange-500" />
                  {teamInfo
                    ? `Team: ${teamInfo.team.name}`
                    : "Individual Registration"}
                </p>
                <div className="text-xs text-muted-foreground uppercase font-medium flex items-center gap-1.5">
                  {event.status === "closed" ? (
                    teamInfo?.team?.award ? (
                      <span className="flex items-center gap-1.5 text-yellow-500 font-bold">
                        <Trophy className="h-3.5 w-3.5" />
                        {teamInfo.team.award.name}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">COMPLETED</span>
                    )
                  ) : (
                    <>
                      <span className="relative flex h-2 w-2">
                        {displayStatus === "pending" && (
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                        )}
                        <span
                          className={`relative inline-flex rounded-full h-2 w-2 ${displayStatus === "pending" || displayStatus === "Invitation Pending" ? "bg-yellow-500" : displayStatus === "approved" ? "bg-green-500" : "bg-red-500"}`}
                        ></span>
                      </span>
                      <span className="text-foreground">{displayStatus}</span>
                    </>
                  )}
                </div>
              </div>

              {displayStatus === "pending" && teamInfo?.role === "leader" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRegisterOpen(true)}
                  className="border-orange-500/30 text-orange-500 hover:bg-orange-500/10 hover:text-orange-600 transition-colors"
                >
                  Edit Registration
                </Button>
              )}
              {(displayStatus === "rejected" ||
                displayStatus === "disqualified") &&
                (event.isTeamRegistrationFull ? (
                  <Button size="sm" disabled>
                    Event Full
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => setRegisterOpen(true)}
                    className="bg-orange-500 hover:bg-orange-600 text-white transition-colors"
                  >
                    Register Again
                  </Button>
                ))}
            </div>

            {event.githubOrgUrl && (
              <a
                href={event.githubOrgUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto"
              >
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 w-full rounded-xl border-border/80 bg-card/80 px-4 text-sm font-semibold text-foreground shadow-sm backdrop-blur-sm transition-all hover:bg-accent hover:text-accent-foreground sm:w-auto"
                >
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
                  GitHub
                </Button>
              </a>
            )}
            {displayStatus === "approved" && (
              <Link
                href={`/student/events/${eventId}/workspace`}
                className="w-full sm:w-auto"
              >
                <Button
                  size="sm"
                  className="group relative inline-flex h-10 w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 px-5 text-sm font-bold text-white shadow-md shadow-orange-500/25 transition-all duration-300 hover:from-orange-600 hover:to-amber-600 hover:shadow-lg hover:shadow-orange-500/40 hover:scale-[1.02] active:scale-[0.98] sm:w-auto"
                >
                  <span>
                    {canEnterWorkspace ? "Workspace" : "View Workspace"}
                  </span>
                  <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                </Button>
              </Link>
            )}

            {displayStatus === "approved" && event.status === "closed" && (
              <div className="w-full order-first mb-2 bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 text-sm text-blue-700 dark:text-blue-400 flex items-start gap-3 shadow-sm">
                {teamInfo?.team?.award ? (
                  <>
                    <Trophy className="h-5 w-5 shrink-0 mt-0.5 text-yellow-500" />
                    <div>
                      <p className="font-semibold text-yellow-600 dark:text-yellow-500">
                        Congratulations! Your team won the{" "}
                        {teamInfo.team.award.name}!
                      </p>
                      <p className="text-xs opacity-90 mt-1">
                        {
                          'This event has concluded. Click "View Workspace" to review your team\'s complete activity history, submissions, and feedback from the judges.'
                        }
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <Award className="h-5 w-5 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">A Memorable Journey!</p>
                      <p className="text-xs opacity-90 mt-1">
                        {
                          "This event has concluded. Although you didn't win the top prize, your team's efforts are commendable. Click \"View Workspace\" to review your activity history."
                        }
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        );
      }

      // Not registered, check event status and registration dates
      if (!isRegistrationOpen(event)) {
        return (
          <Button size="lg" disabled className="w-full sm:w-auto px-8">
            Registration Closed
          </Button>
        );
      }

      if (eventPendingInvitations.length > 0) {
        return (
          <Button
            size="lg"
            disabled
            title="Bạn đang có lời mời vào nhóm chờ xử lý. Vui lòng hủy hoặc từ chối lời mời trước khi đăng ký event."
            className="w-full sm:w-auto px-8 bg-orange-500/50 cursor-not-allowed"
          >
            Register Now
          </Button>
        );
      }

      return (
        <Button
          size="lg"
          onClick={() => setRegisterOpen(true)}
          className="w-full sm:w-auto px-8 bg-orange-500 hover:bg-orange-600"
        >
          Register Now
        </Button>
      );
    }

    // 4. Stakeholder (Judge/Mentor)
    if (userRole === "stakeholder") {
      if (isJudgeForEvent || isMentorForEvent) {
        return (
          <div className="flex gap-4">
            {isJudgeForEvent && (
              <Link href={`/judge/events/${eventId}/dashboard`}>
                <Button
                  size="lg"
                  className="w-full sm:w-auto px-8 bg-purple-600 hover:bg-purple-700 text-white"
                >
                  Enter Judge Workspace
                </Button>
              </Link>
            )}
            {isMentorForEvent && (
              <Link href={`/mentor/events/${eventId}/teams`}>
                <Button
                  size="lg"
                  className="w-full sm:w-auto px-8 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Enter Mentor Workspace
                </Button>
              </Link>
            )}
          </div>
        );
      }
      return (
        <Button size="lg" disabled className="w-full sm:w-auto px-8">
          Not Assigned to Event
        </Button>
      );
    }

    return null;
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <main className="flex-1 container mx-auto px-4 py-12 max-w-5xl">
        <Link
          href="/home"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-8"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Events
        </Link>

        {/* Hero Banner */}
        <div className="relative rounded-3xl overflow-hidden bg-card border border-border p-8 md:p-12 mb-12 shadow-2xl">
          {eventImageUrl && (
            <>
              <Image
                src={eventImageUrl}
                alt={event.name || "Event image"}
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 1024px"
                className="object-cover opacity-60"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-background via-background/70 to-transparent" />
            </>
          )}
          <div className="absolute top-0 right-0 h-64 w-64 rounded-full bg-orange-500/10 blur-[100px]" />

          <div className="relative z-10">
            <div className="flex items-center justify-between gap-3 mb-6 w-full">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-500 text-sm font-medium">
                <Calendar className="h-4 w-4" />
                {event.season} {event.year}
              </div>
              {event.status && (
                <div
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${
                    event.status === "closed"
                      ? "bg-muted/50 text-muted-foreground border border-border/50"
                      : event.status === "ongoing"
                        ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                        : event.status === "active"
                          ? "bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20"
                          : "bg-muted text-muted-foreground border border-border"
                  }`}
                >
                  <div
                    className={`h-1.5 w-1.5 rounded-full ${
                      event.status === "closed"
                        ? "bg-muted-foreground"
                        : event.status === "ongoing"
                          ? "bg-blue-500"
                          : event.status === "active"
                            ? "bg-green-500"
                            : "bg-muted-foreground"
                    }`}
                  />
                  {event.status}
                </div>
              )}
            </div>

            <h1 className="text-4xl md:text-5xl font-black text-foreground mb-6">
              {event.name}
            </h1>

            <p className="text-lg text-muted-foreground max-w-2xl mb-8 leading-relaxed">
              {event.description}
            </p>

            <div className="flex flex-wrap gap-4 mb-8">
              <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-4 py-3 border border-border">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider">
                    Registration Deadline
                  </div>
                  <div className="font-semibold text-foreground">
                    {event.registrationDeadline
                      ? new Date(
                          event.registrationDeadline,
                        ).toLocaleDateString()
                      : "TBA"}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-4 py-3 border border-border">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider">
                    Start Date
                  </div>
                  <div className="font-semibold text-foreground">
                    {event.startDate
                      ? new Date(event.startDate).toLocaleDateString()
                      : "TBA"}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-4 py-3 border border-border">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider">
                    End Date
                  </div>
                  <div className="font-semibold text-foreground">
                    {event.endDate
                      ? new Date(event.endDate).toLocaleDateString()
                      : "TBA"}
                  </div>
                </div>
              </div>
              {event.prizes && event.prizes.length > 0 && (
                <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-4 py-3 border border-border">
                  <Trophy className="h-5 w-5 text-yellow-500" />
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider">
                      Prize up to
                    </div>
                    <div className="flex flex-wrap gap-x-2 font-semibold text-foreground">
                      {prizePoolTotals.map((total) => (
                        <span key={total.currency}>
                          {formatPrizeAmount(total.amount, total.currency)}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex w-full flex-wrap items-center gap-2">
              {renderActionButton()}
            </div>
          </div>
        </div>

        <OnlineMeetingCard
          meeting={onlineMeeting}
          eventStatus={event.status}
          className="mb-12"
        />

        {event.status?.toLowerCase() === "closed" && (
          <section className="relative mb-12 overflow-hidden rounded-3xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-card to-background p-6 shadow-xl md:p-8">
            <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-amber-400/15 blur-[80px]" />
            <div className="relative">
              <div className="mb-7 flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-amber-400/30 bg-amber-400/15 text-amber-400">
                  <Trophy className="h-7 w-7" />
                </div>
                <div>
                  <Badge
                    variant="outline"
                    className="mb-3 border-amber-400/30 bg-amber-400/10 text-amber-400"
                  >
                    Event completed
                  </Badge>
                  <h2 className="text-2xl font-bold text-foreground">
                    Event Achievements
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Awarded teams at {event.name}.
                  </p>
                </div>
              </div>

              {event.eventAchievements && event.eventAchievements.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {event.eventAchievements.map((achievement) => (
                    <article
                      key={achievement.id}
                      className="rounded-2xl border border-amber-400/20 bg-background/55 p-5 backdrop-blur-sm"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-400/15 text-amber-400">
                          <Award className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="truncate text-lg font-bold text-foreground">
                            {achievement.award?.name || "Official achievement"}
                          </h3>
                          <p className="truncate text-sm font-semibold text-amber-400">
                            {achievement.name}
                          </p>
                        </div>
                      </div>
                      <p className="mt-3 text-sm text-muted-foreground">
                        {achievement.award?.description ||
                          "Awarded by the event organizer"}
                      </p>
                      {achievement.track?.name ? (
                        <Badge
                          variant="outline"
                          className="mt-4 border-border text-muted-foreground"
                        >
                          {achievement.track.name}
                        </Badge>
                      ) : null}
                    </article>
                  ))}
                </div>
              ) : (
                <p className="rounded-2xl border border-border bg-background/40 p-5 text-sm text-muted-foreground">
                  No team achievements have been announced for this event.
                </p>
              )}
            </div>
          </section>
        )}

        {/* Pending Invitations Alert */}
        {eventPendingInvitations.length > 0 && (
          <div className="mb-12 bg-orange-500/10 border border-orange-500/30 rounded-2xl p-4 flex items-center justify-between text-orange-600 dark:text-orange-400">
            <div className="flex items-center gap-3">
              <BellRing className="h-5 w-5 animate-pulse" />
              <span className="font-medium">
                You have {eventPendingInvitations.length} pending team
                invitation(s) for this event. Please check your notifications
                bell on the header to accept or reject them.
              </span>
            </div>
          </div>
        )}

        {user?.role === "student" && hasApprovedTeam && (
          <div className="mb-12">
            <div className="rounded-3xl border border-border bg-card p-6 shadow-lg">
              <div className="mb-5 flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-orange-500" />
                <h2 className="text-lg font-semibold text-foreground">
                  Your Mentor
                </h2>
              </div>

              {isMentorLoading ? (
                <div className="h-20 animate-pulse rounded-2xl bg-muted" />
              ) : assignedMentor ? (
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-16 w-16 border border-orange-500/30">
                      {assignedMentor.avatarUrl || assignedMentor.avatar_url ? (
                        <AvatarImage
                          src={
                            assignedMentor.avatarUrl ||
                            assignedMentor.avatar_url ||
                            undefined
                          }
                          alt={assignedMentor.name || "Assigned mentor"}
                        />
                      ) : null}
                      <AvatarFallback className="text-lg">
                        {getInitials(assignedMentor.name)}
                      </AvatarFallback>
                    </Avatar>

                    <div>
                      <p className="text-lg font-semibold text-foreground">
                        {assignedMentor.name || "Assigned Mentor"}
                      </p>
                      <p className="mt-1 text-sm text-orange-500">
                        {assignedMentor.stakeholderProfile?.jobTitle ||
                          "Event Mentor"}
                        {assignedMentor.stakeholderProfile?.organization ||
                        assignedMentor.stakeholderProfile?.organizationName
                          ? ` · ${
                              assignedMentor.stakeholderProfile.organization ||
                              assignedMentor.stakeholderProfile.organizationName
                            }`
                          : ""}
                      </p>
                      {assignedMentor.email ? (
                        <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                          <Mail className="h-4 w-4" />
                          {assignedMentor.email}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <Button asChild variant="outline">
                    <Link href={`/student/events/${eventId}/workspace/mentor`}>
                      Open Mentor Workspace
                    </Link>
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No mentor has been assigned to your team yet.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Tracks — catalog hidden for deferred (Flow B); teams see assignment in workspace only */}
        {(() => {
          const isDeferred = Boolean(event.deferredTrackAssignment);
          const visibleTracks = isDeferred ? [] : (event.tracks ?? []);

          if (!isDeferred && visibleTracks.length === 0) {
            return null;
          }

          return (
            <div className="mb-12">
              <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-2">
                <Users className="h-6 w-6 text-orange-500" />
                Competition Tracks
              </h2>
              {isDeferred ? (
                <div className="rounded-2xl border border-border bg-card p-6">
                  <p className="font-semibold text-foreground">
                    Track được bốc thăm một lần trước ngày thi
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    BTC gán track ngẫu nhiên cho từng đội (Day 1). Sau khi gán,
                    track giữ nguyên suốt cuộc thi — kể cả vòng chung kết.
                  </p>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-6">
                  {visibleTracks.map((track) => (
                    <div
                      key={track.id}
                      className="flex h-full flex-col rounded-2xl border border-border bg-card p-6 transition-colors hover:border-orange-500/30"
                    >
                      <h3 className="text-xl font-bold text-foreground mb-3">
                        {track.name}
                      </h3>
                      <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
                        {track.description}
                      </p>
                      <div className="mt-auto flex items-center justify-between rounded-lg border border-border/50 bg-muted/50 p-3 text-sm font-medium">
                        <span className="text-muted-foreground">Team Size:</span>
                        <span className="text-foreground">
                          {event.minMembersPerTeam ?? 1}–
                          {event.maxMembersPerTeam ?? 4} members
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        {/* Prizes Section */}
        {event.prizes && event.prizes.length > 0 && (
          <div className="mb-12">
            <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-2">
              <Trophy className="h-6 w-6 text-amber-500" />
              Prizes & Awards
            </h2>
            {prizePoolTotals.length > 0 && (
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-5 py-4">
                <span className="font-semibold text-foreground">
                  Total prize pool
                </span>
                <div className="flex flex-wrap gap-2">
                  {prizePoolTotals.map((total) => (
                    <span
                      key={total.currency}
                      className="rounded-lg bg-background/70 px-3 py-1.5 font-bold text-amber-600"
                    >
                      {formatPrizeAmount(total.amount, total.currency)}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="grid sm:grid-cols-2 gap-6">
              {event.prizes.map((prize, index) => (
                <div
                  key={prize.id || index}
                  className="bg-card border border-border rounded-2xl p-6 hover:border-amber-500/30 transition-colors shadow-sm relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Trophy className="h-24 w-24 text-amber-500" />
                  </div>
                  <div className="relative z-10">
                    <h3 className="text-xl font-bold text-amber-500 mb-2">
                      {prize.name}
                    </h3>
                    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      {getPrizePlacementLabel(prize.placement)}
                    </p>
                    <p className="mb-3 text-2xl font-black text-foreground">
                      {formatPrizeAmount(prize.amount, prize.currency)}
                    </p>
                    {prize.description && (
                      <p className="text-muted-foreground text-sm font-medium mb-4">
                        {prize.description}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <RulesSection groups={eventRuleGroups} />
        <SupportLocationSection
          location={publicEventLocation}
          contacts={eventContacts}
          mentorNote={mentorSupportNote}
          hasFaq={eventFaqItems.length > 0}
        />
        <FAQSection items={eventFaqItems} />
      </main>

      {userRole === "student" && (
        <EventRegisterDialog
          eventId={eventId}
          open={registerOpen}
          onOpenChange={handleRegisterOpenChange}
        />
      )}
    </div>
  );
}
