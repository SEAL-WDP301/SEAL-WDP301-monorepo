"use client";
/* eslint-disable react-hooks/incompatible-library */

import { useMemo } from "react";
import { flexRender, getCoreRowModel, useReactTable, type RowSelectionState, type SortingState, type VisibilityState } from "@tanstack/react-table";
import { Columns3 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { PaginatedRegistrationResponse, RegistrationFilters, RegistrationListItem } from "@/lib/organizer/registrations/registration-types";
import { cn } from "@/lib/utils";
import { getRegistrationColumns } from "./registration-columns";
import { RegistrationMobileCard } from "./registration-mobile-card";
import { formatRegistrationNumber } from "@/lib/organizer/registrations/registration-formatters";

const columnLabels: Record<string, string> = {
  student: "Student",
  event: "Event",
  registeredAt: "Registered date",
  eligibility: "Eligibility",
  teamStatus: "Team status",
  status: "Registration status",
  reviewedBy: "Reviewed by",
};

export function RegistrationTable({ response, filters, rowSelection, onRowSelectionChange, columnVisibility, onColumnVisibilityChange, actions, onChange }: {
  response: PaginatedRegistrationResponse;
  filters: RegistrationFilters;
  rowSelection: RowSelectionState;
  onRowSelectionChange: (selection: RowSelectionState) => void;
  columnVisibility: VisibilityState;
  onColumnVisibilityChange: (visibility: VisibilityState) => void;
  actions: { view: (row: RegistrationListItem) => void };
  onChange: (patch: Partial<RegistrationFilters>) => void;
}) {
  const columns = useMemo(() => getRegistrationColumns(actions), [actions]);
  const sorting: SortingState = [{ id: filters.sortBy, desc: filters.sortOrder === "desc" }];
  const table = useReactTable({
    data: response.data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    pageCount: response.pagination.totalPages,
    state: { rowSelection, columnVisibility, sorting },
    getRowId: (row) => row.id,
    onRowSelectionChange: (updater) => onRowSelectionChange(typeof updater === "function" ? updater(rowSelection) : updater),
    onColumnVisibilityChange: (updater) => onColumnVisibilityChange(typeof updater === "function" ? updater(columnVisibility) : updater),
    onSortingChange: (updater) => {
      const next = typeof updater === "function" ? updater(sorting) : updater;
      if (next[0]) onChange({ sortBy: next[0].id, sortOrder: next[0].desc ? "desc" : "asc" });
    },
  });
  const start = response.pagination.total === 0 ? 0 : (filters.page - 1) * filters.limit + 1;
  const end = Math.min(filters.page * filters.limit, response.pagination.total);

  return (
    <div className="space-y-4">
      <div className="hidden overflow-hidden rounded-2xl border border-border bg-card/40 md:block">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="text-xs text-muted-foreground">{response.data.length} registrations on this page</p>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="outline" size="sm"><Columns3 /> Columns</Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {table.getAllLeafColumns().filter((column) => column.getCanHide()).map((column) => (
                <DropdownMenuCheckboxItem key={column.id} checked={column.getIsVisible()} onCheckedChange={(checked) => column.toggleVisibility(Boolean(checked))}>
                  {columnLabels[column.id] ?? column.id}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="overflow-x-auto">
          <Table className="min-w-[1120px]">
            <TableHeader className="bg-muted/35">
              {table.getHeaderGroups().map((group) => (
                <TableRow key={group.id}>
                  {group.headers.map((header) => (
                    <TableHead key={header.id} className={cn(header.column.id === "actions" && "sticky right-0 z-20 bg-muted/95 shadow-[-8px_0_16px_-16px_rgba(0,0,0,0.7)]")}>
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() ? "selected" : undefined} className="hover:bg-muted/25">
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className={cn("py-3", cell.column.id === "actions" && "sticky right-0 z-10 bg-card/95 shadow-[-8px_0_16px_-16px_rgba(0,0,0,0.7)] backdrop-blur")}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="grid gap-3 md:hidden">
        {table.getRowModel().rows.map((row) => <RegistrationMobileCard key={row.id} registration={row.original} selected={row.getIsSelected()} onSelectedChange={row.toggleSelected} onView={() => actions.view(row.original)} />)}
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card/40 p-4 text-sm lg:flex-row lg:items-center">
        <p className="text-muted-foreground">Showing <span className="font-medium text-foreground">{start}–{end}</span> of {formatRegistrationNumber(response.pagination.total)}</p>
        <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
          <Select value={String(filters.limit)} onValueChange={(value) => value && onChange({ limit: Number(value), page: 1 })}>
            <SelectTrigger className="w-28"><SelectValue>{filters.limit} rows</SelectValue></SelectTrigger>
            <SelectContent>{[10, 20, 50, 100].map((size) => <SelectItem key={size} value={String(size)}>{size} rows</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="outline" size="sm" disabled={filters.page <= 1} onClick={() => onChange({ page: filters.page - 1 })}>Previous</Button>
          <span className="min-w-20 text-center text-sm font-medium">{filters.page} / {response.pagination.totalPages}</span>
          <Button variant="outline" size="sm" disabled={filters.page >= response.pagination.totalPages} onClick={() => onChange({ page: filters.page + 1 })}>Next</Button>
        </div>
      </div>
    </div>
  );
}
