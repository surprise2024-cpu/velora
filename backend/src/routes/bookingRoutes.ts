
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";

import {
  bookingSchema,
  guestBookingSchema,
  checkoutIdentitySchema,
  createBooking,
  BookingError,
} from "../services/bookingService.js";

const router = Router();

const checkoutBookingSchema = bookingSchema.extend({
  checkout: checkoutIdentitySchema.optional(),
});

const checkoutGuestBookingSchema =
  guestBookingSchema.extend({
    checkout: checkoutIdentitySchema.optional(),
  });

const guestBookingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message:
      "Too many guest booking attempts. Please try again later.",
  },
});

function handleBookingError(
  error: unknown,
  res: import("express").Response
) {
  if (error instanceof BookingError) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
    });
  }

  if (error instanceof z.ZodError) {
    return res.status(400).json({
      success: false,
      message: "Invalid checkout details",
      errors: z.flattenError(error),
    });
  }

  console.error("Failed to create booking:", error);

  return res.status(500).json({
    success: false,
    message: "Failed to create booking",
  });
}

router.post("/", requireAuth, async (req, res) => {
  const parsed = checkoutBookingSchema.safeParse(
    req.body
  );

  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid booking details",
      errors: parsed.error.flatten(),
    });
  }

  const { checkout, ...bookingInput } = parsed.data;

  try {
    const { booking } = await createBooking(
      bookingInput,
      {
        userId: res.locals.authUser.id,
      },
      checkout
    );

    return res.status(201).json({
      success: true,
      message: "Booking created successfully",
      data: booking,
    });
  } catch (error) {
    return handleBookingError(error, res);
  }
});

router.post(
  "/guest",
  guestBookingLimiter,
  async (req, res) => {
    const parsed =
      checkoutGuestBookingSchema.safeParse(
        req.body
      );

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid guest booking details",
        errors: parsed.error.flatten(),
      });
    }

    const {
      guestName,
      guestEmail,
      guestPhone,
      checkout,
      ...bookingInput
    } = parsed.data;

    try {
      const { booking, guestToken } =
        await createBooking(
          bookingInput,
          {
            guest: {
              name: guestName,
              email: guestEmail,
              phone: guestPhone,
            },
          },
          checkout
        );

      return res.status(201).json({
        success: true,
        message: "Guest booking created successfully",
        data: {
          id: booking.id,
          status: booking.status,
          checkIn: booking.checkIn,
          checkOut: booking.checkOut,
          guestCount: booking.guestCount,
          guestAccessToken: guestToken,
        },
      });
    } catch (error) {
      return handleBookingError(error, res);
    }
  }
);

router.get("/my", requireAuth, async (_req, res) => {
  try {
    const bookings = await prisma.booking.findMany({
      where: {
        userId: res.locals.authUser.id,
      },
      include: {
        bookingRooms: {
          include: {
            room: {
              include: {
                branch: {
                  select: {
                    id: true,
                    name: true,
                    city: true,
                    address: true,
                  },
                },
                roomType: {
                  select: {
                    id: true,
                    name: true,
                    basePrice: true,
                    currency: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.status(200).json({
      success: true,
      data: bookings,
    });
  } catch (error) {
    console.error(
      "Failed to retrieve bookings:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve bookings",
    });
  }
});

export default router;
