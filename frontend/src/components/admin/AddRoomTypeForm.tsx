
import { useEffect, useState, type FormEvent } from "react";
import { apiRequest } from "../../lib/api";
import styles from "./AddRoomTypeForm.module.css";

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
  const [error, setError] = useState("");

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

    const guests = Number(maxGuests);
    const price = Number(basePrice);
    const normalizedCurrency = currency.trim().toUpperCase();
    const imageList = splitLines(images);

    if (!branchId) {
      setError("Please select a hotel branch.");
      return;
    }

    if (!selectedBranch?.isActive) {
      setError("The selected hotel branch must be active.");
      return;
    }

    if (!name.trim()) {
      setError("Room type name is required.");
      return;
    }

    if (!Number.isInteger(guests) || guests <= 0) {
      setError("Maximum guests must be a positive whole number.");
      return;
    }

    if (!Number.isFinite(price) || price <= 0) {
      setError("Nightly price must be greater than zero.");
      return;
    }

    if (!/^[A-Z]{3}$/.test(normalizedCurrency)) {
      setError("Currency must be a three-letter code.");
      return;
    }

    if (
      imageList.some((image) => {
        try {
          const url = new URL(image);
          return !["http:", "https:"].includes(url.protocol);
        } catch {
          return true;
        }
      })
    ) {
      setError("Every image must have a valid HTTP or HTTPS URL.");
      return;
    }

    const payload = {
      name: name.trim(),
      description: description.trim(),
      maxGuests: guests,
      basePrice: price,
      currency: normalizedCurrency,
      images: imageList,
      amenities: splitLines(amenities),
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
      <div className={styles.formHeader}>
        <div>
          <h2>
            {isEditing ? "Edit Room Type" : "Add Room Type"}
          </h2>
          <p>
            Configure room category details and nightly pricing.
          </p>
        </div>
      </div>

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

      <form onSubmit={(event) => void handleSubmit(event)}>
        <div className={styles.formGrid}>
          <label className={styles.field}>
            <span>Hotel Branch *</span>
            <select
              value={branchId}
              onChange={(event) =>
                setBranchId(event.target.value)
              }
              disabled={isEditing || loadingBranches || saving}
              required
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
          </label>

          <label className={styles.field}>
            <span>Room Type Name *</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={150}
              required
              disabled={saving}
              placeholder="e.g. Deluxe King Room"
            />
          </label>

          <label className={styles.field}>
            <span>Maximum Guests *</span>
            <input
              type="number"
              min="1"
              step="1"
              value={maxGuests}
              onChange={(event) =>
                setMaxGuests(event.target.value)
              }
              required
              disabled={saving}
            />
          </label>

          <label className={styles.field}>
            <span>Base Price / Night *</span>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={basePrice}
              onChange={(event) =>
                setBasePrice(event.target.value)
              }
              required
              disabled={saving}
              placeholder="e.g. 1250.00"
            />
          </label>

          <label className={styles.field}>
            <span>Currency *</span>
            <input
              value={currency}
              onChange={(event) =>
                setCurrency(event.target.value)
              }
              maxLength={3}
              required
              disabled={saving}
              placeholder="ZAR"
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
              onChange={(event) =>
                setImages(event.target.value)
              }
              rows={4}
              disabled={saving}
              placeholder={"https://example.com/room-1.jpg"}
            />
            <small>Enter one image URL per line.</small>
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
