
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/prisma.js";
import {
  createBooking,
  BookingError,
} from "../src/services/bookingService.js";

const BRANCH_NAME = "Velora Pretoria";
const ROOM_TYPE_NAME = "Deluxe King Room";
const ROOM_NUMBER = "201";

function dateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

async function main() {
  console.log("\nVELORA — CONCURRENT BOOKING TEST\n");

  // Find the actual Pretoria room.
  const rooms = await prisma.room.findMany({
    where: {
      roomNumber: ROOM_NUMBER,
      isActive: true,
      branch: {
        name: BRANCH_NAME,
        isActive: true,
      },
      roomType: {
        name: ROOM_TYPE_NAME,
        isActive: true,
      },
    },
    select: {
      id: true,
      branchId: true,
      roomTypeId: true,
      roomNumber: true,
    },
  });

  if (rooms.length !== 1) {
    throw new Error(
      `Expected exactly one matching Room 201; found ${rooms.length}.`
    );
  }

  const room = rooms[0];

  // Confirm the room type has exactly one active room.
  const activeRoomCount = await prisma.room.count({
    where: {
      branchId: room.branchId,
      roomTypeId: room.roomTypeId,
      isActive: true,
    },
  });

  if (activeRoomCount !== 1) {
    throw new Error(
      `Expected one active Deluxe King Room; found ${activeRoomCount}.`
    );
  }

  // Choose a future one-night stay.
  // Search for a date with no existing blocking booking.
  let checkIn: string | undefined;
  let checkOut: string | undefined;

  for (let offset = 30; offset <= 90; offset++) {
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    start.setUTCDate(start.getUTCDate() + offset);

    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);

    const blocking = await prisma.bookingRoom.count({
      where: {
        roomId: room.id,
        booking: {
          status: { in: ["PENDING", "CONFIRMED"] },
          checkIn: { lt: end },
          checkOut: { gt: start },
        },
      },
    });

    if (blocking === 0) {
      checkIn = dateString(start);
      checkOut = dateString(end);
      break;
    }
  }

  if (!checkIn || !checkOut) {
    throw new Error("No free test dates found in the next 30–90 days.");
  }

  console.log(`Branch: ${BRANCH_NAME}`);
  console.log(`Room: ${ROOM_NUMBER} (${ROOM_TYPE_NAME})`);
  console.log(`Check-in: ${checkIn}`);
  console.log(`Check-out: ${checkOut}`);
  console.log("Starting two simultaneous booking requests...\n");

  const marker = `velora-concurrency-${randomUUID()}`;

  const input = {
    branchId: room.branchId,
    checkIn,
    checkOut,
    guestCount: 2,
    rooms: [
      {
        roomTypeId: room.roomTypeId,
        quantity: 1,
      },
    ],
  };

  const attempts = [1, 2].map((number) =>
    createBooking(input, {
      guest: {
        name: `Concurrency Test ${number}`,
        email: `${marker}-${number}@example.invalid`,
        phone: "0000000000",
      },
    })
  );

  const results = await Promise.allSettled(attempts);

  let createdBookingIds: string[] = [];

  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      createdBookingIds.push(result.value.booking.id);
      console.log(
        `Request ${index + 1}: CREATED — ${result.value.booking.id}`
      );
    } else {
      const error = result.reason;

      if (error instanceof BookingError) {
        console.log(
          `Request ${index + 1}: REJECTED — HTTP ${error.statusCode}`
        );
      } else {
        console.log(
          `Request ${index + 1}: ERROR —`,
          error instanceof Error ? error.message : error
        );
      }
    }
  });

  // Find all active bookings occupying this room for these dates.
  const overlapping = await prisma.bookingRoom.findMany({
    where: {
      roomId: room.id,
      booking: {
        status: { in: ["PENDING", "CONFIRMED"] },
        checkIn: { lt: new Date(`${checkOut}T00:00:00Z`) },
        checkOut: { gt: new Date(`${checkIn}T00:00:00Z`) },
      },
    },
    select: {
      bookingId: true,
    },
  });

  console.log(`\nActive overlapping reservations: ${overlapping.length}`);

  const rejectedWithConflict = results.filter(
    (result) =>
      result.status === "rejected" &&
      result.reason instanceof BookingError &&
      result.reason.statusCode === 409
  ).length;

  const passed =
    createdBookingIds.length === 1 &&
    rejectedWithConflict === 1 &&
    overlapping.length === 1 &&
    overlapping[0].bookingId === createdBookingIds[0];

  console.log(
    passed
      ? "\nPASS — Concurrent double booking prevented."
      : "\nFAIL — Expected one booking and one HTTP 409 conflict."
  );

  // Cancel only the bookings created by this test.
  // Keep records for audit; do not delete anything.
  try {
    if (createdBookingIds.length > 0) {
      const cleanup = await prisma.booking.updateMany({
        where: {
          id: { in: createdBookingIds },
          status: "PENDING",
          guestEmail: {
            startsWith: marker,
          },
        },
        data: {
          status: "CANCELLED",
        },
      });

      console.log(
        `Cleanup: ${cleanup.count} test booking(s) cancelled.`
      );

      if (cleanup.count !== createdBookingIds.length) {
        throw new Error("Incomplete test booking cleanup.");
      }
    }
  } finally {
    await prisma.$disconnect();
  }

  if (!passed) {
    process.exitCode = 1;
  }
}

main().catch(async (error) => {
  console.error("\nTEST ERROR:", error);
  process.exitCode = 1;
  await prisma.$disconnect();
});
