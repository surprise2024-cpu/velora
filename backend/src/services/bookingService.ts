
import {
  randomBytes,
  createHash,
  createHmac,
  timingSafeEqual,
} from "node:crypto";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";

export const bookingSchema = z.object({
  branchId: z.uuid(),
  checkIn: z.iso.date(),
  checkOut: z.iso.date(),
  guestCount: z.number().int().positive(),
  rooms: z.array(
    z.object({
      roomTypeId: z.uuid(),
      quantity: z.number().int().positive(),
    })
  ).min(1),
});

export const guestBookingSchema = bookingSchema.extend({
  guestName: z.string().trim().min(2).max(120),
  guestEmail: z.email().max(254),
  guestPhone: z.string().trim().min(7).max(30),
});

export const checkoutIdentitySchema = z.object({
  idempotencyKey: z.uuid(),
  checkoutSecret: z.string().regex(/^[a-f0-9]{64}$/),
});

type BookingInput = z.infer<typeof bookingSchema>;

type CustomerDetails =
  | { userId: string; guest?: never }
  | {
      userId?: never;
      guest: {
        name: string;
        email: string;
        phone: string;
      };
    };

type CheckoutIdentity = z.infer<
  typeof checkoutIdentitySchema
>;

export class BookingError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "BookingError";
  }
}

function validateBooking(input: BookingInput) {
  const today = new Date().toISOString().slice(0, 10);

  const checkInDate = new Date(
    `${input.checkIn}T00:00:00Z`
  );

  const checkOutDate = new Date(
    `${input.checkOut}T00:00:00Z`
  );

  const stayNights =
    (checkOutDate.getTime() - checkInDate.getTime()) /
    86_400_000;

  if (
    input.checkIn < today ||
    !Number.isInteger(stayNights) ||
    stayNights <= 0 ||
    stayNights > 30
  ) {
    throw new BookingError(400, "Invalid booking dates");
  }

  const totalRooms = input.rooms.reduce(
    (sum, room) => sum + room.quantity,
    0
  );

  if (totalRooms > 10) {
    throw new BookingError(
      400,
      "A booking cannot exceed 10 rooms"
    );
  }

  if (
    new Set(input.rooms.map((room) => room.roomTypeId))
      .size !== input.rooms.length
  ) {
    throw new BookingError(
      400,
      "Duplicate room types are not allowed"
    );
  }

  return { checkInDate, checkOutDate };
}

function hashValue(value: string): string {
  return createHash("sha256")
    .update(value)
    .digest("hex");
}

function deriveGuestToken(
  checkout: CheckoutIdentity
): string {
  const secret = process.env.CHECKOUT_RECOVERY_SECRET;

  if (!secret || !/^[a-fA-F0-9]{64}$/.test(secret)) {
    throw new Error(
      "Checkout recovery secret is not configured"
    );
  }

  return createHmac(
    "sha256",
    Buffer.from(secret, "hex")
  )
    .update("velora-guest-booking-v1:")
    .update(checkout.idempotencyKey)
    .update(":")
    .update(checkout.checkoutSecret)
    .digest("hex");
}

function createRequestHash(
  input: BookingInput,
  customer: CustomerDetails,
  checkout: CheckoutIdentity
): string {
  const normalizedRooms = [...input.rooms]
    .sort((a, b) =>
      a.roomTypeId.localeCompare(b.roomTypeId)
    )
    .map((room) => ({
      roomTypeId: room.roomTypeId,
      quantity: room.quantity,
    }));

  let identity:
    | {
        type: "customer";
        userId: string;
      }
    | {
        type: "guest";
        name: string;
        email: string;
        phone: string;
      };

  if (customer.userId) {
    identity = {
      type: "customer",
      userId: customer.userId,
    };
  } else if (customer.guest) {
    identity = {
      type: "guest",
      name: customer.guest.name.trim(),
      email: customer.guest.email.trim().toLowerCase(),
      phone: customer.guest.phone.trim(),
    };
  } else {
    throw new BookingError(
      400,
      "Customer or guest information is required"
    );
  }


  return hashValue(
    JSON.stringify({
      version: 1,
      identity,
      checkoutSecretHash: hashValue(
        checkout.checkoutSecret
      ),
      branchId: input.branchId,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      guestCount: input.guestCount,
      rooms: normalizedRooms,
    })
  );
}

function hashesMatch(
  supplied: string,
  stored: string
): boolean {
  if (
    !/^[a-f0-9]{64}$/.test(supplied) ||
    !/^[a-f0-9]{64}$/.test(stored)
  ) {
    return false;
  }

  return timingSafeEqual(
    Buffer.from(supplied, "hex"),
    Buffer.from(stored, "hex")
  );
}

const bookingInclude = {
  bookingRooms: {
    include: {
      room: {
        include: {
          roomType: true,
        },
      },
    },
  },
} as const;

export async function createBooking(
  input: BookingInput,
  customer: CustomerDetails,
  checkout?: CheckoutIdentity
) {
  const { checkInDate, checkOutDate } =
    validateBooking(input);

  const validatedCheckout = checkout
    ? checkoutIdentitySchema.parse(checkout)
    : null;

  const requestHash = validatedCheckout
    ? createRequestHash(
        input,
        customer,
        validatedCheckout
      )
    : null;

  const guestToken = customer.guest
    ? validatedCheckout
      ? deriveGuestToken(validatedCheckout)
      : randomBytes(32).toString("hex")
    : null;

  const guestTokenHash = guestToken
    ? hashValue(guestToken)
    : null;

  const booking = await prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(
          hashtextextended(${input.branchId}, 0)
        )
      `;

      if (validatedCheckout) {
        const existing = await tx.booking.findUnique({
          where: {
            idempotencyKey:
              validatedCheckout.idempotencyKey,
          },
          include: bookingInclude,
        });

        if (existing) {
          if (
            !requestHash ||
            !existing.checkoutRequestHash ||
            !hashesMatch(
              requestHash,
              existing.checkoutRequestHash
            ) ||
            (customer.userId
              ? existing.userId !== customer.userId
              : existing.userId !== null ||
                existing.guestAccessTokenHash !==
                  guestTokenHash)
          ) {
            throw new BookingError(
              409,
              "Checkout identifier has already been used for another request"
            );
          }

          return existing;
        }
      }

      const branch = await tx.branch.findFirst({
        where: {
          id: input.branchId,
          isActive: true,
        },
        select: { id: true },
      });

      if (!branch) {
        throw new BookingError(
          404,
          "Hotel branch not found"
        );
      }

      const selectedRooms: {
        roomId: string;
        price: string;
      }[] = [];

      let totalCapacity = 0;

      for (const requested of input.rooms) {
        const roomType = await tx.roomType.findFirst({
          where: {
            id: requested.roomTypeId,
            branchId: input.branchId,
            isActive: true,
          },
        });

        if (!roomType) {
          throw new BookingError(
            404,
            "Room type not found"
          );
        }

        totalCapacity +=
          roomType.maxGuests * requested.quantity;

        const availableRooms = await tx.room.findMany({
          where: {
            branchId: input.branchId,
            roomTypeId: roomType.id,
            isActive: true,
            bookingRooms: {
              none: {
                booking: {
                  status: {
                    in: ["PENDING", "CONFIRMED"],
                  },
                  checkIn: { lt: checkOutDate },
                  checkOut: { gt: checkInDate },
                },
              },
            },
          },
          take: requested.quantity,
          orderBy: { roomNumber: "asc" },
          select: { id: true },
        });

        if (
          availableRooms.length < requested.quantity
        ) {
          throw new BookingError(
            409,
            "Not enough rooms available for the selected dates"
          );
        }

        for (const room of availableRooms) {
          selectedRooms.push({
            roomId: room.id,
            price: roomType.basePrice.toString(),
          });
        }
      }

      if (input.guestCount > totalCapacity) {
        throw new BookingError(
          400,
          "Guest count exceeds selected room capacity"
        );
      }

      return tx.booking.create({
        data: {
          idempotencyKey:
            validatedCheckout?.idempotencyKey ?? null,
          checkoutRequestHash: requestHash,
          userId: customer.userId ?? null,
          guestName: customer.guest?.name ?? null,
          guestEmail:
            customer.guest?.email.toLowerCase() ??
            null,
          guestPhone: customer.guest?.phone ?? null,
          guestAccessTokenHash: guestTokenHash,
          checkIn: checkInDate,
          checkOut: checkOutDate,
          guestCount: input.guestCount,
          status: "PENDING",
          bookingRooms: {
            create: selectedRooms.map((room) => ({
              roomId: room.roomId,
              price: room.price,
            })),
          },
        },
        include: bookingInclude,
      });
    }
  );

  return {
    booking,
    guestToken,
  };
}
