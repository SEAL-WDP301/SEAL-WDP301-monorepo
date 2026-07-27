"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { RegistrationListItem } from "@/lib/organizer/registrations/registration-types";
import { formatRegistrationDate } from "@/lib/organizer/registrations/registration-formatters";
import { RegistrationStatusBadge } from "./registration-status-badge";
import { EligibilityBadge } from "./eligibility-badge";
import { TeamStatusBadge } from "./team-status-badge";

export function getRegistrationColumns(actions: {
  view: (row: RegistrationListItem) => void;
}): ColumnDef<RegistrationListItem>[] {
  return [
    {
      id: "select",
      header: ({ table }) => (
        <input
          aria-label="Select all registrations on this page"
          type="checkbox"
          checked={table.getIsAllPageRowsSelected()}
          onChange={table.getToggleAllPageRowsSelectedHandler()}
          className="size-4 accent-orange-500"
        />
      ),
      cell: ({ row }) => (
        <input
          aria-label={`Select ${row.original.student.fullName}`}
          type="checkbox"
          checked={row.getIsSelected()}
          onChange={row.getToggleSelectedHandler()}
          className="size-4 accent-orange-500"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "student",
      header: "Student",
      cell: ({ row }) => {
        const student = row.original.student;
        const initials = student.fullName.split(" ").filter(Boolean).map((word) => word[0]).slice(0, 2).join("");
        return (
          <div className="flex w-64 items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full border border-orange-500/15 bg-orange-500/10 text-xs font-bold uppercase text-orange-500">
              {initials || "U"}
            </span>
            <div className="min-w-0">
              <p className="truncate font-semibold text-foreground">{student.fullName}</p>
              <p className="truncate text-xs text-muted-foreground">{student.email}</p>
              {student.studentId ? <p className="mt-0.5 truncate text-[10px] text-muted-foreground/75">{student.studentId}</p> : null}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "event",
      header: "Event",
      cell: ({ row }) => {
        const event = row.original.event;
        const metadata = [
          event.track,
          event.season && event.year > 0 ? `${event.season} ${event.year}` : event.season,
        ].filter(Boolean);
        return (
          <div className="w-72">
            <p className="line-clamp-2 font-medium leading-5 text-foreground" title={event.name}>{event.name}</p>
            {metadata.length > 0 ? <p className="mt-1 truncate text-xs text-muted-foreground">{metadata.join(" · ")}</p> : null}
          </div>
        );
      },
    },
    {
      accessorKey: "registeredAt",
      header: ({ column }) => (
        <Button variant="ghost" size="sm" className="-ml-2" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Registered <ArrowUpDown />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="w-40">
          <p className="text-sm font-medium">{formatRegistrationDate(row.original.registeredAt)}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{row.original.registeredRelative}</p>
        </div>
      ),
    },
    { accessorKey: "eligibility", header: "Eligibility", cell: ({ row }) => <EligibilityBadge status={row.original.eligibility} reason={row.original.eligibilityReason} /> },
    {
      accessorKey: "teamStatus",
      header: "Team",
      cell: ({ row }) => (
        <div className="w-32">
          <TeamStatusBadge status={row.original.teamStatus} />
          {row.original.team ? <p className="mt-1 truncate text-[10px] text-muted-foreground">{row.original.team.name} · {row.original.team.role}</p> : null}
        </div>
      ),
    },
    { accessorKey: "status", header: "Status", cell: ({ row }) => <RegistrationStatusBadge status={row.original.status} /> },
    {
      accessorKey: "reviewedBy",
      header: "Reviewed By",
      cell: ({ row }) => row.original.reviewedBy ? (
        <div className="w-36"><p className="truncate text-sm">{row.original.reviewedBy}</p><p className="truncate text-xs text-muted-foreground">{row.original.reviewedAt}</p></div>
      ) : <span className="text-xs text-muted-foreground">Not reviewed</span>,
    },
    {
      id: "actions",
      header: () => <span className="block text-right">Actions</span>,
      enableHiding: false,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" className="whitespace-nowrap" onClick={() => actions.view(row.original)}>
            View details
          </Button>
        </div>
      ),
    },
  ];
}
