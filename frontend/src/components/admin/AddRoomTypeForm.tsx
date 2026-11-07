
import { useEffect, useState, type FormEvent } from "react";
import { apiRequest } from "../../lib/api";
import styles from "./AddRoomTypeForm.module.css";

import FormFieldError from "./FormFieldError";

import { useZodForm } from "../../hooks/useZodForm";
import { roomTypeSchema } from "../../schemas/roomTypeSchema";

export type EditableRoomType = {
  id: string;
  branchId: string;
  name: string;
  description: string | null;
  maxGuests: number;
  basePrice: string | number;
  currency: string;
  images: string[];
  amenities: string[];
};

type AdminBranch = {
  id: string;
  name: string;
  city: string;
  isActive: boolean;
};

type BranchesResponse = {
  success: boolean;
  data: AdminBranch[];
};

type AddRoomTypeFormProps = {
  roomType?: EditableRoomType;
  onCancel: () => void;
  onSaved: () => void;
  onSavingChange?: (saving: boolean) => void;
};

function splitLines(value: string) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function AddRoomTypeForm({
  roomType,
  onCancel,
  onSaved,
  onSavingChange,
}: AddRoomTypeFormProps) {
  const isEditing = Boolean(roomType);

  const [branches, setBranches] = useState<AdminBranch[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(true);
  const [branchError, setBranchError] = useState("");

  const [branchId, setBranchId] = useState(roomType?.branchId ?? "");
  const [name, setName] = useState(roomType?.name ?? "");
  const [description, setDescription] = useState(
    roomType?.description ?? ""
  );
  const [maxGuests, setMaxGuests] = useState(
    String(roomType?.maxGuests ?? 2)
  );
  const [basePrice, setBasePrice] = useState(
    String(roomType?.basePrice ?? "")
  );
  const [currency, setCurrency] = useState(
    roomType?.currency ?? "ZAR"
  );
  const [images, setImages] = useState(
    roomType?.images.join("\n") ?? ""
  );
  const [amenities, setAmenities] = useState(
    roomType?.amenities.join("\n") ?? ""
  );

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    onSavingChange?.(saving);
  }, [saving, onSavingChange]);

  const [error, setError] = useState("");

  const {
    fieldErrors,
    setFieldErrors,
    validate,
    clearFieldError,
  } = useZodForm(roomTypeSchema);

  useEffect(() => {
    let active = true;

    async function loadBranches() {
      setLoadingBranches(true);
      setBranchError("");

      try {
        const response = await apiRequest<BranchesResponse>(
          "/admin/branches"
        );

        if (!response.success || !Array.isArray(response.data)) {
          throw new Error("Unexpected branches response.");
        }

        if (active) {
          setBranches(response.data);
        }
      } catch (err) {
        if (active) {
          setBranchError(
            err instanceof Error
              ? err.message
              : "Unable to load hotel branches."
          );
        }
      } finally {
        if (active) {
          setLoadingBranches(false);
        }
      }
    }

    void loadBranches();

    return () => {
      active = false;
    };
  }, []);

  const activeBranches = branches.filter(
    (branch) => branch.isActive
  );

  const selectedBranch = branches.find(
    (branch) => branch.id === branchId
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) return;

    setError("");

    const imageList = splitLines(images);
    const amenityList = splitLines(amenities);

    const validated = validate({
      branchId,
      name,
      description,
      maxGuests,
      basePrice,
      currency,
      images: imageList,
      amenities: amenityList,
    });

    if (!validated) {
      return;
    }

    if (!selectedBranch?.isActive) {
      setFieldErrors({
        branchId: "The selected hotel branch must be active.",
      });
      return;
    }

    const payload = {
      name: validated.name,
      description: validated.description,
      maxGuests: validated.maxGuests,
      basePrice: validated.basePrice,
      currency: validated.currency,
      images: validated.images,
      amenities: validated.amenities,
    };

    try {
      setSaving(true);

      const endpoint = isEditing
        ? `/admin/room-types/${roomType!.id}`
        : `/admin/branches/${branchId}/room-types`;

      const response = await apiRequest<{
        success: boolean;
        message?: string;
      }>(endpoint, {
        method: isEditing ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      });

      if (!response.success) {
        throw new Error(
          response.message || "Unable to save room type."
        );
      }

      onSaved();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save room type."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={styles.formCard}>
      {branchError && (
        <p role="alert" className={styles.error}>
          {branchError}
        </p>
      )}

      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}

      <form noValidate onSubmit={(event) => void handleSubmit(event)}>
        <div className={styles.formGrid}>
          <label className={styles.field}>
            <span>Hotel Branch *</span>

            <select
              value={branchId}
              onChange={(event) => {
                setBranchId(event.target.value);
                clearFieldError("branchId");
              }}
              disabled={isEditing || loadingBranches || saving}
              required
              aria-invalid={Boolean(fieldErrors.branchId)}
              aria-describedby={
                fieldErrors.branchId ? "room-type-branch-error" : undefined
              }
            >
              <option value="">Select a branch</option>

              {activeBranches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name} — {branch.city}
                </option>
              ))}

              {isEditing &&
                selectedBranch &&
                !selectedBranch.isActive && (
                  <option value={selectedBranch.id}>
                    {selectedBranch.name} (Inactive)
                  </option>
                )}
            </select>

            <FormFieldError
              id="room-type-branch-error"
              message={fieldErrors.branchId}
            />
          </label>

          <label className={styles.field}>
            <span>Room Type Name *</span>

            <input
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                clearFieldError("name");
              }}
              maxLength={150}
              required
              disabled={saving}
              placeholder="e.g. Deluxe King Room"
              aria-invalid={Boolean(fieldErrors.name)}
              aria-describedby={
                fieldErrors.name ? "room-type-name-error" : undefined
              }
            />

            <FormFieldError
              id="room-type-name-error"
              message={fieldErrors.name}
            />
          </label>

          <label className={styles.field}>
            <span>Maximum Guests *</span>

            <input
              type="text"
              inputMode="numeric"
              value={maxGuests}
              onChange={(event) => {
                setMaxGuests(event.target.value);
                clearFieldError("maxGuests");
              }}
              required
              disabled={saving}
              placeholder="e.g. 2"
              aria-invalid={Boolean(fieldErrors.maxGuests)}
              aria-describedby={
                fieldErrors.maxGuests ? "room-type-guests-error" : undefined
              }
            />

            <FormFieldError
              id="room-type-guests-error"
              message={fieldErrors.maxGuests}
            />
          </label>

          <label className={styles.field}>
            <span>Base Price / Night *</span>

            <input
              type="text"
              inputMode="decimal"
              value={basePrice}
              onChange={(event) => {
                setBasePrice(event.target.value);
                clearFieldError("basePrice");
              }}
              required
              disabled={saving}
              placeholder="e.g. 1250.00"
              aria-invalid={Boolean(fieldErrors.basePrice)}
              aria-describedby={
                fieldErrors.basePrice ? "room-type-price-error" : undefined
              }
            />

            <FormFieldError
              id="room-type-price-error"
              message={fieldErrors.basePrice}
            />
          </label>

          <label className={styles.field}>
            <span>Currency *</span>

            <input
              value={currency}
              onChange={(event) => {
                setCurrency(event.target.value);
                clearFieldError("currency");
              }}
              maxLength={3}
              required
              disabled={saving}
              placeholder="ZAR"
              aria-invalid={Boolean(fieldErrors.currency)}
              aria-describedby={
                fieldErrors.currency ? "room-type-currency-error" : undefined
              }
            />

            <FormFieldError
              id="room-type-currency-error"
              message={fieldErrors.currency}
            />
          </label>

          <label className={`${styles.field} ${styles.fullWidth}`}>
            <span>Description</span>
            <textarea
              value={description}
              onChange={(event) =>
                setDescription(event.target.value)
              }
              rows={3}
              disabled={saving}
              placeholder="Describe this room category..."
            />
          </label>

          <label className={`${styles.field} ${styles.fullWidth}`}>
            <span>Amenities</span>
            <textarea
              value={amenities}
              onChange={(event) =>
                setAmenities(event.target.value)
              }
              rows={4}
              disabled={saving}
              placeholder={"Wi-Fi\nAir conditioning\nSmart TV"}
            />
            <small>Enter one amenity per line.</small>
          </label>

          <label className={`${styles.field} ${styles.fullWidth}`}>
            <span>Image URLs</span>

            <textarea
              value={images}
              onChange={(event) => {
                setImages(event.target.value);
                clearFieldError("images");
              }}
              rows={4}
              disabled={saving}
              placeholder="https://example.com/room-1.jpg"
              aria-invalid={Boolean(fieldErrors.images)}
              aria-describedby={
                fieldErrors.images ? "room-type-images-error" : undefined
              }
            />

            <small>Enter one image URL per line.</small>

            <FormFieldError
              id="room-type-images-error"
              message={fieldErrors.images}
            />
          </label>
        </div>

        <div className={styles.formActions}>
          <button
            type="button"
            className={styles.cancelButton}
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </button>

          <button
            type="submit"
            className={styles.saveButton}
            disabled={
              saving ||
              loadingBranches ||
              Boolean(branchError) ||
              activeBranches.length === 0
            }
          >
            {saving
              ? "Saving..."
              : isEditing
                ? "Save Changes"
                : "Create Room Type"}
          </button>
        </div>
      </form>
    </section>
  );
}
