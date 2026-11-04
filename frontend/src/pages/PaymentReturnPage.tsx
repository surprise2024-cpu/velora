
import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { apiRequest } from "../lib/api";
import Navbar from "../components/Navbar";
import styles from "./PaymentReturnPage.module.css";

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
      let reference = referenceFromUrl;

      const saved = sessionStorage.getItem(
        "velora.pendingPayment"
      );

      if (!reference && saved) {
        try {
          const pending = JSON.parse(saved) as {
            reference?: string;
          };

          reference = pending.reference ?? null;
        } catch {
          reference = null;
        }
      }

      if (!reference) {
        setError("No payment reference was found.");
        setStatus("failed");
        return;
      }

      try {
        const response = await apiRequest<VerifyResponse>(
          `/payments/${encodeURIComponent(reference)}/verify`,
          { method: "POST" }
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
          sessionStorage.removeItem("velora.pendingPayment");
          setStatus("success");
        } else if (
          response.data.requiresReview ||
          response.data.recordedStatus === "PENDING"
        ) {
          setStatus("pending");
        } else {
          sessionStorage.removeItem("velora.pendingPayment");
          setStatus("failed");
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to verify payment."
        );
        setStatus("failed");
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
              <h1>Payment Not Yet Confirmed</h1>
              <p>
                Your payment is pending or requires further
                review. Please do not start another payment
                until its status is resolved.
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
