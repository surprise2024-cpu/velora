import z from "zod";

export const registerSchema = z.object({
  firstName: z.string().trim().min(1).max(50),
  lastName: z.string().trim().min(1).max(50),
  email: z.email().trim().toLowerCase().max(254),
  password: z.string().min(12).max(128),
  confirmPassword: z.string(),
  acceptedTerms: z.literal(true),
}).strict().refine(
  (data) => data.password === data.confirmPassword,
  {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  }
);

export const loginSchema = z.object({
  email: z.email().trim().toLowerCase().max(254),
  password: z.string().min(1),
}).strict();