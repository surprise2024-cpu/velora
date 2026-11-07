
import { useEffect, useState, type FormEvent } from "react";
import { apiRequest } from "../../lib/api";
import styles from "./AddBranchForm.module.css";

import { useZodForm } from "../../hooks/useZodForm";
import { branchSchema } from "../../schemas/branchSchema";
import FormFieldError from "./FormFieldError";

export type EditableBranch = {
  id: string;
  brandId: string;
  name: string;
  description: string | null;
  address: string;
  city: string;
  province: string;
  country: string;
  starRating: number | null;
  images: string[];
  amenities: string[];
  policies: string[];
};

type Props = {
  brandId: string;
  branch?: EditableBranch;
  onSaved: () => void;
  onCancel: () => void;
  onSavingChange?: (saving: boolean) => void;
};

type ApiResponse = {
  success: boolean;
  message?: string;
};

type BranchForm = {
  name: string;
  description: string;
  address: string;
  city: string;
  province: string;
  country: string;
  starRating: string;
  images: string;
  amenities: string;
  policies: string;
};

function createInitialForm(branch?: EditableBranch): BranchForm {
  return {
    name: branch?.name ?? "",
    description: branch?.description ?? "",
    address: branch?.address ?? "",
    city: branch?.city ?? "",
    province: branch?.province ?? "",
    country: branch?.country ?? "South Africa",
    starRating: String(branch?.starRating ?? 3),
    images: (branch?.images ?? []).join("\n"),
    amenities: (branch?.amenities ?? []).join("\n"),
    policies: (branch?.policies ?? []).join("\n"),
  };
}

export default function AddBranchForm({
  brandId,
  branch,
  onSaved,
  onCancel,
  onSavingChange,
}: Props) {
  const isEditing = Boolean(branch);

  const [form, setForm] = useState<BranchForm>(() =>
    createInitialForm(branch)
  );

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    onSavingChange?.(saving);
  }, [saving, onSavingChange]);

  const {
    fieldErrors,
    validate,
    clearFieldError,
  } = useZodForm(branchSchema);

  const [error, setError] = useState("");

  function updateField(
    field: keyof BranchForm,
    value: string
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));

    clearFieldError(field);
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (saving) return;

    setError("");

    const validated = validate(form);

    if (!validated) return;

    const payload = {
      ...validated,
      ...(!isEditing && brandId ? { brandId } : {}),
    };

    setSaving(true);

    try {
      const endpoint = branch
        ? `/admin/branches/${branch.id}`
        : "/admin/branches";

      const response = await apiRequest<ApiResponse>(
        endpoint,
        {
          method: branch ? "PATCH" : "POST",
          body: JSON.stringify(payload),
        }
      );

      if (!response.success) {
        throw new Error(
          response.message ||
            (branch
              ? "Unable to update branch."
              : "Unable to create branch.")
        );
      }

      onSaved();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save branch."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={styles.formPanel}>
      <form noValidate onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.grid}>
          <label>
            Branch Name *
            <input
              required
              maxLength={150}
              value={form.name}
              onChange={(event) =>
                updateField("name", event.target.value)
              }
            />
            <FormFieldError
              id="branch-name-error"
              message={fieldErrors.name}
            />
          </label>

          <label>
            City *
            <input
              required
              value={form.city}
              onChange={(event) =>
                updateField("city", event.target.value)
              }
            />
            <FormFieldError
              id="branch-city-error"
              message={fieldErrors.city}
            />
          </label>

          <label>
            Province *
            <input
              required
              value={form.province}
              onChange={(event) =>
                updateField("province", event.target.value)
              }
            />
            <FormFieldError
              id="branch-province-error"
              message={fieldErrors.province}
            />
          </label>

          <label>
            Country *
            <input
              required
              value={form.country}
              onChange={(event) =>
                updateField("country", event.target.value)
              }
            />
            <FormFieldError
              id="branch-country-error"
              message={fieldErrors.country}
            />
          </label>

          <label>
            Street Address *
            <input
              required
              value={form.address}
              onChange={(event) =>
                updateField("address", event.target.value)
              }
            />
            <FormFieldError
              id="branch-address-error"
              message={fieldErrors.address}
            />
          </label>

          <label>
            Star Rating
            <select
              value={form.starRating}
              onChange={(event) =>
                updateField("starRating", event.target.value)
              }
            >
              {[1, 2, 3, 4, 5].map((rating) => (
                <option key={rating} value={rating}>
                  {rating} Star{rating !== 1 ? "s" : ""}
                </option>
              ))}
            </select>
            <FormFieldError
              id="branch-rating-error"
              message={fieldErrors.starRating}
            />
          </label>
        </div>

        <label>
          Description
          <textarea
            rows={3}
            value={form.description}
            onChange={(event) =>
              updateField("description", event.target.value)
            }
          />
          <FormFieldError
            id="branch-description-error"
            message={fieldErrors.description}
          />
        </label>

        <label>
          Image URLs (one per line)
          <textarea
            rows={3}
            value={form.images}
            onChange={(event) =>
              updateField("images", event.target.value)
            }
          />
          <FormFieldError
            id="branch-images-error"
            message={fieldErrors.images}
          />
        </label>

        <label>
          Amenities (one per line)
          <textarea
            rows={3}
            value={form.amenities}
            onChange={(event) =>
              updateField("amenities", event.target.value)
            }
          />
          <FormFieldError
            id="branch-amenities-error"
            message={fieldErrors.amenities}
          />
        </label>

        <label>
          Policies (one per line)
          <textarea
            rows={3}
            value={form.policies}
            onChange={(event) =>
              updateField("policies", event.target.value)
            }
          />
          <FormFieldError
            id="branch-policies-error"
            message={fieldErrors.policies}
          />
        </label>

        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}

        <div className={styles.actions}>
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className={styles.cancelButton}
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={saving}
            className={styles.submitButton}
          >
            {saving
              ? "Saving..."
              : isEditing
                ? "Save Changes"
                : "Create Branch"}
          </button>
        </div>
      </form>
    </section>
  );
}
