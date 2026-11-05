
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

import {
  verifyBookingPayment,
  PaymentVerificationError,
} from "../services/paymentVerificationService.js";

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


router.post("/guest/:reference/verify", async (req, res) => {
  const parsed = z.string().min(1).max(200).safeParse(
    req.params.reference
  );

  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid payment reference",
    });
  }

  const authorization = req.headers.authorization ?? "";

  const match = /^Bearer ([a-f0-9]{64})$/.exec(
    authorization
  );

  if (!match) {
    return res.status(404).json({
      success: false,
      message: "Payment not found",
    });
  }

  try {
    const result = await verifyBookingPayment(
      parsed.data,
      {
        type: "guest",
        token: match[1]!,
      }
    );

    return res.status(200).json({
      success: true,
      message: "Paystack verification completed",
      data: result,
    });
  } catch (error) {
    if (error instanceof PaymentVerificationError) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }

    console.error("Guest payment verification failed:", error);

    return res.status(502).json({
      success: false,
      message: "Payment verification service unavailable",
    });
  }
});


router.post("/:reference/verify", requireAuth, async (req, res) => {
  const parsed = z.string().min(1).max(200).safeParse(
    req.params.reference
  );

  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid payment reference",
    });
  }

  try {
    const result = await verifyBookingPayment(
      parsed.data,
      {
        type: "customer",
        userId: res.locals.authUser.id,
      }
    );

    return res.status(200).json({
      success: true,
      message: "Paystack verification completed",
      data: result,
    });
  } catch (error) {
    if (error instanceof PaymentVerificationError) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }

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
