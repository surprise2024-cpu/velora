
import { useEffect, useState } from "react";
import { apiRequest } from "../lib/api";
import styles from "./MyBookings.module.css";
import BookingPaymentHistory from "./BookingPaymentHistory";

type BookingStatus = "PENDING" | "CONFIRMED" | "CANCELLED";

type BookingRoom = {
  id: string;
  price: string | null;
  room: {
    roomNumber: string;
    branch: {
      id: string;
      name: string;
      city: string;
      address: string;
    };
    roomType: {
      id: string;
      name: string;
      basePrice: string;
      currency: string;
    };
  };
};

type Booking = {
  id: string;
  checkIn: string;
  checkOut: string;
  guestCount: number;
  status: BookingStatus;
  createdAt: string;
  bookingRooms: BookingRoom[];
};

type BookingsResponse = {
  success: boolean;
  data: Booking[];
};

function dateOnly(value: string): string {
  return value.slice(0, 10);
}

function calculateNights(checkIn: string, checkOut: string) {
  const start = Date.parse(`${dateOnly(checkIn)}T00:00:00Z`);
  const end = Date.parse(`${dateOnly(checkOut)}T00:00:00Z`);

  return Math.max(0, Math.round((end - start) / 86400000));
}

function formatDate(value: string) {
  const date = new Date(`${dateOnly(value)}T12:00:00Z`);

  return new Intl.DateTimeFormat("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency,
  }).format(amount);
}

function getBookingTotal(booking: Booking) {
  const nights = calculateNights(booking.checkIn, booking.checkOut);

  if (
    nights <= 0 ||
    booking.bookingRooms.length === 0 ||
    booking.bookingRooms.some((item) => item.price === null)
  ) {
    return null;
  }

  const nightlyTotal = booking.bookingRooms.reduce(
    (sum, item) => sum + Number(item.price),
    0
  );

  if (!Number.isFinite(nightlyTotal)) {
    return null;
  }

  return nightlyTotal * nights;
}

export default function MyBookings() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("ALL");

  useEffect(() => {
    let active = true;

    async function loadBookings() {
      try {
        const response = await apiRequest<BookingsResponse>(
          "/bookings/my"
        );

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
  }, []);

  const today = new Date().toLocaleDateString("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const upcoming = bookings.filter(
    (booking) =>
      booking.status !== "CANCELLED" &&
      dateOnly(booking.checkOut) > today
  );

  const completed = bookings.filter(
    (booking) =>
      booking.status !== "CANCELLED" &&
      dateOnly(booking.checkOut) <= today
  );

  const filteredBookings = bookings.filter((booking) => {
    if (filter === "ALL") return true;
    if (filter === "UPCOMING") return upcoming.includes(booking);
    if (filter === "PAST") return completed.includes(booking);
    return booking.status === filter;
  });

  if (loading) {
    return (
      <section className={styles.container}>
        <p role="status">Loading your reservations...</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className={styles.container}>
        <p className={styles.error} role="alert">{error}</p>
      </section>
    );
  }

  return (
    <section className={styles.container}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>YOUR RESERVATIONS</p>
          <h2>My Bookings</h2>
          <p>
            View your reservations across Velora hotel branches.
          </p>
        </div>
      </header>

      <div className={styles.stats}>
        <div className={styles.stat}>
          <span>Total Bookings</span>
          <strong>{bookings.length}</strong>
        </div>
        <div className={styles.stat}>
          <span>Upcoming / Active</span>
          <strong>{upcoming.length}</strong>
        </div>
        <div className={styles.stat}>
          <span>Past Stays</span>
          <strong>{completed.length}</strong>
        </div>
      </div>

      <div className={styles.filters}>
        {[
          ["ALL", "All"],
          ["UPCOMING", "Upcoming"],
          ["PAST", "Past"],
          ["PENDING", "Pending"],
          ["CONFIRMED", "Confirmed"],
          ["CANCELLED", "Cancelled"],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={
              filter === value
                ? styles.activeFilter
                : styles.filterButton
            }
            onClick={() => setFilter(value)}
            aria-pressed={filter === value}
          >
            {label}
          </button>
        ))}
      </div>

      {filteredBookings.length === 0 ? (
        <div className={styles.empty}>
          <h3>No bookings found</h3>
          <p>
            {bookings.length === 0
              ? "You haven't made any reservations yet."
              : "No reservations match this filter."}
          </p>
        </div>
      ) : (
        <div className={styles.bookingList}>
          {filteredBookings.map((booking) => {
            const firstRoom = booking.bookingRooms[0];
            const branch = firstRoom?.room.branch;
            const currency =
              firstRoom?.room.roomType.currency ?? "ZAR";

            const nights = calculateNights(
              booking.checkIn,
              booking.checkOut
            );

            const total = getBookingTotal(booking);

            return (
              <article
                key={booking.id}
                className={styles.bookingCard}
              >
                <div className={styles.cardTop}>
                  <div>
                    <h3>
                      {branch?.name ?? "Velora Reservation"}
                    </h3>
                    <p>{branch?.city ?? "Location unavailable"}</p>
                  </div>

                  <span
                    className={`${styles.status} ${
                      styles[booking.status.toLowerCase()]
                    }`}
                  >
                    {booking.status}
                  </span>
                </div>

                <div className={styles.details}>
                  <div>
                    <span>Check-in</span>
                    <strong>{formatDate(booking.checkIn)}</strong>
                  </div>

                  <div>
                    <span>Check-out</span>
                    <strong>{formatDate(booking.checkOut)}</strong>
                  </div>

                  <div>
                    <span>Guests</span>
                    <strong>{booking.guestCount}</strong>
                  </div>

                  <div>
                    <span>Nights</span>
                    <strong>{nights}</strong>
                  </div>
                </div>

                <div className={styles.rooms}>
                  <h4>Reserved Rooms</h4>
                  {booking.bookingRooms.map((item) => (
                    <p key={item.id}>
                      {item.room.roomType.name}
                      {" — "}
                      Room {item.room.roomNumber}
                    </p>
                  ))}
                </div>

                <div className={styles.cardBottom}>
                  <div>
                    <span>Reservation Total</span>
                    <strong>
                      {total === null
                        ? "Price unavailable"
                        : formatMoney(total, currency)}
                    </strong>
                  </div>

                  <details className={styles.bookingDetails}>
                    <summary>Booking ID</summary>
                    <code>{booking.id}</code>
                  </details>
                </div>

                <BookingPaymentHistory bookingId={booking.id} />
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
