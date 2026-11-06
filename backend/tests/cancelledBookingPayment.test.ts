
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

// Safety: load only the dedicated test environment.
import { config } from "dotenv";

config({ path: ".env.test", override: true });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("Missing test DATABASE_URL");
}

const target = new URL(databaseUrl);

if (
  target.pathname !== "/velora_test" ||
  !["localhost", "127.0.0.1"].includes(target.hostname)
) {
  throw new Error("REFUSING TO RUN: Not the local velora_test database");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

// Import only after the test DATABASE_URL is configured.
// The production service imports its own Prisma singleton.
const { reconcilePaystackWebhookPayment } = await import(
  "../src/services/paymentVerificationService.js"
);

const originalFetch = globalThis.fetch;

after(async () => {
  globalThis.fetch = originalFetch;
  await prisma.$disconnect();
});

test("successful late payment must not reactivate cancelled booking", async () => {
  const suffix = randomUUID();
  const reference = `velora-${randomUUID()}`;

  let brandId: string | undefined;
  let branchId: string | undefined;
  let roomTypeId: string | undefined;
  let roomId: string | undefined;
  let bookingId: string | undefined;

  try {
    const brand = await prisma.hotelBrand.create({
      data: { name: `Test Brand ${suffix}` },
    });
    brandId = brand.id;

    const branch = await prisma.branch.create({
      data: {
        brandId: brand.id,
        name: "Test Branch",
        address: "Test Address",
        city: "Pretoria",
        province: "Gauteng",
        country: "South Africa",
        isActive: true,
      },
    });
    branchId = branch.id;

    const roomType = await prisma.roomType.create({
      data: {
        branchId: branch.id,
        name: "Test Deluxe",
        maxGuests: 2,
        basePrice: "1000.00",
        currency: "ZAR",
      },
    });
    roomTypeId = roomType.id;

    const room = await prisma.room.create({
      data: {
        branchId: branch.id,
        roomTypeId: roomType.id,
        roomNumber: "101",
      },
    });
    roomId = room.id;

    const booking = await prisma.booking.create({
      data: {
        checkIn: new Date("2026-12-15T00:00:00.000Z"),
        checkOut: new Date("2026-12-18T00:00:00.000Z"),
        guestCount: 2,
        status: "CANCELLED",
        guestName: "Test Guest",
        guestEmail: "test@example.invalid",
        bookingRooms: {
          create: {
            roomId: room.id,
            price: "1000.00",
          },
        },
        payments: {
          create: {
            reference,
            amount: "3000.00",
            currency: "ZAR",
            status: "PENDING",
          },
        },
      },
    });
    bookingId = booking.id;

    let verifyCalls = 0;

    globalThis.fetch = async (input) => {
      verifyCalls++;

      assert.equal(
        String(input),
        `https://api.paystack.co/transaction/verify/${reference}`
      );

      return new Response(
        JSON.stringify({
          status: true,
          data: {
            id: 123456789,
            reference,
            amount: 300000,
            currency: "ZAR",
            status: "success",
            paid_at: "2026-12-15T12:00:00.000Z",
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    };

    const result = await reconcilePaystackWebhookPayment(reference);

    const savedBooking = await prisma.booking.findUniqueOrThrow({
      where: { id: booking.id },
      include: { payments: true },
    });

    assert.equal(result.recordedStatus, "COMPLETED");
    assert.equal(result.requiresReview, true);
    assert.equal(result.providerStatus, "success");
    assert.equal(savedBooking.status, "CANCELLED");
    assert.equal(savedBooking.payments.length, 1);
   assert.equal(savedBooking.payments[0]?.status, "COMPLETED");

    // Verify the manual-review flag is persisted.
    assert.equal(savedBooking.payments[0]?.requiresReview, true);
    assert.equal(verifyCalls, 1);

    // Verify idempotency: repeating the notification
    // must not create another payment or confirm the booking.
    const repeated = await reconcilePaystackWebhookPayment(reference);

    const afterRepeat = await prisma.booking.findUniqueOrThrow({
      where: { id: booking.id },
      include: { payments: true },
    });

    assert.equal(repeated.recordedStatus, "COMPLETED");
    assert.equal(repeated.requiresReview, true);
    assert.equal(afterRepeat.status, "CANCELLED");
    assert.equal(afterRepeat.payments.length, 1);

    // A duplicate webhook must preserve the review flag.
    assert.equal(afterRepeat.payments[0]?.requiresReview, true);

    assert.equal(verifyCalls, 2);

    
const reviewPaymentId = afterRepeat.payments[0]?.id;

assert.ok(reviewPaymentId);

// Simulate an administrator resolving the payment review.
// The HTTP endpoint will be tested separately.
const resolvedPayment = await prisma.payment.update({
  where: {
    id: reviewPaymentId,
  },
  data: {
    requiresReview: false,
    reviewedAt: new Date(),
    reviewedById: null,
  },
});

assert.equal(resolvedPayment.requiresReview, false);
assert.ok(resolvedPayment.reviewedAt);

// Simulate Paystack delivering the same successful event again.
await reconcilePaystackWebhookPayment(reference);

const afterResolution = await prisma.booking.findUniqueOrThrow({
  where: {
    id: booking.id,
  },
  include: {
    payments: true,
  },
});

    assert.equal(afterResolution.status, "CANCELLED");
    assert.equal(afterResolution.payments.length, 1);
    assert.equal(afterResolution.payments[0]?.status, "COMPLETED");
    assert.equal(afterResolution.payments[0]?.requiresReview, false);
    assert.ok(afterResolution.payments[0]?.reviewedAt);
    assert.equal(verifyCalls, 3);

    console.log("PASS: Resolved review stays resolved");
    console.log("PASS: Duplicate webhook does not reopen review");


    console.log("PASS: Cancelled booking remains cancelled");
    console.log("PASS: Late successful payment recorded");
    console.log("PASS: Manual review requested");
    console.log("PASS: Duplicate reconciliation is idempotent");
    console.log("PASS: No real Paystack API request made");
  } finally {
    globalThis.fetch = originalFetch;

    if (bookingId) {
      await prisma.payment.deleteMany({ where: { bookingId } });
      await prisma.bookingRoom.deleteMany({ where: { bookingId } });
      await prisma.booking.delete({ where: { id: bookingId } });
    }

    if (roomId) {
      await prisma.room.delete({ where: { id: roomId } });
    }
    if (roomTypeId) {
      await prisma.roomType.delete({ where: { id: roomTypeId } });
    }
    if (branchId) {
      await prisma.branch.delete({ where: { id: branchId } });
    }
    if (brandId) {
      await prisma.hotelBrand.delete({ where: { id: brandId } });
    }
  }
});
