
import {
  randomUUID,
  createHash,
  timingSafeEqual,
} from "node:crypto";

import { prisma } from "../lib/prisma.js";


const DAY_MS = 86_400_000;

type PricedRoom = {
  price: { toFixed(digits: number): string } | null;
};

type BookingForTotal = {
  checkIn: Date;
  checkOut: Date;
  bookingRooms: PricedRoom[];
};

interface PaystackInitializeResponse {
  status: boolean;
  message: string;
  data?: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
}

export class PaymentInitializationError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "PaymentInitializationError";
  }
}

export function bookingTotalCents(
  booking: BookingForTotal
): number | null {
  const nights =
    (booking.checkOut.getTime() -
      booking.checkIn.getTime()) /
    DAY_MS;

  if (
    !Number.isInteger(nights) ||
    nights <= 0 ||
    booking.bookingRooms.length === 0
  ) {
    return null;
  }

  let nightlyCents = 0;

  for (const room of booking.bookingRooms) {
    if (room.price === null) return null;

    const parts = room.price.toFixed(2).split(".");
    if (parts.length !== 2) return null;

    const rands = Number(parts[0]);
    const cents = Number(parts[1]);

    if (
      !Number.isSafeInteger(rands) ||
      !Number.isSafeInteger(cents)
    ) {
      return null;
    }

    nightlyCents += rands * 100 + cents;

    if (!Number.isSafeInteger(nightlyCents)) {
      return null;
    }
  }

  const total = nightlyCents * nights;

  return Number.isSafeInteger(total) && total > 0
    ? total
    : null;
}

export async function initializeBookingPayment(
  bookingId: string,
  owner:
    | { type: "customer"; userId: string }
    | { type: "guest"; token: string }
) {
  const initialized = await prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(
          hashtextextended(${bookingId}, 1)
        )
      `;

      const booking = await tx.booking.findFirst({
        where: {
          id: bookingId,
          ...(owner.type === "customer"
            ? { userId: owner.userId }
            : {
                userId: null,
                guestAccessTokenHash: {
                  not: null,
                },
              }),
        },
        include: {
          user: {
            select: { email: true },
          },
          bookingRooms: {
            select: { price: true },
          },
          payments: {
            where: {
              status: {
                in: ["PENDING", "COMPLETED"],
              },
            },
            select: { status: true },
          },
        },
      });

      if (!booking) {
        throw new PaymentInitializationError(
          404,
          "Booking not found"
        );
      }

      
if (owner.type === "guest") {
  const token = owner.token;

  if (!/^[a-f0-9]{64}$/.test(token)) {
    throw new PaymentInitializationError(
      404,
      "Booking not found"
    );
  }

  const storedHash = booking.guestAccessTokenHash;

  if (!storedHash) {
    throw new PaymentInitializationError(
      404,
      "Booking not found"
    );
  }

  const suppliedHash = createHash("sha256")
    .update(token)
    .digest();

  const expectedHash = Buffer.from(
    storedHash,
    "hex"
  );

  if (
    expectedHash.length !== 32 ||
    !timingSafeEqual(suppliedHash, expectedHash)
  ) {
    throw new PaymentInitializationError(
      404,
      "Booking not found"
    );
  }
}


      if (booking.status === "CANCELLED") {
        throw new PaymentInitializationError(
          409,
          "Cancelled bookings cannot be paid"
        );
      }

      if (
        booking.payments.some(
          (payment) => payment.status === "COMPLETED"
        )
      ) {
        throw new PaymentInitializationError(
          409,
          "Booking has already been paid"
        );
      }

      if (
        booking.payments.some(
          (payment) => payment.status === "PENDING"
        )
      ) {
        throw new PaymentInitializationError(
          409,
          "Booking already has an active payment attempt"
        );
      }

      const email =
        owner.type === "guest"
          ? booking.guestEmail
          : booking.user?.email;

      if (!email) {
        throw new PaymentInitializationError(
          400,
          "Booking customer email is missing"
        );
      }

      const totalCents = bookingTotalCents(booking);

      if (totalCents === null) {
        throw new PaymentInitializationError(
          409,
          "Invalid booking amount"
        );
      }

      const reference = `velora-${randomUUID()}`;
      const amount = (totalCents / 100).toFixed(2);

      const payment = await tx.payment.create({
        data: {
          bookingId,
          reference,
          amount,
          currency: "ZAR",
          status: "PENDING",
        },
      });

      return {
        payment,
        reference,
        amount,
        totalCents,
        email,
      };
    }
  );

  const {
    payment,
    reference,
    amount,
    totalCents,
    email,
  } = initialized;

  const response = await fetch(
    "https://api.paystack.co/transaction/initialize",
    {
      method: "POST",
      headers: {
        Authorization:
          `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        amount: totalCents,
        currency: "ZAR",
        reference,
        callback_url:
          `${process.env.FRONTEND_URL ??
            "http://localhost:5173"}/payment/callback`,
        metadata: {
          bookingId,
          paymentId: payment.id,
        },
      }),
      signal: AbortSignal.timeout(15_000),
    }
  );

  const result =
    (await response.json()) as PaystackInitializeResponse;

  if (
    !response.ok ||
    !result.status ||
    !result.data?.authorization_url ||
    result.data.reference !== reference
  ) {
    // Preserve the existing behavior:
    // only explicit provider rejection marks payment FAILED.
    // Ambiguous responses remain PENDING for reconciliation.
    if (result.status === false) {
      await prisma.payment.updateMany({
        where: {
          id: payment.id,
          status: "PENDING",
        },
        data: { status: "FAILED" },
      });
    }

    throw new PaymentInitializationError(
      502,
      "Paystack could not initialize payment"
    );
  }

  return {
    paymentId: payment.id,
    reference,
    authorizationUrl: result.data.authorization_url,
    amount,
    currency: "ZAR",
  };
}
