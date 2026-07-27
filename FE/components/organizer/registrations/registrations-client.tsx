"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { RowSelectionState, VisibilityState } from "@tanstack/react-table";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { enqueueSnackbar } from "notistack";
import { isAxiosError } from "axios";
import { RegistrationKpiGrid } from "./registration-kpi-grid";
import { RegistrationTrendChart } from "./registration-trend-chart";
import { RegistrationToolbar } from "./registration-toolbar";
import { RegistrationTable } from "./registration-table";
import { RegistrationTableSkeleton } from "./registration-table-skeleton";
import { RegistrationEmptyState } from "./registration-empty-state";
import { RegistrationErrorState } from "./registration-error-state";
import { RegistrationDetailsDrawer } from "./registration-details-drawer";
import { ApproveRegistrationDialog } from "./approve-registration-dialog";
import { RejectRegistrationDialog } from "./reject-registration-dialog";
import { BulkRegistrationActions } from "./bulk-registration-actions";
import { ExportRegistrationDialog } from "./export-registration-dialog";
import {
  defaultRegistrationFilters,
  parseRegistrationFilters,
} from "@/lib/organizer/registrations/registration-search-params";
import type {
  ApproveRegistrationInput,
  RegistrationFilters,
  RegistrationListItem,
  RejectRegistrationInput,
} from "@/lib/organizer/registrations/registration-types";
import { organizerRegistrationService } from "@/services/organizer-registration.service";
import { getDashboardFilterOptions } from "@/services/admin-dashboard.service";

type ActionType = "approve" | "reject" | null;

function getActionErrorMessage(error: unknown) {
  if (isAxiosError<{ message?: string }>(error)) {
    if (error.response?.status === 404) {
      return "Registration review API is not available on the backend yet.";
    }
    return error.response?.data?.message || "Unable to update registration.";
  }
  return "Unable to update registration.";
}

export function RegistrationsClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<RegistrationFilters>(() =>
    parseRegistrationFilters(searchParams),
  );
  const [search, setSearch] = useState(filters.search);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    eligibility: false,
    reviewedBy: false,
  });
  const [selectedRegistration, setSelectedRegistration] =
    useState<RegistrationListItem | null>(null);
  const [selectedRegistrationId, setSelectedRegistrationId] = useState<
    string | null
  >(() => searchParams.get("registrationId"));
  const [detailsOpen, setDetailsOpen] = useState(() =>
    Boolean(searchParams.get("registrationId")),
  );
  const [action, setAction] = useState<ActionType>(null);
  const [exportOpen, setExportOpen] = useState(false);

  const updateFilters = useCallback(
    (patch: Partial<RegistrationFilters>) => {
      const next = {
        ...filters,
        ...patch,
        page: "page" in patch ? (patch.page ?? filters.page) : 1,
      };
      const params = new URLSearchParams();
      Object.entries(next).forEach(([key, value]) => {
        if (
          String(value) !==
          String(defaultRegistrationFilters[key as keyof RegistrationFilters])
        )
          params.set(key, String(value));
      });
      setFilters(next);
      router.replace(
        `${pathname}${params.size ? `?${params.toString()}` : ""}`,
        { scroll: false },
      );
      setRowSelection({});
    },
    [filters, pathname, router],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (search !== filters.search) updateFilters({ search });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [filters.search, search, updateFilters]);

  const overviewQuery = useQuery({
    queryKey: ["organizer-registration-overview"],
    queryFn: () => organizerRegistrationService.getOverview(),
  });
  const trendQuery = useQuery({
    queryKey: ["organizer-registration-trend"],
    queryFn: () => organizerRegistrationService.getTrend(),
  });
  const registrationsQuery = useQuery({
    queryKey: ["organizer-registrations", filters],
    queryFn: () => organizerRegistrationService.getRegistrations(filters),
    placeholderData: (previous) => previous,
  });
  const detailsQuery = useQuery({
    queryKey: ["organizer-registration", selectedRegistrationId],
    queryFn: () =>
      organizerRegistrationService.getRegistration(
        selectedRegistrationId ?? "",
      ),
    enabled: detailsOpen && Boolean(selectedRegistrationId),
  });
  const filterOptionsQuery = useQuery({
    queryKey: ["organizer-dashboard-filter-options"],
    queryFn: getDashboardFilterOptions,
  });

  const mutation = useMutation({
    mutationFn: async ({
      type,
      registration,
      input,
    }: {
      type: Exclude<ActionType, null>;
      registration: RegistrationListItem;
      input:
        | ApproveRegistrationInput
        | RejectRegistrationInput;
    }) => {
      if (type === "approve")
        return organizerRegistrationService.approve(
          registration.id,
          input as ApproveRegistrationInput,
        );
      return organizerRegistrationService.reject(
        registration.id,
        input as RejectRegistrationInput,
      );
    },
    onSuccess: (_, variables) => {
      enqueueSnackbar(
        `${variables.registration.student.fullName} moved to ${variables.type === "approve" ? "Approved" : "Rejected"}.`,
        { variant: "success" },
      );
      setAction(null);
      void queryClient.invalidateQueries({
        queryKey: ["organizer-registrations"],
      });
    },
    onError: (error) =>
      enqueueSnackbar(getActionErrorMessage(error), { variant: "error" }),
  });

  const openAction = useCallback(
    (type: Exclude<ActionType, null>, registration: RegistrationListItem) => {
      setSelectedRegistration(registration);
      setAction(type);
    },
    [],
  );
  const actions = useMemo(
    () => ({
      view: (registration: RegistrationListItem) => {
        setSelectedRegistration(registration);
        setSelectedRegistrationId(registration.id);
        setDetailsOpen(true);
      },
      approve: (registration: RegistrationListItem) =>
        openAction("approve", registration),
      reject: (registration: RegistrationListItem) =>
        openAction("reject", registration),
    }),
    [openAction],
  );

  const handleDetailsOpenChange = (open: boolean) => {
    setDetailsOpen(open);
    if (open || !searchParams.has("registrationId")) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("registrationId");
    router.replace(`${pathname}${params.size ? `?${params.toString()}` : ""}`, {
      scroll: false,
    });
  };

  const selectedRows =
    registrationsQuery.data?.data.filter((record) => rowSelection[record.id]) ??
    [];
  const canBulkApprove =
    selectedRows.length > 0 &&
    selectedRows.every(
      (record) =>
        record.status === "Pending" && record.eligibility === "Eligible",
    );
  const runBulk = async (type: Exclude<ActionType, null>) => {
    if (
      !window.confirm(
        `Apply ${type} to ${selectedRows.length} selected registrations?`,
      )
    )
      return;
    const eligible = selectedRows.filter(
      (record) =>
        type !== "approve" ||
        (record.status === "Pending" && record.eligibility === "Eligible"),
    );
    const results = await Promise.allSettled(
      eligible.map((record) =>
        type === "approve"
          ? organizerRegistrationService.approve(record.id, {
              sendNotification: true,
              includeTeamInstructions: true,
            })
          : organizerRegistrationService.reject(record.id, {
              reason: "Bulk review",
              note: "",
              sendNotification: true,
              allowRegisterAgain: false,
            }),
      ),
    );
    const succeeded = results.filter(
      (result) => result.status === "fulfilled",
    ).length;
    const failedResults = results.filter(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );

    if (succeeded === 0 && failedResults.length > 0) {
      enqueueSnackbar(getActionErrorMessage(failedResults[0].reason), {
        variant: "error",
      });
      return;
    }

    const skipped = selectedRows.length - eligible.length;
    const failed = failedResults.length;
    enqueueSnackbar(
      `${succeeded} succeeded${failed ? `, ${failed} failed` : ""}${skipped ? `, ${skipped} skipped` : ""}.`,
      { variant: failed || skipped ? "warning" : "success" },
    );
    setRowSelection({});
    void queryClient.invalidateQueries({
      queryKey: ["organizer-registrations"],
    });
  };

  const resetFilters = () => {
    setSearch("");
    updateFilters(defaultRegistrationFilters);
  };
  const exportRegistrations = (scope: "filtered" | "selected") => {
    enqueueSnackbar(
      `${scope === "selected" ? selectedRows.length : (registrationsQuery.data?.pagination.total ?? 0)} registrations queued for CSV export.`,
      { variant: "success" },
    );
    setExportOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-400">
            Participant operations
          </p>
          <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">
            Registrations
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Review and manage student registrations across your assigned events.
          </p>
        </div>
      </div>
      {overviewQuery.data ? (
        <RegistrationKpiGrid overview={overviewQuery.data} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
          {Array.from({ length: 5 }, (_, index) => (
            <div
              key={index}
              className="h-40 animate-pulse rounded-2xl bg-muted/50"
            />
          ))}
        </div>
      )}
      <section>
        <div>
          {trendQuery.data ? (
            <RegistrationTrendChart data={trendQuery.data} />
          ) : (
            <div className="h-96 animate-pulse rounded-2xl bg-muted/50" />
          )}
        </div>
      </section>
      <RegistrationToolbar
        filters={filters}
        search={search}
        onSearchChange={setSearch}
        onChange={updateFilters}
        onReset={resetFilters}
        onExport={() => setExportOpen(true)}
        eventOptions={filterOptionsQuery.data?.events}
      />
      {registrationsQuery.isError ? (
        <RegistrationErrorState
          onRetry={() => void registrationsQuery.refetch()}
        />
      ) : registrationsQuery.isLoading || !registrationsQuery.data ? (
        <RegistrationTableSkeleton />
      ) : registrationsQuery.data.data.length === 0 ? (
        <RegistrationEmptyState onReset={resetFilters} />
      ) : (
        <RegistrationTable
          response={registrationsQuery.data}
          filters={filters}
          rowSelection={rowSelection}
          onRowSelectionChange={setRowSelection}
          columnVisibility={columnVisibility}
          onColumnVisibilityChange={setColumnVisibility}
          actions={actions}
          onChange={updateFilters}
        />
      )}
      <BulkRegistrationActions
        count={selectedRows.length}
        canApprove={canBulkApprove}
        onApprove={() => void runBulk("approve")}
        onReject={() => void runBulk("reject")}
        onExport={() => setExportOpen(true)}
        onClear={() => setRowSelection({})}
      />
      <RegistrationDetailsDrawer
        registration={detailsQuery.data ?? null}
        open={detailsOpen}
        onOpenChange={handleDetailsOpenChange}
        loading={detailsQuery.isLoading}
        error={detailsQuery.isError}
        onRetry={() => void detailsQuery.refetch()}
      />
      <ApproveRegistrationDialog
        registration={selectedRegistration}
        open={action === "approve"}
        onOpenChange={(open) => !open && setAction(null)}
        pending={mutation.isPending}
        onConfirm={(input) =>
          selectedRegistration &&
          mutation.mutate({
            type: "approve",
            registration: selectedRegistration,
            input,
          })
        }
      />
      <RejectRegistrationDialog
        registration={selectedRegistration}
        open={action === "reject"}
        onOpenChange={(open) => !open && setAction(null)}
        pending={mutation.isPending}
        onConfirm={(input) =>
          selectedRegistration &&
          mutation.mutate({
            type: "reject",
            registration: selectedRegistration,
            input,
          })
        }
      />
      <ExportRegistrationDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        selectedCount={selectedRows.length}
        onConfirm={exportRegistrations}
      />
    </div>
  );
}
