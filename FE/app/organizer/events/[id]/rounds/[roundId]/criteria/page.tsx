"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import { Edit2, Loader2, Plus, Save, Trash2, AlignLeft, UploadCloud, ChevronLeft, ChevronRight, Sparkles, AlertTriangle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  createOrganizerRubric,
  deleteOrganizerRubric,
  getOrganizerEvent,
  getOrganizerRubrics,
  updateOrganizerRubric,
  bulkDeleteOrganizerRubrics,
  type OrganizerRubric,
  type OrganizerRubricPayload,
} from "@/lib/api/organizer-events.api";
import { cn } from "@/lib/utils";
import { BulkImportRubricsModal } from "./_components/bulk-import-modal";
import { AiSuggestRubricsModal } from "./_components/ai-suggest-rubrics-modal";

type RubricDraft = {
  roundId: string;
  trackId: string;
  name: string;
  description: string;
  weight: number | string;
};

const emptyRubric = (): RubricDraft => ({
  roundId: "",
  trackId: "",
  name: "",
  description: "",
  weight: 10,
});

function getApiMessage(error: unknown, fallback: string) {
  const apiError = error as {
    response?: { data?: { message?: string; errors?: string[] } };
  };
  const errors = apiError.response?.data?.errors;
  if (Array.isArray(errors) && errors.length > 0) return errors.join(", ");
  return apiError.response?.data?.message || fallback;
}

export default function EventCriteriaPage() {
  const params = useParams();
  const eventId = params.id as string;
  const currentRoundId = params.roundId as string;
  const queryClient = useQueryClient();

  const [rubricDraft, setRubricDraft] = useState<RubricDraft>(() => ({
    ...emptyRubric(),
    roundId: currentRoundId,
  }));
  const [editingRubricId, setEditingRubricId] = useState<number | null>(null);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [isAiSuggestOpen, setIsAiSuggestOpen] = useState(false);
  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
  const [isConfirmDeleteModalOpen, setIsConfirmDeleteModalOpen] = useState(false);
  
  // Selection & Pagination state
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const eventQuery = useQuery({
    queryKey: ["organizerEvent", eventId],
    queryFn: () => getOrganizerEvent(eventId),
  });

  const rubricsQuery = useQuery({
    queryKey: ["organizerRubrics", eventId],
    queryFn: () => getOrganizerRubrics(eventId),
  });

  const event = eventQuery.data;
  const rounds = useMemo(
    () => [...(event?.rounds || [])].sort((a, b) => a.roundNumber - b.roundNumber),
    [event?.rounds]
  );

  const roundById = useMemo(
    () => new Map(rounds.map((round) => [round.id, round])),
    [rounds]
  );

  const rubrics = useMemo(() => rubricsQuery.data || [], [rubricsQuery.data]);
  const currentRound = roundById.get(Number(currentRoundId));

  const canEditCriteria = useMemo(() => {
    if (event?.status === "closed") return false;
    if (!currentRound) return false;
    return (
      currentRound.status === "not_started" || currentRound.status === "open"
    );
  }, [event?.status, currentRound]);

  const getDisabledReason = () => {
    if (event?.status === "closed") return "Event is closed.";
    if (!currentRound) return "Round not found.";
    if (!canEditCriteria) return "Cannot edit after this round has ended.";
    return undefined;
  };

  const roundRubrics = useMemo(
    () =>
      rubrics.filter((rubric) => String(rubric.roundId) === currentRoundId),
    [currentRoundId, rubrics],
  );

  const totalPages = Math.ceil(roundRubrics.length / ITEMS_PER_PAGE);
  const paginatedRubrics = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return roundRubrics.slice(start, start + ITEMS_PER_PAGE);
  }, [roundRubrics, currentPage]);

  const TARGET_WEIGHT_TOTAL = 100;

  const weightTotal = useMemo(
    () => roundRubrics.reduce((sum, r) => sum + Number(r.weight || 0), 0),
    [roundRubrics],
  );

  const selectedScopeWeight = useMemo(
    () =>
      roundRubrics.reduce((sum, r) => {
        if (r.id === editingRubricId) return sum;
        return sum + Number(r.weight || 0);
      }, 0),
    [editingRubricId, roundRubrics],
  );

  const projectedScopeWeight =
    selectedScopeWeight + (Number(rubricDraft.weight) || 0);
  const weightOverBudget = weightTotal > TARGET_WEIGHT_TOTAL + 0.01;
  const weightIncomplete =
    roundRubrics.length > 0 &&
    weightTotal < TARGET_WEIGHT_TOTAL - 0.01 &&
    !weightOverBudget;

  const resetForm = () => {
    setEditingRubricId(null);
    setRubricDraft({ ...emptyRubric(), roundId: currentRoundId });
    setIsAddEditModalOpen(false);
  };

  const saveRubricMutation = useMutation({
    mutationFn: async () => {
      if (!canEditCriteria) {
        throw new Error("Cannot manage criteria after a round has ended.");
      }
      if (!rubricDraft.name.trim()) throw new Error("Criterion name is required.");

      const weight = Number(rubricDraft.weight);

      if (!Number.isFinite(weight) || weight <= 0) {
        throw new Error("Weight (%) must be greater than 0.");
      }
      if (weight > TARGET_WEIGHT_TOTAL) {
        throw new Error("Weight (%) cannot exceed 100.");
      }
      if (projectedScopeWeight > TARGET_WEIGHT_TOTAL + 0.01) {
        const message = `Weight exceeds 100%: current ${selectedScopeWeight.toFixed(2)}% + ${weight}% = ${projectedScopeWeight.toFixed(2)}%.`;
        enqueueSnackbar(message, { variant: "warning" });
        throw new Error(message);
      }

      const payload: OrganizerRubricPayload = {
        name: rubricDraft.name.trim(),
        description: rubricDraft.description.trim() || undefined,
        maxScore: 10,
        weight,
        roundId: Number(currentRoundId),
        trackId: null,
      };

      return editingRubricId
        ? updateOrganizerRubric(eventId, editingRubricId, payload)
        : createOrganizerRubric(eventId, payload);
    },
    onSuccess: () => {
      enqueueSnackbar(editingRubricId ? "Rubric updated" : "Rubric created", { variant: "success" });
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["organizerRubrics", eventId] });
    },
    onError: (error) => {
      enqueueSnackbar(getApiMessage(error, "Failed to save rubric"), { variant: "error" });
    },
  });

  const deleteRubricMutation = useMutation({
    mutationFn: (rubricId: number) => deleteOrganizerRubric(eventId, rubricId),
    onSuccess: () => {
      enqueueSnackbar("Rubric deleted", { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["organizerRubrics", eventId] });
      setSelectedIds(prev => []);
    },
    onError: (error) => {
      enqueueSnackbar(getApiMessage(error, "Failed to delete rubric"), { variant: "error" });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: () => bulkDeleteOrganizerRubrics(eventId, selectedIds),
    onSuccess: () => {
      enqueueSnackbar(`Successfully deleted ${selectedIds.length} rubrics`, { variant: "success" });
      setSelectedIds([]);
      setIsConfirmDeleteModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["organizerRubrics", eventId] });
    },
    onError: (error) => {
      enqueueSnackbar(getApiMessage(error, "Failed to delete rubrics"), { variant: "error" });
    }
  });

  const startEditRubric = (rubric: OrganizerRubric) => {
    setEditingRubricId(rubric.id);
    setRubricDraft({
      roundId: currentRoundId,
      trackId: "",
      name: rubric.name,
      description: rubric.description || "",
      weight: rubric.weight,
    });
    setIsAddEditModalOpen(true);
  };

  const toggleSelection = (id: number) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === paginatedRubrics.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(paginatedRubrics.map(r => r.id));
    }
  };

  if (eventQuery.isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (eventQuery.isError || !event) {
    return (
      <div className="mx-auto mt-20 max-w-lg rounded-xl border border-red-500/20 bg-red-500/10 p-6 text-center text-red-500">
        Failed to load event details.
      </div>
    );
  }

  const hasRequiredConfiguration = rounds.length > 0;
  const canSubmit =
    canEditCriteria &&
    Boolean(rubricDraft.name.trim()) &&
    !saveRubricMutation.isPending &&
    projectedScopeWeight <= TARGET_WEIGHT_TOTAL + 0.01;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Badge variant="outline">{event.season} {event.year}</Badge>
            <Badge variant={event.status === "draft" ? "warning" : "success"} className="capitalize">
              {event.status}
            </Badge>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Grading Criteria</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Round {currentRound?.roundNumber}: {currentRound?.name}. One rubric
            shared by all tracks in this round. Weights total 100%.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            className="gap-2 bg-orange-600 hover:bg-orange-700 text-white"
            disabled={!canEditCriteria || !currentRound}
            onClick={() => setIsAiSuggestOpen(true)}
            title={getDisabledReason()}
          >
            <Sparkles className="h-4 w-4" />
            AI Suggest
          </Button>
          <Button
            type="button"
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
            disabled={!canEditCriteria || !currentRound}
            onClick={() => setIsBulkImportOpen(true)}
            title={getDisabledReason()}
          >
            <UploadCloud className="mr-2 h-4 w-4" />
            Bulk Import
          </Button>
          <Button
            type="button"
            className="shrink-0"
            disabled={!canEditCriteria || !currentRound}
            onClick={() => { setEditingRubricId(null); setIsAddEditModalOpen(true); }}
            title={getDisabledReason()}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Rubric
          </Button>
        </div>
      </div>

      {!hasRequiredConfiguration && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-400">
          Create at least one round before adding rubrics.
        </div>
      )}

      {weightOverBudget && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-400">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <p>
            Weights total <strong>{weightTotal.toFixed(2)}%</strong> (max 100%).
            Over by{" "}
            <strong>{(weightTotal - TARGET_WEIGHT_TOTAL).toFixed(2)}%</strong>.
          </p>
        </div>
      )}

      {weightIncomplete && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <p>
            Weights total <strong>{weightTotal.toFixed(2)}%</strong>. Remaining{" "}
            <strong>
              {(TARGET_WEIGHT_TOTAL - weightTotal).toFixed(2)}%
            </strong>
            .
          </p>
        </div>
      )}

      <GlassCard className="min-w-0 rounded-[24px] p-5">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-xl font-bold">Rubric List</h2>
            <p className="text-sm text-muted-foreground">
              {roundRubrics.length} criteria ·{" "}
              <span
                className={cn(
                  "font-semibold",
                  weightOverBudget
                    ? "text-red-600"
                    : Math.abs(weightTotal - TARGET_WEIGHT_TOTAL) <= 0.01
                      ? "text-emerald-600"
                      : "text-amber-600",
                )}
              >
                {weightTotal.toFixed(2)}% / 100%
              </span>
            </p>
          </div>

          <div className="flex items-center gap-3">
            {selectedIds.length > 0 && (
              <Button
                variant="destructive"
                onClick={() => setIsConfirmDeleteModalOpen(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Selected ({selectedIds.length})
              </Button>
            )}
          </div>
        </div>

        {rubricsQuery.isLoading ? (
          <div className="flex min-h-64 items-center justify-center rounded-2xl border border-dashed border-border text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading rubrics...
          </div>
        ) : roundRubrics.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 p-8 text-center">
            <Plus className="mb-3 h-8 w-8 text-muted-foreground" />
            <p className="font-semibold">No rubrics yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Add Rubric, Bulk Import, or AI Suggest.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="overflow-x-auto rounded-2xl border border-border">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-semibold w-12">
                      <input 
                        type="checkbox" 
                        className="h-4 w-4 rounded border-gray-300"
                        checked={paginatedRubrics.length > 0 && selectedIds.length === paginatedRubrics.length}
                        onChange={toggleSelectAll}
                      />
                    </th>
                    <th className="px-4 py-3 font-semibold">Rubric</th>
                    <th className="w-28 px-4 py-3 text-center font-semibold">Weight %</th>
                    <th className="w-28 px-4 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRubrics.map((rubric) => (
                      <tr key={rubric.id} className="border-t border-border bg-background/40 align-top hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-4">
                          <input 
                            type="checkbox" 
                            className="h-4 w-4 rounded border-gray-300"
                            checked={selectedIds.includes(rubric.id)}
                            onChange={() => toggleSelection(rubric.id)}
                          />
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{rubric.name}</span>
                            {rubric.description && (
                              <Dialog>
                                <DialogTrigger className="inline-flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-blue-500 transition-colors" title="View description">
                                  <AlignLeft className="h-3.5 w-3.5" />
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-[500px]">
                                  <DialogHeader>
                                    <DialogTitle className="flex items-center gap-2">
                                      <AlignLeft className="h-5 w-5 text-blue-500" />
                                      {rubric.name}
                                    </DialogTitle>
                                  </DialogHeader>
                                  <div className="mt-4 text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed bg-muted/30 p-4 rounded-xl border border-border">
                                    {rubric.description}
                                  </div>
                                </DialogContent>
                              </Dialog>
                            )}
                          </div>
                          {!rubric.description && (
                            <div className="mt-1 text-xs text-muted-foreground italic">No description</div>
                          )}
                        </td>
                        <td className="px-4 py-4 text-center font-semibold tabular-nums">
                          {Number(rubric.weight).toFixed(
                            Number(rubric.weight) % 1 === 0 ? 0 : 2,
                          )}
                          %
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex justify-end gap-2" title={getDisabledReason()}>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon-sm"
                              disabled={!canEditCriteria}
                              onClick={() => startEditRubric(rubric)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              disabled={!canEditCriteria || deleteRubricMutation.isPending}
                              onClick={() => {
                                if (window.confirm(`Delete rubric "${rubric.name}"?`)) {
                                  deleteRubricMutation.mutate(rubric.id);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-2 py-2">
                <div className="text-sm text-muted-foreground">
                  Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, roundRubrics.length)} of {roundRubrics.length}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" /> Prev
                  </Button>
                  <div className="text-sm font-medium">
                    Page {currentPage} of {totalPages}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  >
                    Next <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </GlassCard>
      
      <Dialog open={isAddEditModalOpen} onOpenChange={setIsAddEditModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingRubricId ? "Edit Rubric" : "Add Rubric"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <Field label="Rubric name *">
              <Input
                value={rubricDraft.name}
                placeholder="Technical Implementation"
                disabled={!canEditCriteria}
                onChange={(event) => setRubricDraft((draft) => ({ ...draft, name: event.target.value }))}
              />
            </Field>

            <Field label="Description">
              <Textarea
                value={rubricDraft.description}
                className="min-h-24 resize-none"
                placeholder="What judges should evaluate."
                disabled={!canEditCriteria}
                onChange={(event) => setRubricDraft((draft) => ({ ...draft, description: event.target.value }))}
              />
            </Field>

            <Field label="Weight (%) *">
              <Input
                type="number"
                min={0.01}
                max={100}
                step="0.01"
                value={rubricDraft.weight}
                disabled={!canEditCriteria}
                onChange={(event) =>
                  setRubricDraft((draft) => ({
                    ...draft,
                    weight: event.target.value,
                  }))
                }
              />
            </Field>

            <div
              className={cn(
                "rounded-xl border px-3 py-2 text-xs",
                Math.abs(projectedScopeWeight - TARGET_WEIGHT_TOTAL) <= 0.01
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                  : projectedScopeWeight > TARGET_WEIGHT_TOTAL
                    ? "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400"
                    : "border-border bg-muted/30 text-muted-foreground",
              )}
            >
              Round total:{" "}
              <strong className="text-foreground">
                {projectedScopeWeight.toFixed(2)}% / {TARGET_WEIGHT_TOTAL}%
              </strong>
              {projectedScopeWeight > TARGET_WEIGHT_TOTAL + 0.01 ? (
                <span>
                  {" "}
                  — over by{" "}
                  {(projectedScopeWeight - TARGET_WEIGHT_TOTAL).toFixed(2)}%
                </span>
              ) : projectedScopeWeight < TARGET_WEIGHT_TOTAL - 0.01 ? (
                <span>
                  {" "}
                  (remaining{" "}
                  {(TARGET_WEIGHT_TOTAL - projectedScopeWeight).toFixed(2)}%)
                </span>
              ) : null}
            </div>

            <div className="pt-4 flex justify-end gap-3 border-t border-border mt-6">
              <Button variant="outline" onClick={resetForm}>Cancel</Button>
              <Button disabled={!canSubmit} onClick={() => saveRubricMutation.mutate()}>
                {saveRubricMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {!saveRubricMutation.isPending && (editingRubricId ? <Save className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />)}
                {editingRubricId ? "Update Rubric" : "Add Rubric"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm Bulk Delete Modal */}
      <Dialog open={isConfirmDeleteModalOpen} onOpenChange={setIsConfirmDeleteModalOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedIds.length} selected rubric(s)? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setIsConfirmDeleteModalOpen(false)}>Cancel</Button>
            <Button 
              variant="destructive" 
              onClick={() => bulkDeleteMutation.mutate()} 
              disabled={bulkDeleteMutation.isPending}
            >
              {bulkDeleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      {event && currentRound && (
        <>
          <BulkImportRubricsModal
            open={isBulkImportOpen}
            onOpenChange={setIsBulkImportOpen}
            event={event}
            round={currentRound}
            existingRubrics={roundRubrics}
          />
          <AiSuggestRubricsModal
            open={isAiSuggestOpen}
            onOpenChange={setIsAiSuggestOpen}
            event={event}
            round={currentRound}
            existingRubrics={roundRubrics}
          />
        </>
      )}
    </div>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}
