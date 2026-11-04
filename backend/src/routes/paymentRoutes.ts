import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();
const DAY_MS = 86_400_000;

const initializeSchema = z.object({ bookingId: z.uuid() });

interface PaystackInitializeResponse {
  status: boolean;
  message: string;
  data?: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
}

interface PaystackVerifyResponse {
  status: boolean;
  data?: {
    id: number;
    reference: string;
    status: string;
    amount: number;
    currency: string;
    paid_at: string | null;
  };
}

type PricedRoom = { price: { toFixed(digits: number): string } | null };
type BookingForTotal = {
  checkIn: Date;
  checkOut: Date;
  bookingRooms: PricedRoom[];
};

function bookingTotalCents(booking: BookingForTotal): number | null {
  const nights =
    (booking.checkOut.getTime() - booking.checkIn.getTime()) / DAY_MS;
  if (!Number.isInteger(nights) || nights <= 0 || booking.bookingRooms.length === 0) {
    return null;
  }

  let nightlyCents = 0;
  for (const room of booking.bookingRooms) {
    if (room.price === null) return null;
    const parts = room.price.toFixed(2).split(".");
    if (parts.length !== 2) return null;
    const rands = Number(parts[0]);
    const cents = Number(parts[1]);
    if (!Number.isSafeInteger(rands) || !Number.isSafeInteger(cents)) return null;
    nightlyCents += rands * 100 + cents;
    if (!Number.isSafeInteger(nightlyCents)) return null;
  }

  const total = nightlyCents * nights;
  return Number.isSafeInteger(total) && total > 0 ? total : null;
}

router.post("/initialize", requireAuth, async (req, res) => {
  const parsed = initializeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, message: "Invalid booking ID" });
  }

  const bookingId = parsed.data.bookingId;
  const userId = res.locals.authUser.id;

  try {
    // Only database work runs under this lock. No Paystack network request here.
    const initialized = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtextextended(${bookingId}, 1))
      `;

      const booking = await tx.booking.findFirst({
        where: { id: bookingId, userId },
        include: {
          user: { select: { email: true } },
          bookingRooms: { select: { price: true } },
          payments: {
            where: { status: { in: ["PENDING", "COMPLETED"] } },
            select: { status: true },
          },
        },
      });

      if (!booking) throw new Error("BOOKING_NOT_FOUND");
      if (booking.status === "CANCELLED") throw new Error("BOOKING_CANCELLED");
      if (booking.payments.some((p) => p.status === "COMPLETED")) {
        throw new Error("BOOKING_ALREADY_PAID");
      }
      if (booking.payments.some((p) => p.status === "PENDING")) {
        throw new Error("PAYMENT_ALREADY_PENDING");
      }
      if (!booking.user?.email) throw new Error("CUSTOMER_EMAIL_MISSING");

      const totalCents = bookingTotalCents(booking);
      if (totalCents === null) throw new Error("INVALID_BOOKING_AMOUNT");

      const reference = `velora-${randomUUID()}`;
      const amount = (totalCents / 100).toFixed(2);
      const payment = await tx.payment.create({
        data: { bookingId, reference, amount, currency: "ZAR", status: "PENDING" },
      });

      return { payment, reference, amount, totalCents, email: booking.user.email };
    });

    const { payment, reference, amount, totalCents, email } = initialized;
    const response = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        amount: totalCents,
        currency: "ZAR",
        reference,
        callback_url: `${process.env.FRONTEND_URL ?? "http://localhost:5173"}/payment/callback`,
        metadata: { bookingId, paymentId: payment.id },
      }),
      signal: AbortSignal.timeout(15_000),
    });

    const result = (await response.json()) as PaystackInitializeResponse;
    if (
      !response.ok ||
      !result.status ||
      !result.data?.authorization_url ||
      result.data.reference !== reference
    ) {
      // Only an explicit provider rejection can safely finalize this attempt.
      // A timeout or ambiguous response remains PENDING until investigated.
      if (result.status === false) {
        await prisma.payment.updateMany({
          where: { id: payment.id, status: "PENDING" },
          data: { status: "FAILED" },
        });
      }
      return res.status(502).json({
        success: false,
        message: "Paystack could not initialize payment",
        reference,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Payment initialized successfully",
      data: {
        paymentId: payment.id,
        reference,
        authorizationUrl: result.data.authorization_url,
        amount,
        currency: "ZAR",
      },
    });
  } catch (error) {
    const knownErrors: Record<string, [number, string]> = {
      BOOKING_NOT_FOUND: [404, "Booking not found"],
      BOOKING_CANCELLED: [409, "Cancelled bookings cannot be paid"],
      BOOKING_ALREADY_PAID: [409, "Booking has already been paid"],
      PAYMENT_ALREADY_PENDING: [409, "Booking already has an active payment attempt"],
      CUSTOMER_EMAIL_MISSING: [400, "Booking customer email is missing"],
      INVALID_BOOKING_AMOUNT: [409, "Invalid booking amount"],
    };
    if (error instanceof Error) {
      const knownError = knownErrors[error.message];
      if (knownError) {
        const [status, message] = knownError;
        return res.status(status).json({ success: false, message });
      }
    }
    console.error("Failed to initialize payment:", error);
    return res.status(502).json({
      success: false,
      message: "Payment initialization failed or is uncertain",
    });
  }
});

router.post("/:reference/verify", requireAuth, async (req, res) => {
  const reference = z.string().min(1).max(200).safeParse(req.params.reference);
  if (!reference.success) {
    return res.status(400).json({ success: false, message: "Invalid payment reference" });
  }

  try {
    const payment = await prisma.payment.findFirst({
      where: {
        reference: reference.data,
        booking: { userId: res.locals.authUser.id },
      },
    });
    if (!payment) {
      return res.status(404).json({ success: false, message: "Payment not found" });
    }

    // Paystack is contacted before the database transaction to keep locks short.
    const response = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(payment.reference)}`,
      {
        headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
        signal: AbortSignal.timeout(15_000),
      }
    );
    if (!response.ok) {
      return res.status(502).json({
        success: false,
        message: "Could not verify payment with Paystack",
      });
    }

    const result = (await response.json()) as PaystackVerifyResponse;
    if (!result.status || !result.data) {
      return res.status(502).json({
        success: false,
        message: "Invalid Paystack verification response",
      });
    }

    const verified = result.data;
    const expectedCents = Number(payment.amount.mul(100).toFixed(0));
    if (
      !Number.isSafeInteger(expectedCents) ||
      verified.reference !== payment.reference ||
      verified.amount !== expectedCents ||
      verified.currency !== payment.currency
    ) {
      return res.status(409).json({
        success: false,
        message: "Paystack transaction details do not match",
      });
    }

    const reconciliation = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtextextended(${payment.bookingId}, 1))
      `;

      // Re-read both records after acquiring the booking lock.
      const currentPayment = await tx.payment.findUnique({
        where: { id: payment.id },
      });
      if (!currentPayment) throw new Error("PAYMENT_NOT_FOUND");

      const booking = await tx.booking.findUnique({
        where: { id: currentPayment.bookingId },
        include: {
          bookingRooms: { select: { price: true } },
          payments: {
            where: { status: "COMPLETED" },
            select: { id: true },
          },
        },
      });
      if (!booking) throw new Error("BOOKING_NOT_FOUND");

      const currentTotalCents = bookingTotalCents(booking);
      const requiresReview =
        booking.status === "CANCELLED" ||
        currentTotalCents !== expectedCents ||
        booking.payments.some((p) => p.id !== currentPayment.id);

      // A provider-confirmed success must be recorded, including a late success
      // after a previously reported failure or abandonment.
      if (verified.status === "success") {
        if (currentPayment.status === "COMPLETED") {
          return { payment: currentPayment, requiresReview };
        }

        const paidAt = verified.paid_at ? new Date(verified.paid_at) : new Date();
        if (Number.isNaN(paidAt.getTime())) {
          throw new Error("INVALID_PAID_AT");
        }
        const savedPayment = await tx.payment.update({
          where: { id: currentPayment.id },
          data: {
            status: "COMPLETED",
            providerTransactionId: String(verified.id),
            paidAt,
          },
        });

        if (requiresReview) {
          console.error("PAYMENT_REQUIRES_REVIEW", {
            reference: savedPayment.reference,
            bookingId: savedPayment.bookingId,
            bookingStatus: booking.status,
            currentTotalCents,
            expectedCents,
          });
        }
        return { payment: savedPayment, requiresReview };
      }

      // Never downgrade a payment already recorded as completed.
      if (currentPayment.status === "COMPLETED") {
        return { payment: currentPayment, requiresReview };
      }

      if (verified.status === "failed" || verified.status === "abandoned") {
        const status = verified.status === "failed" ? "FAILED" : "CANCELLED";
        // Do not reverse a prior terminal status on a later non-success result.
        if (currentPayment.status !== "PENDING") {
          return { payment: currentPayment, requiresReview: false };
        }
        const savedPayment = await tx.payment.update({
          where: { id: currentPayment.id },
          data: { status },
        });
        return { payment: savedPayment, requiresReview: false };
      }

      // Pending, ongoing, or unrecognized provider statuses remain unchanged.
      return { payment: currentPayment, requiresReview: false };
    });

    return res.status(200).json({
      success: true,
      message: "Paystack verification completed",
      data: {
        reference: payment.reference,
        providerStatus: verified.status,
        amount: reconciliation.payment.amount.toFixed(2),
        currency: reconciliation.payment.currency,
        paidAt: reconciliation.payment.paidAt?.toISOString() ?? verified.paid_at,
        recordedStatus: reconciliation.payment.status,
        requiresReview: reconciliation.requiresReview,
      },
    });
  } catch (error) {
    console.error("Payment verification failed:", error);
    return res.status(502).json({
      success: false,
      message: "Payment verification service unavailable",
    });
  }
});


router.get("/booking/:bookingId", requireAuth, async (req, res) => {
  const parsed = z.uuid().safeParse(req.params.bookingId);

  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid booking ID",
    });
  }

  try {
    const booking = await prisma.booking.findFirst({
      where: {
        id: parsed.data,
        userId: res.locals.authUser.id,
      },
      select: {
        id: true,
        payments: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            reference: true,
            amount: true,
            currency: true,
            status: true,
            paidAt: true,
            createdAt: true,
          },
        },
      },
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: booking.payments.map((payment) => ({
        ...payment,
        amount: payment.amount.toFixed(2),
      })),
    });
  } catch (error) {
    console.error("Failed to retrieve booking payments:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve booking payments",
    });
  }
});


export default router;
