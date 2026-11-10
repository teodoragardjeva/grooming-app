// Shared (client + server) validation. Messages are error CODES translated by the UI (bg/en).
import { z } from "zod";

export const bookingFormSchema = z.object({
  serviceId: z.uuid({ message: "service_required" }),
  variantId: z.uuid({ message: "variant_required" }).nullish(),
  startAt: z.iso.datetime({ offset: true, message: "slot_required" }),
  name: z.string().trim().min(2, { message: "name_short" }).max(100, { message: "name_long" }),
  phone: z
    .string()
    .trim()
    .min(6, { message: "phone_invalid" })
    .max(30, { message: "phone_invalid" })
    .regex(/^\+?[\d\s()\-]{6,}$/, { message: "phone_invalid" }),
  email: z.email({ message: "email_invalid" }).max(200, { message: "email_invalid" }),
  dogName: z.string().trim().max(80, { message: "text_long" }).optional(),
  notes: z.string().trim().max(1000, { message: "text_long" }).optional(),
  consent: z.literal(true, { message: "consent_required" }),
});
export type BookingFormValues = z.infer<typeof bookingFormSchema>;

export const bookingRequestSchema = bookingFormSchema.extend({
  locale: z.enum(["bg", "en"]),
  website: z.string().max(0).optional(), // honeypot: must stay empty
  turnstileToken: z.string().max(4096).optional(),
});
export type BookingRequest = z.infer<typeof bookingRequestSchema>;

export const availabilityQuerySchema = z.object({
  service: z.uuid(),
  variant: z.uuid().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const tokenBodySchema = z.object({ token: z.string().min(20).max(200) });
