
import { createHash, timingSafeEqual } from "node:crypto";
import { prisma } from "../lib/prisma.js";
import { bookingTotalCents } from "./paymentInitializationService.js";

type PaymentOwner =
  | { type: "customer"; userId: string }
  | { type: "guest"; token: string };

interface PaystackVerifyResponse {
  status: boolean;
  data?: {
    id: number;
    reference: string;
    amount: number;
    currency: string;
    status: string;
    paid_at: string | null;
  };
}

export class PaymentVerificationError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "PaymentVerificationError";
  }
}

function guestTokenMatches(
  token: string,
  storedHash: string | null
): boolean {
  if (!/^[a-f0-9]{64}$/.test(token) || !storedHash) {
    return false;
  }

  if (!/^[a-f0-9]{64}$/.test(storedHash)) {
    return false;
  }

  const suppliedHash = createHash("sha256")
    .update(token)
    .digest();

  const expectedHash = Buffer.from(storedHash, "hex");

  return (
    expectedHash.length === 32 &&
    timingSafeEqual(suppliedHash, expectedHash)
  );
}

export async function verifyBookingPayment(
  reference: string,
  owner: PaymentOwner
) {
  const payment = await prisma.payment.findUnique({
    where: { reference },
    include: {
      booking: {
        select: {
          userId: true,
          guestAccessTokenHash: true,
        },
      },
    },
  });

  if (!payment) {
    throw new PaymentVerificationError(404, "Payment not found");
  }

  const authorized =
    owner.type === "customer"
      ? payment.booking.userId === owner.userId
      : payment.booking.userId === null &&
        guestTokenMatches(
          owner.token,
          payment.booking.guestAccessTokenHash
        );

  if (!authorized) {
    throw new PaymentVerificationError(404, "Payment not found");
  }

  const response = await fetch(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    {
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      },
      signal: AbortSignal.timeout(15_000),
    }
  );

  if (!response.ok) {
    throw new PaymentVerificationError(
      502,
      "Could not verify payment with Paystack"
    );
  }

  const result =
    (await response.json()) as PaystackVerifyResponse;

  if (!result.status || !result.data) {
    throw new PaymentVerificationError(
      502,
      "Invalid Paystack verification response"
    );
  }

  const verified = result.data;

  const expectedCents = Number(
    payment.amount.mul(100).toFixed(0)
  );

  if (
    !Number.isSafeInteger(expectedCents) ||
    verified.reference !== payment.reference ||
    verified.amount !== expectedCents ||
    verified.currency !== payment.currency
  ) {
    throw new PaymentVerificationError(
      409,
      "Paystack transaction details do not match"
    );
  }

  const reconciliation = await prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(
          hashtextextended(${payment.bookingId}, 1)
        )
      `;

      const currentPayment = await tx.payment.findUnique({
        where: { id: payment.id },
      });

      if (!currentPayment) {
        throw new PaymentVerificationError(
          404,
          "Payment not found"
        );
      }

      const booking = await tx.booking.findUnique({
        where: { id: currentPayment.bookingId },
        include: {
          bookingRooms: {
            select: { price: true },
          },
          payments: {
            where: { status: "COMPLETED" },
            select: { id: true },
          },
        },
      });

      if (!booking) {
        throw new PaymentVerificationError(
          404,
          "Booking not found"
        );
      }

      // Recheck authorization while holding the booking lock.
      const stillAuthorized =
        owner.type === "customer"
          ? booking.userId === owner.userId
          : booking.userId === null &&
            guestTokenMatches(
              owner.token,
              booking.guestAccessTokenHash
            );

      if (!stillAuthorized) {
        throw new PaymentVerificationError(
          404,
          "Payment not found"
        );
      }

      
const branchIds = [
  ...new Set(
    (
      await tx.bookingRoom.findMany({
        where: { bookingId: booking.id },
        select: {
          room: {
            select: {
              branchId: true,
            },
          },
        },
      })
    ).map((item) => item.room.branchId)
  ),
].sort();

const validBranchAssignment = branchIds.length === 1;

let branchActive = false;

if (validBranchAssignment) {
  const branchId = branchIds[0]!;

  // Match the branch lock used by booking creation,
  // administrator approval and branch deactivation.
  await tx.$executeRaw`
    SELECT pg_advisory_xact_lock(
      hashtextextended(${branchId}::text, 0)
    )
  `;

  const branch = await tx.branch.findUnique({
    where: { id: branchId },
    select: { isActive: true },
  });

  branchActive = branch?.isActive === true;
}


      const currentTotalCents = bookingTotalCents(booking);

      const requiresReview =
        booking.status === "CANCELLED" ||
        !validBranchAssignment ||
        !branchActive ||
        currentTotalCents !== expectedCents ||
        booking.payments.some(
          (existing) => existing.id !== currentPayment.id
        );


      if (verified.status === "success") {
        const paidAt = verified.paid_at
          ? new Date(verified.paid_at)
          : new Date();

        if (Number.isNaN(paidAt.getTime())) {
          throw new PaymentVerificationError(
            502,
            "Invalid payment timestamp"
          );
        }

        const savedPayment =
          currentPayment.status === "COMPLETED"
            ? currentPayment
            : await tx.payment.update({
                where: { id: currentPayment.id },
                data: {
                  status: "COMPLETED",
                  providerTransactionId: String(verified.id),
                  paidAt,
                },
              });

        // Confirm only a successfully paid booking
        // that does not require manual review.
        if (!requiresReview && booking.status === "PENDING") {
          await tx.booking.update({
            where: { id: booking.id },
            data: { status: "CONFIRMED" },
          });
        }

        if (requiresReview) {
          console.error("PAYMENT_REQUIRES_REVIEW", {
            reference: savedPayment.reference,
            bookingId: booking.id,
            bookingStatus: booking.status,
            currentTotalCents,
            expectedCents,
            branchIds,
            branchActive,
          });
        }

        return { payment: savedPayment, requiresReview };
      }

      // Never downgrade a completed payment.
      if (currentPayment.status === "COMPLETED") {
        return { payment: currentPayment, requiresReview };
      }

      if (
        verified.status === "failed" ||
        verified.status === "abandoned"
      ) {
        if (currentPayment.status !== "PENDING") {
          return {
            payment: currentPayment,
            requiresReview: false,
          };
        }

        const savedPayment = await tx.payment.update({
          where: { id: currentPayment.id },
          data: {
            status:
              verified.status === "failed"
                ? "FAILED"
                : "CANCELLED",
          },
        });

        return {
          payment: savedPayment,
          requiresReview: false,
        };
      }

      return {
        payment: currentPayment,
        requiresReview: false,
      };
    }
  );

  return {
    reference: payment.reference,
    providerStatus: verified.status,
    amount: reconciliation.payment.amount.toFixed(2),
    currency: reconciliation.payment.currency,
    paidAt:
      reconciliation.payment.paidAt?.toISOString() ??
      verified.paid_at,
    recordedStatus: reconciliation.payment.status,
    requiresReview: reconciliation.requiresReview,
  };
}
