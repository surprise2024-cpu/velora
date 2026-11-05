
import { useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../lib/api";
import { useAuth } from "../context/useAuth";
import styles from "./BookingConfirmation.module.css";
import PaymentButton from "./PaymentButton";


export type BookingSelection = {
  branchId: string;
  branchName: string;
  roomTypeId: string;
  roomName: string;
  checkIn: string;
  checkOut: string;
  guestCount: number;
  nightlyPrice: number;
  currency: string;
  nights: number;
};

type BookingResponse = {
  success: boolean;
  data: {
    id: string;
    status: string;
  };
};

type Props = {
  selection: BookingSelection;
  onCancel: () => void;
};

export default function BookingConfirmation({
  selection,
  onCancel,
}: Props) {
  const { user } = useAuth();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bookingId, setBookingId] = useState<string | null>(null);

  const estimatedTotal =
    selection.nightlyPrice * selection.nights;

  const formattedTotal = new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: selection.currency,
  }).format(estimatedTotal);

  async function confirmBooking() {
    if (submitting || bookingId) return;

    setSubmitting(true);
    setError(null);

    try {
      const response = await apiRequest<BookingResponse>(
        "/bookings",
        {
          method: "POST",
          body: JSON.stringify({
            branchId: selection.branchId,
            checkIn: selection.checkIn,
            checkOut: selection.checkOut,
            guestCount: selection.guestCount,
            rooms: [
              {
                roomTypeId: selection.roomTypeId,
                quantity: 1,
              },
            ],
          }),
        }
      );

      if (!response.success || !response.data?.id) {
        throw new Error("Booking creation failed.");
      }

      setBookingId(response.data.id);

    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to create your booking."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (bookingId) {
    return (
      <section className={styles.panel} role="status">
        <h3>Reservation Created</h3>

        <p>
          Your reservation has been created successfully.
        </p>

        <p>
          <strong>Booking reference:</strong>{" "}
          <code>{bookingId}</code>
        </p>

        <p className={styles.notice}>
          Your reservation is not yet paid. Payment
          confirmation will be handled separately.
        </p>

        <PaymentButton bookingId={bookingId} />

        <Link to="/account" className={styles.accountLink}>
          Go to My Account
        </Link>
      </section>
    );
  }

  return (
    <section className={styles.panel}>
      <h3>Review Your Reservation</h3>

      <div className={styles.details}>
        <p>
          <span>Hotel</span>
          <strong>{selection.branchName}</strong>
        </p>

        <p>
          <span>Room</span>
          <strong>{selection.roomName}</strong>
        </p>

        <p>
          <span>Check-in</span>
          <strong>{selection.checkIn}</strong>
        </p>

        <p>
          <span>Check-out</span>
          <strong>{selection.checkOut}</strong>
        </p>

        <p>
          <span>Guests</span>
          <strong>{selection.guestCount}</strong>
        </p>

        <p>
          <span>Rooms</span>
          <strong>1</strong>
        </p>

        <p>
          <span>Nights</span>
          <strong>{selection.nights}</strong>
        </p>

        <p className={styles.total}>
          <span>Estimated total</span>
          <strong>{formattedTotal}</strong>
        </p>
      </div>

      
      {!user && (
        <p className={styles.notice}>
          You're exploring Velora as a guest. Your room selection
          is ready, but you'll need to sign in with Google to
          complete your reservation.{" "}
          <Link to="/login">Continue to Sign In</Link>
        </p>
      )}


      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <div className={styles.actions}>
        <button
          type="button"
          onClick={onCancel}
          className={styles.cancelButton}
          disabled={submitting}
        >
          Back to Rooms
        </button>

        <button
          type="button"
          onClick={() => void confirmBooking()}
          className={styles.confirmButton}
          disabled={!user || submitting}
        >
          {submitting
            ? "Creating Reservation..."
            : "Confirm Reservation"}
        </button>
      </div>
    </section>
  );
}
