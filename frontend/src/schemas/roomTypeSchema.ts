import { z } from "zod";

export const roomTypeSchema = z.object({
  branchId: z.uuid("Please select a valid hotel branch."),

  name: z.string()
    .trim()
    .min(1, "Room type name is required.")
    .max(150, "Room type name must not exceed 150 characters."),

  maxGuests: z.string()
    .trim()
    .regex(
      /^[1-9]\d*$/,
      "Maximum guests must be a positive whole number."
    )
    .refine(
      (value) => Number.isSafeInteger(Number(value)),
      "Maximum guests is too large."
    )
    .transform(Number),

  basePrice: z.string()
    .trim()
    .regex(
      /^\d+(\.\d{1,2})?$/,
      "Base price must have no more than two decimal places."
    )
    .refine(
      (value) =>
        Number.isFinite(Number(value)) && Number(value) > 0,
      "Base price must be greater than zero."
    )
    .transform(Number),

  currency: z.string()
    .trim()
    .toUpperCase()
    .regex(
      /^[A-Z]{3}$/,
      "Currency must be a three-letter code."
    ),

  images: z.array(z.url({
    protocol: /^https?$/,
    error: "Every image must have a valid HTTP or HTTPS URL.",
  })),

  amenities: z.array(z.string().trim().min(1)),

  description: z.string().trim(),
});

export type RoomTypeFormInput = z.input<typeof roomTypeSchema>;

export type RoomTypeFormData = z.output<typeof roomTypeSchema>;
