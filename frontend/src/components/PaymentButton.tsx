
import { useState } from "react";
import { apiRequest } from "../lib/api";
import styles from "./PaymentButton.module.css";

type InitializeResponse = {
  success: boolean;
  data: {
    paymentId: string;
    reference: string;
    authorizationUrl: string;
    amount: string;
    currency: string;
  };
};

type Props = {
  bookingId: string;
};

export default function PaymentButton({ bookingId }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePayment() {
    if (loading) return;

    setLoading(true);
    setError(null);

    try {
      const response = await apiRequest<InitializeResponse>(
        "/payments/initialize",
        {
          method: "POST",
          body: JSON.stringify({ bookingId }),
        }
      );

      if (
        !response.success ||
        !response.data?.reference ||
        !response.data?.authorizationUrl
      ) {
        throw new Error("Unable to initialize payment.");
      }

      const checkoutUrl = new URL(response.data.authorizationUrl);

      if (
        checkoutUrl.protocol !== "https:" ||
        checkoutUrl.hostname !== "checkout.paystack.com"
      ) {
        throw new Error("Unexpected payment checkout URL.");
      }

      // Keep the reference for recovery after redirect.
      sessionStorage.setItem(
        "velora.pendingPayment",
        JSON.stringify({
          bookingId,
          reference: response.data.reference,
        })
      );

      window.location.assign(checkoutUrl.toString());
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to start payment."
      );
      setLoading(false);
    }
  }

  return (
    <div className={styles.container}>
      <button
        type="button"
        className={styles.button}
        onClick={() => void handlePayment()}
        disabled={loading}
      >
        {loading ? "Preparing Checkout..." : "Pay Now"}
      </button>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
