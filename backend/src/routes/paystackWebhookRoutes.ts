
import { createHmac, timingSafeEqual } from "node:crypto";
import { Router } from "express";
import {
  reconcilePaystackWebhookPayment,
} from "../services/paymentVerificationService.js";

const router = Router();

type PaystackEvent = {
  event: string;
  data: {
    reference?: string;
  };
};

router.post("/", async (req, res) => {
  const secret = process.env.PAYSTACK_SECRET_KEY;

  if (!secret) {
    console.error("PAYSTACK_SECRET_KEY is not configured");
    return res.sendStatus(503);
  }

  if (!Buffer.isBuffer(req.body)) {
    return res.sendStatus(400);
  }

  const signature = req.header("x-paystack-signature");

  if (!signature || !/^[a-f0-9]{128}$/i.test(signature)) {
    return res.sendStatus(401);
  }

  const expected = createHmac("sha512", secret)
    .update(req.body)
    .digest();

  const supplied = Buffer.from(signature, "hex");

  if (
    supplied.length !== expected.length ||
    !timingSafeEqual(supplied, expected)
  ) {
    return res.sendStatus(401);
  }

  let event: PaystackEvent;

  try {
    event = JSON.parse(req.body.toString("utf8")) as PaystackEvent;
  } catch {
    return res.sendStatus(400);
  }

  if (
    !event ||
    typeof event !== "object" ||
    typeof event.event !== "string" ||
    !event.data ||
    typeof event.data !== "object"
  ) {
    return res.sendStatus(400);
  }

  // Only successful charge events require this handler.
  if (event.event !== "charge.success") {
    return res.sendStatus(200);
  }

  const reference = event.data.reference;

  if (
    typeof reference !== "string" ||
    !/^velora-[0-9a-f-]{36}$/i.test(reference)
  ) {
    return res.sendStatus(400);
  }

  try {
    const result = await reconcilePaystackWebhookPayment(reference);

    if (result.recordedStatus !== "COMPLETED") {
      console.error("Paystack webhook not yet reconciled", {
        reference,
        providerStatus: result.providerStatus,
        recordedStatus: result.recordedStatus,
      });

      return res.sendStatus(503);
    }

    console.log("PAYSTACK_WEBHOOK_RECONCILED", {
        reference,
        providerStatus: result.providerStatus,
        recordedStatus: result.recordedStatus,
        requiresReview: result.requiresReview,
    });

    if (result.requiresReview) {
      console.error("Paystack payment requires manual review", {
        reference,
      });
    }

    return res.sendStatus(200);
  } catch (error) {
    console.error("Paystack webhook reconciliation failed:", error);

    // Retryable response for temporary verification/database failures.
    // Permanent failures must be investigated through backend logs.
    return res.sendStatus(503);
  }
});

export default router;
