
import { useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../lib/api";
import { useAuth } from "../context/useAuth";
import styles from "./BookingConfirmation.module.css";
import PaymentButton from "./PaymentButton";
import {
  loadGuestBookingRecovery,
  saveGuestBookingRecovery,
} from "../lib/bookingRecovery";

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
    guestAccessToken?: string;
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

  const [bookingId, setBookingId] =
  useState<string | null>(() => {
    const recovery = loadGuestBookingRecovery();

    if (
      recovery &&
      recovery.selection.branchId === selection.branchId &&
      recovery.selection.roomTypeId === selection.roomTypeId &&
      recovery.selection.checkIn === selection.checkIn &&
      recovery.selection.checkOut === selection.checkOut &&
      recovery.selection.guestCount === selection.guestCount
    ) {
      return recovery.bookingId;
    }

    return null;
  });

const [guestToken, setGuestToken] =
  useState<string | null>(() => {
    const recovery = loadGuestBookingRecovery();

    if (
      recovery &&
      recovery.selection.branchId === selection.branchId &&
      recovery.selection.roomTypeId === selection.roomTypeId &&
      recovery.selection.checkIn === selection.checkIn &&
      recovery.selection.checkOut === selection.checkOut &&
      recovery.selection.guestCount === selection.guestCount
    ) {
      return recovery.guestToken;
    }

    return null;
  });

  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");

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
      const isGuest = !user;

      if (isGuest) {
        if (guestName.trim().length < 2) {
          throw new Error("Please enter your full name.");
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail.trim())) {
          throw new Error("Please enter a valid email address.");
        }

        if (guestPhone.trim().length < 7) {
          throw new Error("Please enter a valid phone number.");
        }
      }

      const endpoint = isGuest
        ? "/bookings/guest"
        : "/bookings";

      const bookingPayload = {
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
        ...(isGuest
          ? {
              guestName: guestName.trim(),
              guestEmail: guestEmail.trim(),
              guestPhone: guestPhone.trim(),
            }
          : {}),
      };

      const response = await apiRequest<BookingResponse>(
        endpoint,
        {
          method: "POST",
          body: JSON.stringify(bookingPayload),
        }
      );

      if (!response.success || !response.data?.id) {
        throw new Error("Booking creation failed.");
      }

      if (isGuest) {
        const token = response.data.guestAccessToken;

        if (!token || !/^[a-f0-9]{64}$/.test(token)) {
          throw new Error(
            "Guest booking was created, but secure payment access is unavailable. Do not create another booking."
          );
        }

        saveGuestBookingRecovery({
          bookingId: response.data.id,
          guestToken: token,
          selection,
        });

        setGuestToken(token);
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
          Your reservation is awaiting payment.
          Complete checkout to confirm your booking.
        </p>

        <PaymentButton
          bookingId={bookingId}
          guestToken={guestToken ?? undefined}
        />

        {user && (
          <Link
            to="/account"
            className={styles.accountLink}
          >
            Go to My Account
          </Link>
        )}
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
        <div className={styles.details}>
          <h4>Guest Contact Details</h4>

          <p className={styles.notice}>
            No account required. Enter your contact
            information to continue as a guest.
          </p>

          <label htmlFor="guest-name">
            Full name
          </label>
          <input
            id="guest-name"
            type="text"
            autoComplete="name"
            value={guestName}
            onChange={(event) =>
              setGuestName(event.target.value)
            }
            maxLength={120}
            required
          />

          <label htmlFor="guest-email">
            Email address
          </label>
          <input
            id="guest-email"
            type="email"
            autoComplete="email"
            value={guestEmail}
            onChange={(event) =>
              setGuestEmail(event.target.value)
            }
            maxLength={254}
            required
          />

          <label htmlFor="guest-phone">
            Phone number
          </label>
          <input
            id="guest-phone"
            type="tel"
            autoComplete="tel"
            value={guestPhone}
            onChange={(event) =>
              setGuestPhone(event.target.value)
            }
            maxLength={30}
            required
          />
        </div>
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
          disabled={submitting}
        >
          {submitting
            ? "Creating Reservation..."
            : "Confirm Reservation"}
        </button>
      </div>
    </section>
  );
}
