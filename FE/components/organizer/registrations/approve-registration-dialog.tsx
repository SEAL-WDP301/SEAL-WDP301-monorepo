"use client";
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { RegistrationListItem } from "@/lib/organizer/registrations/registration-types";
export function ApproveRegistrationDialog({ registration, open, onOpenChange, onConfirm, pending }: { registration: RegistrationListItem | null; open: boolean; onOpenChange: (open: boolean) => void; onConfirm: (input: { sendNotification: boolean; includeTeamInstructions: boolean }) => void; pending: boolean }) {
  const [notify, setNotify] = useState(true); const [instructions, setInstructions] = useState(true);
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Approve registration</DialogTitle><DialogDescription>Confirm that this student can join the selected event.</DialogDescription></DialogHeader>
    {registration && <div className="space-y-3 rounded-xl border border-border p-4 text-sm"><p><span className="text-muted-foreground">Student:</span> {registration.student.fullName}</p><p><span className="text-muted-foreground">Event:</span> {registration.event.name}</p><p><span className="text-muted-foreground">Eligibility:</span> {registration.eligibility}</p><p><span className="text-muted-foreground">Capacity:</span> 420 / 500 · 80 slots remaining</p></div>}
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={notify} onChange={(event) => setNotify(event.target.checked)} className="size-4 accent-orange-500" /> Send approval notification</label>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={instructions} onChange={(event) => setInstructions(event.target.checked)} className="size-4 accent-orange-500" /> Include team formation instructions</label>
    <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={() => onConfirm({ sendNotification: notify, includeTeamInstructions: instructions })} disabled={pending || registration?.eligibility === "Not Eligible"}>{pending ? "Approving..." : "Confirm Approval"}</Button></DialogFooter>
  </DialogContent></Dialog>;
}
