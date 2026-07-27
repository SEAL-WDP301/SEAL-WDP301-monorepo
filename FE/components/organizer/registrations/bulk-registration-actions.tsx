"use client";
import { Button } from "@/components/ui/button";
export function BulkRegistrationActions({ count, canApprove, onApprove, onReject, onExport, onClear }: { count: number; canApprove: boolean; onApprove: () => void; onReject: () => void; onExport: () => void; onClear: () => void }) {
  if (!count) return null;
  return <div className="sticky bottom-4 z-30 flex flex-wrap items-center gap-2 rounded-2xl border border-orange-500/25 bg-popover/95 p-3 shadow-xl backdrop-blur"><p className="mr-auto text-sm font-semibold">{count} registrations selected</p><Button size="sm" disabled={!canApprove} title={!canApprove ? "Only eligible pending registrations can be approved" : undefined} onClick={onApprove}>Approve Selected</Button><Button size="sm" variant="destructive" onClick={onReject}>Reject Selected</Button><Button size="sm" variant="outline" onClick={onExport}>Export Selected</Button><Button size="sm" variant="ghost" onClick={onClear}>Clear Selection</Button></div>;
}
