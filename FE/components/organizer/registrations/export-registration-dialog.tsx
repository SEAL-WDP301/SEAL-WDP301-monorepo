"use client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
export function ExportRegistrationDialog({ open, onOpenChange, selectedCount, onConfirm }: { open: boolean; onOpenChange: (open: boolean) => void; selectedCount: number; onConfirm: (scope: "filtered" | "selected") => void }) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Export registrations</DialogTitle><DialogDescription>The backend will prepare a CSV without passwords, tokens, or internal notes.</DialogDescription></DialogHeader><div className="space-y-2"><Button variant="outline" className="w-full justify-start" onClick={() => onConfirm("filtered")}>Export current filtered results</Button><Button variant="outline" className="w-full justify-start" disabled={!selectedCount} onClick={() => onConfirm("selected")}>Export {selectedCount} selected registrations</Button></div><DialogFooter><Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button></DialogFooter></DialogContent></Dialog>;
}
