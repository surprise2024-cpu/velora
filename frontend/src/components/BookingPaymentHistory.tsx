
import { useEffect, useState } from "react";
import { apiRequest } from "../lib/api";
import styles from "./BookingPaymentHistory.module.css";

type Payment = {
  id: string;
  reference: string;
  amount: string;
  currency: string;
  status: string;
  paidAt: string | null;
  createdAt: string;
};

type PaymentResponse = {
  success: boolean;
  data: Payment[];
};

type Props = {
  bookingId: string;
};

function formatAmount(amount: string, currency: string) {
  const numericAmount = Number(amount);

  if (!Number.isFinite(numericAmount)) {
    return "Amount unavailable";
  }

  try {
    return new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency,
    }).format(numericAmount);
  } catch {
    return `${currency} ${numericAmount.toFixed(2)}`;
  }
}

function formatDate(value: string | null) {
  if (!value) return "Not available";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return new Intl.DateTimeFormat("en-ZA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Johannesburg",
  }).format(date);
}

function getPaymentLabel(status: string) {
  switch (status) {
    case "COMPLETED":
      return "Payment Completed";
    case "PENDING":
      return "Payment Pending";
    case "FAILED":
      return "Payment Failed";
    case "CANCELLED":
      return "Payment Cancelled";
    default:
      return status;
  }
}

export default function BookingPaymentHistory({
  bookingId,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!expanded || loaded) return;

    let active = true;

    async function loadPayments() {
      setLoading(true);
      setError("");

      try {
        const response = await apiRequest<PaymentResponse>(
          `/payments/booking/${bookingId}`
        );

        if (!response.success || !Array.isArray(response.data)) {
          throw new Error("Unexpected payment history response.");
        }

        if (active) {
          setPayments(response.data);
          setLoaded(true);
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to retrieve payment history."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadPayments();

    return () => {
      active = false;
    };
  }, [bookingId, expanded, loaded, reloadKey]);

  const hasCompletedPayment = payments.some(
    (payment) => payment.status === "COMPLETED"
  );

  return (
    <section className={styles.container}>
      <button
        type="button"
        className={styles.toggleButton}
        onClick={() => setExpanded((previous) => !previous)}
        aria-expanded={expanded}
      >
        <span>Payment History</span>
        <span aria-hidden="true">
          {expanded ? "−" : "+"}
        </span>
      </button>

      {expanded && (
        <div className={styles.content}>
          {loading && (
            <p role="status">Loading payment history...</p>
          )}

          {error && (
            <div className={styles.error} role="alert">
              <p>{error}</p>
              <button
                type="button"
                onClick={() => setReloadKey((key) => key + 1)}
              >
                Try Again
              </button>
            </div>
          )}

          {!loading && !error && loaded && (
            <>
              {payments.length === 0 ? (
                <div className={styles.empty}>
                  <strong>No payment records</strong>
                  <p>
                    No payment attempts have been recorded
                    for this reservation.
                  </p>
                </div>
              ) : (
                <>
                  <div className={styles.summary}>
                    <span>Payment Overview</span>
                    <strong>
                      {hasCompletedPayment
                        ? "Completed payment recorded"
                        : "No completed payment recorded"}
                    </strong>
                    <small>
                      {payments.length} transaction
                      {payments.length === 1 ? "" : "s"} recorded
                    </small>
                  </div>

                  <div className={styles.paymentList}>
                    {payments.map((payment) => (
                      <article
                        key={payment.id}
                        className={styles.paymentCard}
                      >
                        <div className={styles.paymentHeader}>
                          <strong>
                            {formatAmount(
                              payment.amount,
                              payment.currency
                            )}
                          </strong>

                          <span
                            className={`${styles.status} ${
                              styles[
                                payment.status.toLowerCase()
                              ] ?? styles.unknown
                            }`}
                          >
                            {getPaymentLabel(payment.status)}
                          </span>
                        </div>

                        <dl className={styles.details}>
                          <div>
                            <dt>Provider</dt>
                            <dd>Paystack</dd>
                          </div>

                          <div>
                            <dt>Initiated</dt>
                            <dd>{formatDate(payment.createdAt)}</dd>
                          </div>

                          <div>
                            <dt>Paid At</dt>
                            <dd>{formatDate(payment.paidAt)}</dd>
                          </div>

                          <div>
                            <dt>Reference</dt>
                            <dd className={styles.reference}>
                              {payment.reference}
                            </dd>
                          </div>
                        </dl>
                      </article>
                    ))}
                  </div>
                </>
              )}

              <button
                type="button"
                className={styles.refreshButton}
                onClick={() => {
                  setLoaded(false);
                  setReloadKey((key) => key + 1);
                }}
              >
                Refresh Payment History
              </button>
            </>
          )}
        </div>
      )}
    </section>
  );
}
