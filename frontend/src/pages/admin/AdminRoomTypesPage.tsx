
import { useEffect, useState } from "react";
import { apiRequest } from "../../lib/api";
import styles from "./AdminRoomTypesPage.module.css";
import AdminConfirmModal from "../../components/admin/AdminConfirmModal";
import AddRoomTypeForm from "../../components/admin/AddRoomTypeForm";

type AdminRoomType = {
  id: string;
  branchId: string;
  name: string;
  description: string | null;
  maxGuests: number;
  basePrice: string | number;
  currency: string;
  isActive: boolean;
  images: string[];
  amenities: string[];
  branch: {
    id: string;
    name: string;
    city: string;
    isActive: boolean;
  };
  _count: {
    rooms: number;
  };
};

type RoomTypesResponse = {
  success: boolean;
  data: AdminRoomType[];
};

type StatusResponse = {
  success: boolean;
  message?: string;
};

type PendingStatusChange = {
  roomType: AdminRoomType;
  action: "activate" | "deactivate";
};

export default function AdminRoomTypesPage() {
  const [roomTypes, setRoomTypes] = useState<AdminRoomType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const [branchFilter, setBranchFilter] = useState("all");

  const [pendingStatusChange, setPendingStatusChange] =
    useState<PendingStatusChange | null>(null);

  const [changingStatusId, setChangingStatusId] =
    useState<string | null>(null);

    const [showAddForm, setShowAddForm] = useState(false);
    const [editingRoomType, setEditingRoomType] = useState<AdminRoomType | null>(null);

  useEffect(() => {
    let active = true;

    async function loadRoomTypes() {
      setLoading(true);
      setError("");

      try {
        const response = await apiRequest<RoomTypesResponse>(
          "/admin/room-types"
        );

        if (!response.success || !Array.isArray(response.data)) {
          throw new Error("Unexpected room types response.");
        }

        if (active) {
          setRoomTypes(response.data);
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load room types."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadRoomTypes();

    return () => {
      active = false;
    };
  }, [reloadKey]);

  const branches = Array.from(
    new Map(
      roomTypes.map((roomType) => [
        roomType.branch.id,
        roomType.branch,
      ])
    ).values()
  ).sort((a, b) => a.name.localeCompare(b.name));

  const filteredRoomTypes =
    branchFilter === "all"
      ? roomTypes
      : roomTypes.filter(
          (roomType) => roomType.branchId === branchFilter
        );

  const activeRoomTypes = roomTypes.filter(
    (roomType) => roomType.isActive
  ).length;

  const totalRooms = roomTypes.reduce(
    (total, roomType) => total + roomType._count.rooms,
    0
  );

  const statistics = [
    { label: "Total Room Types", value: roomTypes.length },
    { label: "Active Room Types", value: activeRoomTypes },
    { label: "Physical Rooms", value: totalRooms },
  ];

  function formatPrice(roomType: AdminRoomType) {
    const amount = Number(roomType.basePrice);

    if (!Number.isFinite(amount)) {
      return "Unavailable";
    }

    try {
      return new Intl.NumberFormat("en-ZA", {
        style: "currency",
        currency: roomType.currency,
      }).format(amount);
    } catch {
      return `${roomType.currency} ${amount.toFixed(2)}`;
    }
  }

  async function handleStatusChange() {
    if (!pendingStatusChange || changingStatusId) return;

    const { roomType, action } = pendingStatusChange;

    setChangingStatusId(roomType.id);
    setError("");
    setSuccess("");

    try {
      const endpoint =
        action === "activate"
          ? `/admin/room-types/${roomType.id}/activate`
          : `/admin/room-types/${roomType.id}`;

      const response = await apiRequest<StatusResponse>(
        endpoint,
        {
          method: action === "activate" ? "PATCH" : "DELETE",
        }
      );

      

      if (!response.success) {
        throw new Error(
          response.message || `Unable to ${action} room type.`
        );
      }

      setSuccess(
        response.message || `Room type ${action}d successfully.`
      );

      setPendingStatusChange(null);
      setReloadKey((value) => value + 1);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : `Unable to ${action} room type.`
      );

        setPendingStatusChange(null);
        setShowAddForm(false);
        setEditingRoomType(null);

    } finally {
      setChangingStatusId(null);
    }
  }

    function openAdd() {
    setEditingRoomType(null);
    setShowAddForm(true);
    setError("");
    setSuccess("");
    }

    function openEdit(roomType: AdminRoomType) {
    setShowAddForm(false);
    setEditingRoomType(roomType);
    setError("");
    setSuccess("");
    }

    function handleSaved() {
    setSuccess(
        editingRoomType
        ? "Room type updated successfully."
        : "Room type created successfully."
    );

    setShowAddForm(false);
    setEditingRoomType(null);
    setReloadKey((value) => value + 1);
    }

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <h1>Room Types</h1>
          <p>
            Manage room categories, pricing, capacity, and
            availability across Velora branches.
          </p>
        </div>

        <button
            type="button"
            className={styles.addButton}
            disabled={loading || changingStatusId !== null}
            onClick={openAdd}
            >
            + Add Room Type
        </button>
      </header>

      {success && (
        <p role="status" className={styles.success}>
          {success}
        </p>
      )}

      {(showAddForm || editingRoomType) && (
        <AddRoomTypeForm
            key={editingRoomType?.id ?? "new-room-type"}
            roomType={editingRoomType ?? undefined}
            onCancel={() => {
            setShowAddForm(false);
            setEditingRoomType(null);
            }}
            onSaved={handleSaved}
        />
        )}

      {loading && (
        <p role="status" className={styles.message}>
          Loading room types...
        </p>
      )}

      {error && (
        <div role="alert" className={styles.error}>
          <p>{error}</p>
          <button
            type="button"
            onClick={() => setReloadKey((value) => value + 1)}
          >
            Try Again
          </button>
        </div>
      )}

      {!loading && !error && (
        <>
          <section
            className={styles.statistics}
            aria-label="Room type statistics"
          >
            {statistics.map((stat) => (
              <article
                key={stat.label}
                className={styles.statCard}
              >
                <span>{stat.label}</span>
                <strong>{stat.value}</strong>
              </article>
            ))}
          </section>

          <section className={styles.roomTypesSection}>
            <div className={styles.sectionHeader}>
              <h2>Room Type Directory</h2>

              <div className={styles.sectionControls}>
                <label htmlFor="branch-filter">
                  Filter by Branch
                </label>

                <select
                  id="branch-filter"
                  value={branchFilter}
                  onChange={(event) =>
                    setBranchFilter(event.target.value)
                  }
                >
                  <option value="all">All Branches</option>

                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {filteredRoomTypes.length === 0 ? (
              <p className={styles.message}>
                No room types found.
              </p>
            ) : (
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col">Room Type</th>
                      <th scope="col">Branch</th>
                      <th scope="col">Guests</th>
                      <th scope="col">Price / Night</th>
                      <th scope="col">Rooms</th>
                      <th scope="col">Status</th>
                      <th scope="col">Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredRoomTypes.map((roomType) => (
                      <tr key={roomType.id}>
                        <td className={styles.roomTypeName}>
                          {roomType.name}
                        </td>

                        <td>
                          {roomType.branch.name}
                          <span className={styles.subText}>
                            {roomType.branch.city}
                          </span>
                        </td>

                        <td>{roomType.maxGuests}</td>

                        <td>{formatPrice(roomType)}</td>

                        <td>{roomType._count.rooms}</td>

                        <td>
                          <span
                            className={`${styles.status} ${
                              roomType.isActive
                                ? styles.active
                                : styles.inactive
                            }`}
                          >
                            {roomType.isActive
                              ? "Active"
                              : "Inactive"}
                          </span>
                        </td>

                        <td>
                          <div className={styles.actionGroup}>
                            <button
                                type="button"
                                className={styles.editButton}
                                disabled={
                                    changingStatusId !== null ||
                                    !roomType.branch.isActive
                                }
                                onClick={() => openEdit(roomType)}
                                title={
                                    !roomType.branch.isActive
                                    ? "Activate the branch before editing this room type"
                                    : undefined
                                }
                                >
                                Edit
                            </button>

                            {roomType.isActive ? (
                              <button
                                type="button"
                                className={styles.deactivateButton}
                                disabled={changingStatusId !== null}
                                onClick={() =>
                                  setPendingStatusChange({
                                    roomType,
                                    action: "deactivate",
                                  })
                                }
                              >
                                Deactivate
                              </button>
                            ) : (
                              <button
                                type="button"
                                className={styles.activateButton}
                                disabled={
                                  changingStatusId !== null ||
                                  !roomType.branch.isActive
                                }
                                title={
                                  !roomType.branch.isActive
                                    ? "Activate the branch first"
                                    : undefined
                                }
                                onClick={() =>
                                  setPendingStatusChange({
                                    roomType,
                                    action: "activate",
                                  })
                                }
                              >
                                Activate
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {pendingStatusChange && (
        <AdminConfirmModal
          title={
            pendingStatusChange.action === "activate"
              ? "Activate Room Type?"
              : "Deactivate Room Type?"
          }
          itemName={pendingStatusChange.roomType.name}
          description={
            pendingStatusChange.action === "activate"
              ? "This room type will become active again."
              : "This room type will become unavailable for new reservations."
          }
          notice={
            pendingStatusChange.action === "activate"
              ? "Previously deactivated physical rooms will remain inactive."
              : "Protected future reservations prevent deactivation. Historical records will be preserved."
          }
          confirmLabel={
            pendingStatusChange.action === "activate"
              ? "Activate Room Type"
              : "Deactivate Room Type"
          }
          loading={changingStatusId !== null}
          onConfirm={() => void handleStatusChange()}
          onCancel={() => {
            if (!changingStatusId) {
              setPendingStatusChange(null);
            }
          }}
        />
      )}
    </main>
  );
}
