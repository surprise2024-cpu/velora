import { z } from "zod";

function splitLines(value: string): string[] {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

const requiredText = (field: string) =>
  z.string().trim().min(1, `${field} is required.`);

export const branchSchema = z.object({
  name: requiredText("Branch name").max(
    150,
    "Branch name must not exceed 150 characters."
  ),

  description: z.string().trim(),

  address: requiredText("Street address"),

  city: requiredText("City"),

  province: requiredText("Province"),

  country: requiredText("Country"),

  starRating: z
    .string()
    .refine(
      (value) => /^[1-5]$/.test(value),
      "Star rating must be between 1 and 5."
    )
    .transform(Number),

  images: z
    .string()
    .transform(splitLines)
    .refine(
      (images) =>
        images.every((image) => {
          try {
            const url = new URL(image);
            return (
              url.protocol === "http:" ||
              url.protocol === "https:"
            );
          } catch {
            return false;
          }
        }),
      "Every image must be a valid HTTP or HTTPS URL."
    ),

  amenities: z.string().transform(splitLines),

  policies: z.string().transform(splitLines),
});

export type BranchFormInput = z.input<typeof branchSchema>;
export type BranchFormData = z.output<typeof branchSchema>;
