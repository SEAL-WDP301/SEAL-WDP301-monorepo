import { Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface TeamCapacityProps {
  registeredTeams?: number;
  maxTeams?: number | null;
  className?: string;
  compact?: boolean;
}

export function TeamCapacity({
  registeredTeams = 0,
  maxTeams,
  className,
  compact = false,
}: TeamCapacityProps) {
  const hasLimit = maxTeams != null;
  const isFull = hasLimit && registeredTeams >= maxTeams;
  const percentage = hasLimit
    ? Math.min(100, Math.round((registeredTeams / maxTeams) * 100))
    : 0;

  if (compact) {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium",
          isFull
            ? "border-red-500/30 bg-red-500/10 text-red-500"
            : "border-border bg-card/50 text-muted-foreground",
          className,
        )}
      >
        <Users className="size-4 shrink-0" />
        <span>
          {registeredTeams} / {hasLimit ? maxTeams : "∞"} teams
        </span>
        {isFull && <span className="font-semibold">Full</span>}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-muted/30 p-3",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-2 font-medium text-foreground">
          <Users className="size-4 text-orange-500" />
          <span>Registered teams</span>
        </div>
        <span className={cn("font-semibold", isFull && "text-red-500")}>
          {registeredTeams} / {hasLimit ? maxTeams : "∞"}
        </span>
      </div>

      {hasLimit && (
        <>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-border">
            <div
              className={cn(
                "h-full rounded-full transition-[width]",
                isFull ? "bg-red-500" : "bg-orange-500",
              )}
              style={{ width: `${percentage}%` }}
            />
          </div>
          <p
            className={cn(
              "mt-2 text-xs text-muted-foreground",
              isFull && "font-medium text-red-500",
            )}
          >
            {isFull
              ? "Event is full"
              : `${Math.max(0, maxTeams - registeredTeams)} team slots remaining`}
          </p>
        </>
      )}
    </div>
  );
}
