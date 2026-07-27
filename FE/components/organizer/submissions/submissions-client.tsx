"use client";

/* eslint-disable react-hooks/incompatible-library */

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { AreaChart } from "@tremor/react";
import {
  CheckCircle2,
  Clock3,
  FileCheck2,
  MoreHorizontal,
  Search,
  Users,
} from "lucide-react";

import { ManagementPageHeader } from "@/components/organizer/shared/management-page-header";
import { ManagementMetricGrid } from "@/components/organizer/shared/management-metric-grid";
import {
  ManagementEmpty,
  ManagementError,
  ManagementSkeleton,
} from "@/components/organizer/shared/management-states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  OrganizerSubmission,
  SubmissionFilters,
} from "@/lib/organizer/management-types";
import { organizerManagementService } from "@/services/organizer-management.service";

const statusVariant = {
  "On Time": "success",
  Late: "warning",
  Invalid: "destructive",
  Reopened: "ai",
} as const;

export function SubmissionsClient() {
  const [filters, setFilters] = useState<SubmissionFilters>({
    search: "",
    status: "All",
    page: 1,
    limit: 10,
  });
  const [selected, setSelected] = useState<OrganizerSubmission | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const query = useQuery({
    queryKey: ["organizer-submissions", filters],
    queryFn: () => organizerManagementService.getSubmissions(filters),
  });
  const activityQuery = useQuery({
    queryKey: ["organizer-submission-activity"],
    queryFn: () => organizerManagementService.getSubmissionActivity(),
  });
  const summaryQuery = useQuery({
    queryKey: ["organizer-submission-summary"],
    queryFn: () => organizerManagementService.getSubmissionSummary(),
  });

  const columns = useMemo<ColumnDef<OrganizerSubmission>[]>(
    () => [
      {
        accessorKey: "team",
        header: "Team",
        cell: ({ row }) => (
          <div>
            <p className="font-medium">{row.original.team}</p>
            <p className="text-xs text-muted-foreground">
              {row.original.project}
            </p>
          </div>
        ),
      },
      { accessorKey: "event", header: "Event" },
      { accessorKey: "round", header: "Round" },
      { accessorKey: "track", header: "Track" },
      { accessorKey: "submittedAt", header: "Submitted At" },
      {
        accessorKey: "status",
        header: "Submission Status",
        cell: ({ row }) => (
          <Badge variant={statusVariant[row.original.status]}>
            {row.original.status}
          </Badge>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Actions for ${row.original.project}`}
              >
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => {
                  setSelected(row.original);
                  setDrawerOpen(true);
                }}
              >
                View Submission
              </DropdownMenuItem>
              {row.original.repository ? (
                <DropdownMenuItem
                  onClick={() => window.open(row.original.repository, "_blank")}
                >
                  Open Repository
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [],
  );
  const table = useReactTable({
    data: query.data?.data ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const summary = summaryQuery.data;
  const metrics = [
    {
      label: "Total Submissions",
      value: summary?.total ?? 0,
      detail: "Across all assigned events",
      icon: FileCheck2,
    },
    {
      label: "Submitted On Time",
      value: summary?.onTime ?? 0,
      detail: "Before round deadline",
      icon: CheckCircle2,
    },
    {
      label: "Late Submissions",
      value: summary?.late ?? 0,
      detail: "Require review",
      icon: Clock3,
    },
    {
      label: "Teams Not Submitted",
      value: summary?.notSubmitted ?? 0,
      detail: "From dashboard submission summary",
      icon: Users,
    },
  ];

  return (
    <div className="space-y-6">
      <ManagementPageHeader
        eyebrow="Delivery operations"
        title="Submissions"
        description="Monitor team deliverables across assigned events."
      />

      {summaryQuery.isError ? (
        <ManagementError onRetry={() => void summaryQuery.refetch()} />
      ) : (
        <ManagementMetricGrid metrics={metrics} />
      )}

      <div className="rounded-2xl border border-border bg-card/60 p-5">
        <h2 className="font-semibold">Submission Activity</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Live activity returned by the dashboard submissions API.
        </p>
        {activityQuery.isError ? (
          <ManagementError onRetry={() => void activityQuery.refetch()} />
        ) : activityQuery.isLoading ? (
          <div className="mt-5 h-64 animate-pulse rounded-xl bg-muted/50" />
        ) : activityQuery.data?.length ? (
          <AreaChart
            data={activityQuery.data}
            index="date"
            categories={["Submissions"]}
            colors={["orange"]}
            className="mt-5 h-64"
            showAnimation={false}
          />
        ) : (
          <ManagementEmpty label="submission activity" />
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card/60 p-4 md:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filters.search}
            onChange={(event) =>
              setFilters({ ...filters, search: event.target.value, page: 1 })
            }
            placeholder="Search team or project..."
            className="pl-9"
          />
        </div>
        <Select
          value={filters.status}
          onValueChange={(status) =>
            status && setFilters({ ...filters, status, page: 1 })
          }
        >
          <SelectTrigger className="w-full md:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {["All", "On Time", "Late", "Invalid", "Reopened"].map((status) => (
              <SelectItem key={status} value={status}>
                {status}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {query.isError ? (
        <ManagementError onRetry={() => void query.refetch()} />
      ) : query.isLoading ? (
        <ManagementSkeleton />
      ) : !query.data?.data.length ? (
        <ManagementEmpty label="submissions" />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((group) => (
                <TableRow key={group.id}>
                  {group.headers.map((header) => (
                    <TableHead key={header.id}>
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex items-center justify-between border-t p-3 text-sm">
            <span>{query.data.pagination.total} submissions</span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={filters.page === 1}
                onClick={() =>
                  setFilters({ ...filters, page: filters.page - 1 })
                }
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={filters.page >= query.data.pagination.totalPages}
                onClick={() =>
                  setFilters({ ...filters, page: filters.page + 1 })
                }
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      )}

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent
          side="right"
          className="w-full overflow-y-auto p-5 sm:max-w-2xl"
        >
          <SheetTitle>{selected?.project}</SheetTitle>
          <SheetDescription>
            {selected?.team} · {selected?.id}
          </SheetDescription>
          {selected ? (
            <div className="mt-6 space-y-6">
              <section className="rounded-2xl border border-border bg-card/60 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-semibold">Submission details</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Information returned by the event submissions API.
                    </p>
                  </div>
                  <Badge variant={statusVariant[selected.status]}>
                    {selected.status}
                  </Badge>
                </div>

                <dl className="mt-5 grid gap-4 sm:grid-cols-2">
                  {[
                    ["Team", selected.team],
                    ["Event", selected.event],
                    ["Round", selected.round],
                    ["Track", selected.track],
                    ["Submitted at", selected.submittedAt],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-xl bg-muted/40 p-3">
                      <dt className="text-xs text-muted-foreground">{label}</dt>
                      <dd className="mt-1 font-medium">{value || "—"}</dd>
                    </div>
                  ))}
                </dl>

                {selected.description ? (
                  <div className="mt-5 border-t border-border pt-5">
                    <h4 className="text-sm font-medium">Description</h4>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                      {selected.description}
                    </p>
                  </div>
                ) : null}
              </section>

              {selected.repository || selected.demo ? (
                <section className="rounded-2xl border border-border bg-card/60 p-5">
                  <h3 className="font-semibold">Files &amp; links</h3>
                  <div className="mt-4 space-y-3">
                    {selected.repository ? (
                      <a
                        className="block rounded-xl border border-border p-4 text-orange-400 transition-colors hover:bg-muted/40"
                        href={selected.repository}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Repository
                      </a>
                    ) : null}
                    {selected.demo ? (
                      <a
                        className="block rounded-xl border border-border p-4 text-orange-400 transition-colors hover:bg-muted/40"
                        href={selected.demo}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Submitted file / demo
                      </a>
                    ) : null}
                  </div>
                </section>
              ) : null}
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
