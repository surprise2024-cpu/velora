
import { useEffect, useState } from "react";
import { apiRequest } from "../../lib/api";
import styles from "./AdminDashboardPage.module.css";

type BookingStatus = "PENDING" | "CONFIRMED" | "CANCELLED";

type AdminBooking = {
  id: string;
  status: BookingStatus;
  checkIn: string;
  checkOut: string;
  guestCount: number;
  createdAt: string;
  guestName?: string | null;
  guestEmail?: string | null;
  user: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  bookingRooms: {
    room: {
      branch: {
        id: string;
        name: string;
        city: string;
      };
    };
  }[];
};

type AdminBookingsResponse = {
  success: boolean;
  data: AdminBooking[];
};

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unavailable";
  }

  return new Intl.DateTimeFormat("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function getGuestName(booking: AdminBooking) {
  return (
    booking.user?.name?.trim() ||
    booking.guestName?.trim() ||
    booking.user?.email ||
    booking.guestEmail ||
    "Guest"
  );
}

export default function AdminDashboardPage() {
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadBookings() {
      setLoading(true);
      setError("");

      try {
        const response = await apiRequest<AdminBookingsResponse>(
          "/admin/bookings"
        );

        if (!response.success || !Array.isArray(response.data)) {
          throw new Error("Unexpected reservation response.");
        }

        if (active) {
          setBookings(response.data);
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load reservations."
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

  const confirmed = bookings.filter(
    (booking) => booking.status === "CONFIRMED"
  ).length;

  const pending = bookings.filter(
    (booking) => booking.status === "PENDING"
  ).length;

  const cancelled = bookings.filter(
    (booking) => booking.status === "CANCELLED"
  ).length;

  const statistics = [
    { label: "Total Reservations", value: bookings.length },
    { label: "Confirmed", value: confirmed },
    { label: "Pending", value: pending },
    { label: "Cancelled", value: cancelled },
  ];

  return (
    <main className={styles.dashboard}>
      <header className={styles.pageHeader}>
        <div>
          <h1>Dashboard</h1>
          <p>Overview of reservations across Velora hotels.</p>
        </div>

        <span className={styles.pageLabel}>
          Administration
        </span>
      </header>

      {loading && (
        <p role="status" className={styles.message}>
          Loading dashboard...
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
            aria-label="Reservation statistics"
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

          <section className={styles.reservations}>
            <div className={styles.sectionHeader}>
              <h2>Recent Reservations</h2>
              <span>Latest 10 bookings</span>
            </div>

            {bookings.length === 0 ? (
              <p className={styles.empty}>
                No reservations found.
              </p>
            ) : (
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col">Guest</th>
                      <th scope="col">Branch</th>
                      <th scope="col">Check-in</th>
                      <th scope="col">Check-out</th>
                      <th scope="col">Status</th>
                    </tr>
                  </thead>

                  <tbody>
                    {bookings.slice(0, 10).map((booking) => (
                      <tr key={booking.id}>
                        <td>{getGuestName(booking)}</td>

                        <td>
                          {booking.bookingRooms[0]?.room.branch
                            .name ?? "Unavailable"}
                        </td>

                        <td>{formatDate(booking.checkIn)}</td>
                        <td>{formatDate(booking.checkOut)}</td>

                        <td>
                          <span
                            className={`${styles.status} ${
                              styles[
                                booking.status.toLowerCase()
                              ]
                            }`}
                          >
                            {booking.status}
                          </span>
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
    </main>
  );
}
