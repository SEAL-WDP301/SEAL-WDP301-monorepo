"use client";
/* eslint-disable react-hooks/incompatible-library */
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button"; import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { RejectRegistrationInput, RegistrationListItem } from "@/lib/organizer/registrations/registration-types";
import { rejectRegistrationSchema } from "@/lib/organizer/registrations/registration-validation";
const reasons = ["Not Eligible", "Duplicate Registration", "Missing Information", "Policy Violation", "Invalid Student Information", "Other"];
export function RejectRegistrationDialog({ registration, open, onOpenChange, onConfirm, pending }: { registration: RegistrationListItem | null; open: boolean; onOpenChange: (open: boolean) => void; onConfirm: (input: RejectRegistrationInput) => void; pending: boolean }) {
  const form = useForm<RejectRegistrationInput>({ resolver: zodResolver(rejectRegistrationSchema), defaultValues: { reason: "", note: "", sendNotification: true, allowRegisterAgain: false } });
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Reject registration</DialogTitle><DialogDescription>{registration ? `Provide a clear reason for rejecting ${registration.student.fullName}.` : "Reject selected registrations."}</DialogDescription></DialogHeader>
    <form className="space-y-4" onSubmit={form.handleSubmit(onConfirm)}>
      <label className="block space-y-1.5 text-sm font-medium">Reason category<Select value={form.watch("reason")} onValueChange={(value) => value && form.setValue("reason", value, { shouldValidate: true })}><SelectTrigger className="mt-1 w-full"><SelectValue placeholder="Select a reason" /></SelectTrigger><SelectContent>{reasons.map((reason) => <SelectItem key={reason} value={reason}>{reason}</SelectItem>)}</SelectContent></Select>{form.formState.errors.reason && <span className="text-xs text-red-400">{form.formState.errors.reason.message}</span>}</label>
      <label className="block space-y-1.5 text-sm font-medium">Detailed note<Textarea {...form.register("note")} maxLength={500} placeholder="Add context for the student..." className="mt-1 min-h-24" />{form.formState.errors.note && <span className="text-xs text-red-400">{form.formState.errors.note.message}</span>}</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" {...form.register("sendNotification")} className="size-4 accent-orange-500" /> Send rejection notification</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" {...form.register("allowRegisterAgain")} className="size-4 accent-orange-500" /> Allow student to register again</label>
      <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" variant="destructive" disabled={pending}>{pending ? "Rejecting..." : "Confirm Rejection"}</Button></DialogFooter>
    </form>
  </DialogContent></Dialog>;
}
