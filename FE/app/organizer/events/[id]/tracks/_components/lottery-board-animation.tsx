"use client";

import { useMemo } from "react";
import { motion, LayoutGroup, AnimatePresence } from "framer-motion";
import { ArrowRight, FileText, Layers, Users } from "lucide-react";
import { cn } from "@/lib/utils";

export type LotteryBoardItem = {
  key: string;
  sourceLabel: string;
  trackId: number;
  trackName: string;
};

export type LotteryTrackSlot = {
  trackId: number;
  trackName: string;
};

export type LotteryPreviewItem = {
  key: string;
  sourceLabel: string;
};

type Props = {
  mode: "problem" | "team";
  phase: "ready" | "spinning" | "reveal" | "done";
  items: LotteryBoardItem[];
  placedCount: number;
  trackSlots: LotteryTrackSlot[];
  previewItems?: LotteryPreviewItem[];
  className?: string;
};

function SourceChip({
  label,
  mode,
  layoutId,
  variant = "pending",
  shuffle = false,
  shuffleIndex = 0,
}: {
  label: string;
  mode: "problem" | "team";
  layoutId?: string;
  variant?: "pending" | "settled";
  shuffle?: boolean;
  shuffleIndex?: number;
}) {
  const Icon = mode === "problem" ? FileText : Users;
  return (
    <motion.div
      layoutId={shuffle ? undefined : layoutId}
      layout={Boolean(layoutId) && !shuffle}
      animate={
        shuffle
          ? {
              x: [0, 6 + (shuffleIndex % 3) * 3, -4, 0],
              opacity: [0.65, 1, 0.8, 0.65],
            }
          : undefined
      }
      transition={
        shuffle
          ? {
              repeat: Infinity,
              duration: 0.85 + (shuffleIndex % 4) * 0.1,
              ease: "easeInOut",
            }
          : { type: "spring", stiffness: 380, damping: 32 }
      }
      className={cn(
        "flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold shadow-sm",
        variant === "pending" &&
          "border-orange-500/35 bg-background text-foreground",
        variant === "settled" &&
          "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
      )}
    >
      <Icon className="h-4 w-4 shrink-0 text-orange-500" />
      <span className="truncate">{label}</span>
    </motion.div>
  );
}

export function LotteryBoardAnimation({
  mode,
  phase,
  items,
  placedCount,
  trackSlots,
  previewItems = [],
  className,
}: Props) {
  const SourceIcon = mode === "problem" ? FileText : Users;
  const sourceTitle = mode === "problem" ? "Problem Pool" : "Waiting Teams";
  const isReady = phase === "ready";
  const isSpinning = phase === "spinning";
  const isAnimating = isSpinning || phase === "reveal" || phase === "done";

  const tracks = useMemo(() => {
    if (trackSlots.length > 0) return trackSlots;
    const fromItems = new Map<number, string>();
    for (const item of items) {
      if (!fromItems.has(item.trackId)) {
        fromItems.set(item.trackId, item.trackName);
      }
    }
    return Array.from(fromItems.entries()).map(([trackId, trackName]) => ({
      trackId,
      trackName,
    }));
  }, [trackSlots, items]);

  const leftPreview = isReady
    ? previewItems
    : isSpinning
      ? items.map((i) => ({ key: i.key, sourceLabel: i.sourceLabel }))
      : items.slice(placedCount).map((i) => ({
          key: i.key,
          sourceLabel: i.sourceLabel,
        }));

  const settledItems = isAnimating && !isSpinning ? items.slice(0, placedCount) : [];

  const settledByTrack = useMemo(() => {
    const map = new Map<number, LotteryBoardItem[]>();
    for (const track of tracks) map.set(track.trackId, []);
    for (const item of settledItems) {
      const list = map.get(item.trackId) ?? [];
      list.push(item);
      map.set(item.trackId, list);
    }
    return map;
  }, [settledItems, tracks]);

  return (
    <LayoutGroup id={`lottery-board-${mode}`}>
      <div
        className={cn(
          "grid min-h-[320px] grid-cols-[1fr_auto_1fr] gap-3 sm:gap-4",
          className,
        )}
      >
        <div className="flex min-h-0 flex-col rounded-2xl border border-orange-500/30 bg-orange-500/5 p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-orange-600">
              <SourceIcon className="h-4 w-4" />
              {sourceTitle}
            </div>
            <span className="text-xs text-muted-foreground">
              {isReady
                ? `${leftPreview.length} items`
                : isSpinning
                  ? "Shuffling..."
                  : `${leftPreview.length} left`}
            </span>
          </div>
          <div className="flex min-h-[200px] flex-1 flex-col gap-2 overflow-y-auto pr-1">
            <AnimatePresence mode="popLayout">
              {leftPreview.length === 0 ? (
                <motion.p
                  key="empty-left"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-1 items-center justify-center py-8 text-center text-sm text-muted-foreground"
                >
                  {isReady
                    ? mode === "team"
                      ? "No teams without tracks."
                      : "No problems in pool."
                    : phase === "done"
                      ? "All drawn!"
                      : "—"}
                </motion.p>
              ) : (
                leftPreview.map((item, i) => (
                  <SourceChip
                    key={item.key}
                    layoutId={isAnimating ? item.key : undefined}
                    label={item.sourceLabel}
                    mode={mode}
                    variant="pending"
                    shuffle={isSpinning}
                    shuffleIndex={i}
                  />
                ))
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center gap-2 px-1">
          <motion.div
            animate={
              phase === "done"
                ? { opacity: 0.35, x: 0 }
                : { x: [0, 10, 0], opacity: [0.45, 1, 0.45] }
            }
            transition={
              phase === "done"
                ? { duration: 0.3 }
                : { repeat: Infinity, duration: 1.1 }
            }
          >
            <ArrowRight className="h-8 w-8 text-orange-500" />
          </motion.div>
          {phase === "reveal" && placedCount < items.length ? (
            <motion.span
              key={placedCount}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide text-orange-600"
            >
              #{placedCount + 1}
            </motion.span>
          ) : null}
        </div>

        <div className="flex min-h-0 flex-col gap-2 overflow-y-auto pr-1">
          {tracks.length === 0 ? (
            <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No tracks in this round.
            </div>
          ) : (
            tracks.map((track, trackIndex) => {
              const settled = settledByTrack.get(track.trackId) ?? [];
              const nextItem =
                phase === "reveal" && placedCount < items.length
                  ? items[placedCount]
                  : null;
              const isReceiving =
                phase === "reveal" && nextItem?.trackId === track.trackId;

              return (
                <motion.div
                  key={track.trackId}
                  animate={
                    isReceiving
                      ? {
                          scale: [1, 1.02, 1],
                          borderColor: [
                            "rgba(249,115,22,0.25)",
                            "rgba(249,115,22,0.65)",
                            "rgba(249,115,22,0.25)",
                          ],
                        }
                      : isSpinning
                        ? { opacity: [0.45, 0.9, 0.45] }
                        : { scale: 1, opacity: 1 }
                  }
                  transition={
                    isReceiving
                      ? { repeat: Infinity, duration: 0.9 }
                      : isSpinning
                        ? {
                            repeat: Infinity,
                            duration: 1.4,
                            delay: trackIndex * 0.12,
                          }
                        : { duration: 0.2 }
                  }
                  className={cn(
                    "rounded-xl border bg-background/80 p-3 shadow-sm",
                    isReceiving
                      ? "border-orange-500/60 bg-orange-500/5"
                      : isReady || isSpinning
                        ? "border-dashed border-orange-500/25 bg-muted/15"
                        : "border-border/80",
                  )}
                >
                  <div className="mb-2 flex items-center gap-2 border-b border-border/60 pb-2">
                    <Layers className="h-4 w-4 text-orange-500" />
                    <span className="text-sm font-bold text-foreground">
                      {track.trackName}
                    </span>
                    {!isReady && !isSpinning && (
                      <span className="ml-auto text-xs text-muted-foreground">
                        {settled.length}
                      </span>
                    )}
                  </div>
                  <div className="flex min-h-[44px] flex-col gap-1.5">
                    <AnimatePresence mode="popLayout">
                      {settled.map((item) => (
                        <SourceChip
                          key={item.key}
                          layoutId={item.key}
                          label={item.sourceLabel}
                          mode={mode}
                          variant="settled"
                        />
                      ))}
                    </AnimatePresence>
                    {settled.length === 0 && !isReceiving && (
                      <p
                        className={cn(
                          "py-2 text-center text-xs italic text-muted-foreground",
                          (isReady || isSpinning) && "opacity-70",
                        )}
                      >
                        {isReady || isSpinning
                          ? "Ready to receive..."
                          : "Waiting for draw..."}
                      </p>
                    )}
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </div>
    </LayoutGroup>
  );
}
