
import { useEffect, useState } from "react";
import { apiRequest } from "../../lib/api";
import styles from "./AdminRoomsPage.module.css";
import AddRoomForm, {
  type EditableRoom,
} from "../../components/admin/AddRoomForm";
import AdminConfirmModal from "../../components/admin/AdminConfirmModal";
import AdminModal from "../../components/admin/AdminModal";

type AdminRoom = {
  id: string;
  branchId: string;
  roomTypeId: string;
  roomNumber: string;
  floor: number | null;
  isActive: boolean;
  branch: {
    id: string;
    name: string;
    city: string;
    isActive: boolean;
  };
  roomType: {
    id: string;
    name: string;
    maxGuests: number;
    basePrice: string | number;
    currency: string;
    isActive: boolean;
  };
};

type RoomsResponse = {
  success: boolean;
  data: AdminRoom[];
};

export default function AdminRoomsPage() {
  const [rooms, setRooms] = useState<AdminRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const [branchFilter, setBranchFilter] = useState("all");
  const [roomTypeFilter, setRoomTypeFilter] = useState("all");

    const [showAddForm, setShowAddForm] = useState(false);
    const [editingRoom, setEditingRoom] = useState<EditableRoom | null>(null);

    const [pendingStatusChange, setPendingStatusChange] =
  useState<{
    room: AdminRoom;
    action: "activate" | "deactivate";
  } | null>(null);

  const [statusSaving, setStatusSaving] = useState(false);

  const [roomFormSaving, setRoomFormSaving] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadRooms() {
      setLoading(true);
      setError("");

      try {
        const response = await apiRequest<RoomsResponse>(
          "/admin/rooms"
        );

        if (!response.success || !Array.isArray(response.data)) {
          throw new Error("Unexpected rooms response.");
        }

        if (active) {
          setRooms(response.data);
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load rooms."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadRooms();

    return () => {
      active = false;
    };
  }, [reloadKey]);

  const branches = Array.from(
    new Map(
      rooms.map((room) => [room.branch.id, room.branch])
    ).values()
  ).sort((a, b) => a.name.localeCompare(b.name));

  const roomTypes = Array.from(
    new Map(
      rooms
        .filter(
          (room) =>
            branchFilter === "all" ||
            room.branchId === branchFilter
        )
        .map((room) => [
          room.roomType.id,
          room.roomType,
        ])
    ).values()
  ).sort((a, b) => a.name.localeCompare(b.name));

  const filteredRooms = rooms.filter((room) => {
    const matchesBranch =
      branchFilter === "all" ||
      room.branchId === branchFilter;

    const matchesRoomType =
      roomTypeFilter === "all" ||
      room.roomTypeId === roomTypeFilter;

    return matchesBranch && matchesRoomType;
  });

  const activeRooms = rooms.filter(
    (room) => room.isActive
  ).length;

  const statistics = [
    { label: "Total Rooms", value: rooms.length },
    { label: "Active Rooms", value: activeRooms },
    {
      label: "Inactive Rooms",
      value: rooms.length - activeRooms,
    },
  ];

  function formatPrice(room: AdminRoom) {
    const amount = Number(room.roomType.basePrice);

    if (!Number.isFinite(amount)) {
      return "Unavailable";
    }

    try {
      return new Intl.NumberFormat("en-ZA", {
        style: "currency",
        currency: room.roomType.currency,
      }).format(amount);
    } catch {
      return `${room.roomType.currency} ${amount.toFixed(2)}`;
    }
  }

  function openAddForm() {
    setRoomFormSaving(false);
    setEditingRoom(null);
    setShowAddForm(true);
  }

  function openEditForm(room: AdminRoom) {
    setRoomFormSaving(false);
    setEditingRoom(room);
    setShowAddForm(true);
  }

  function closeRoomForm() {
    if (roomFormSaving) return;

    setEditingRoom(null);
    setShowAddForm(false);
  }

  function handleRoomSaved() {
    // A successful save is allowed to close the modal.
    setEditingRoom(null);
    setShowAddForm(false);
    setRoomFormSaving(false);
    setReloadKey((value) => value + 1);
  }

    
async function handleRoomStatusChange() {
  if (!pendingStatusChange || statusSaving) {
    return;
  }

  const { room, action } = pendingStatusChange;

  setStatusSaving(true);
  setError("");

  try {
    if (action === "activate") {
      await apiRequest(
        `/admin/rooms/${room.id}/activate`,
        {
          method: "PATCH",
        }
      );
    } else {
      await apiRequest(`/admin/rooms/${room.id}`, {
        method: "DELETE",
      });
    }

    setPendingStatusChange(null);
    setReloadKey((value) => value + 1);
  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : `Unable to ${action} room.`
    );
    setPendingStatusChange(null);
  } finally {
    setStatusSaving(false);
  }
}


  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <h1>Rooms</h1>
          <p>
            Manage physical rooms across Velora hotel branches.
          </p>
        </div>

        <button
            type="button"
            className={styles.addButton}
            onClick={openAddForm}
            >
            + Add Room
        </button>
      </header>

      {loading && (
        <p role="status" className={styles.message}>
          Loading rooms...
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
            aria-label="Room statistics"
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

          <section className={styles.roomsSection}>
            <div className={styles.sectionHeader}>
              <h2>Physical Room Directory</h2>
              <span>{filteredRooms.length} rooms shown</span>
            </div>

            <div className={styles.filters}>
              <label>
                <span>Hotel Branch</span>
                <select
                  value={branchFilter}
                  onChange={(event) => {
                    setBranchFilter(event.target.value);
                    setRoomTypeFilter("all");
                  }}
                >
                  <option value="all">All Branches</option>

                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Room Type</span>
                <select
                  value={roomTypeFilter}
                  onChange={(event) =>
                    setRoomTypeFilter(event.target.value)
                  }
                >
                  <option value="all">All Room Types</option>

                  {roomTypes.map((roomType) => (
                    <option
                      key={roomType.id}
                      value={roomType.id}
                    >
                      {roomType.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {filteredRooms.length === 0 ? (
              <p className={styles.message}>
                No rooms found for the selected filters.
              </p>
            ) : (
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col">Room Number</th>
                      <th scope="col">Branch</th>
                      <th scope="col">Room Type</th>
                      <th scope="col">Floor</th>
                      <th scope="col">Guests</th>
                      <th scope="col">Price / Night</th>
                      <th scope="col">Status</th>
                      <th scope="col">Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredRooms.map((room) => (
                      <tr key={room.id}>
                        <td className={styles.roomNumber}>
                          {room.roomNumber}
                        </td>

                        <td>
                          {room.branch.name}
                          <span className={styles.subText}>
                            {room.branch.city}
                          </span>
                        </td>

                        <td>{room.roomType.name}</td>

                        <td>{room.floor ?? "—"}</td>

                        <td>{room.roomType.maxGuests}</td>

                        <td>{formatPrice(room)}</td>

                        <td>
                          <span
                            className={`${styles.status} ${
                              room.isActive
                                ? styles.active
                                : styles.inactive
                            }`}
                          >
                            {room.isActive
                              ? "Active"
                              : "Inactive"}
                          </span>
                        </td>

                        <td>
                          <div className={styles.actionGroup}>
                            <button
                                type="button"
                                className={styles.editButton}
                                onClick={() => openEditForm(room)}
                                disabled={
                                    !room.branch.isActive ||
                                    !room.roomType.isActive
                                }
                                >
                                Edit
                            </button>
                            
                            <button
                              type="button"
                              className={
                                room.isActive
                                  ? styles.deactivateButton
                                  : styles.activateButton
                              }
                              onClick={() =>
                                setPendingStatusChange({
                                  room,
                                  action: room.isActive
                                    ? "deactivate"
                                    : "activate",
                                })
                              }
                              disabled={
                                statusSaving ||
                                (!room.isActive &&
                                  (!room.branch.isActive ||
                                    !room.roomType.isActive))
                              }
                            >
                              {room.isActive ? "Deactivate" : "Activate"}
                            </button>

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

      {showAddForm && (
        <AdminModal
          title={editingRoom ? "Edit Room" : "Add Room"}
          subtitle={
            editingRoom
              ? "Update this room's number or floor."
              : "Create a physical room within a hotel branch."
          }
          size="medium"
          onClose={closeRoomForm}
          canClose={!roomFormSaving}
        >
          <AddRoomForm
            key={editingRoom?.id ?? "new-room"}
            room={editingRoom ?? undefined}
            onCancel={closeRoomForm}
            onSaved={handleRoomSaved}
            onSavingChange={setRoomFormSaving}
          />
        </AdminModal>
      )}
                
      {pendingStatusChange && (
        <AdminConfirmModal
          title={
            pendingStatusChange.action === "activate"
              ? "Activate Room"
              : "Deactivate Room"
          }
          itemName={
            `Room ${pendingStatusChange.room.roomNumber}`
          }
          description={
            pendingStatusChange.action === "activate"
              ? "This room will become active and may be available for future bookings."
              : "This room will become inactive and unavailable for new bookings. Rooms with protected future reservations cannot be deactivated."
          }
          notice={
            pendingStatusChange.action === "deactivate"
              ? "Existing protected future reservations will be checked before this action is allowed."
              : undefined
          }
          confirmLabel={
            pendingStatusChange.action === "activate"
              ? "Activate Room"
              : "Deactivate Room"
          }
          loading={statusSaving}
          onConfirm={() => void handleRoomStatusChange()}
          onCancel={() => {
            if (!statusSaving) {
              setPendingStatusChange(null);
            }
          }}
        />
      )}

    </main>
  );
}
