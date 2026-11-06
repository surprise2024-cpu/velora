
import { useState, type FormEvent } from "react";
import { apiRequest } from "../../lib/api";
import styles from "./AddBranchForm.module.css";

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

function splitLines(value: string): string[] {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function AddBranchForm({
  brandId,
  branch,
  onSaved,
  onCancel,
}: Props) {
  const isEditing = Boolean(branch);

  const [form, setForm] = useState<BranchForm>(() =>
    createInitialForm(branch)
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function updateField(
    field: keyof BranchForm,
    value: string
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (saving) return;

    setError("");

    const images = splitLines(form.images);

    for (const image of images) {
      try {
        const url = new URL(image);

        if (!["http:", "https:"].includes(url.protocol)) {
          throw new Error("Invalid protocol");
        }
      } catch {
        setError(
          "Every image must be a valid HTTP or HTTPS URL."
        );
        return;
      }
    }

    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      address: form.address.trim(),
      city: form.city.trim(),
      province: form.province.trim(),
      country: form.country.trim(),
      starRating: Number(form.starRating),
      images,
      amenities: splitLines(form.amenities),
      policies: splitLines(form.policies),
      ...(!isEditing && { brandId }),
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
      <header className={styles.header}>
        <div>
          <h2>
            {isEditing
              ? "Edit Hotel Branch"
              : "Add Hotel Branch"}
          </h2>
          <p>
            {isEditing
              ? "Update this Velora hotel's details."
              : "Register a new Velora accommodation."}
          </p>
        </div>

        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className={styles.closeButton}
        >
          Close
        </button>
      </header>

      <form onSubmit={handleSubmit} className={styles.form}>
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
