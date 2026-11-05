
import { useEffect, useState, type FormEvent } from "react";
import { apiRequest } from "../../lib/api";
import styles from "./AddRoomForm.module.css";

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
};

export default function AddRoomForm({
  room,
  onCancel,
  onSaved,
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
  const [error, setError] = useState("");

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

  const canSave =
    !loadingOptions &&
    !saving &&
    Boolean(selectedBranch?.isActive) &&
    Boolean(
      selectedRoomType?.isActive &&
      selectedRoomType.branchId === branchId
    );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!canSave) {
      setError("Select an active branch and room type.");
      return;
    }

    const cleanedRoomNumber = roomNumber.trim();

    if (!cleanedRoomNumber || cleanedRoomNumber.length > 20) {
      setError("Room number must contain 1 to 20 characters.");
      return;
    }

    let parsedFloor: number | undefined;

    if (floor.trim() !== "") {
      parsedFloor = Number(floor);

      if (!Number.isSafeInteger(parsedFloor)) {
        setError("Floor must be a valid whole number.");
        return;
      }
    }

    const payload = {
      roomNumber: cleanedRoomNumber,
      ...(parsedFloor !== undefined
        ? { floor: parsedFloor }
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
            branchId,
            roomTypeId,
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
      <div className={styles.formHeader}>
        <div>
          <h2>{editing ? "Edit Room" : "Add Physical Room"}</h2>
          <p>
            {editing
              ? "Update this room's number or floor."
              : "Create a physical room within a hotel branch."}
          </p>
        </div>

        <button
          type="button"
          className={styles.closeButton}
          onClick={onCancel}
          disabled={saving}
          aria-label="Close room form"
        >
          ×
        </button>
      </div>

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
        <form onSubmit={(event) => void handleSubmit(event)}>
          <div className={styles.formGrid}>
            <label className={styles.field}>
              <span>Hotel Branch *</span>
              <select
                value={branchId}
                disabled={editing || saving}
                onChange={(event) => {
                  setBranchId(event.target.value);
                  setRoomTypeId("");
                }}
                required
              >
                <option value="">Select a branch</option>

                {availableBranches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name} — {branch.city}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.field}>
              <span>Room Type *</span>
              <select
                value={roomTypeId}
                disabled={editing || saving || !branchId}
                onChange={(event) =>
                  setRoomTypeId(event.target.value)
                }
                required
              >
                <option value="">Select a room type</option>

                {availableRoomTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name} ({type.currency}{" "}
                    {Number(type.basePrice).toFixed(2)})
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.field}>
              <span>Room Number *</span>
              <input
                type="text"
                value={roomNumber}
                maxLength={20}
                onChange={(event) =>
                  setRoomNumber(event.target.value)
                }
                placeholder="e.g. TEST-101"
                required
                disabled={saving}
              />
            </label>

            <label className={styles.field}>
              <span>Floor</span>
              <input
                type="number"
                step="1"
                value={floor}
                onChange={(event) => setFloor(event.target.value)}
                placeholder="e.g. 1"
                disabled={saving}
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
              disabled={!canSave}
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
