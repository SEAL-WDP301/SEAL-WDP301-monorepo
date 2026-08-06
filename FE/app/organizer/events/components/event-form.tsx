"use client";

import {
  useForm,
  useFieldArray,
  useWatch,
  type FieldErrors,
  type FieldPath,
  type Resolver,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Trash2,
  Info,
  Trophy,
  GitMerge,
  FileText,
  Calendar,
  Link as LinkIcon,
  Loader2,
  Save,
  CheckCircle2,
  MapPin,
  Phone,
  HelpCircle,
  ListChecks,
  Image as ImageIcon,
  UploadCloud,
  GripVertical,
  Sparkles,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { enqueueSnackbar } from "notistack";
import {
  useState,
  useMemo,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  createGoogleCalendarMeeting,
  createOrganizerEvent,
  getGoogleCalendarAuthorizationUrl,
  getGoogleCalendarStatus,
  updateGoogleCalendarMeeting,
  updateOrganizerEvent,
  type OrganizerEvent,
  type OrganizerEventContact,
  type OrganizerEventFAQItem,
  type OrganizerEventPayload,
} from "@/lib/api/organizer-events.api";
import { uploadFile } from "@/lib/api/upload.api";
import { cn } from "@/lib/utils";
import { ImageCropper } from "@/components/ui/image-cropper";
import {
  buildGoogleMapsSearchUrl,
  getEventMapUrl,
} from "@/lib/events/location";
import { shouldSyncGoogleCalendarMeeting } from "@/lib/events/calendar-meeting";
import {
  calculatePrizePoolTotals,
  formatPrizeAmount,
  getNextPrizePlacement,
  getPrizeAmountOrderViolations,
  normalizePrizeOrder,
  reorderRankedPrizes,
} from "@/lib/events/prizes";
import {
  createDefaultEventSchedule,
  getEventSeason,
} from "@/lib/events/event-defaults";

const defaultLocation = {
  venueName: "FPT University Ho Chi Minh City",
  room: "Innovation Hall",
  address: "Lô E2a-7, Đường D1, Khu Công nghệ cao, TP. Thủ Đức, TP.HCM",
  meetingPlatform: "Google Meet",
  meetingUrl: "https://meet.google.com/",
  mapUrl: buildGoogleMapsSearchUrl(
    "FPT University Ho Chi Minh City, Lô E2a-7, Đường D1, Khu Công nghệ cao, TP. Thủ Đức, TP.HCM",
  ),
  note: "Teams will receive detailed room allocation before the event day.",
};

type StoredGoogleMeetConfig = {
  createGoogleMeetOnOngoing?: boolean;
  meetingStartDate?: string;
  meetingEndDate?: string;
  timeZone?: string;
};

const defaultContacts = [
  {
    label: "Organizer Support",
    name: "SEAL Organizing Committee",
    email: "seal@fe.edu.vn",
    phone: "0123 456 789",
    detail:
      "Questions about registration, teams, schedules, and event logistics.",
    responseTime: "Within 24 hours",
  },
  {
    label: "Technical Support",
    name: "SEAL Technical Team",
    email: "tech.seal@fe.edu.vn",
    phone: "0987 654 321",
    detail:
      "Support for GitHub, submissions, file upload, and workspace access.",
    responseTime: "During competition hours",
  },
];

const defaultRuleGroups = [
  {
    title: "Team Rules",
    itemsText: [
      "Each team must follow the official team size configured for its track.",
      "Participants must use their registered account and team workspace.",
      "Team members are responsible for keeping project work original and transparent.",
    ].join("\n"),
  },
  {
    title: "Submission Rules",
    itemsText: [
      "Submit before the round deadline shown in the event workspace.",
      "GitHub repositories or uploaded files must be accessible to organizers and judges.",
      "Late, inaccessible, or incomplete submissions may not be evaluated.",
    ].join("\n"),
  },
  {
    title: "Judging Rules",
    itemsText: [
      "Projects are evaluated using the official rubric for each round.",
      "Judge decisions are based on submitted work, presentation, and rule compliance.",
      "Organizers may request clarification when submission evidence is unclear.",
    ].join("\n"),
  },
];

const defaultFaqItems = [
  {
    question: "Who can join this event?",
    answer:
      "Students who meet the event eligibility rules can register individually or as part of a team, depending on organizer settings.",
  },
  {
    question: "Can a team update its submission?",
    answer:
      "Teams can update submissions while the round is still open. After the deadline, submissions are locked for evaluation.",
  },
  {
    question: "Where will announcements be posted?",
    answer:
      "Official announcements are posted in the event workspace and may also be sent through registered contact channels.",
  },
];

interface RuleGroupSource {
  title?: string;
  name?: string;
  category?: string;
  rules?: string[];
}

function linesToList(value?: string) {
  return (value || "")
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseJsonSafe<T>(jsonStr: string | null | undefined, fallback: T): T {
  if (!jsonStr) return fallback;
  try {
    return JSON.parse(jsonStr) as T;
  } catch {
    return fallback;
  }
}

function toDateTimeLocalValue(value: string) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}

function getApiStatus(error: unknown) {
  return (error as { response?: { status?: number } })?.response?.status;
}

function normalizeRuleGroups(event?: OrganizerEvent) {
  const rulesArray = parseJsonSafe<RuleGroupSource[]>(event?.rules, []);
  if (!rulesArray.length) return defaultRuleGroups;
  return rulesArray.map((group) => ({
    title: group.title || group.name || group.category || "Rules",
    itemsText: (group.rules || []).join("\n"),
  }));
}

function normalizeFaqItems(event?: OrganizerEvent) {
  if (!event?.faq?.length) return defaultFaqItems;
  return event.faq.map((faq: OrganizerEventFAQItem) => ({
    question: faq.question || faq.q || faq.title || "",
    answer: faq.answer || faq.a || faq.content || "",
  }));
}

const createEventSchema = (isEdit: boolean) =>
  z
    .object({
      name: z.string().min(1, "Name is required").max(100, "Name is too long"),
      description: z.string().max(2000, "Description is too long").optional(),
      imageUrl: z
        .string()
        .trim()
        .url("Invalid image URL")
        .refine(
          (value) => /^https?:\/\//i.test(value),
          "Image URL must use HTTP or HTTPS",
        )
        .optional()
        .or(z.literal("")),
      season: z.enum(["Spring", "Summer", "Fall"]),
      year: z.coerce
        .number()
        .int("Year must be an integer")
        .min(2020, "Year must be >= 2020")
        .max(
          new Date().getFullYear() + 5,
          "Year cannot exceed 5 years in the future",
        ),
      maxTeams: z.coerce
        .number()
        .int("Maximum teams must be an integer")
        .min(1, "Maximum teams must be at least 1")
        .max(1000, "Maximum teams cannot exceed 1000"),
      /**
       * ON  → define tracks now; students pick a track when registering.
       * OFF → create without tracks (Flow B); add later in Tracks & Rounds,
       *       then assign randomly when a round opens.
       */
      useTracks: z.boolean().default(false),
      deferredTrackAssignment: z.boolean().default(true),
      minMembersPerTeam: z.coerce
        .number()
        .int("Minimum members must be an integer")
        .min(1, "Minimum members must be at least 1")
        .max(20, "Minimum members cannot exceed 20"),
      maxMembersPerTeam: z.coerce
        .number()
        .int("Maximum members must be an integer")
        .min(1, "Maximum members must be at least 1")
        .max(20, "Maximum members cannot exceed 20"),
      status: z.enum(["draft", "active", "ongoing", "closed"]).optional(),
      registrationDeadline: z.string().optional(),
      startDate: z.string().optional(),
      endDate: isEdit
        ? z.string().optional()
        : z.string().min(1, "End date is required"),
      githubOrgUrl: z
        .string()
        .url("Invalid GitHub URL")
        .includes("github.com", { message: "Must be a github.com URL" })
        .optional()
        .or(z.literal("")),
      prizes: z
        .array(
          z.object({
            id: z.number().optional(),
            name: z.string().min(1, "Prize name is required"),
            description: z.string().optional(),
            quantity: z
              .union([
                z.coerce.number().int().min(1, "Quantity must be >= 1"),
                z.literal(""),
              ])
              .optional()
              .transform((v) =>
                v === "" ? undefined : (v as number | undefined),
              ),
            amount: z.coerce
              .number()
              .int("Prize amount must be an integer")
              .min(0, "Prize amount cannot be negative")
              .default(0),
            placement: z
              .number()
              .int("Placement must be an integer")
              .min(1, "Placement must be at least 1")
              .nullable()
              .optional()
              .default(null),
            currency: z
              .string()
              .regex(/^[A-Z]{3}$/, "Use a three-letter currency code")
              .default("VND"),
          }),
        )
        .optional()
        .default([
          {
            name: "Champion (First Prize)",
            description: "Gold Trophy",
            quantity: 1,
            amount: 10_000_000,
            placement: 1,
            currency: "VND",
          },
          {
            name: "Second Prize (Runner-up)",
            description: "Silver Trophy",
            quantity: 1,
            amount: 5_000_000,
            placement: 2,
            currency: "VND",
          },
          {
            name: "Third Prize",
            description: "Bronze Trophy",
            quantity: 1,
            amount: 2_500_000,
            placement: 3,
            currency: "VND",
          },
          {
            name: "Honorable Mention",
            description: "Certificate",
            quantity: 1,
            amount: 1_000_000,
            placement: null,
            currency: "VND",
          },
        ]),
      tracks: z
        .array(
          z.object({
            id: z.number().optional(),
            _count: z.object({ teams: z.number().optional() }).optional(),
            name: z.string().min(1, "Track name is required"),
            description: z.string().optional(),
          }),
        )
        .default([]),
      rounds: z
        .array(
          z.object({
            id: z.number().optional(),
            _count: z.object({ submissions: z.number().optional() }).optional(),
            roundNumber: z.coerce.number().int().min(1, "Must be >= 1"),
            name: z.string().min(1, "Round name is required"),
            submissionType: z.enum(["github_link", "file"]),
            submissionDeadline: z.string().optional(),
            maxFileSizeMb: z.coerce
              .number()
              .int()
              .min(1, "Must be >= 1")
              .max(500, "Max 500MB")
              .default(20),
            isTrackSpecific: z.boolean().default(false),
            advanceCount: z.coerce
              .number()
              .int()
              .min(1, "Must be >= 1")
              .optional()
              .nullable(),
          }),
        )
        .min(1, "At least one round is required")
        .default([
          {
            roundNumber: 1,
            name: "",
            submissionType: "file",
            submissionDeadline: "",
            maxFileSizeMb: 20,
            isTrackSpecific: false,
          },
        ]),
      location: z
        .object({
          venueName: z.string().optional(),
          room: z.string().optional(),
          address: z.string().optional(),
          meetingPlatform: z.string().optional(),
          meetingUrl: z
            .string()
            .url("Invalid meeting URL")
            .optional()
            .or(z.literal("")),
          mapUrl: z
            .string()
            .url("Invalid map URL")
            .optional()
            .or(z.literal("")),
          note: z.string().optional(),
        })
        .default(defaultLocation),
      createGoogleMeet: z.boolean().default(false),
      calendarMeetingStart: z.string().optional(),
      calendarMeetingEnd: z.string().optional(),
      calendarAttendeeEmails: z.string().optional(),
      sendCalendarInvitations: z.boolean().default(true),
      notifyParticipants: z.boolean().default(true),
      contacts: z
        .array(
          z.object({
            label: z.string().optional(),
            name: z.string().optional(),
            email: z
              .string()
              .email("Invalid email")
              .optional()
              .or(z.literal("")),
            phone: z.string().optional(),
            detail: z.string().optional(),
            responseTime: z.string().optional(),
          }),
        )
        .default(defaultContacts),
      ruleGroups: z
        .array(
          z.object({
            title: z.string().min(1, "Rule group title is required"),
            itemsText: z.string().optional(),
          }),
        )
        .default(defaultRuleGroups),
      faqItems: z
        .array(
          z.object({
            question: z.string().min(1, "Question is required"),
            answer: z.string().min(1, "Answer is required"),
          }),
        )
        .default(defaultFaqItems),
    })
    .superRefine((data, ctx) => {
      const now = new Date();

      if (data.minMembersPerTeam > data.maxMembersPerTeam) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "Maximum members must be greater than or equal to minimum members",
          path: ["maxMembersPerTeam"],
        });
      }

      if (!isEdit) {
        const requireText = (
          value: string | undefined,
          path: Array<string | number>,
          label: string,
        ) => {
          if (!value?.trim()) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `${label} is required`,
              path,
            });
          }
        };

        requireText(data.description, ["description"], "Description");
        requireText(data.imageUrl, ["imageUrl"], "Cover image");
        requireText(
          data.registrationDeadline,
          ["registrationDeadline"],
          "Registration deadline",
        );
        requireText(data.startDate, ["startDate"], "Start date");
        requireText(
          data.githubOrgUrl,
          ["githubOrgUrl"],
          "GitHub organization URL",
        );

        requireText(
          data.location.venueName,
          ["location", "venueName"],
          "Venue",
        );
        requireText(data.location.room, ["location", "room"], "Room / Hall");
        requireText(data.location.address, ["location", "address"], "Address");
        requireText(
          data.location.meetingPlatform,
          ["location", "meetingPlatform"],
          "Online platform",
        );
        if (!data.createGoogleMeet) {
          requireText(
            data.location.meetingUrl,
            ["location", "meetingUrl"],
            "Meeting URL",
          );
        }
        requireText(data.location.mapUrl, ["location", "mapUrl"], "Map URL");

        if (data.contacts.length === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "At least one contact is required",
            path: ["contacts"],
          });
        }
        data.contacts.forEach((contact, index) => {
          requireText(
            contact.label,
            ["contacts", index, "label"],
            "Contact label",
          );
          requireText(
            contact.name,
            ["contacts", index, "name"],
            "Contact name",
          );
          requireText(
            contact.email,
            ["contacts", index, "email"],
            "Contact email",
          );
          requireText(
            contact.phone,
            ["contacts", index, "phone"],
            "Contact phone",
          );
          requireText(
            contact.detail,
            ["contacts", index, "detail"],
            "Contact detail",
          );
          requireText(
            contact.responseTime,
            ["contacts", index, "responseTime"],
            "Response time",
          );
        });

        if (data.ruleGroups.length === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "At least one rule group is required",
            path: ["ruleGroups"],
          });
        }
        data.ruleGroups.forEach((group, index) => {
          requireText(
            group.itemsText,
            ["ruleGroups", index, "itemsText"],
            "Rules",
          );
        });

        if (data.faqItems.length === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "At least one FAQ is required",
            path: ["faqItems"],
          });
        }

        if (data.useTracks) {
          data.tracks.forEach((track, index) => {
            requireText(
              track.description,
              ["tracks", index, "description"],
              "Track description",
            );
          });
        }

        data.rounds.forEach((round, index) => {
          requireText(
            round.submissionDeadline,
            ["rounds", index, "submissionDeadline"],
            "Round deadline",
          );
        });
      }

      if (data.useTracks && data.tracks.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Add at least one track, or turn off Use tracks",
          path: ["tracks"],
        });
      }

      const attendeeEmails = (data.calendarAttendeeEmails || "")
        .split(/[\s,;]+/)
        .map((email) => email.trim())
        .filter(Boolean);
      attendeeEmails.forEach((email) => {
        if (!z.string().email().safeParse(email).success) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Invalid attendee email: ${email}`,
            path: ["calendarAttendeeEmails"],
          });
        }
      });

      if (data.createGoogleMeet) {
        if (!data.startDate) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Start date is required to create Google Meet",
            path: ["startDate"],
          });
        }
        if (!data.endDate) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "End date is required to create Google Meet",
            path: ["endDate"],
          });
        }
        const meetingStart = data.calendarMeetingStart || data.startDate;
        const meetingEnd = data.calendarMeetingEnd || data.endDate;
        if (
          meetingStart &&
          meetingEnd &&
          new Date(meetingEnd) <= new Date(meetingStart)
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Meeting end time must be after meeting start time",
            path: ["calendarMeetingEnd"],
          });
        }
        if (
          meetingEnd &&
          data.endDate &&
          new Date(meetingEnd) > new Date(data.endDate)
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Meeting end time must not be after event end time",
            path: ["calendarMeetingEnd"],
          });
        }
      }

      if (!isEdit && data.startDate) {
        if (new Date(data.startDate) <= now) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Start date must be in the future",
            path: ["startDate"],
          });
        }
      }

      if (!isEdit && data.registrationDeadline) {
        if (new Date(data.registrationDeadline) <= now) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Registration deadline must be in the future",
            path: ["registrationDeadline"],
          });
        }
      }

      if (data.registrationDeadline && data.startDate) {
        if (new Date(data.registrationDeadline) > new Date(data.startDate)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message:
              "Registration deadline must be before or equal to the event start date",
            path: ["registrationDeadline"],
          });
        }
      }

      if (!isEdit && data.endDate && new Date(data.endDate) <= now) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "End date must be in the future",
          path: ["endDate"],
        });
      }

      if (
        data.startDate &&
        data.endDate &&
        new Date(data.startDate) > new Date(data.endDate)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "End date must be after or equal to the event start date",
          path: ["endDate"],
        });
      }

      if (
        data.registrationDeadline &&
        data.endDate &&
        new Date(data.registrationDeadline) > new Date(data.endDate)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "End date must be after or equal to the registration deadline",
          path: ["endDate"],
        });
      }

      if (data.useTracks) {
        const trackNames = data.tracks.map((t) => t.name.trim().toLowerCase());
        if (new Set(trackNames).size !== trackNames.length) {
          trackNames.forEach((name, idx) => {
            if (trackNames.indexOf(name) !== idx) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Track names must be unique",
                path: ["tracks", idx, "name"],
              });
            }
          });
        }
      }

      const roundNumbers = data.rounds.map((r) => r.roundNumber);
      if (new Set(roundNumbers).size !== roundNumbers.length) {
        roundNumbers.forEach((num, idx) => {
          if (roundNumbers.indexOf(num) !== idx) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "Round numbers must be unique",
              path: ["rounds", idx, "roundNumber"],
            });
          }
        });
      }

      const primaryPrizes = new Map<
        number,
        (typeof data.prizes)[number] & { index: number }
      >();
      data.prizes.forEach((prize, index) => {
        if (prize.placement == null) return;
        const existing = primaryPrizes.get(prize.placement);
        if (existing) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Placement ${prize.placement} is already assigned`,
            path: ["prizes", index, "placement"],
          });
          return;
        }
        primaryPrizes.set(prize.placement, { ...prize, index });
      });

      const rankedPrizes = Array.from(primaryPrizes.entries())
        .sort(([firstPlacement], [secondPlacement]) =>
          firstPlacement - secondPlacement,
        )
        .map(([, prize]) => prize);
      if (new Set(rankedPrizes.map((prize) => prize.currency)).size > 1) {
        rankedPrizes.forEach((prize) => {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Ranked prizes must use one currency",
            path: ["prizes", prize.index, "currency"],
          });
        });
      }

      getPrizeAmountOrderViolations(data.prizes).forEach(({ lowerIndex }) => {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Amounts must decrease or stay equal from top to bottom",
          path: ["prizes", lowerIndex, "amount"],
        });
      });

      data.rounds.forEach((round, idx) => {
        if (round.submissionDeadline) {
          const roundDate = new Date(round.submissionDeadline);
          if (data.startDate && roundDate < new Date(data.startDate)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message:
                "Round deadline must be after or at the same time as event start date",
              path: ["rounds", idx, "submissionDeadline"],
            });
          }
          if (data.endDate && roundDate > new Date(data.endDate)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message:
                "Round deadline must be before or at the same time as event end date",
              path: ["rounds", idx, "submissionDeadline"],
            });
          }
          if (idx > 0) {
            const prevRound = data.rounds[idx - 1];
            if (prevRound.submissionDeadline) {
              if (roundDate < new Date(prevRound.submissionDeadline)) {
                ctx.addIssue({
                  code: z.ZodIssueCode.custom,
                  message: `Deadline must be after or equal to Round ${prevRound.roundNumber}`,
                  path: ["rounds", idx, "submissionDeadline"],
                });
              }
            }
          }
        }
      });
    });

type EventFormValues = z.infer<ReturnType<typeof createEventSchema>>;

const eventFormSteps: Array<{
  id: string;
  title: string;
  description: string;
  icon: typeof Info;
  fields: FieldPath<EventFormValues>[];
}> = [
  {
    id: "event-form-general",
    title: "General",
    description: "Core event details",
    icon: Info,
    fields: [
      "name",
      "season",
      "year",
      "maxTeams",
      "minMembersPerTeam",
      "maxMembersPerTeam",
      "registrationDeadline",
      "startDate",
      "endDate",
      "githubOrgUrl",
      "imageUrl",
      "description",
    ],
  },
  {
    id: "event-form-prizes",
    title: "Prizes",
    description: "Awards and rewards",
    icon: Trophy,
    fields: ["prizes"],
  },
  {
    id: "event-form-tracks",
    title: "Tracks",
    description: "Optional — or add later in settings",
    icon: GitMerge,
    fields: ["useTracks", "tracks", "deferredTrackAssignment"],
  },
  {
    id: "event-form-rounds",
    title: "Rounds",
    description: "Submission stages",
    icon: FileText,
    fields: ["rounds"],
  },
  {
    id: "event-form-logistics",
    title: "Event Details",
    description: "Location, contacts and rules",
    icon: MapPin,
    fields: [
      "location",
      "createGoogleMeet",
      "calendarMeetingStart",
      "calendarMeetingEnd",
      "calendarAttendeeEmails",
      "contacts",
      "ruleGroups",
      "faqItems",
    ],
  },
];

interface EventFormProps {
  initialData?: OrganizerEvent;
}

interface SortablePrizeCardProps {
  children: ReactNode;
  id: string;
  isSpecial: boolean;
  position: number;
}

const prizeScreenReaderInstructions = {
  draggable:
    "Press Space to pick up a prize. Use the arrow keys to move it. Press Space again to drop it, or Escape to cancel.",
};

function SortablePrizeCard({
  children,
  id,
  isSpecial,
  position,
}: SortablePrizeCardProps) {
  const shouldReduceMotion = useReducedMotion();
  const {
    attributes,
    isDragging,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id, disabled: isSpecial });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition: shouldReduceMotion ? undefined : transition,
      }}
      className={cn(
        "rounded-xl border border-border/60 bg-background/40 p-3 transition-[border-color,box-shadow,background-color]",
        isDragging &&
          "border-amber-500/60 bg-amber-500/5 shadow-lg shadow-amber-950/10",
      )}
    >
      <div className="flex items-start gap-2">
        {isSpecial ? (
          <div
            className="mt-4 flex size-11 shrink-0 items-center justify-center text-amber-600/70"
            title="Special prize"
          >
            <Sparkles className="size-4" aria-hidden="true" />
            <span className="sr-only">Special prize</span>
          </div>
        ) : (
          <button
            ref={setActivatorNodeRef}
            type="button"
            className="mt-4 flex size-11 shrink-0 touch-none cursor-grab items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-amber-500/10 hover:text-amber-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 active:cursor-grabbing"
            aria-label={`Move prize at position ${position}`}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-4" aria-hidden="true" />
          </button>
        )}
        {children}
      </div>
    </div>
  );
}

export default function EventForm({ initialData }: EventFormProps) {
  const router = useRouter();
  const isEdit = !!initialData;
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [calendarChecking, setCalendarChecking] = useState(true);
  const [calendarConnecting, setCalendarConnecting] = useState(false);
  const calendarPopupRef = useRef<Window | null>(null);
  const calendarPopupPollRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );

  const initialLocation = useMemo(
    () =>
      parseJsonSafe<Partial<typeof defaultLocation> & StoredGoogleMeetConfig>(
        initialData?.location,
        {},
      ),
    [initialData?.location],
  );
  const hasExistingCalendarMeeting = Boolean(
    initialData?.calendarMeeting?.id ||
    initialData?.calendarMeeting?.meetUrl ||
    (initialLocation.meetingPlatform?.toLowerCase() === "google meet" &&
      initialLocation.meetingUrl),
  );

  // Cropper states
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);

  const DEFAULT_EVENT_DESCRIPTION =
    "Building a Retrieval-Augmented Generation (RAG) AI automation involves connecting a Large Language Model (LLM) to your private data sources (like PDFs or databases). When a user asks a question, the system retrieves relevant information and passes it to the AI, allowing it to generate accurate, context-aware responses without hallucinating";

  const createPreset = useMemo(() => {
    const schedule = createDefaultEventSchedule();
    const startDate = new Date(schedule.startDate);

    return {
      ...schedule,
      year: startDate.getFullYear(),
      season: getEventSeason(startDate),
    };
  }, []);

  const defaultValues: Partial<EventFormValues> = {
    name:
      initialData?.name ||
      (isEdit ? "" : `SEAL AI Innovation Hackathon ${createPreset.year}`),
    description: initialData?.description || DEFAULT_EVENT_DESCRIPTION,
    imageUrl: isEdit
      ? initialData?.imageUrl || initialData?.image_url || ""
      : "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1600&q=80",
    season: initialData?.season || createPreset.season,
    year: initialData?.year || createPreset.year,
    maxTeams: initialData?.maxTeams ?? 50,
    // useTracks = students pick track at register (= !deferred). Never infer from track count
    // (Flow B may already have tracks added on Tracks & Rounds).
    useTracks: isEdit
      ? !(initialData?.deferredTrackAssignment ?? false)
      : false,
    deferredTrackAssignment: isEdit
      ? (initialData?.deferredTrackAssignment ?? false)
      : true,
    minMembersPerTeam: initialData?.minMembersPerTeam ?? 3,
    maxMembersPerTeam: initialData?.maxMembersPerTeam ?? 5,
    status: initialData?.status || "draft",
    registrationDeadline: initialData?.registrationDeadline
      ? new Date(initialData.registrationDeadline).toISOString().slice(0, 16)
      : isEdit
        ? ""
        : createPreset.registrationDeadline,
    startDate: initialData?.startDate
      ? new Date(initialData.startDate).toISOString().slice(0, 16)
      : isEdit
        ? ""
        : createPreset.startDate,
    endDate: initialData?.endDate
      ? new Date(initialData.endDate).toISOString().slice(0, 16)
      : isEdit
        ? ""
        : createPreset.endDate,
    githubOrgUrl:
      initialData?.githubOrgUrl || "https://github.com/DEMO-SEAL-HackaThon-ORG",
    prizes: initialData?.prizes
      ? normalizePrizeOrder(
          initialData.prizes.map((prize) => ({
            id: prize.id,
            name: prize.name,
            description: prize.description || "",
            quantity: prize.quantity ?? 1,
            amount: prize.amount ?? 0,
            placement: prize.placement ?? null,
            currency: prize.currency || "VND",
          })),
        )
      : [
          {
            name: "Champion (First Prize)",
            description: "Gold Trophy",
            quantity: 1,
            amount: 10_000_000,
            placement: 1,
            currency: "VND",
          },
          {
            name: "Second Prize (Runner-up)",
            description: "Silver Trophy",
            quantity: 1,
            amount: 5_000_000,
            placement: 2,
            currency: "VND",
          },
          {
            name: "Third Prize",
            description: "Bronze Trophy",
            quantity: 1,
            amount: 2_500_000,
            placement: 3,
            currency: "VND",
          },
          {
            name: "Honorable Mention",
            description: "Certificate",
            quantity: 1,
            amount: 1_000_000,
            placement: null,
            currency: "VND",
          },
        ],
    tracks: isEdit
      ? (initialData?.tracks || []).map((track) => ({
          id: track.id,
          name: track.name,
          description: track.description || "",
          _count: track._count,
        }))
      : [],
    rounds: isEdit
      ? (initialData?.rounds || []).map((round) => ({
          ...round,
          submissionDeadline: round.submissionDeadline
            ? new Date(round.submissionDeadline).toISOString().slice(0, 16)
            : "",
          maxFileSizeMb: round.maxFileSizeMb || 20,
          isTrackSpecific: round.isTrackSpecific ?? false,
          advanceCount: round.advanceCount ?? undefined,
        }))
      : [
          {
            roundNumber: 1,
            name: "Prototype & GitHub Submission",
            submissionType: "github_link",
            submissionDeadline: createPreset.roundDeadline,
            maxFileSizeMb: 20,
            isTrackSpecific: true,
          },
        ],
    location: {
      ...defaultLocation,
      ...initialLocation,
      mapUrl: getEventMapUrl(initialLocation) || defaultLocation.mapUrl,
    },
    createGoogleMeet:
      initialLocation.createGoogleMeetOnOngoing || hasExistingCalendarMeeting,
    calendarMeetingStart: initialData?.calendarMeeting?.startDate
      ? toDateTimeLocalValue(initialData.calendarMeeting.startDate)
      : initialLocation.meetingStartDate
        ? toDateTimeLocalValue(initialLocation.meetingStartDate)
        : hasExistingCalendarMeeting && initialData?.startDate
          ? toDateTimeLocalValue(initialData.startDate)
          : "",
    calendarMeetingEnd: initialData?.calendarMeeting?.endDate
      ? toDateTimeLocalValue(initialData.calendarMeeting.endDate)
      : initialLocation.meetingEndDate
        ? toDateTimeLocalValue(initialLocation.meetingEndDate)
        : hasExistingCalendarMeeting && initialData?.endDate
          ? toDateTimeLocalValue(initialData.endDate)
          : "",
    calendarAttendeeEmails: "",
    sendCalendarInvitations: true,
    notifyParticipants: true,
    contacts: (() => {
      const parsedContacts = parseJsonSafe<OrganizerEventContact[]>(
        initialData?.contact,
        [],
      );
      return parsedContacts.length
        ? parsedContacts.map((contact) => ({
            label: contact.label || contact.type || "",
            name: contact.name || contact.title || "",
            email: contact.email || "",
            phone: contact.phone || "",
            detail: contact.detail || "",
            responseTime: contact.responseTime || "",
          }))
        : defaultContacts;
    })(),
    ruleGroups: normalizeRuleGroups(initialData),
    faqItems: normalizeFaqItems(initialData),
  };

  const eventSchema = useMemo(() => createEventSchema(isEdit), [isEdit]);

  const form = useForm<EventFormValues>({
    resolver: zodResolver(eventSchema) as Resolver<EventFormValues>,
    defaultValues,
    mode: "onChange",
  });
  const prizeDragSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const watchedStatus = useWatch({ control: form.control, name: "status" });
  const watchedCreateGoogleMeet = useWatch({
    control: form.control,
    name: "createGoogleMeet",
  });
  const watchedEventEndDate = useWatch({
    control: form.control,
    name: "endDate",
  });
  const watchedPrizes = useWatch({
    control: form.control,
    name: "prizes",
  });
  const useTracks = useWatch({
    control: form.control,
    name: "useTracks",
  });
  const prizePoolTotals = useMemo(
    () => calculatePrizePoolTotals(watchedPrizes),
    [watchedPrizes],
  );

  // Match Tracks page / BE: editable until any round leaves not_started.
  const canModifyStructure =
    !isEdit ||
    (watchedStatus !== "closed" &&
      (initialData?.rounds || []).every(
        (round) => (round.status || "not_started") === "not_started",
      ));

  const control = form.control;

  useEffect(() => {
    let active = true;
    getGoogleCalendarStatus()
      .then((status) => active && setCalendarConnected(status.connected))
      .catch(() => {
        if (!active) return;
        setCalendarConnected(false);
        enqueueSnackbar("Unable to check Google Calendar connection", {
          variant: "error",
        });
      })
      .finally(() => active && setCalendarChecking(false));

    const handleCalendarMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (calendarPopupRef.current && event.source !== calendarPopupRef.current)
        return;
      if (event.data?.type !== "seal-google-calendar") return;
      if (calendarPopupPollRef.current) {
        clearInterval(calendarPopupPollRef.current);
        calendarPopupPollRef.current = null;
      }
      calendarPopupRef.current = null;
      setCalendarConnecting(false);
      if (event.data.status === "connected") {
        setCalendarConnected(true);
        enqueueSnackbar("Google Calendar connected", { variant: "success" });
      } else {
        enqueueSnackbar("Unable to connect Google Calendar", {
          variant: "error",
        });
      }
    };
    window.addEventListener("message", handleCalendarMessage);
    return () => {
      active = false;
      window.removeEventListener("message", handleCalendarMessage);
      if (calendarPopupPollRef.current) {
        clearInterval(calendarPopupPollRef.current);
      }
    };
  }, []);

  const connectGoogleCalendar = async () => {
    const popup = window.open(
      "about:blank",
      "seal-google-calendar",
      "width=560,height=720",
    );
    if (!popup) {
      enqueueSnackbar("Allow pop-ups to connect Google Calendar", {
        variant: "warning",
      });
      return;
    }
    calendarPopupRef.current = popup;
    setCalendarConnecting(true);
    try {
      popup.location.href = await getGoogleCalendarAuthorizationUrl();
      calendarPopupPollRef.current = setInterval(() => {
        if (!popup.closed) return;
        if (calendarPopupPollRef.current) {
          clearInterval(calendarPopupPollRef.current);
          calendarPopupPollRef.current = null;
        }
        calendarPopupRef.current = null;
        setCalendarConnecting(false);
      }, 500);
    } catch {
      popup.close();
      calendarPopupRef.current = null;
      setCalendarConnecting(false);
      enqueueSnackbar("Unable to start Google Calendar connection", {
        variant: "error",
      });
    }
  };

  const {
    fields: trackFields,
    append: appendTrack,
    remove: removeTrack,
  } = useFieldArray({
    control: form.control,
    name: "tracks",
  });

  const {
    fields: roundFields,
    append: appendRound,
    remove: removeRound,
  } = useFieldArray({
    control: form.control,
    name: "rounds",
  });

  const {
    fields: contactFields,
    append: appendContact,
    remove: removeContact,
  } = useFieldArray({
    control: form.control,
    name: "contacts",
  });

  const {
    fields: prizeFields,
    replace: replacePrizes,
  } = useFieldArray({
    control: form.control,
    name: "prizes",
  });

  const replaceAndValidatePrizes = (prizes: EventFormValues["prizes"]) => {
    replacePrizes(normalizePrizeOrder(prizes));
    void form.trigger("prizes");
  };

  const handleAddPrize = () => {
    const prizes = form.getValues("prizes");
    replaceAndValidatePrizes([
      ...prizes,
      {
        name: "",
        description: "",
        quantity: 1,
        amount: 0,
        placement: getNextPrizePlacement(prizes),
        currency: "VND",
      },
    ]);
  };

  const handleAddSpecialPrize = () => {
    replaceAndValidatePrizes([
      ...form.getValues("prizes"),
      {
        name: "",
        description: "",
        quantity: 1,
        amount: 0,
        placement: null,
        currency: "VND",
      },
    ]);
  };

  const handleRemovePrize = (index: number) => {
    replaceAndValidatePrizes(
      form.getValues("prizes").filter((_, prizeIndex) => prizeIndex !== index),
    );
  };

  const rankedPrizeFields = prizeFields.filter(
    (_, index) => watchedPrizes?.[index]?.placement != null,
  );

  const handlePrizeDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;

    const fromIndex = rankedPrizeFields.findIndex(
      (field) => field.id === active.id,
    );
    const toIndex = rankedPrizeFields.findIndex(
      (field) => field.id === over.id,
    );
    if (fromIndex < 0 || toIndex < 0) return;

    replaceAndValidatePrizes(
      reorderRankedPrizes(
        form.getValues("prizes"),
        fromIndex,
        toIndex,
      ),
    );
  };

  const {
    fields: ruleGroupFields,
    append: appendRuleGroup,
    remove: removeRuleGroup,
  } = useFieldArray({
    control: form.control,
    name: "ruleGroups",
  });

  const {
    fields: faqFields,
    append: appendFaq,
    remove: removeFaq,
  } = useFieldArray({
    control: form.control,
    name: "faqItems",
  });

  const handleRemoveTrack = (index: number) => {
    const track = form.getValues(`tracks.${index}`);
    const teamCount = track._count?.teams ?? 0;
    if (track.id && teamCount > 0) {
      if (
        !window.confirm(
          `Warning: This track currently has ${teamCount} participating teams.\nDelete it will PERMANENTLY REMOVE all associated teams and submissions.\nAre you sure to delete?`,
        )
      ) {
        return;
      }
    }
    removeTrack(index);
  };

  const handleRemoveRound = (index: number) => {
    const round = form.getValues(`rounds.${index}`);
    const submissionCount = round._count?.submissions ?? 0;
    if (round.id && submissionCount > 0) {
      if (
        !window.confirm(
          `Warning: This round currently has ${submissionCount} submissions.\nThe deletion will PERMANENTLY DELETE all submissions and examiner assignments.\nAre you sure to delete?`,
        )
      ) {
        return;
      }
    }
    removeRound(index);
  };

  useEffect(() => {
    const handleScroll = () => {
      let maxVisibleArea = 0;
      let newStep = 0;

      eventFormSteps.forEach((step, index) => {
        const el = document.getElementById(step.id);
        if (el) {
          const rect = el.getBoundingClientRect();
          // Account for the sticky header (~100px)
          const visibleTop = Math.max(rect.top, 100);
          const visibleBottom = Math.min(rect.bottom, window.innerHeight);
          const visibleHeight = Math.max(0, visibleBottom - visibleTop);

          // If this section occupies more of the screen than previous ones
          if (visibleHeight >= maxVisibleArea) {
            maxVisibleArea = visibleHeight;
            newStep = index;
          }

          // Special case: if we scrolled to the absolute bottom of the form,
          // highlight the last section, even if it's smaller than the one above it.
          if (index === eventFormSteps.length - 1) {
            if (
              rect.bottom <= window.innerHeight + 50 &&
              rect.top < window.innerHeight
            ) {
              newStep = index;
              maxVisibleArea = Infinity; // Ensure nothing else overrides this
            }
          }
        }
      });

      setCurrentStep(newStep);
    };

    window.addEventListener("scroll", handleScroll, {
      capture: true,
      passive: true,
    });

    // Initial check after a slight delay to let DOM render
    const timeoutId = setTimeout(handleScroll, 500);

    return () => {
      window.removeEventListener("scroll", handleScroll, { capture: true });
      clearTimeout(timeoutId);
    };
  }, []);

  const handleStepSelect = (stepIndex: number) => {
    setCurrentStep(stepIndex);
    document.getElementById(eventFormSteps[stepIndex].id)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const handleInvalidSubmit = (errors: FieldErrors<EventFormValues>) => {
    const errorRoots = new Set(Object.keys(errors));
    const firstInvalidStep = eventFormSteps.findIndex((step) =>
      step.fields.some((field) => errorRoots.has(field.split(".")[0])),
    );

    if (firstInvalidStep >= 0) {
      handleStepSelect(firstInvalidStep);
    }

    enqueueSnackbar("Please review the highlighted required fields.", {
      variant: "warning",
    });
  };

  const onSubmit = async (data: EventFormValues) => {
    if (isEdit && initialData?.status !== "draft") {
      enqueueSnackbar("Event must have Draft status before it can be edited.", {
        variant: "warning",
      });
      return;
    }
    if (data.createGoogleMeet && !calendarConnected) {
      handleStepSelect(eventFormSteps.length - 1);
      enqueueSnackbar("Connect Google Calendar before creating a Google Meet", {
        variant: "warning",
      });
      return;
    }
    if (isLoading) return;
    setIsLoading(true);
    try {
      const {
        contacts,
        ruleGroups,
        faqItems,
        location,
        createGoogleMeet,
        calendarMeetingStart,
        calendarMeetingEnd,
        calendarAttendeeEmails,
        sendCalendarInvitations,
        notifyParticipants,
        useTracks,
        tracks: _formTracks,
        rounds: _formRounds,
        ...restData
      } = data;

      const payload: OrganizerEventPayload = {
        ...restData,
        registrationDeadline: data.registrationDeadline
          ? new Date(data.registrationDeadline).toISOString()
          : undefined,
        startDate: data.startDate
          ? new Date(data.startDate).toISOString()
          : undefined,
        endDate: data.endDate
          ? new Date(data.endDate).toISOString()
          : undefined,
        githubOrgUrl: data.githubOrgUrl || undefined,
        imageUrl: data.imageUrl || undefined,
        prizes: data.prizes?.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          quantity: p.quantity ? Number(p.quantity) : 1,
          amount: Number(p.amount),
          placement: p.placement ?? null,
          currency: p.currency,
        })),
        // Flow A: send tracks from form. Flow B create: empty. Flow B edit: omit so
        // Tracks & Rounds catalog is not wiped by Save Changes.
        ...(useTracks
          ? {
              tracks: data.tracks?.map((t) => ({
                id: t.id,
                name: t.name,
                description: t.description,
              })),
            }
          : isEdit
            ? {}
            : { tracks: [] }),
        // Checked useTracks → pick track at register.
        // Unchecked → assign tracks later when a round opens.
        deferredTrackAssignment: !useTracks,
        rounds: data.rounds?.map((r, _idx, arr) => {
          const maxRoundNumber = Math.max(...arr.map((x) => x.roundNumber));
          const isLastRound = r.roundNumber === maxRoundNumber;
          return {
          id: r.id,
          roundNumber: r.roundNumber,
          name: r.name,
          submissionType: r.submissionType,
          submissionDeadline: r.submissionDeadline
            ? new Date(r.submissionDeadline).toISOString()
            : undefined,
          maxFileSizeMb: r.maxFileSizeMb,
          // Flow B (no tracks at create): every round is track-specific.
          isTrackSpecific: !useTracks ? true : r.isTrackSpecific,
          advanceCount: isLastRound ? null : (r.advanceCount ?? null),
        };
        }),
        location: JSON.stringify({
          venueName: location.venueName || undefined,
          room: location.room || undefined,
          address: location.address || undefined,
          meetingPlatform: location.meetingPlatform || undefined,
          meetingUrl: location.meetingUrl || undefined,
          mapUrl: location.mapUrl || undefined,
          note: location.note || undefined,
          createGoogleMeetOnOngoing: createGoogleMeet || undefined,
          meetingStartDate:
            createGoogleMeet && (calendarMeetingStart || data.startDate)
              ? new Date(
                  calendarMeetingStart || data.startDate || "",
                ).toISOString()
              : undefined,
          meetingEndDate:
            createGoogleMeet && (calendarMeetingEnd || data.endDate)
              ? new Date(calendarMeetingEnd || data.endDate || "").toISOString()
              : undefined,
          timeZone: createGoogleMeet ? "Asia/Ho_Chi_Minh" : undefined,
        }),
        contact: JSON.stringify(
          contacts
            .filter(
              (contact) =>
                contact.label ||
                contact.name ||
                contact.email ||
                contact.phone ||
                contact.detail,
            )
            .map((contact) => ({
              label: contact.label || undefined,
              name: contact.name || undefined,
              email: contact.email || undefined,
              phone: contact.phone || undefined,
              detail: contact.detail || undefined,
              responseTime: contact.responseTime || undefined,
            })),
        ),
        rules: JSON.stringify(
          ruleGroups
            .map((group) => ({
              title: group.title,
              rules: linesToList(group.itemsText),
            }))
            .filter((group) => group.title && group.rules.length > 0),
        ),
        faq: faqItems
          .filter((faq) => faq.question && faq.answer)
          .map((faq) => ({
            question: faq.question,
            answer: faq.answer,
          })),
      };

      const savedEvent =
        isEdit && initialData?.id
          ? await updateOrganizerEvent(initialData.id, payload)
          : await createOrganizerEvent(payload);

      if (
        shouldSyncGoogleCalendarMeeting({
          createGoogleMeet,
          eventStatus: watchedStatus,
          hasExistingMeeting: hasExistingCalendarMeeting,
        })
      ) {
        try {
          const attendeeEmails = Array.from(
            new Set(
              (calendarAttendeeEmails || "")
                .split(/[\s,;]+/)
                .map((email) => email.trim())
                .filter(Boolean),
            ),
          );
          const meetingInput = {
            meetingStartDate: calendarMeetingStart
              ? new Date(calendarMeetingStart).toISOString()
              : undefined,
            meetingEndDate: calendarMeetingEnd
              ? new Date(calendarMeetingEnd).toISOString()
              : undefined,
            attendeeEmails,
            sendInvitations: sendCalendarInvitations,
            notifyParticipants,
            timeZone: "Asia/Ho_Chi_Minh",
          };
          let meeting;
          if (isEdit && hasExistingCalendarMeeting) {
            try {
              meeting = await updateGoogleCalendarMeeting(
                savedEvent.id,
                meetingInput,
              );
            } catch (error) {
              if (getApiStatus(error) !== 404) throw error;
              meeting = await createGoogleCalendarMeeting(
                savedEvent.id,
                meetingInput,
              );
            }
          } else {
            try {
              meeting = await createGoogleCalendarMeeting(
                savedEvent.id,
                meetingInput,
              );
            } catch (error) {
              if (!isEdit || getApiStatus(error) !== 409) throw error;
              meeting = await updateGoogleCalendarMeeting(
                savedEvent.id,
                meetingInput,
              );
            }
          }
          if (meeting.meetUrl) {
            form.setValue("location.meetingUrl", meeting.meetUrl);
          }
          enqueueSnackbar(
            sendCalendarInvitations && meeting.attendeeCount
              ? `Google Meet synchronized and ${meeting.attendeeCount} invitation(s) sent`
              : "Google Meet synchronized",
            { variant: "success" },
          );
        } catch {
          enqueueSnackbar(
            "Event saved, but Google Meet creation failed. You can retry from edit event.",
            { variant: "warning" },
          );
        }
      } else if (createGoogleMeet) {
        enqueueSnackbar(
          "Google Meet configuration saved. The meeting will be created when the event moves to Ongoing.",
          { variant: "info" },
        );
      }

      if (isEdit && initialData?.id) {
        enqueueSnackbar("Event updated successfully", { variant: "success" });
        router.push(`/organizer/events/${initialData.id}`);
      } else {
        enqueueSnackbar("Event created successfully", { variant: "success" });
        router.push(`/organizer/events/${savedEvent.id}`);
      }
    } catch (error: unknown) {
      const apiError = error as {
        response?: { data?: { errors?: string[]; message?: string } };
      };
      console.error("Event form error", apiError.response?.data ?? error);
      const errData =
        apiError.response?.data?.errors || apiError.response?.data?.message;
      let errorMessage = "Failed to save event";

      if (Array.isArray(errData)) {
        errorMessage = errData.join(", ");
      } else if (typeof errData === "string") {
        errorMessage = errData;
      }

      enqueueSnackbar(errorMessage, { variant: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  const sectionVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (custom: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        delay: custom * 0.1,
        duration: 0.5,
        ease: "easeOut" as const,
      },
    }),
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit, handleInvalidSubmit)}
        className="pb-8"
        suppressHydrationWarning
      >
        <div className="grid items-start gap-8 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="sticky top-24 rounded-[28px] border border-border/60 bg-card/90 p-6 shadow-lg shadow-black/5 backdrop-blur-xl">
            <nav aria-label="Event creation progress">
              {eventFormSteps.map((step, index) => {
                const StepIcon = step.icon;
                const isActive = currentStep === index;
                const isComplete = index < currentStep;

                return (
                  <div key={step.title} className="relative pb-2 last:pb-0">
                    {index < eventFormSteps.length - 1 && (
                      <div
                        className={cn(
                          "absolute -bottom-2 left-7 top-7 w-px",
                          isComplete ? "bg-orange-500" : "bg-border",
                        )}
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => handleStepSelect(index)}
                      className={cn(
                        "relative z-10 flex w-full items-center gap-3 rounded-2xl p-2.5 text-left transition-all",
                        isActive &&
                          "bg-orange-500/10 ring-1 ring-orange-500/20",
                        "hover:bg-orange-500/5",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-all",
                          isActive &&
                            "border-orange-500 bg-orange-500 text-white shadow-lg shadow-orange-500/25",
                          isComplete &&
                            !isActive &&
                            "border-orange-500 bg-orange-500/10 text-orange-600",
                          !isActive &&
                            !isComplete &&
                            "border-border bg-background text-muted-foreground",
                        )}
                      >
                        {isComplete && !isActive ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : (
                          <StepIcon className="h-4 w-4" />
                        )}
                      </span>
                      <span className="min-w-0">
                        <span
                          className={cn(
                            "block text-sm font-semibold",
                            isActive && "text-orange-600 dark:text-orange-400",
                          )}
                        >
                          {index + 1}. {step.title}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                          {step.description}
                        </span>
                      </span>
                    </button>
                  </div>
                );
              })}
            </nav>

            <div className="mt-5 rounded-2xl bg-muted/50 p-3">
              <div className="flex items-center justify-between text-xs font-medium">
                <span>Progress</span>
                <span className="text-orange-600">
                  {Math.round(
                    ((currentStep + 1) / eventFormSteps.length) * 100,
                  )}
                  %
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400"
                  animate={{
                    inlineSize: `${((currentStep + 1) / eventFormSteps.length) * 100}%`,
                  }}
                  transition={{ type: "spring", stiffness: 120, damping: 20 }}
                />
              </div>
            </div>
          </aside>

          <main className="min-w-0 space-y-12 rounded-[32px] border border-border/60 bg-card p-4 shadow-xl shadow-black/5 sm:p-6 lg:p-8">
            {/* GENERAL INFORMATION */}
            <motion.div
              id="event-form-general"
              custom={0}
              variants={sectionVariants}
              initial="hidden"
              animate="visible"
              className="relative scroll-mt-24 group"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 rounded-3xl blur-xl transition-all duration-500 group-hover:from-blue-500/10 group-hover:to-purple-500/10" />
              <div className="relative">
                <div className="flex items-center gap-4 mb-8">
                  <div className="p-3 bg-gradient-to-br from-blue-500/20 to-blue-600/20 rounded-2xl text-blue-600 ring-1 ring-blue-500/20">
                    <Info className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
                      General Information
                    </h3>
                    <p className="text-muted-foreground mt-1">
                      Basic details and scheduling for your event.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-x-6 gap-y-6">
                  <FormField
                    control={control}
                    name="name"
                    render={({ field }) => (
                      <FormItem className="md:col-span-12">
                        <FormLabel className="text-foreground/80 font-medium">
                          Event Name <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            className="bg-background/50 border-border/50 focus-visible:ring-blue-500/30 rounded-xl"
                            placeholder="E.g. SEAL Hackathon 2026"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={control}
                    name="season"
                    render={({ field }) => (
                      <FormItem className="md:col-span-4">
                        <FormLabel className="text-foreground/80 font-medium">
                          Season <span className="text-red-500">*</span>
                        </FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="bg-background/50 border-border/50 focus:ring-blue-500/30 rounded-xl">
                              <SelectValue placeholder="Select Season" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="rounded-xl">
                            <SelectItem value="Spring">Spring</SelectItem>
                            <SelectItem value="Summer">Summer</SelectItem>
                            <SelectItem value="Fall">Fall</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={control}
                    name="year"
                    render={({ field }) => (
                      <FormItem className="md:col-span-4">
                        <FormLabel className="text-foreground/80 font-medium">
                          Year <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            className="bg-background/50 border-border/50 focus-visible:ring-blue-500/30 rounded-xl"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={control}
                    name="maxTeams"
                    render={({ field }) => (
                      <FormItem className="md:col-span-4">
                        <FormLabel className="text-foreground/80 font-medium">
                          Maximum Teams <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={1}
                            className="bg-background/50 border-border/50 focus-visible:ring-blue-500/30 rounded-xl"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={control}
                    name="minMembersPerTeam"
                    render={({ field }) => (
                      <FormItem className="md:col-span-4">
                        <FormLabel className="text-foreground/80 font-medium">
                          Minimum Members per Team{" "}
                          <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={1}
                            max={20}
                            className="bg-background/50 border-border/50 focus-visible:ring-blue-500/30 rounded-xl"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={control}
                    name="maxMembersPerTeam"
                    render={({ field }) => (
                      <FormItem className="md:col-span-4">
                        <FormLabel className="text-foreground/80 font-medium">
                          Maximum Members per Team{" "}
                          <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={1}
                            max={20}
                            className="bg-background/50 border-border/50 focus-visible:ring-blue-500/30 rounded-xl"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={control}
                    name="registrationDeadline"
                    render={({ field }) => (
                      <FormItem className="md:col-span-4">
                        <FormLabel className="text-foreground/80 font-medium flex items-center gap-2">
                          <Calendar className="w-4 h-4" /> Registration Deadline{" "}
                          {!isEdit && <span className="text-red-500">*</span>}
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="datetime-local"
                            className="bg-background/50 border-border/50 focus-visible:ring-blue-500/30 rounded-xl"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={control}
                    name="startDate"
                    render={({ field }) => (
                      <FormItem className="md:col-span-4">
                        <FormLabel className="text-foreground/80 font-medium flex items-center gap-2">
                          <Calendar className="w-4 h-4" /> Start Date{" "}
                          {!isEdit && <span className="text-red-500">*</span>}
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="datetime-local"
                            className="bg-background/50 border-border/50 focus-visible:ring-blue-500/30 rounded-xl"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={control}
                    name="endDate"
                    render={({ field }) => (
                      <FormItem className="md:col-span-4">
                        <FormLabel className="text-foreground/80 font-medium flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          End Date
                          {!isEdit && <span className="text-red-500">*</span>}
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="datetime-local"
                            className="bg-background/50 border-border/50 focus-visible:ring-blue-500/30 rounded-xl"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={control}
                    name="githubOrgUrl"
                    render={({ field }) => (
                      <FormItem className="md:col-span-12">
                        <FormLabel className="text-foreground/80 font-medium flex items-center gap-2">
                          <LinkIcon className="w-4 h-4" /> GitHub Organization
                          URL{" "}
                          {!isEdit && <span className="text-red-500">*</span>}
                        </FormLabel>
                        <FormControl>
                          <Input
                            className="bg-background/50 border-border/50 focus-visible:ring-blue-500/30 rounded-xl"
                            placeholder="https://github.com/your-org"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={control}
                    name="imageUrl"
                    render={({ field }) => (
                      <FormItem className="md:col-span-12">
                        <FormLabel className="text-foreground/80 font-medium flex items-center gap-2">
                          <ImageIcon className="w-4 h-4" /> Cover Image{" "}
                          {!isEdit && <span className="text-red-500">*</span>}
                        </FormLabel>
                        <FormControl>
                          <div className="flex flex-col gap-3">
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              id="cover-upload"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                const reader = new FileReader();
                                reader.onload = () => {
                                  setCropImageSrc(reader.result as string);
                                  setCropDialogOpen(true);
                                };
                                reader.readAsDataURL(file);
                                e.target.value = "";
                              }}
                            />
                            {cropImageSrc && (
                              <ImageCropper
                                open={cropDialogOpen}
                                imageSrc={cropImageSrc}
                                aspect={21 / 9}
                                onClose={() => setCropDialogOpen(false)}
                                onCropComplete={async (croppedFile) => {
                                  setCropDialogOpen(false);
                                  try {
                                    setIsUploading(true);
                                    const res = await uploadFile(croppedFile);
                                    field.onChange(res.data.fileUrl);
                                    enqueueSnackbar(
                                      "Cover image uploaded successfully",
                                      { variant: "success" },
                                    );
                                  } catch {
                                    enqueueSnackbar(
                                      "Failed to upload cropped image",
                                      { variant: "error" },
                                    );
                                  } finally {
                                    setIsUploading(false);
                                  }
                                }}
                              />
                            )}
                            {!field.value && (
                              <label htmlFor="cover-upload" className="w-full">
                                <div className="border-2 border-dashed border-border/50 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors w-full min-h-[160px]">
                                  {isUploading ? (
                                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground mb-3" />
                                  ) : (
                                    <UploadCloud className="w-8 h-8 text-muted-foreground mb-3" />
                                  )}
                                  <span className="text-sm font-medium text-foreground">
                                    {isUploading
                                      ? "Uploading..."
                                      : "Click to upload cover image"}
                                  </span>
                                  <span className="text-xs text-muted-foreground mt-1">
                                    PNG, JPG, WEBP up to 5MB
                                  </span>
                                </div>
                              </label>
                            )}
                            {field.value && (
                              <div className="relative w-full h-[240px] rounded-xl overflow-hidden border border-border/50 group">
                                <img
                                  src={field.value}
                                  alt="Cover Preview"
                                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                />
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                                  <label htmlFor="cover-upload">
                                    <div className="cursor-pointer bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors text-sm font-medium">
                                      {isUploading ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                      ) : (
                                        <UploadCloud className="w-4 h-4" />
                                      )}
                                      Change Image
                                    </div>
                                  </label>
                                  <Button
                                    type="button"
                                    variant="destructive"
                                    onClick={() => field.onChange("")}
                                    className="backdrop-blur-sm"
                                  >
                                    <Trash2 className="w-4 h-4 mr-2" /> Remove
                                    Image
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        </FormControl>
                        <p className="text-xs text-muted-foreground">
                          Upload a beautiful cover image to make your event
                          stand out.
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={control}
                    name="description"
                    render={({ field }) => (
                      <FormItem className="md:col-span-12">
                        <FormLabel className="text-foreground/80 font-medium">
                          Description{" "}
                          {!isEdit && <span className="text-red-500">*</span>}
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            className="bg-background/50 border-border/50 focus-visible:ring-blue-500/30 rounded-xl min-h-[120px] resize-y"
                            placeholder="Event description..."
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </motion.div>

            {/* PRIZES */}
            <motion.div
              id="event-form-prizes"
              custom={1}
              variants={sectionVariants}
              initial="hidden"
              animate="visible"
              className="relative scroll-mt-24 group"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-orange-500/5 rounded-3xl blur-xl transition-all duration-500 group-hover:from-amber-500/10 group-hover:to-orange-500/10" />
              <div className="relative bg-card/40 backdrop-blur-2xl border border-border/50 p-8 rounded-3xl shadow-sm transition-all duration-500 hover:shadow-md">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-gradient-to-br from-amber-500/20 to-orange-600/20 rounded-2xl text-amber-600 ring-1 ring-amber-500/20">
                      <Trophy className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-amber-500 to-orange-500">
                        Prizes & Awards
                      </h3>
                      <p className="text-muted-foreground mt-1">
                        Drag ranked prizes to set their order. Amounts must
                        decrease from top to bottom.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      onClick={handleAddSpecialPrize}
                      variant="ghost"
                      className="text-muted-foreground hover:bg-amber-500/10 hover:text-amber-600"
                    >
                      <Sparkles className="mr-2 size-4" />
                      Add Special
                    </Button>
                    <Button
                      type="button"
                      onClick={handleAddPrize}
                      variant="outline"
                      className="border-amber-500/30 text-amber-600 hover:bg-amber-500/10 rounded-xl"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Prize
                    </Button>
                  </div>
                </div>

                {prizeFields.length > 0 ? (
                  <DndContext
                    accessibility={{
                      screenReaderInstructions: prizeScreenReaderInstructions,
                    }}
                    collisionDetection={closestCenter}
                    sensors={prizeDragSensors}
                    onDragEnd={handlePrizeDragEnd}
                  >
                    <SortableContext
                      items={prizeFields.map((field) => field.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-2">
                        {prizeFields.map((field, index) => (
                          <SortablePrizeCard
                            key={field.id}
                            id={field.id}
                            isSpecial={
                              watchedPrizes?.[index]?.placement == null
                            }
                            position={index + 1}
                          >
                          <div className="grid min-w-0 flex-1 grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-12">
                            <FormField
                              control={control}
                              name={`prizes.${index}.name`}
                              render={({ field }) => (
                                <FormItem className="col-span-2 space-y-1 sm:col-span-4 lg:col-span-4">
                                  <FormLabel className="text-[11px] text-muted-foreground">
                                    Prize Name
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      className="h-9 bg-background/50"
                                      placeholder="Example: Champion"
                                      {...field}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={control}
                              name={`prizes.${index}.amount`}
                              render={({ field }) => (
                                <FormItem className="space-y-1 lg:col-span-3">
                                  <FormLabel className="text-[11px] text-muted-foreground">
                                    Amount
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      min="0"
                                      step="1"
                                      className="h-9 bg-background/50 tabular-nums"
                                      {...field}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={control}
                              name={`prizes.${index}.currency`}
                              render={({ field }) => (
                                <FormItem className="space-y-1 lg:col-span-2">
                                  <FormLabel className="text-[11px] text-muted-foreground">
                                    Currency
                                  </FormLabel>
                                  <Select
                                    value={field.value}
                                    onValueChange={field.onChange}
                                  >
                                    <FormControl>
                                      <SelectTrigger className="h-9 bg-background/50">
                                        <SelectValue />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="VND">VND</SelectItem>
                                      <SelectItem value="USD">USD</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={control}
                              name={`prizes.${index}.quantity`}
                              render={({ field }) => (
                                <FormItem className="space-y-1 lg:col-span-3">
                                  <FormLabel className="text-[11px] text-muted-foreground">
                                    Quantity
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      min="1"
                                      step="1"
                                      inputMode="numeric"
                                      className="h-9 bg-background/50 tabular-nums"
                                      {...field}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={control}
                              name={`prizes.${index}.description`}
                              render={({ field }) => (
                                <FormItem className="col-span-2 space-y-1 sm:col-span-4 lg:col-span-12">
                                  <FormLabel className="text-[11px] text-muted-foreground">
                                    Other rewards
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      className="h-9 bg-background/50"
                                      placeholder="Example: Gold Trophy and certificate"
                                      {...field}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="mt-5 shrink-0 text-red-500 hover:bg-red-500/10 hover:text-red-500"
                            onClick={() => handleRemovePrize(index)}
                            aria-label={`Remove prize ${index + 1}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          </SortablePrizeCard>
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                ) : (
                  <div className="rounded-2xl border border-dashed border-border/50 p-8 text-center text-sm text-muted-foreground">
                    No prizes yet. Click Add Prize to start.
                  </div>
                )}

                {prizePoolTotals.length > 0 && (
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3">
                    <span className="text-sm font-semibold text-foreground">
                      Total prize pool
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {prizePoolTotals.map((total) => (
                        <span
                          key={total.currency}
                          className="rounded-lg bg-background/70 px-3 py-1 text-sm font-bold text-amber-600"
                        >
                          {formatPrizeAmount(total.amount, total.currency)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>

            {/* EVENT DETAILS */}
            {/* TRACKS */}
            <motion.div
              id="event-form-tracks"
              custom={2}
              variants={sectionVariants}
              initial="hidden"
              animate="visible"
              className="relative scroll-mt-24 group"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-teal-500/5 rounded-3xl blur-xl transition-all duration-500 group-hover:from-emerald-500/10 group-hover:to-teal-500/10" />
              <div className="relative">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-gradient-to-br from-emerald-500/20 to-teal-600/20 rounded-2xl text-emerald-600 ring-1 ring-emerald-500/20">
                      <GitMerge className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-500 to-teal-500">
                        Tracks
                      </h3>
                      <p className="text-muted-foreground mt-1">
                        Choose whether this event uses tracks, then configure
                        them here.
                      </p>
                    </div>
                  </div>
                  {canModifyStructure && useTracks && (
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-2 rounded-xl border-emerald-500/20 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950"
                      onClick={() =>
                        appendTrack({
                          name: "",
                          description: "",
                        })
                      }
                    >
                      <Plus className="h-4 w-4" /> Add Track
                    </Button>
                  )}
                </div>

                <FormField
                  control={control}
                  name="useTracks"
                  render={({ field }) => (
                    <FormItem className="mb-6 rounded-xl border border-border/60 bg-muted/30 p-4">
                      <div className="flex items-start gap-3">
                        <FormControl>
                          <input
                            type="checkbox"
                            className="mt-1 h-4 w-4 rounded border-border"
                            checked={Boolean(field.value)}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              field.onChange(checked);
                              if (checked) {
                                if (form.getValues("tracks").length === 0) {
                                  appendTrack({
                                    name: "",
                                    description: "",
                                  });
                                }
                                form.setValue(
                                  "deferredTrackAssignment",
                                  false,
                                  { shouldDirty: true },
                                );
                              } else {
                                form.setValue("tracks", [], {
                                  shouldDirty: true,
                                  shouldValidate: true,
                                });
                                form.setValue(
                                  "deferredTrackAssignment",
                                  true,
                                  { shouldDirty: true },
                                );
                                const rounds = form.getValues("rounds");
                                rounds.forEach((_, index) => {
                                  // Flow B needs per-track đề when round opens.
                                  form.setValue(
                                    `rounds.${index}.isTrackSpecific`,
                                    true,
                                    { shouldDirty: true },
                                  );
                                });
                              }
                            }}
                          />
                        </FormControl>
                        <div>
                          <FormLabel className="text-foreground/90 font-medium">
                            Use tracks for this event
                          </FormLabel>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Checked: define tracks now. Students choose a track
                            when they register. Unchecked: students register
                            without choosing a track; you set tracks later in
                            Tracks &amp; Rounds and they are assigned when a
                            round opens.
                          </p>
                        </div>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {!useTracks ? (
                  <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
                    Thêm bảng sau khi tạo event tại{" "}
                    <strong className="text-foreground">
                      Tracks &amp; Rounds
                    </strong>
                    .
                  </div>
                ) : null}

                <div className="space-y-4">
                  <AnimatePresence mode="popLayout">
                    {useTracks &&
                      trackFields.map((field, index) => (
                      <motion.div
                        key={field.id}
                        layout
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -10 }}
                        transition={{ duration: 0.2 }}
                        className="grid grid-cols-1 md:grid-cols-12 gap-4 p-5 bg-background/50 border border-border/50 rounded-2xl items-start relative group/item hover:border-emerald-500/30 hover:shadow-sm transition-all"
                      >
                        <div className="md:col-span-4">
                          <FormField
                            control={control}
                            name={`tracks.${index}.name`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                                  Track Name *
                                </FormLabel>
                                <FormControl>
                                  <Input
                                    className="bg-card/50 rounded-lg"
                                    placeholder="Example: AI Track"
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <div className="md:col-span-8">
                          <FormField
                            control={control}
                            name={`tracks.${index}.description`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                                  Description {!isEdit && "*"}
                                </FormLabel>
                                <FormControl>
                                  <Input
                                    className="bg-card/50 rounded-lg"
                                    placeholder="Track focus area..."
                                    {...field}
                                    value={field.value ?? ""}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <div className="md:col-span-12 flex justify-end items-end">
                          {trackFields.length > 1 && canModifyStructure && (
                            <Button
                              type="button"
                              variant="ghost"
                              className="text-red-500/70 hover:text-red-600 hover:bg-red-100/50 rounded-xl transition-colors"
                              onClick={() => handleRemoveTrack(index)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" /> Remove Track
                            </Button>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>

            {/* ROUNDS */}
            <motion.div
              id="event-form-rounds"
              custom={3}
              variants={sectionVariants}
              initial="hidden"
              animate="visible"
              className="relative scroll-mt-24 group"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-rose-500/5 to-pink-500/5 rounded-3xl blur-xl transition-all duration-500 group-hover:from-rose-500/10 group-hover:to-pink-500/10" />
              <div className="relative">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-gradient-to-br from-rose-500/20 to-pink-600/20 rounded-2xl text-rose-600 ring-1 ring-rose-500/20">
                      <FileText className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-rose-500 to-pink-500">
                        Rounds
                      </h3>
                      <p className="text-muted-foreground mt-1">
                        Configure submission stages for the participants.
                      </p>
                    </div>
                  </div>
                  {canModifyStructure && (
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-2 rounded-xl border-rose-500/20 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950"
                      onClick={() =>
                        appendRound({
                          roundNumber: roundFields.length + 1,
                          name: "",
                          submissionType: "file",
                          submissionDeadline: "",
                          maxFileSizeMb: 20,
                          // Flow B (!useTracks) always needs per-track đề.
                          isTrackSpecific: true,
                        })
                      }
                    >
                      <Plus className="h-4 w-4" /> Add Round
                    </Button>
                  )}
                </div>

                <div className="space-y-4">
                  <AnimatePresence mode="popLayout">
                    {roundFields.map((field, index) => (
                      <motion.div
                        key={field.id}
                        layout
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -10 }}
                        transition={{ duration: 0.2 }}
                        className="grid grid-cols-1 md:grid-cols-12 gap-4 p-5 bg-background/50 border border-border/50 rounded-2xl items-start relative group/item hover:border-rose-500/30 hover:shadow-sm transition-all"
                      >
                        <div className="md:col-span-2">
                          <FormField
                            control={control}
                            name={`rounds.${index}.roundNumber`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                                  Round # *
                                </FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    className="bg-card/50 rounded-lg"
                                    {...field}
                                    value={field.value ?? ""}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <div className="md:col-span-5">
                          <FormField
                            control={control}
                            name={`rounds.${index}.name`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                                  Round Name *
                                </FormLabel>
                                <FormControl>
                                  <Input
                                    className="bg-card/50 rounded-lg"
                                    placeholder="Example: Semi-final"
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <div className="md:col-span-5 flex justify-between items-end gap-3">
                          <FormField
                            control={control}
                            name={`rounds.${index}.submissionDeadline`}
                            render={({ field }) => (
                              <FormItem className="flex-1">
                                <FormLabel className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                                  Deadline {!isEdit && "*"}
                                </FormLabel>
                                <FormControl>
                                  <Input
                                    type="datetime-local"
                                    className="bg-card/50 rounded-lg"
                                    {...field}
                                    value={field.value ?? ""}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <div className="md:col-span-4">
                          <FormField
                            control={control}
                            name={`rounds.${index}.submissionType`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                                  Submission Type *
                                </FormLabel>
                                <Select
                                  onValueChange={field.onChange}
                                  value={field.value}
                                >
                                  <FormControl>
                                    <SelectTrigger className="bg-card/50 rounded-lg">
                                      <SelectValue>
                                        {field.value === "file"
                                          ? "Project File (ZIP/RAR)"
                                          : field.value === "github_link"
                                            ? "GitHub Link"
                                            : "Select Type"}
                                      </SelectValue>
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent className="rounded-xl">
                                    <SelectItem value="file">
                                      Project File (ZIP/RAR)
                                    </SelectItem>
                                    <SelectItem value="github_link">
                                      GitHub Link
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <div className="md:col-span-4">
                          <FormField
                            control={control}
                            name={`rounds.${index}.maxFileSizeMb`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                                  Max File Size (MB)
                                </FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    className="bg-card/50 rounded-lg"
                                    {...field}
                                    value={field.value ?? ""}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <div className="md:col-span-4 flex items-center justify-end mt-6">
                          {roundFields.length > 1 && canModifyStructure && (
                            <Button
                              type="button"
                              variant="ghost"
                              className="text-red-500/70 hover:text-red-600 hover:bg-red-100/50 rounded-xl transition-colors"
                              onClick={() => handleRemoveRound(index)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" /> Remove Round
                            </Button>
                          )}
                        </div>
                        {(() => {
                          const allRounds = form.watch("rounds") ?? [];
                          const thisNum = Number(allRounds[index]?.roundNumber);
                          const maxNum = Math.max(
                            ...allRounds.map((r) => Number(r.roundNumber) || 0),
                          );
                          const isLastRound =
                            Number.isFinite(thisNum) && thisNum === maxNum;
                          if (isLastRound) {
                            return (
                              <p className="md:col-span-12 text-xs text-muted-foreground border-t border-border/50 pt-3 mt-1">
                                Final round: awards come from the Prizes section below.
                              </p>
                            );
                          }
                          return (
                            <div className="md:col-span-3">
                              <FormField
                                control={control}
                                name={`rounds.${index}.advanceCount`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                                      Top N advance *
                                    </FormLabel>
                                    <FormControl>
                                      <Input
                                        type="number"
                                        min={1}
                                        placeholder="e.g. 2, 3, 4"
                                        className="bg-card/50 rounded-lg"
                                        {...field}
                                        value={field.value ?? ""}
                                        onChange={(e) => {
                                          const raw = e.target.value;
                                          field.onChange(
                                            raw === "" ? undefined : Number(raw),
                                          );
                                        }}
                                      />
                                    </FormControl>
                                    <FormDescription className="text-xs">
                                      Tùy cuộc thi — per track nếu bật track-specific.
                                    </FormDescription>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>
                          );
                        })()}
                        {useTracks ? (
                        <div className="md:col-span-12 flex items-center justify-between mt-2 pt-4 border-t border-border/50">
                          <FormField
                            control={control}
                            name={`rounds.${index}.isTrackSpecific`}
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                                  <FormControl>
                                    <input
                                      type="checkbox"
                                      className="h-4 w-4 rounded border-border text-blue-600 focus:ring-blue-500"
                                      checked={field.value}
                                      onChange={field.onChange}
                                    />
                                  </FormControl>
                                  <div className="space-y-1 leading-none">
                                    <FormLabel className="text-sm font-medium text-foreground">
                                      Thi theo track (vòng này)
                                    </FormLabel>
                                    <p className="text-xs text-muted-foreground">
                                      Bật: mỗi track một đề. Tắt: một đề chung cả vòng.
                                    </p>
                                  </div>
                                </FormItem>
                              )}
                            />
                        </div>
                        ) : (
                        <div className="md:col-span-12 mt-2 pt-4 border-t border-border/50">
                          <p className="text-xs text-muted-foreground">
                            Luồng B: mọi vòng thi theo track — đội giữ nguyên bảng
                            từ V1 tới chung kết; mỗi vòng có đề và tiêu chí chấm riêng.
                          </p>
                        </div>
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
            <div className="mt-8 flex flex-wrap items-center justify-end gap-3 border-t border-border/60 pt-6">
              <Button
                type="submit"
                className="rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-8 text-white shadow-lg shadow-orange-500/25 hover:from-orange-600 hover:to-amber-600"
                disabled={
                  isLoading || isUploading || form.formState.isSubmitting
                }
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    {isEdit ? (
                      <>
                        <Save className="mr-2 h-4 w-4" /> Save Changes
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="mr-2 h-4 w-4" /> Create Event
                      </>
                    )}
                  </>
                )}
              </Button>
            </div>
            <motion.div
              id="event-form-logistics"
              custom={4}
              variants={sectionVariants}
              initial="hidden"
              animate="visible"
              className="relative scroll-mt-24 group"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-yellow-500/5 rounded-3xl blur-xl transition-all duration-500 group-hover:from-orange-500/10 group-hover:to-yellow-500/10" />
              <div className="relative">
                <div className="flex items-center gap-4 mb-8">
                  <div className="p-3 bg-gradient-to-br from-orange-500/20 to-yellow-600/20 rounded-2xl text-orange-600 ring-1 ring-orange-500/20">
                    <ListChecks className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-orange-500 to-yellow-500">
                      Event Details
                    </h3>
                    <p className="text-muted-foreground mt-1">
                      Default public information. You can edit, add, or remove
                      it before publishing.
                    </p>
                  </div>
                </div>

                <div className="space-y-8">
                  <div className="rounded-2xl border border-border/50 bg-background/50 p-5">
                    <div className="mb-5 flex items-center gap-3">
                      <MapPin className="h-5 w-5 text-orange-500" />
                      <h4 className="font-semibold text-foreground">
                        Location
                      </h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                      <FormField
                        control={control}
                        name="location.venueName"
                        render={({ field }) => (
                          <FormItem className="md:col-span-6">
                            <FormLabel className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                              Venue {!isEdit && "*"}
                            </FormLabel>
                            <FormControl>
                              <Input
                                className="bg-card/50 rounded-lg"
                                {...field}
                                value={field.value ?? ""}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={control}
                        name="location.room"
                        render={({ field }) => (
                          <FormItem className="md:col-span-6">
                            <FormLabel className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                              Room / Hall {!isEdit && "*"}
                            </FormLabel>
                            <FormControl>
                              <Input
                                className="bg-card/50 rounded-lg"
                                {...field}
                                value={field.value ?? ""}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={control}
                        name="location.address"
                        render={({ field }) => (
                          <FormItem className="md:col-span-12">
                            <FormLabel className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                              Address {!isEdit && "*"}
                            </FormLabel>
                            <FormControl>
                              <Input
                                className="bg-card/50 rounded-lg"
                                {...field}
                                value={field.value ?? ""}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="md:col-span-12 rounded-xl border border-border/60 bg-card/40 p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-sm font-semibold">
                              Google Calendar
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {calendarChecking
                                ? "Checking connection..."
                                : calendarConnected
                                  ? "Connected. You can create a unique Google Meet for this event."
                                  : "Connect your organizer calendar before creating a Google Meet."}
                            </p>
                          </div>
                          {!calendarConnected && !calendarChecking ? (
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => void connectGoogleCalendar()}
                              disabled={calendarConnecting}
                            >
                              {calendarConnecting ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <Calendar className="mr-2 h-4 w-4" />
                              )}
                              Connect Google Calendar
                            </Button>
                          ) : null}
                        </div>
                        {calendarConnected ? (
                          <div className="mt-4 space-y-4 border-t border-border/60 pt-4">
                            <FormField
                              control={control}
                              name="createGoogleMeet"
                              render={({ field }) => (
                                <FormItem className="flex items-start gap-3 space-y-0">
                                  <FormControl>
                                    <input
                                      type="checkbox"
                                      className="mt-0.5 size-4 accent-orange-500"
                                      checked={field.value}
                                      onChange={field.onChange}
                                    />
                                  </FormControl>
                                  <div>
                                    <FormLabel>
                                      Create Google Meet automatically
                                    </FormLabel>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                      The configuration is saved now. Google
                                      Meet is created only when the event moves
                                      to Ongoing.
                                    </p>
                                  </div>
                                </FormItem>
                              )}
                            />
                            {watchedCreateGoogleMeet ? (
                              <>
                                <div className="grid gap-4 sm:grid-cols-2">
                                  <FormField
                                    control={control}
                                    name="calendarMeetingStart"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>Meeting start</FormLabel>
                                        <FormControl>
                                          <Input
                                            type="datetime-local"
                                            max={watchedEventEndDate || undefined}
                                            {...field}
                                            value={field.value ?? ""}
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                  <FormField
                                    control={control}
                                    name="calendarMeetingEnd"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>Meeting end</FormLabel>
                                        <FormControl>
                                          <Input
                                            type="datetime-local"
                                            max={watchedEventEndDate || undefined}
                                            {...field}
                                            value={field.value ?? ""}
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  Leave meeting times empty to use the event
                                  start and end times.
                                </p>
                                <FormField
                                  control={control}
                                  name="calendarAttendeeEmails"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>
                                        Additional attendee emails
                                      </FormLabel>
                                      <FormControl>
                                        <Textarea
                                          className="min-h-20 bg-background/50"
                                          placeholder="email1@example.com, email2@example.com"
                                          disabled={watchedStatus !== "ongoing"}
                                          {...field}
                                          value={field.value ?? ""}
                                        />
                                      </FormControl>
                                      <p className="text-xs text-muted-foreground">
                                        Registered students are included
                                        automatically. Add extra guests in
                                        Google Calendar after the meeting is
                                        created.
                                      </p>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                                <div className="grid gap-3 sm:grid-cols-2">
                                  <FormField
                                    control={control}
                                    name="sendCalendarInvitations"
                                    render={({ field }) => (
                                      <FormItem className="flex items-center gap-3 space-y-0">
                                        <FormControl>
                                          <input
                                            type="checkbox"
                                            className="size-4 accent-orange-500"
                                            checked={field.value}
                                            disabled={
                                              watchedStatus !== "ongoing"
                                            }
                                            onChange={field.onChange}
                                          />
                                        </FormControl>
                                        <FormLabel>
                                          Send Google invitations
                                        </FormLabel>
                                      </FormItem>
                                    )}
                                  />
                                  <FormField
                                    control={control}
                                    name="notifyParticipants"
                                    render={({ field }) => (
                                      <FormItem className="flex items-center gap-3 space-y-0">
                                        <FormControl>
                                          <input
                                            type="checkbox"
                                            className="size-4 accent-orange-500"
                                            checked={field.value}
                                            disabled={
                                              watchedStatus !== "ongoing"
                                            }
                                            onChange={field.onChange}
                                          />
                                        </FormControl>
                                        <FormLabel>
                                          Send SEAL notifications when published
                                        </FormLabel>
                                      </FormItem>
                                    )}
                                  />
                                </div>
                              </>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                      <FormField
                        control={control}
                        name="location.meetingPlatform"
                        render={({ field }) => (
                          <FormItem
                            className={
                              watchedCreateGoogleMeet
                                ? "md:col-span-6"
                                : "md:col-span-4"
                            }
                          >
                            <FormLabel className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                              Online Platform {!isEdit && "*"}
                            </FormLabel>
                            <FormControl>
                              <Input
                                className="bg-card/50 rounded-lg"
                                placeholder="Google Meet / Zoom"
                                disabled={watchedCreateGoogleMeet}
                                {...field}
                                value={
                                  watchedCreateGoogleMeet
                                    ? "Google Meet"
                                    : (field.value ?? "")
                                }
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      {!watchedCreateGoogleMeet ? (
                        <FormField
                          control={control}
                          name="location.meetingUrl"
                          render={({ field }) => (
                            <FormItem className="md:col-span-4">
                              <FormLabel className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                                Meeting URL {!isEdit && "*"}
                              </FormLabel>
                              <FormControl>
                                <Input
                                  className="bg-card/50 rounded-lg"
                                  placeholder="https://..."
                                  {...field}
                                  value={field.value ?? ""}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      ) : null}
                      <FormField
                        control={control}
                        name="location.mapUrl"
                        render={({ field }) => (
                          <FormItem
                            className={
                              watchedCreateGoogleMeet
                                ? "md:col-span-6"
                                : "md:col-span-4"
                            }
                          >
                            <FormLabel className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                              Map URL {!isEdit && "*"}
                            </FormLabel>
                            <FormControl>
                              <Input
                                className="bg-card/50 rounded-lg"
                                placeholder="https://..."
                                {...field}
                                value={field.value ?? ""}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={control}
                        name="location.note"
                        render={({ field }) => (
                          <FormItem className="md:col-span-12">
                            <FormLabel className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                              Location Note
                            </FormLabel>
                            <FormControl>
                              <Textarea
                                className="bg-card/50 rounded-lg min-h-[80px]"
                                {...field}
                                value={field.value ?? ""}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border/50 bg-background/50 p-5">
                    <div className="mb-5 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <Phone className="h-5 w-5 text-orange-500" />
                        <h4 className="font-semibold text-foreground">
                          Contact
                        </h4>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        className="gap-2 rounded-xl"
                        onClick={() =>
                          appendContact({
                            label: "",
                            name: "",
                            email: "",
                            phone: "",
                            detail: "",
                            responseTime: "",
                          })
                        }
                      >
                        <Plus className="h-4 w-4" /> Add Contact
                      </Button>
                    </div>
                    <div className="space-y-4">
                      {contactFields.map((field, index) => (
                        <div
                          key={field.id}
                          className="grid grid-cols-1 md:grid-cols-12 gap-4 rounded-xl border border-border/50 bg-card/40 p-4"
                        >
                          <FormField
                            control={control}
                            name={`contacts.${index}.label`}
                            render={({ field }) => (
                              <FormItem className="md:col-span-3">
                                <FormLabel className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                                  Label
                                </FormLabel>
                                <FormControl>
                                  <Input
                                    className="bg-background/50 rounded-lg"
                                    {...field}
                                    value={field.value ?? ""}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={control}
                            name={`contacts.${index}.name`}
                            render={({ field }) => (
                              <FormItem className="md:col-span-3">
                                <FormLabel className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                                  Name
                                </FormLabel>
                                <FormControl>
                                  <Input
                                    className="bg-background/50 rounded-lg"
                                    {...field}
                                    value={field.value ?? ""}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={control}
                            name={`contacts.${index}.email`}
                            render={({ field }) => (
                              <FormItem className="md:col-span-3">
                                <FormLabel className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                                  Email
                                </FormLabel>
                                <FormControl>
                                  <Input
                                    className="bg-background/50 rounded-lg"
                                    {...field}
                                    value={field.value ?? ""}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={control}
                            name={`contacts.${index}.phone`}
                            render={({ field }) => (
                              <FormItem className="md:col-span-3">
                                <FormLabel className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                                  Phone
                                </FormLabel>
                                <FormControl>
                                  <Input
                                    className="bg-background/50 rounded-lg"
                                    {...field}
                                    value={field.value ?? ""}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={control}
                            name={`contacts.${index}.detail`}
                            render={({ field }) => (
                              <FormItem className="md:col-span-8">
                                <FormLabel className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                                  Detail
                                </FormLabel>
                                <FormControl>
                                  <Input
                                    className="bg-background/50 rounded-lg"
                                    {...field}
                                    value={field.value ?? ""}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={control}
                            name={`contacts.${index}.responseTime`}
                            render={({ field }) => (
                              <FormItem className="md:col-span-3">
                                <FormLabel className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                                  Response Time
                                </FormLabel>
                                <FormControl>
                                  <Input
                                    className="bg-background/50 rounded-lg"
                                    {...field}
                                    value={field.value ?? ""}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <div className="md:col-span-1 flex items-end justify-end">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="text-red-500 hover:bg-red-100/50 hover:text-red-600"
                              onClick={() => removeContact(index)}
                              aria-label="Remove contact"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border/50 bg-background/50 p-5">
                    <div className="mb-5 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-orange-500" />
                        <h4 className="font-semibold text-foreground">Rules</h4>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        className="gap-2 rounded-xl"
                        onClick={() =>
                          appendRuleGroup({
                            title: "New Rule Group",
                            itemsText: "",
                          })
                        }
                      >
                        <Plus className="h-4 w-4" /> Add Rule Group
                      </Button>
                    </div>
                    <div className="space-y-4">
                      {ruleGroupFields.map((field, index) => (
                        <div
                          key={field.id}
                          className="grid grid-cols-1 md:grid-cols-12 gap-4 rounded-xl border border-border/50 bg-card/40 p-4"
                        >
                          <FormField
                            control={control}
                            name={`ruleGroups.${index}.title`}
                            render={({ field }) => (
                              <FormItem className="md:col-span-11">
                                <FormLabel className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                                  Group Title
                                </FormLabel>
                                <FormControl>
                                  <Input
                                    className="bg-background/50 rounded-lg"
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <div className="md:col-span-1 flex items-end justify-end">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="text-red-500 hover:bg-red-100/50 hover:text-red-600"
                              onClick={() => removeRuleGroup(index)}
                              aria-label="Remove rule group"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <FormField
                            control={control}
                            name={`ruleGroups.${index}.itemsText`}
                            render={({ field }) => (
                              <FormItem className="md:col-span-12">
                                <FormLabel className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                                  Rules, one per line
                                </FormLabel>
                                <FormControl>
                                  <Textarea
                                    className="bg-background/50 rounded-lg min-h-[120px]"
                                    {...field}
                                    value={field.value ?? ""}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border/50 bg-background/50 p-5">
                    <div className="mb-5 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <HelpCircle className="h-5 w-5 text-orange-500" />
                        <h4 className="font-semibold text-foreground">FAQ</h4>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        className="gap-2 rounded-xl"
                        onClick={() => appendFaq({ question: "", answer: "" })}
                      >
                        <Plus className="h-4 w-4" /> Add FAQ
                      </Button>
                    </div>
                    <div className="space-y-4">
                      {faqFields.map((field, index) => (
                        <div
                          key={field.id}
                          className="grid grid-cols-1 md:grid-cols-12 gap-4 rounded-xl border border-border/50 bg-card/40 p-4"
                        >
                          <FormField
                            control={control}
                            name={`faqItems.${index}.question`}
                            render={({ field }) => (
                              <FormItem className="md:col-span-11">
                                <FormLabel className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                                  Question
                                </FormLabel>
                                <FormControl>
                                  <Input
                                    className="bg-background/50 rounded-lg"
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <div className="md:col-span-1 flex items-end justify-end">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="text-red-500 hover:bg-red-100/50 hover:text-red-600"
                              onClick={() => removeFaq(index)}
                              aria-label="Remove FAQ"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <FormField
                            control={control}
                            name={`faqItems.${index}.answer`}
                            render={({ field }) => (
                              <FormItem className="md:col-span-12">
                                <FormLabel className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                                  Answer
                                </FormLabel>
                                <FormControl>
                                  <Textarea
                                    className="bg-background/50 rounded-lg min-h-[90px]"
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            <div className="sticky bottom-6 z-50 mt-8 flex flex-wrap items-center justify-end gap-3 rounded-2xl border border-border/60 bg-card/95 p-4 shadow-2xl shadow-black/10 backdrop-blur-xl">
              <Button
                type="submit"
                className="rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-8 text-white shadow-lg shadow-orange-500/25 hover:from-orange-600 hover:to-amber-600"
                disabled={
                  isLoading || isUploading || form.formState.isSubmitting
                }
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    {isEdit ? (
                      <>
                        <Save className="mr-2 h-4 w-4" /> Save Changes
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="mr-2 h-4 w-4" /> Create Event
                      </>
                    )}
                  </>
                )}
              </Button>
            </div>
          </main>
        </div>
      </form>
    </Form>
  );
}
