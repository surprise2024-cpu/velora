
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";

import {
  bookingTotalCents,
  initializeBookingPayment,
  PaymentInitializationError,
} from "../services/paymentInitializationService.js";

import {
  authorizeGuestBooking,
} from "../lib/guestBookingAccess.js";

const router = Router();
const DAY_MS = 86_400_000;

const initializeSchema = z.object({ bookingId: z.uuid() });


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

router.post("/guest/initialize", async (req, res) => {
  const parsed = initializeSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid booking ID",
    });
  }

  const authorization = req.headers.authorization;

  const guestToken =
    typeof authorization === "string" &&
    authorization.startsWith("Bearer ")
      ? authorization.slice(7)
      : null;

  try {
    const authorized = await authorizeGuestBooking(
      parsed.data.bookingId,
      guestToken
    );

    if (!authorized) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    const payment = await initializeBookingPayment(
      parsed.data.bookingId,
      {
        type: "guest",
        token: guestToken as string,
      }
    );

    return res.status(200).json({
      success: true,
      message: "Guest payment initialized successfully",
      data: payment,
    });
  } catch (error) {
    if (error instanceof PaymentInitializationError) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }

    console.error(
      "Guest payment initialization failed:",
      error
    );

    return res.status(502).json({
      success: false,
      message: "Payment initialization failed or is uncertain",
    });
  }
});



router.post("/initialize", requireAuth, async (req, res) => {
  const parsed = initializeSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid booking ID",
    });
  }

  try {
    const payment = await initializeBookingPayment(
      parsed.data.bookingId,
      {
        type: "customer",
        userId: res.locals.authUser.id,
      }
    );

    return res.status(200).json({
      success: true,
      message: "Payment initialized successfully",
      data: payment,
    });
  } catch (error) {
    if (error instanceof PaymentInitializationError) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
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
