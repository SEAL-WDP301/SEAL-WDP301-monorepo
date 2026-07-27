"use client";

import { ProgressBar } from "@tremor/react";
import { Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { RegistrationDetails } from "@/lib/organizer/registrations/registration-types";
import { formatRegistrationDate } from "@/lib/organizer/registrations/registration-formatters";

import { EligibilityBadge } from "./eligibility-badge";
import { RegistrationStatusBadge } from "./registration-status-badge";

interface RegistrationDetailsDrawerProps {
  registration: RegistrationDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
}

export function RegistrationDetailsDrawer({
  registration,
  open,
  onOpenChange,
  loading = false,
  error = false,
  onRetry,
}: RegistrationDetailsDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 overflow-y-auto p-5 sm:max-w-2xl"
      >
        <SheetTitle>Registration details</SheetTitle>
        <SheetDescription className="mt-1">
          {registration?.id ??
            (loading ? "Loading registration..." : "Registration information")}
        </SheetDescription>

        {loading && <DetailsSkeleton />}

        {error && !loading && (
          <div className="grid min-h-64 place-items-center text-center">
            <div>
              <p className="text-sm text-muted-foreground">
                Unable to load registration details.
              </p>
              {onRetry && (
                <Button variant="outline" className="mt-4" onClick={onRetry}>
                  Try again
                </Button>
              )}
            </div>
          </div>
        )}

        {registration && !loading && !error && (
          <Tabs defaultValue="overview" className="mt-6">
            <TabsList className="w-full overflow-x-auto">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="answers">Answers</TabsTrigger>
              <TabsTrigger value="team">Team</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="mt-5">
              <Overview registration={registration} />
            </TabsContent>
            <TabsContent value="answers" className="mt-5">
              <Answers registration={registration} />
            </TabsContent>
            <TabsContent value="team" className="mt-5">
              <Team registration={registration} />
            </TabsContent>
            <TabsContent value="history" className="mt-5">
              <History registration={registration} />
            </TabsContent>
          </Tabs>
        )}
      </SheetContent>
    </Sheet>
  );
}

function DetailsSkeleton() {
  return (
    <div className="mt-6 space-y-3">
      {Array.from({ length: 4 }, (_, index) => (
        <div
          key={index}
          className="h-20 animate-pulse rounded-xl bg-muted/50"
        />
      ))}
    </div>
  );
}

function Overview({ registration }: { registration: RegistrationDetails }) {
  const initials = registration.student.fullName
    .split(" ")
    .map((word) => word[0])
    .slice(0, 2)
    .join("");

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border p-4">
        <div className="flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-full bg-orange-500/10 font-semibold text-orange-400">
            {initials}
          </span>
          <div>
            <p className="font-semibold">{registration.student.fullName}</p>
            <p className="text-xs text-muted-foreground">
              {registration.student.email} · {registration.student.studentId}
            </p>
          </div>
        </div>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <Detail label="Department" value={registration.student.department} />
          <Detail label="School" value={registration.student.school} />
          <Detail label="Phone" value={registration.student.phone} />
          <Detail
            label="Profile completion"
            value={`${registration.student.profileCompletion}%`}
          />
        </dl>
        <ProgressBar
          value={registration.student.profileCompletion}
          color="orange"
          className="mt-3"
        />
      </div>

      <div className="rounded-xl border border-border p-4">
        <h4 className="font-semibold">Registration information</h4>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
          <Detail label="Event" value={registration.event.name} />
          <Detail label="Track" value={registration.event.track} />
          <Detail
            label="Registered at"
            value={formatRegistrationDate(registration.registeredAt)}
          />
          <Detail label="Source" value={registration.source} />
          <div>
            <dt className="text-xs text-muted-foreground">Status</dt>
            <dd className="mt-1">
              <RegistrationStatusBadge status={registration.status} />
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Eligibility</dt>
            <dd className="mt-1">
              <EligibilityBadge
                status={registration.eligibility}
                reason={registration.eligibilityReason}
              />
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value?: string | number }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd>{value || "—"}</dd>
    </div>
  );
}

function Answers({ registration }: { registration: RegistrationDetails }) {
  if (!registration.answers.length) {
    return <EmptyText>No registration answers were submitted.</EmptyText>;
  }

  return (
    <div className="space-y-3">
      {registration.answers.map((answer) => (
        <div key={answer.label} className="rounded-xl border border-border p-4">
          <p className="text-xs font-medium text-muted-foreground">
            {answer.label}
          </p>
          <p className="mt-2 text-sm leading-relaxed">{answer.value}</p>
        </div>
      ))}
    </div>
  );
}

function Team({ registration }: { registration: RegistrationDetails }) {
  const { team } = registration;
  if (!team) {
    return (
      <div className="grid min-h-56 place-items-center text-center">
        <div>
          <Users className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            Student has not joined a team.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border p-4">
      <h4 className="font-semibold">{team.name}</h4>
      <p className="mt-1 text-xs text-muted-foreground">
        {team.status} · {team.role} · {team.members.length} members
      </p>
      <div className="mt-4 space-y-2 text-sm">
        <p>
          <span className="text-muted-foreground">Leader:</span> {team.leader}
        </p>
        {team.members.map((member) => (
          <div key={member} className="rounded-lg bg-muted/40 px-3 py-2">
            {member}
          </div>
        ))}
      </div>
    </div>
  );
}

function History({ registration }: { registration: RegistrationDetails }) {
  if (!registration.history.length) {
    return <EmptyText>No registration history is available yet.</EmptyText>;
  }

  return (
    <ol className="relative ml-2 border-l border-border pl-5">
      {registration.history.map((item) => (
        <li key={item.id} className="relative pb-6 last:pb-0">
          <span className="absolute -left-[25px] top-1 size-2 rounded-full bg-orange-400 ring-4 ring-background" />
          <p className="text-sm font-semibold">
            {item.action.replaceAll("_", " ")}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {item.actor} · {item.time}
          </p>
          {item.note && (
            <p className="mt-2 rounded-lg bg-muted/40 p-2 text-xs">
              {item.note}
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}

function EmptyText({ children }: { children: string }) {
  return (
    <p className="py-12 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}
