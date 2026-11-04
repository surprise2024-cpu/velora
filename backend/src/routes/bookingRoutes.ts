
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

const bookingSchema = z.object({
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

router.post("/", requireAuth, async (req, res) => {
  const parsed = bookingSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid booking details",
      errors: parsed.error.flatten(),
    });
  }

  const {
    branchId,
    checkIn,
    checkOut,
    guestCount,
    rooms,
  } = parsed.data;

  const today = new Date().toISOString().slice(0, 10);

  const checkInDate = new Date(`${checkIn}T00:00:00Z`);
  const checkOutDate = new Date(`${checkOut}T00:00:00Z`);

  const stayNights =
    (checkOutDate.getTime() - checkInDate.getTime()) /
    (24 * 60 * 60 * 1000);

  if (
    checkIn < today ||
    stayNights <= 0 ||
    stayNights > 30
  ) {
    return res.status(400).json({
      success: false,
      message: "Invalid booking dates",
    });
  }

  const totalRooms = rooms.reduce(
    (sum, room) => sum + room.quantity,
    0
  );

  if (totalRooms > 10) {
    return res.status(400).json({
      success: false,
      message: "A booking cannot exceed 10 rooms",
    });
  }

  if (new Set(rooms.map((room) => room.roomTypeId)).size !== rooms.length) {
    return res.status(400).json({
      success: false,
      message: "Duplicate room types are not allowed",
    });
  }

  try {
    const booking = await prisma.$transaction(async (tx) => {
      // Serialize booking allocations across concurrent requests.
      // All booking creation paths must use this same lock.
      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(
          hashtextextended(${branchId}, 0)
        )
      `;

      const branch = await tx.branch.findFirst({
        where: {
          id: branchId,
          isActive: true,
        },
        select: { id: true },
      });

      if (!branch) {
        throw new Error("BRANCH_NOT_FOUND");
      }

      const selectedRooms: {
        roomId: string;
        price: string;
      }[] = [];

      let totalCapacity = 0;

      for (const requested of rooms) {
        const roomType = await tx.roomType.findFirst({
          where: {
            id: requested.roomTypeId,
            branchId,
            isActive: true,
          },
        });

        if (!roomType) {
          throw new Error("ROOM_TYPE_NOT_FOUND");
        }

        totalCapacity += roomType.maxGuests * requested.quantity;

        const availableRooms = await tx.room.findMany({
          where: {
            branchId,
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

        if (availableRooms.length < requested.quantity) {
          throw new Error("INSUFFICIENT_AVAILABILITY");
        }

        for (const room of availableRooms) {
          selectedRooms.push({
            roomId: room.id,
            price: roomType.basePrice.toString(),
          });
        }
      }

      if (guestCount > totalCapacity) {
        throw new Error("GUEST_CAPACITY_EXCEEDED");
      }

      return tx.booking.create({
        data: {
          userId: res.locals.authUser.id,
          checkIn: checkInDate,
          checkOut: checkOutDate,
          guestCount,
          status: "PENDING",
          bookingRooms: {
            create: selectedRooms.map((room) => ({
              roomId: room.roomId,
              price: room.price,
            })),
          },
        },
        include: {
          bookingRooms: {
            include: {
              room: {
                include: {
                  roomType: true,
                },
              },
            },
          },
        },
      });
    });

    return res.status(201).json({
      success: true,
      message: "Booking created successfully",
      data: booking,
    });
  } catch (error) {
    if (error instanceof Error) {
      const knownErrors: Record<string, [number, string]> = {
        BRANCH_NOT_FOUND: [404, "Hotel branch not found"],
        ROOM_TYPE_NOT_FOUND: [404, "Room type not found"],
        INSUFFICIENT_AVAILABILITY: [
          409,
          "Not enough rooms available for the selected dates",
        ],
        GUEST_CAPACITY_EXCEEDED: [
          400,
          "Guest count exceeds selected room capacity",
        ],
      };

      const known = knownErrors[error.message];

      if (known) {
        return res.status(known[0]).json({
          success: false,
          message: known[1],
        });
      }
    }

    console.error("Failed to create booking:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create booking",
    });
  }
});


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
    console.error("Failed to retrieve bookings:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve bookings",
    });
  }
});


export default router;
