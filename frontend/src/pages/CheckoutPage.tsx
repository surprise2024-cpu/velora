import {
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Link } from "react-router-dom";
import {
  CalendarDays,
  UserRound,
} from "lucide-react";
import Navbar from "../components/Navbar";
import { useAuth } from "../context/useAuth";
import { apiRequest } from "../lib/api";
import {
  loadCheckoutSelection,
  type CheckoutSelection,
} from "../lib/checkoutSelection";
import {
  saveGuestBookingRecovery,
} from "../lib/bookingRecovery";
import styles from "./CheckoutPage.module.css";
type BookingResponse = {
  success: boolean;
  data: {
    id: string;
    status: string;
    guestAccessToken?: string | null;
  };
};
type PaymentResponse = {
  success: boolean;
  data: {
    paymentId: string;
    reference: string;
    authorizationUrl: string;
    amount: number;
    currency: string;
  };
};
type CheckoutAttempt = {
  fingerprint: string;
  idempotencyKey: string;
  checkoutSecret: string;
  bookingId?: string;
  guestToken?: string;
};
const ATTEMPT_KEY = "velora.checkoutAttempt";
const PENDING_PAYMENT_KEY = "velora.pendingPayment";
function formatDate(value: string): string {
  const date = new Date(`${value}T00:00:00Z`);
  return new Intl.DateTimeFormat("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}
function formatPrice(
  value: number,
  currency: string
): string {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency,
  }).format(value);
}
function createSecret(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}
function loadAttempt(): CheckoutAttempt | null {
  try {
    const raw = sessionStorage.getItem(ATTEMPT_KEY);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") {
      return null;
    }
    const attempt = value as CheckoutAttempt;
    if (
      typeof attempt.fingerprint !== "string" ||
      !attempt.fingerprint ||
      typeof attempt.idempotencyKey !== "string" ||
      !/^[0-9a-f-]{36}$/i.test(
        attempt.idempotencyKey
      ) ||
      typeof attempt.checkoutSecret !== "string" ||
      !/^[a-f0-9]{64}$/.test(
        attempt.checkoutSecret
      )
    ) {
      return null;
    }
    return attempt;
  } catch {
    return null;
  }
}
function saveAttempt(
  attempt: CheckoutAttempt
): void {
  sessionStorage.setItem(
    ATTEMPT_KEY,
    JSON.stringify(attempt)
  );
}
function createFingerprint(
  selection: CheckoutSelection,
  identity: string,
  guestName: string,
  guestEmail: string,
  guestPhone: string
): string {
  return JSON.stringify({
    branchId: selection.branchId,
    roomTypeId: selection.roomTypeId,
    checkIn: selection.checkIn,
    checkOut: selection.checkOut,
    guestCount: selection.guestCount,
    identity,
    guestName,
    guestEmail,
    guestPhone,
  });
}
function getCheckoutAttempt(
  fingerprint: string
): CheckoutAttempt {
  const existing = loadAttempt();
  if (existing) {
    if (existing.fingerprint !== fingerprint) {
      throw new Error(
        "Another checkout attempt is already in progress. Please finish or resolve that reservation before changing the booking details."
      );
    }
    return existing;
  }
  const attempt: CheckoutAttempt = {
    fingerprint,
    idempotencyKey: crypto.randomUUID(),
    checkoutSecret: createSecret(),
  };
  saveAttempt(attempt);
  return attempt;
}
function validatePaystackUrl(
  value: string
): string {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.hostname !== "checkout.paystack.com" ||
    url.username ||
    url.password
  ) {
    throw new Error(
      "The payment provider returned an invalid checkout URL."
    );
  }
  return url.toString();
}
export default function CheckoutPage() {
  const [selection] = useState(
    () => loadCheckoutSelection()
  );
  const { user, loading: authLoading } = useAuth();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [specialRequests, setSpecialRequests] =
    useState("");
  const [acceptedTerms, setAcceptedTerms] =
    useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const submittingRef = useRef(false);
  const [profileAppliedFor, setProfileAppliedFor] =
    useState<string | null>(null);

  // Apply the asynchronously loaded profile during render, not in an effect.
  // Only run when the authenticated account changes, so manual edits remain.
  if (user && profileAppliedFor !== user.id) {
    const parts = (user.name ?? "").trim().split(/\s+/);
    setFirstName(parts[0] ?? "");
    setLastName(parts.slice(1).join(" "));
    setEmail(user.email ?? "");
    setProfileAppliedFor(user.id);
  } else if (!user && !authLoading && profileAppliedFor !== null) {
    // Avoid showing the previous account's personal details after sign-out.
    setFirstName("");
    setLastName("");
    setEmail("");
    setProfileAppliedFor(null);
  }
  useLayoutEffect(() => {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "instant",
    });
  }, []);
  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    if (
      !selection ||
      submittingRef.current ||
      authLoading
    ) {
      return;
    }
    if (user?.role === "ADMIN") {
      setError(
        "Administrator accounts cannot create customer reservations."
      );
      return;
    }
    const guestName =
      `${firstName.trim()} ${lastName.trim()}`.trim();
    const guestEmail = email.trim().toLowerCase();
    const guestPhone = phone.trim();
    if (
      !firstName.trim() ||
      !lastName.trim() ||
      guestName.length < 2 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        guestEmail
      ) ||
      guestPhone.length < 7 ||
      !acceptedTerms
    ) {
      setError(
        "Please complete all required guest details."
      );
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    setError("");
    try {
      const isGuest = user === null;
      const fingerprint = createFingerprint(
        selection,
        isGuest ? "guest" : user.id,
        isGuest ? guestName : "",
        isGuest ? guestEmail : "",
        isGuest ? guestPhone : ""
      );
      const attempt =
        getCheckoutAttempt(fingerprint);
      let bookingId = attempt.bookingId;
      let guestToken = attempt.guestToken;
      if (!bookingId) {
        const endpoint = isGuest
          ? "/bookings/guest"
          : "/bookings";
        const payload = {
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
          checkout: {
            idempotencyKey:
              attempt.idempotencyKey,
            checkoutSecret:
              attempt.checkoutSecret,
          },
          ...(isGuest
            ? {
                guestName,
                guestEmail,
                guestPhone,
              }
            : {}),
        };
        const response =
          await apiRequest<BookingResponse>(
            endpoint,
            {
              method: "POST",
              body: JSON.stringify(payload),
            }
          );
        if (!response.data?.id) {
          throw new Error(
            "The booking response was incomplete. Please retry using the same checkout."
          );
        }
        bookingId = response.data.id;
        if (isGuest) {
          const returnedToken =
            response.data.guestAccessToken;
          if (
            typeof returnedToken !== "string" ||
            !/^[a-f0-9]{64}$/.test(
              returnedToken
            )
          ) {
            throw new Error(
              "The reservation was created, but guest payment access could not be confirmed. Do not start a new reservation."
            );
          }
          guestToken = returnedToken;
        }
        attempt.bookingId = bookingId;
        attempt.guestToken = guestToken;
        saveAttempt(attempt);
      }
      if (
        isGuest &&
        (!guestToken ||
          !/^[a-f0-9]{64}$/.test(guestToken))
      ) {
        throw new Error(
          "Guest booking access is unavailable. Please do not create another reservation."
        );
      }
      if (isGuest && guestToken) {
        saveGuestBookingRecovery({
          bookingId,
          guestToken,
          selection,
        });
      }
      const pendingRaw = sessionStorage.getItem(
        PENDING_PAYMENT_KEY
      );
      if (pendingRaw) {
        try {
          const pending = JSON.parse(
            pendingRaw
          ) as {
            bookingId?: string;
            reference?: string;
          };
          if (
            pending.bookingId === bookingId &&
            pending.reference
          ) {
            throw new Error(
              "Payment was already initialized for this reservation. Please check its payment status before starting another payment."
            );
          }
        } catch (pendingError) {
          if (pendingError instanceof Error &&
              pendingError.message.startsWith(
                "Payment was already initialized"
              )) {
            throw pendingError;
          }
        }
      }
      const paymentEndpoint = isGuest
        ? "/payments/guest/initialize"
        : "/payments/initialize";
      const paymentResponse =
        await apiRequest<PaymentResponse>(
          paymentEndpoint,
          {
            method: "POST",
            headers:
              isGuest && guestToken
                ? {
                    Authorization:
                      `Bearer ${guestToken}`,
                  }
                : undefined,
            body: JSON.stringify({
              bookingId,
            }),
          }
        );
      const payment = paymentResponse.data;
      if (
        !payment?.reference ||
        !payment.authorizationUrl
      ) {
        throw new Error(
          "Payment initialization returned incomplete details."
        );
      }
      const authorizationUrl =
        validatePaystackUrl(
          payment.authorizationUrl
        );
      sessionStorage.setItem(
        PENDING_PAYMENT_KEY,
        JSON.stringify({
          bookingId,
          reference: payment.reference,
          checkoutType: isGuest
            ? "guest"
            : "customer",
          ...(isGuest && guestToken
            ? { guestToken }
            : {}),
        })
      );
      window.location.assign(authorizationUrl);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to continue to payment. Please try again."
      );
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }
  if (!selection) {
    return (
      <>
        <Navbar />
        <main className={styles.page}>
          <div className={styles.emptyState}>
            <h1>No room selected</h1>
            <p>
              Please choose a hotel and select an
              available room before continuing to checkout.
            </p>
            <Link
              to="/#hotels"
              className={styles.backButton}
            >
              Browse Hotels
            </Link>
          </div>
        </main>
      </>
    );
  }
  const total =
    selection.nightlyPrice * selection.nights;
  return (
    <>
      <Navbar />
      <main className={styles.page}>
        <div className={styles.container}>
          <Link
            to={`/hotels/${selection.branchId}`}
            className={styles.backLink}
          >
            Back to room selection
          </Link>
          <div className={styles.heading}>
            <h1>Complete Your Booking</h1>
            <p>
              Review your reservation and enter your details
              to continue securely to Paystack.
            </p>
          </div>
          <div className={styles.checkoutGrid}>
            <section className={styles.guestPanel}>
              <div className={styles.panelHeading}>
                <UserRound
                  size={21}
                  aria-hidden="true"
                />
                <h2>Guest Information</h2>
              </div>
              <p className={styles.panelDescription}>
                Please enter your details as they
                appear on your identification document.
              </p>
              <form
                id="velora-checkout-form"
                className={styles.guestForm}
                onSubmit={handleSubmit}
              >
                <div className={styles.nameGrid}>
                  <div className={styles.field}>
                    <label htmlFor="checkout-first-name">
                      First Name
                    </label>
                    <input
                      id="checkout-first-name"
                      type="text"
                      autoComplete="given-name"
                      placeholder="Enter first name"
                      maxLength={60}
                      required
                      value={firstName}
                      onChange={(event) =>
                        setFirstName(event.target.value)
                      }
                    />
                  </div>
                  <div className={styles.field}>
                    <label htmlFor="checkout-last-name">
                      Last Name
                    </label>
                    <input
                      id="checkout-last-name"
                      type="text"
                      autoComplete="family-name"
                      placeholder="Enter last name"
                      maxLength={60}
                      required
                      value={lastName}
                      onChange={(event) =>
                        setLastName(event.target.value)
                      }
                    />
                  </div>
                </div>
                <div className={styles.field}>
                  <label htmlFor="checkout-email">
                    Email Address
                  </label>
                  <input
                    id="checkout-email"
                    type="email"
                    autoComplete="email"
                    placeholder="name@example.com"
                    maxLength={254}
                    required
                    value={email}
                    onChange={(event) =>
                      setEmail(event.target.value)
                    }
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor="checkout-phone">
                    Phone Number
                  </label>
                  <input
                    id="checkout-phone"
                    type="tel"
                    autoComplete="tel"
                    placeholder="+27 00 000 0000"
                    maxLength={30}
                    required
                    value={phone}
                    onChange={(event) =>
                      setPhone(event.target.value)
                    }
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor="checkout-requests">
                    Special Requests
                    <span className={styles.optional}>
                      (Optional)
                    </span>
                  </label>
                  <textarea
                    id="checkout-requests"
                    placeholder="Any special requests for your stay?"
                    rows={4}
                    maxLength={1000}
                    value={specialRequests}
                    onChange={(event) =>
                      setSpecialRequests(
                        event.target.value
                      )
                    }
                  />
                  <p className={styles.paymentNotice}>
                    Special requests are not yet
                    submitted to the hotel.
                  </p>
                </div>
                <label className={styles.terms}>
                  <input
                    type="checkbox"
                    checked={acceptedTerms}
                    required
                    onChange={(event) =>
                      setAcceptedTerms(
                        event.target.checked
                      )
                    }
                  />
                  <span>
                    I agree to the Terms and Conditions
                    and Privacy Policy.
                  </span>
                </label>
              </form>
            </section>
            <aside className={styles.summaryPanel}>
              <div className={styles.summaryHeading}>
                <CalendarDays
                  size={21}
                  aria-hidden="true"
                />
                <h2>Reservation Summary</h2>
              </div>
              <div className={styles.summaryBody}>
                <h3>{selection.branchName}</h3>
                <p className={styles.roomName}>
                  {selection.roomName} ·{" "}
                  {selection.guestCount}{" "}
                  {selection.guestCount === 1
                    ? "guest"
                    : "guests"}
                </p>
                <div
                  className={
                    styles.roomImageContainer
                  }
                >
                  {selection.roomImage ? (
                    <img
                      src={selection.roomImage}
                      alt={`${selection.roomName} at ${selection.branchName}`}
                      className={styles.roomImage}
                    />
                  ) : (
                    <div
                      className={
                        styles.imagePlaceholder
                      }
                    >
                      <span>VELORA HOTELS</span>
                      <p>
                        Room photography coming soon
                      </p>
                    </div>
                  )}
                </div>
                <div className={styles.dateGrid}>
                  <div>
                    <span>Check-in</span>
                    <strong>
                      {formatDate(
                        selection.checkIn
                      )}
                    </strong>
                  </div>
                  <div>
                    <span>Check-out</span>
                    <strong>
                      {formatDate(
                        selection.checkOut
                      )}
                    </strong>
                  </div>
                </div>
                <div className={styles.stayDetails}>
                  <span>
                    1 room · {selection.nights}{" "}
                    {selection.nights === 1
                      ? "night"
                      : "nights"}
                  </span>
                  <span>
                    {selection.guestCount}{" "}
                    {selection.guestCount === 1
                      ? "guest"
                      : "guests"}
                  </span>
                </div>
                <div className={styles.priceDetails}>
                  <div className={styles.priceRow}>
                    <span>
                      {formatPrice(
                        selection.nightlyPrice,
                        selection.currency
                      )}{" "}
                      × {selection.nights}{" "}
                      {selection.nights === 1
                        ? "night"
                        : "nights"}
                    </span>
                    <strong>
                      {formatPrice(
                        total,
                        selection.currency
                      )}
                    </strong>
                  </div>
                  <div className={styles.totalRow}>
                    <strong>
                      Estimated Subtotal
                    </strong>
                    <strong>
                      {formatPrice(
                        total,
                        selection.currency
                      )}
                    </strong>
                  </div>
                </div>
                <button
                  type="submit"
                  form="velora-checkout-form"
                  className={styles.continueButton}
                  disabled={
                    submitting ||
                    authLoading ||
                    user?.role === "ADMIN"
                  }
                >
                  {submitting
                    ? "Preparing Payment..."
                    : "Continue to Payment"}
                </button>
                {error && (
                    <p
                        className={styles.paymentNotice}
                        role="alert"
                        style={{
                        color: "#dc2626",
                        fontWeight: 600,
                        }}
                    >
                        {error}
                    </p>
                )}
                <p className={styles.paymentNotice}>
                  Secure payment powered by Paystack.
                  Your reservation is confirmed only
                  after successful payment verification.
                </p>
              </div>
            </aside>
          </div>
        </div>
      </main>
    </>
  );
}
