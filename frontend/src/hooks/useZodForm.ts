import { useState } from "react";
import { z } from "zod";

export type ZodFieldErrors<T extends string> =
  Partial<Record<T, string>>;

export function useZodForm<
  TInput extends Record<string, unknown>,
  TOutput
>(schema: z.ZodType<TOutput, TInput>) {
  type Field = Extract<keyof TInput, string>;

  const [fieldErrors, setFieldErrors] =
    useState<ZodFieldErrors<Field>>({});

  function validate(values: TInput): TOutput | null {
    const result = schema.safeParse(values);

    if (result.success) {
      setFieldErrors({});
      return result.data;
    }

    const errors: ZodFieldErrors<Field> = {};

    for (const issue of result.error.issues) {
      const field = issue.path[0];

      if (
        typeof field === "string" &&
        Object.prototype.hasOwnProperty.call(values, field)
      ) {
        const fieldKey = field as Field;

        if (!errors[fieldKey]) {
          errors[fieldKey] = issue.message;
        }
      }
    }

    setFieldErrors(errors);
    return null;
  }

  function clearFieldError(field: Field) {
    setFieldErrors((current) => {
      if (!current[field]) return current;

      const updated = { ...current };
      delete updated[field];
      return updated;
    });
  }

  function clearAllErrors() {
    setFieldErrors({});
  }

  return {
    fieldErrors,
    setFieldErrors,
    validate,
    clearFieldError,
    clearAllErrors,
  };
}
