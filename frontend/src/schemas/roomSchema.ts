import { z } from "zod";

export const roomSchema = z.object({
  branchId: z.uuid("Please select a valid hotel branch."),

  roomTypeId: z.uuid("Please select a valid room type."),

  roomNumber: z.string()
    .trim()
    .min(1, "Room number is required.")
    .max(20, "Room number must not exceed 20 characters."),

  floor: z.string()
    .trim()
    .refine(
      (value) =>
        value === "" ||
        (
          /^-?\d+$/.test(value) &&
          Number.isSafeInteger(Number(value))
        ),
      "Floor must be a valid whole number."
    )
    .transform((value) =>
      value === "" ? undefined : Number(value)
    ),
});

export type RoomFormInput = z.input<typeof roomSchema>;

export type RoomFormData = z.output<typeof roomSchema>;
