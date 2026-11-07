
import { useEffect, useState, type FormEvent } from "react";
import { apiRequest } from "../../lib/api";
import styles from "./AddRoomForm.module.css";

import { useZodForm } from "../../hooks/useZodForm";
import { roomSchema } from "../../schemas/roomSchema";
import FormFieldError from "./FormFieldError";

export type EditableRoom = {
  id: string;
  branchId: string;
  roomTypeId: string;
  roomNumber: string;
  floor: number | null;
  isActive: boolean;
};

type AdminBranch = {
  id: string;
  name: string;
  city: string;
  isActive: boolean;
};

type AdminRoomType = {
  id: string;
  branchId: string;
  name: string;
  isActive: boolean;
  basePrice: string | number;
  currency: string;
};

type ApiListResponse<T> = {
  success: boolean;
  data: T[];
};

type AddRoomFormProps = {
  room?: EditableRoom;
  onCancel: () => void;
  onSaved: () => void;
  onSavingChange?: (saving: boolean) => void;
};

export default function AddRoomForm({
  room,
  onCancel,
  onSaved,
  onSavingChange,
}: AddRoomFormProps) {
  const editing = Boolean(room);

  const [branches, setBranches] = useState<AdminBranch[]>([]);
  const [roomTypes, setRoomTypes] = useState<AdminRoomType[]>([]);

  const [branchId, setBranchId] = useState(room?.branchId ?? "");
  const [roomTypeId, setRoomTypeId] = useState(
    room?.roomTypeId ?? ""
  );
  const [roomNumber, setRoomNumber] = useState(
    room?.roomNumber ?? ""
  );
  const [floor, setFloor] = useState(
    room?.floor === null || room?.floor === undefined
      ? ""
      : String(room.floor)
  );

  const [loadingOptions, setLoadingOptions] = useState(true);
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
  } = useZodForm(roomSchema);

  useEffect(() => {
    let active = true;

    async function loadOptions() {
      try {
        const [branchesResponse, roomTypesResponse] =
          await Promise.all([
            apiRequest<ApiListResponse<AdminBranch>>(
              "/admin/branches"
            ),
            apiRequest<ApiListResponse<AdminRoomType>>(
              "/admin/room-types"
            ),
          ]);

        if (
          !branchesResponse.success ||
          !roomTypesResponse.success ||
          !Array.isArray(branchesResponse.data) ||
          !Array.isArray(roomTypesResponse.data)
        ) {
          throw new Error("Unable to load room options.");
        }

        if (active) {
          setBranches(branchesResponse.data);
          setRoomTypes(roomTypesResponse.data);
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load branches and room types."
          );
        }
      } finally {
        if (active) {
          setLoadingOptions(false);
        }
      }
    }

    void loadOptions();

    return () => {
      active = false;
    };
  }, []);

  const availableBranches = branches.filter(
    (branch) => branch.isActive
  );

  const availableRoomTypes = roomTypes.filter(
    (type) =>
      type.branchId === branchId &&
      type.isActive
  );

  const selectedBranch = branches.find(
    (branch) => branch.id === branchId
  );

  const selectedRoomType = roomTypes.find(
    (type) => type.id === roomTypeId
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving || loadingOptions) return;

    setError("");

    const validated = validate({
      branchId,
      roomTypeId,
      roomNumber,
      floor,
    });

    if (!validated) return;

    if (!selectedBranch?.isActive) {
      setFieldErrors({
        branchId: "Please select an active hotel branch.",
      });
      return;
    }

    if (
      !selectedRoomType?.isActive ||
      selectedRoomType.branchId !== validated.branchId
    ) {
      setFieldErrors({
        roomTypeId: "Please select an active room type for this branch.",
      });
      return;
    }

    const payload = {
      roomNumber: validated.roomNumber,
      ...(validated.floor !== undefined
        ? { floor: validated.floor }
        : {}),
    };

    setSaving(true);

    try {
      if (room) {
        await apiRequest(`/admin/rooms/${room.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        await apiRequest("/admin/rooms", {
          method: "POST",
          body: JSON.stringify({
            ...payload,
            branchId: validated.branchId,
            roomTypeId: validated.roomTypeId,
          }),
        });
      }

      onSaved();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save room."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={styles.formCard}>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {loadingOptions ? (
        <p className={styles.helperText}>
          Loading branches and room types...
        </p>
      ) : (
        <form noValidate onSubmit={(event) => void handleSubmit(event)}>
          <div className={styles.formGrid}>
            <label className={styles.field}>
              <span>Hotel Branch *</span>

              <select
                value={branchId}
                disabled={editing || saving}
                onChange={(event) => {
                  setBranchId(event.target.value);
                  setRoomTypeId("");
                  clearFieldError("branchId");
                  clearFieldError("roomTypeId");
                }}
                required
                aria-invalid={Boolean(fieldErrors.branchId)}
                aria-describedby={
                  fieldErrors.branchId ? "room-branch-error" : undefined
                }
              >
                <option value="">Select a branch</option>

                {availableBranches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name} — {branch.city}
                  </option>
                ))}
              </select>

              <FormFieldError
                id="room-branch-error"
                message={fieldErrors.branchId}
              />
            </label>

            <label className={styles.field}>
              <span>Room Type *</span>

              <select
                value={roomTypeId}
                disabled={editing || saving || !branchId}
                onChange={(event) => {
                  setRoomTypeId(event.target.value);
                  clearFieldError("roomTypeId");
                }}
                required
                aria-invalid={Boolean(fieldErrors.roomTypeId)}
                aria-describedby={
                  fieldErrors.roomTypeId ? "room-type-error" : undefined
                }
              >
                <option value="">Select a room type</option>

                {availableRoomTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name} ({type.currency}{" "}
                    {Number(type.basePrice).toFixed(2)})
                  </option>
                ))}
              </select>

              <FormFieldError
                id="room-type-error"
                message={fieldErrors.roomTypeId}
              />
            </label>

            <label className={styles.field}>
              <span>Room Number *</span>

              <input
                type="text"
                value={roomNumber}
                maxLength={20}
                onChange={(event) => {
                  setRoomNumber(event.target.value);
                  clearFieldError("roomNumber");
                }}
                placeholder="e.g. TEST-101"
                required
                disabled={saving}
                aria-invalid={Boolean(fieldErrors.roomNumber)}
                aria-describedby={
                  fieldErrors.roomNumber ? "room-number-error" : undefined
                }
              />

              <FormFieldError
                id="room-number-error"
                message={fieldErrors.roomNumber}
              />
            </label>

            <label className={styles.field}>
              <span>Floor</span>

              <input
                type="text"
                inputMode="numeric"
                value={floor}
                onChange={(event) => {
                  setFloor(event.target.value);
                  clearFieldError("floor");
                }}
                placeholder="e.g. 1"
                disabled={saving}
                aria-invalid={Boolean(fieldErrors.floor)}
                aria-describedby={
                  fieldErrors.floor ? "room-floor-error" : undefined
                }
              />

              <FormFieldError
                id="room-floor-error"
                message={fieldErrors.floor}
              />
            </label>
          </div>

          {editing && (
            <p className={styles.helperText}>
              Branch and room type cannot be changed when
              editing an existing room.
            </p>
          )}

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
              disabled={saving || loadingOptions}
            >
              {saving
                ? "Saving..."
                : editing
                  ? "Save Changes"
                  : "Create Room"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
