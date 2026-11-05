
import { useEffect, useState } from "react";
import { apiRequest } from "../../lib/api";
import styles from "./AdminRoomsPage.module.css";
import AdminConfirmModal from "../../components/admin/AdminConfirmModal";

type AdminBooking = {
  id: string;
  status: string;
  checkIn: string;
  checkOut: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
  } | null;
  bookingRooms: {
    room: {
      id: string;
      roomNumber: string;
      branch: {
        id: string;
        name: string;
        city: string;
      };
      roomType: {
        id: string;
        name: string;
        maxGuests: number;
        basePrice: string | number;
        currency: string;
      };
    };
  }[];
};

type BookingsResponse = {
  success: boolean;
  data: AdminBooking[];
};

type BookingAction = "approve" | "cancel";

type PendingBookingAction = {
  booking: AdminBooking;
  action: BookingAction;
};

type BookingActionResponse = {
  success: boolean;
  message?: string;
};  

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [branchFilter, setBranchFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

    const [pendingAction, setPendingAction] =
  useState<PendingBookingAction | null>(null);

    const [actionSaving, setActionSaving] = useState(false);
    const [success, setSuccess] = useState("");
    const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadBookings() {

        setLoading(true);
        setError("");

      try {
        const response = await apiRequest<BookingsResponse>(
          "/admin/bookings"
        );

        if (!response.success || !Array.isArray(response.data)) {
          throw new Error("Unexpected bookings response.");
        }

        if (active) {
          setBookings(response.data);
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load bookings."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadBookings();

    return () => {
      active = false;
    };
  }, [reloadKey]);

  const branches = Array.from(
    new Map(
      bookings.flatMap((booking) =>
        booking.bookingRooms.map(({ room }) => [
          room.branch.id,
          room.branch,
        ] as const)
      )
    ).values()
  ).sort((a, b) => a.name.localeCompare(b.name));

  const filteredBookings = bookings.filter((booking) => {
    const matchesBranch =
      branchFilter === "all" ||
      booking.bookingRooms.some(
        ({ room }) => room.branch.id === branchFilter
      );

    const matchesStatus =
      statusFilter === "all" ||
      booking.status === statusFilter;

    return matchesBranch && matchesStatus;
  });

  const statistics = [
    { label: "Total Bookings", value: bookings.length },
    {
      label: "Pending",
      value: bookings.filter((b) => b.status === "PENDING").length,
    },
    {
      label: "Confirmed",
      value: bookings.filter((b) => b.status === "CONFIRMED").length,
    },
    {
      label: "Cancelled",
      value: bookings.filter((b) => b.status === "CANCELLED").length,
    },
  ];

  
async function handleBookingAction() {
  if (!pendingAction || actionSaving) {
    return;
  }

  const { booking, action } = pendingAction;

  setActionSaving(true);
  setError("");
  setSuccess("");

  try {
    const endpoint =
      action === "approve"
        ? `/admin/bookings/${booking.id}/approve`
        : `/admin/bookings/${booking.id}/cancel`;

    const response = await apiRequest<BookingActionResponse>(
      endpoint,
      {
        method: "PATCH",
      }
    );

    if (!response.success) {
      throw new Error(
        response.message || `Unable to ${action} booking.`
      );
    }

    setSuccess(
      response.message ||
        `Booking ${action === "approve" ? "approved" : "cancelled"} successfully.`
    );

    setPendingAction(null);
    setReloadKey((value) => value + 1);
  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : `Unable to ${action} booking.`
    );

    setPendingAction(null);
  } finally {
    setActionSaving(false);
  }
}


  function formatDate(value: string) {
    return new Date(value).toLocaleDateString("en-ZA", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  }

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <h1>Bookings</h1>
          <p>
            View and manage guest reservations across Velora
            hotel branches.
          </p>
        </div>
      </header>

      {success && (
            <p role="status" className={styles.success}>
                {success}
            </p>
        )}

      {loading && (
        <p role="status" className={styles.message}>
          Loading bookings...
        </p>
      )}

      {error && (
        <div role="alert" className={styles.error}>
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          <section
            className={styles.statistics}
            aria-label="Booking statistics"
          >
            {statistics.map((stat) => (
              <article key={stat.label} className={styles.statCard}>
                <span>{stat.label}</span>
                <strong>{stat.value}</strong>
              </article>
            ))}
          </section>

          <section className={styles.roomsSection}>
            <div className={styles.sectionHeader}>
              <h2>Booking Directory</h2>
              <span>{filteredBookings.length} bookings shown</span>
            </div>

            <div className={styles.filters}>
              <label>
                <span>Hotel Branch</span>
                <select
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
              </label>

              <label>
                <span>Booking Status</span>
                <select
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(event.target.value)
                  }
                >
                  <option value="all">All Statuses</option>
                  <option value="PENDING">Pending</option>
                  <option value="CONFIRMED">Confirmed</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </label>
            </div>

            {filteredBookings.length === 0 ? (
              <p className={styles.message}>
                No bookings found for the selected filters.
              </p>
            ) : (
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Guest</th>
                      <th>Branch</th>
                      <th>Room</th>
                      <th>Check-in</th>
                      <th>Check-out</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredBookings.map((booking) => (
                      <tr key={booking.id}>
                        <td>
                          {booking.user?.name || "Guest"}
                          <span className={styles.subText}>
                            {booking.user?.email || "No email available"}
                          </span>
                        </td>

                        <td>
                          {Array.from(
                            new Set(
                              booking.bookingRooms.map(
                                ({ room }) => room.branch.name
                              )
                            )
                          ).join(", ") || "Unavailable"}
                        </td>

                        <td>
                          {booking.bookingRooms
                            .map(
                              ({ room }) =>
                                `${room.roomNumber} (${room.roomType.name})`
                            )
                            .join(", ") || "Unallocated"}
                        </td>

                        <td>{formatDate(booking.checkIn)}</td>
                        <td>{formatDate(booking.checkOut)}</td>
                        <td>{booking.status}</td>
                        
                        <td>
                        <div className={styles.actionGroup}>
                            {booking.status === "PENDING" && (
                            <button
                                type="button"
                                className={styles.activateButton}
                                disabled={actionSaving}
                                onClick={() =>
                                setPendingAction({
                                    booking,
                                    action: "approve",
                                })
                                }
                            >
                                Approve
                            </button>
                            )}

                            {(booking.status === "PENDING" ||
                            booking.status === "CONFIRMED") && (
                            <button
                                type="button"
                                className={styles.deactivateButton}
                                disabled={actionSaving}
                                onClick={() =>
                                setPendingAction({
                                    booking,
                                    action: "cancel",
                                })
                                }
                            >
                                Cancel
                            </button>
                            )}

                            {booking.status !== "PENDING" &&
                            booking.status !== "CONFIRMED" && (
                                <span className={styles.subText}>
                                No actions
                                </span>
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

        {pendingAction && (
        <AdminConfirmModal
            title={
            pendingAction.action === "approve"
                ? "Approve Booking?"
                : "Cancel Booking?"
            }
            itemName={
            pendingAction.booking.user?.name ||
            `Booking ${pendingAction.booking.id.slice(0, 8)}`
            }
            description={
            pendingAction.action === "approve"
                ? "This reservation will be confirmed if its allocated rooms, room types, and hotel branch are active and all approval checks pass."
                : "This reservation will be cancelled and its allocated rooms may become available for other reservations."
            }
            notice={
            pendingAction.action === "approve"
                ? "Bookings with an active pending payment attempt cannot be manually approved."
                : "Cancellation does not automatically refund completed payments. Confirm the payment situation before proceeding."
            }
            confirmLabel={
            pendingAction.action === "approve"
                ? "Approve Booking"
                : "Cancel Booking"
            }
            loading={actionSaving}
            onConfirm={() => void handleBookingAction()}
            onCancel={() => {
            if (!actionSaving) {
                setPendingAction(null);
            }
            }}
        />
        )}
    </main>
  );
}
