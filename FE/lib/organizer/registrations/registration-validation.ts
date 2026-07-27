import { z } from "zod";

export const rejectRegistrationSchema = z
  .object({
    reason: z.string().min(1, "Select a reason"),
    note: z.string().max(500, "Note must be at most 500 characters"),
    sendNotification: z.boolean(),
    allowRegisterAgain: z.boolean(),
  })
  .refine((value) => value.reason !== "Other" || value.note.trim().length > 0, {
    message: "A detailed note is required for Other",
    path: ["note"],
  });
