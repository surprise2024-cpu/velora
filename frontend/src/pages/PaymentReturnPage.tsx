
import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { apiRequest } from "../lib/api";
import Navbar from "../components/Navbar";
import styles from "./PaymentReturnPage.module.css";
import {
  clearGuestBookingRecovery,
} from "../lib/bookingRecovery";


type VerifyResponse = {
  success: boolean;
  data: {
    reference: string;
    providerStatus: string;
    recordedStatus: string;
    requiresReview: boolean;
    amount: string;
    currency: string;
    paidAt: string | null;
  };
};

type PaymentResult = VerifyResponse["data"];

type PendingPayment = {
  bookingId?: string;
  reference?: string;
  checkoutType?: "customer" | "guest";
  guestToken?: string;
};

export default function PaymentReturnPage() {
  const [params] = useSearchParams();

  const referenceFromUrl =
    params.get("reference") ?? params.get("trxref");

  const [status, setStatus] = useState<
    "loading" | "success" | "pending" | "failed"
  >("loading");

  const [result, setResult] = useState<PaymentResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const verificationStarted = useRef(false);

  useEffect(() => {
    if (verificationStarted.current) return;
    verificationStarted.current = true;

    async function verifyPayment() {
      const saved = sessionStorage.getItem(
        "velora.pendingPayment"
      );

      let pending: PendingPayment | null = null;

      if (saved) {
        try {
          pending = JSON.parse(saved) as PendingPayment;
        } catch {
          pending = null;
        }
      }

      const reference =
        referenceFromUrl ?? pending?.reference;

      if (!reference) {
        setError("No payment reference was found.");
        setStatus("failed");
        return;
      }

      // Do not apply stored credentials to a different
      // payment reference supplied through the URL.
      if (
        pending?.reference &&
        pending.reference !== reference
      ) {
        setError(
          "This payment reference does not match the pending checkout."
        );
        setStatus("failed");
        return;
      }

      const isGuest = pending?.checkoutType === "guest";

      if (
        isGuest &&
        !/^[a-f0-9]{64}$/.test(pending?.guestToken ?? "")
      ) {
        setError(
          "Guest payment access is unavailable. Please do not pay again."
        );
        setStatus("pending");
        return;
      }

      const endpoint = isGuest
        ? `/payments/guest/${encodeURIComponent(reference)}/verify`
        : `/payments/${encodeURIComponent(reference)}/verify`;

      try {
        const response = await apiRequest<VerifyResponse>(
          endpoint,
          {
            method: "POST",
            headers: isGuest
              ? {
                  Authorization: `Bearer ${pending!.guestToken}`,
                }
              : undefined,
          }
        );

        if (!response.success || !response.data) {
          throw new Error("Payment verification failed.");
        }

        setResult(response.data);

        if (
          response.data.providerStatus === "success" &&
          response.data.recordedStatus === "COMPLETED" &&
          !response.data.requiresReview
        ) {
          sessionStorage.removeItem(
            "velora.pendingPayment"
          );
          clearGuestBookingRecovery();
          setStatus("success");
        } else if (
          response.data.requiresReview ||
          response.data.recordedStatus === "PENDING"
        ) {
          setStatus("pending");
        } else {
          setStatus("failed");
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to verify payment."
        );
        setStatus("pending");
      }
    }

    void verifyPayment();
  }, [referenceFromUrl]);

  return (
    <div className={styles.page}>
      <Navbar />

      <main className={styles.container}>
        <section className={styles.card}>
          {status === "loading" && (
            <>
              <h1>Verifying Your Payment</h1>
              <p role="status">
                Please wait while we confirm your payment
                with Paystack.
              </p>
            </>
          )}

          {status === "success" && (
            <>
              <h1>Payment Successful!</h1>
              <p>
                Your payment has been verified and recorded
                successfully.
              </p>
            </>
          )}

          {status === "pending" && (
            <>
              <h1>Payment Verification Pending</h1>
              <p>
                We could not confirm the final payment result
                on this page. Please do not start another
                payment until the status is resolved.
              </p>
            </>
          )}

          {status === "failed" && (
            <>
              <h1>Payment Not Confirmed</h1>
              <p>
                We could not confirm a successful payment.
                This does not necessarily mean that you
                were charged or that the payment failed.
              </p>
            </>
          )}

          {result && (
            <div className={styles.details}>
              <p>
                <span>Reference</span>
                <strong>{result.reference}</strong>
              </p>

              <p>
                <span>Provider status</span>
                <strong>{result.providerStatus}</strong>
              </p>

              <p>
                <span>Recorded status</span>
                <strong>{result.recordedStatus}</strong>
              </p>

              <p>
                <span>Amount</span>
                <strong>
                  {new Intl.NumberFormat("en-ZA", {
                    style: "currency",
                    currency: result.currency,
                  }).format(Number(result.amount))}
                </strong>
              </p>
            </div>
          )}

          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}

          <Link to="/" className={styles.homeLink}>
            Return to Hotels
          </Link>
        </section>
      </main>
    </div>
  );
}
