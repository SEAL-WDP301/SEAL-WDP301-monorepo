const fs = require('fs');
const path = require('path');

const fileContent = `"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import { Edit2, Loader2, Plus, RefreshCcw, Save, Trash2, X, Info, AlignLeft, UploadCloud, ChevronLeft, ChevronRight } from "lucide-react";

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
  DialogFooter
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

type RubricDraft = {
  roundId: string;
  trackId: string;
  name: string;
  description: string;
  maxScore: number | string;
  weight: number | string;
};

const emptyRubric = (): RubricDraft => ({
  roundId: "",
  trackId: "",
  name: "",
  description: "",
  maxScore: 10,
  weight: 1,
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

  const [trackFilter, setTrackFilter] = useState("all");
  const [rubricDraft, setRubricDraft] = useState<RubricDraft>(() => ({
    ...emptyRubric(),
    roundId: currentRoundId,
  }));
  const [editingRubricId, setEditingRubricId] = useState<number | null>(null);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
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
  const tracks = useMemo(() => event?.tracks || [], [event?.tracks]);
  
  const isRoundNotStarted = (id: string | number | null | undefined) => {
    if (event?.status === "closed") return false;
    if (!id) return true;
    const round = roundById.get(Number(id));
    return !round || round.status === "not_started";
  };

  const roundById = useMemo(
    () => new Map(rounds.map((round) => [round.id, round])),
    [rounds]
  );
  const trackById = useMemo(
    () => new Map(tracks.map((track) => [track.id, track])),
    [tracks]
  );

  const rubrics = useMemo(() => rubricsQuery.data || [], [rubricsQuery.data]);
  
  const currentRound = roundById.get(Number(currentRoundId));
  const isTrackSpecific = currentRound?.isTrackSpecific ?? false;

  const filteredRubrics = useMemo(
    () =>
      rubrics.filter((rubric) => {
        const matchesRound = String(rubric.roundId) === currentRoundId;
        const matchesTrack =
          trackFilter === "all" || String(rubric.trackId) === trackFilter;
        return matchesRound && matchesTrack;
      }),
    [currentRoundId, rubrics, trackFilter]
  );

  // Pagination logic
  const totalPages = Math.ceil(filteredRubrics.length / ITEMS_PER_PAGE);
  const paginatedRubrics = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredRubrics.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredRubrics, currentPage]);

  const selectedScopeWeight = useMemo(() => {
    if (!rubricDraft.roundId || !rubricDraft.trackId) return 0;
    return rubrics.reduce((sum, rubric) => {
      if (
        rubric.id !== editingRubricId &&
        String(rubric.roundId) === rubricDraft.roundId &&
        String(rubric.trackId) === rubricDraft.trackId
      ) {
        return sum + Number(rubric.weight || 0);
      }
      return sum;
    }, 0);
  }, [editingRubricId, rubricDraft.roundId, rubricDraft.trackId, rubrics]);

  const resetForm = () => {
    setEditingRubricId(null);
    setRubricDraft({ ...emptyRubric(), roundId: currentRoundId });
    setIsAddEditModalOpen(false);
  };

  const saveRubricMutation = useMutation({
    mutationFn: async () => {
      if (!isRoundNotStarted(currentRoundId)) {
        throw new Error("Can only manage criteria for rounds that have not started yet.");
      }
      if (isTrackSpecific && !rubricDraft.trackId) throw new Error("Track is required for track-specific rounds.");
      if (!rubricDraft.name.trim()) throw new Error("Criterion name is required.");

      const maxScore = Number(rubricDraft.maxScore);
      const weight = Number(rubricDraft.weight);

      if (!Number.isFinite(maxScore) || maxScore < 1) {
        throw new Error("Max score must be at least 1.");
      }
      if (!Number.isFinite(weight) || weight <= 0) {
        throw new Error("Weight must be greater than 0.");
      }

      const payload: OrganizerRubricPayload = {
        name: rubricDraft.name.trim(),
        description: rubricDraft.description.trim() || undefined,
        maxScore,
        weight,
        roundId: Number(currentRoundId),
        trackId: isTrackSpecific && rubricDraft.trackId ? Number(rubricDraft.trackId) : null,
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
      enqueueSnackbar(\`Successfully deleted \${selectedIds.length} rubrics\`, { variant: "success" });
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
      trackId: rubric.trackId ? String(rubric.trackId) : "",
      name: rubric.name,
      description: rubric.description || "",
      maxScore: rubric.maxScore,
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
  const isTrackValid = !isTrackSpecific || Boolean(rubricDraft.trackId);
  const canSubmit = isRoundNotStarted(currentRoundId) && Boolean(rubricDraft.name.trim()) && isTrackValid && !saveRubricMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Badge variant="outline">{event.season} {event.year}</Badge>
            <Badge variant={event.status === "draft" ? "warning" : "success"}>
              {event.status}
            </Badge>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Grading Criteria</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Add, edit, and delete rubrics for Round {currentRound?.roundNumber}: {currentRound?.name}.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            type="button"
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
            disabled={event?.status === "closed" || !currentRound || !isRoundNotStarted(currentRound.id)}
            onClick={() => setIsBulkImportOpen(true)}
          >
            <UploadCloud className="mr-2 h-4 w-4" />
            Bulk Import
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={rubricsQuery.isFetching}
            onClick={() => queryClient.invalidateQueries({ queryKey: ["organizerRubrics", eventId] })}
          >
            <RefreshCcw className={cn("mr-2 h-4 w-4", rubricsQuery.isFetching && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {!hasRequiredConfiguration && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-400">
          At least one round and one track must be configured before a rubric can be added.
        </div>
      )}

      <GlassCard className="min-w-0 rounded-[24px] p-5">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-xl font-bold">Rubric List</h2>
            <p className="text-sm text-muted-foreground">
              {filteredRubrics.length} of {rubrics.length} criteria
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Field label="Filter by track">
              <select
                value={trackFilter}
                onChange={(event) => { setTrackFilter(event.target.value); setCurrentPage(1); setSelectedIds([]); }}
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
              >
                <option value="all">All tracks</option>
                {tracks.map((track) => (
                  <option key={track.id} value={track.id}>{track.name}</option>
                ))}
              </select>
            </Field>

            <div className="h-10 self-end flex items-center">
              {selectedIds.length > 0 && (
                <Button 
                  variant="destructive" 
                  className="mr-3" 
                  onClick={() => setIsConfirmDeleteModalOpen(true)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Selected ({selectedIds.length})
                </Button>
              )}
              <Button
                type="button"
                className="shrink-0"
                disabled={event?.status === "closed" || !currentRound || !isRoundNotStarted(currentRound.id)}
                onClick={() => { setEditingRubricId(null); setIsAddEditModalOpen(true); }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Rubric
              </Button>
            </div>
          </div>
        </div>

        {rubricsQuery.isLoading ? (
          <div className="flex min-h-64 items-center justify-center rounded-2xl border border-dashed border-border text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading rubrics...
          </div>
        ) : filteredRubrics.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 p-8 text-center">
            <Plus className="mb-3 h-8 w-8 text-muted-foreground" />
            <p className="font-semibold">No rubrics found</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Click Add Rubric or Bulk Import to get started.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="overflow-x-auto rounded-2xl border border-border">
              <table className="w-full min-w-[780px] text-left text-sm">
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
                    <th className="px-4 py-3 font-semibold">Round</th>
                    <th className="px-4 py-3 font-semibold">Track</th>
                    <th className="w-24 px-4 py-3 text-center font-semibold">Max</th>
                    <th className="w-24 px-4 py-3 text-center font-semibold">Weight</th>
                    <th className="w-28 px-4 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRubrics.map((rubric) => {
                    const round = rubric.round || roundById.get(rubric.roundId);
                    const track = rubric.track || (rubric.trackId ? trackById.get(rubric.trackId) : undefined);

                    return (
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
                        <td className="px-4 py-4">{round ? \`Round \${round.roundNumber}: \${round.name}\` : "Unknown"}</td>
                        <td className="px-4 py-4">
                          {track ? <Badge variant="outline">{track.name}</Badge> : <Badge variant="secondary">All tracks</Badge>}
                        </td>
                        <td className="px-4 py-4 text-center">{rubric.maxScore}</td>
                        <td className="px-4 py-4 text-center">{rubric.weight}</td>
                        <td className="px-4 py-4">
                          <div className="flex justify-end gap-2" title={event?.status === "closed" ? "Read-only: Event is closed." : !isRoundNotStarted(rubric.roundId) ? "Read-only: This round has already started." : undefined}>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon-sm"
                              title="Edit rubric"
                              disabled={!isRoundNotStarted(rubric.roundId)}
                              onClick={() => startEditRubric(rubric)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              title="Delete rubric"
                              disabled={!isRoundNotStarted(rubric.roundId) || deleteRubricMutation.isPending}
                              onClick={() => {
                                if (window.confirm(\`Delete rubric "\${rubric.name}"?\`)) {
                                  deleteRubricMutation.mutate(rubric.id);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            
            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-2 py-2">
                <div className="text-sm text-muted-foreground">
                  Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredRubrics.length)} of {filteredRubrics.length}
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
      
      {/* Add / Edit Rubric Modal */}
      <Dialog open={isAddEditModalOpen} onOpenChange={setIsAddEditModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingRubricId ? "Edit Rubric" : "Add Rubric"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {isTrackSpecific && (
              <Field label="Track *">
                <select
                  value={rubricDraft.trackId}
                  disabled={!isRoundNotStarted(currentRoundId)}
                  onChange={(event) => setRubricDraft((draft) => ({ ...draft, trackId: event.target.value }))}
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">Select track</option>
                  {tracks.map((track) => (
                    <option key={track.id} value={track.id}>{track.name}</option>
                  ))}
                </select>
              </Field>
            )}

            <Field label="Rubric name *">
              <Input
                value={rubricDraft.name}
                placeholder="Technical Implementation"
                disabled={!isRoundNotStarted(currentRoundId)}
                onChange={(event) => setRubricDraft((draft) => ({ ...draft, name: event.target.value }))}
              />
            </Field>

            <Field label="Description">
              <Textarea
                value={rubricDraft.description}
                className="min-h-24 resize-none"
                placeholder="Describe what judges should evaluate."
                disabled={!isRoundNotStarted(currentRoundId)}
                onChange={(event) => setRubricDraft((draft) => ({ ...draft, description: event.target.value }))}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Max score *">
                <Input
                  type="number"
                  min={1}
                  value={rubricDraft.maxScore}
                  disabled={!isRoundNotStarted(currentRoundId)}
                  onChange={(event) => setRubricDraft((draft) => ({ ...draft, maxScore: event.target.value }))}
                />
              </Field>
              <Field label="Weight *">
                <Input
                  type="number"
                  min={0.01}
                  step="0.01"
                  value={rubricDraft.weight}
                  disabled={!isRoundNotStarted(currentRoundId)}
                  onChange={(event) => setRubricDraft((draft) => ({ ...draft, weight: event.target.value }))}
                />
              </Field>
            </div>

            {rubricDraft.roundId && rubricDraft.trackId && (
              <div className="rounded-xl border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                Current weight for this round and track: <strong className="text-foreground">{selectedScopeWeight}</strong>
              </div>
            )}

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
        <BulkImportRubricsModal
          open={isBulkImportOpen}
          onOpenChange={setIsBulkImportOpen}
          event={event}
          round={currentRound}
          existingRubrics={rubrics}
        />
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
`;

fs.writeFileSync(path.join(__dirname, 'app/organizer/events/[id]/rounds/[roundId]/criteria/page.tsx'), fileContent);
