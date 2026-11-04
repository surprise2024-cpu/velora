
import { Router, type Request, type Response } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAdmin } from "../middleware/requireAdmin.js";
import { z } from "zod";


const router = Router();

router.get("/bookings", requireAdmin, async (_req: Request, res: Response) => {
  try {
    const bookings = await prisma.booking.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        bookingRooms: {
          include: {
            room: {
              include: {
                branch: {
                  select: {
                    id: true,
                    name: true,
                    city: true,
                  },
                },
                roomType: {
                  select: {
                    id: true,
                    name: true,
                    maxGuests: true,
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

    if (
      error instanceof Error &&
      error.message === "BOOKING_PAYMENT_PENDING"
    ) {
      return res.status(409).json({
        success: false,
        message: "Booking has an active payment attempt",
      });
    }

    console.error("Failed to retrieve reservations:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve reservations",
    });
  }
});


router.patch(
  "/bookings/:id/approve",
  requireAdmin,
  async (req: Request, res: Response) => {
    const bookingId = z.uuid().safeParse(req.params.id);

    if (!bookingId.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking ID",
      });
    }

    
    try {
      const updatedBooking = await prisma.$transaction(
        async (tx) => {
            
          // Coordinate with cancellation and modification.
          await tx.$executeRaw`
            SELECT pg_advisory_xact_lock(
              hashtextextended(${bookingId.data}, 1)
            )
          `;

          const activePayment = await tx.payment.findFirst({
            where: {
              bookingId: bookingId.data,
              status: "PENDING",
            },
            select: {
              id: true,
            },
          });

          if (activePayment) {
            throw new Error("BOOKING_PAYMENT_PENDING");
          }


          const result = await tx.booking.updateMany({
            where: {
              id: bookingId.data,
              status: "PENDING",
            },
            data: {
              status: "CONFIRMED",
            },
          });

          if (result.count === 0) {
            throw new Error("BOOKING_NOT_APPROVABLE");
          }

          return tx.booking.findUnique({
            where: { id: bookingId.data },
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
        }
      );

      return res.status(200).json({
        success: true,
        message: "Booking approved successfully",
        data: updatedBooking,
      });
    } catch (error) {

      if (
        error instanceof Error &&
        error.message === "BOOKING_PAYMENT_PENDING"
      ) {
        return res.status(409).json({
          success: false,
          message: "Booking has an active payment attempt",
        });
      }

      if (
        error instanceof Error &&
        error.message === "BOOKING_NOT_APPROVABLE"
      ) {
        return res.status(409).json({
          success: false,
          message: "Booking not found or is not pending",
        });
      }

      console.error("Failed to approve booking:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to approve booking",
      });
    }

  }
);


router.patch(
  "/bookings/:id/cancel",
  requireAdmin,
  async (req: Request, res: Response) => {
    const bookingId = z.uuid().safeParse(req.params.id);

    if (!bookingId.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking ID",
      });
    }

    
    try {
      const cancelledBooking = await prisma.$transaction(
        async (tx) => {

          // Coordinate with reservation modifications.
          await tx.$executeRaw`
            SELECT pg_advisory_xact_lock(
              hashtextextended(${bookingId.data}, 1)
            )
          `;

          const activePayment = await tx.payment.findFirst({
            where: {
              bookingId: bookingId.data,
              status: "PENDING",
            },
            select: {
              id: true,
            },
          });

          if (activePayment) {
            throw new Error("BOOKING_PAYMENT_PENDING");
          }

          const result = await tx.booking.updateMany({
            where: {
              id: bookingId.data,
              status: {
                in: ["PENDING", "CONFIRMED"],
              },
            },
            data: {
              status: "CANCELLED",
            },
          });

          if (result.count === 0) {
            throw new Error("BOOKING_NOT_CANCELLABLE");
          }

          return tx.booking.findUnique({
            where: { id: bookingId.data },
            include: {
              bookingRooms: {
                include: {
                  room: {
                    select: {
                      id: true,
                      roomNumber: true,
                      branchId: true,
                    },
                  },
                },
              },
            },
          });
        }
      );

      return res.status(200).json({
        success: true,
        message: "Booking cancelled successfully",
        data: cancelledBooking,
      });
    } catch (error) {

      if (
        error instanceof Error &&
        error.message === "BOOKING_PAYMENT_PENDING"
      ) {
        return res.status(409).json({
          success: false,
          message: "Booking has an active payment attempt",
        });
      }

      if (
        error instanceof Error &&
        error.message === "BOOKING_NOT_CANCELLABLE"
      ) {
        return res.status(409).json({
          success: false,
          message: "Booking not found or already cancelled",
        });
      }

      console.error("Failed to cancel booking:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to cancel booking",
      });
    }

  }
);


const modifyBookingSchema = z.object({
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

router.patch(
  "/bookings/:id",
  requireAdmin,
  async (req: Request, res: Response) => {
    const bookingId = z.uuid().safeParse(req.params.id);
    const parsed = modifyBookingSchema.safeParse(req.body);

    if (!bookingId.success || !parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid reservation modification details",
      });
    }

    const { checkIn, checkOut, guestCount, rooms } = parsed.data;

    const today = new Date().toISOString().slice(0, 10);
    const checkInDate = new Date(`${checkIn}T00:00:00Z`);
    const checkOutDate = new Date(`${checkOut}T00:00:00Z`);

    const stayNights =
      (checkOutDate.getTime() - checkInDate.getTime()) /
      (24 * 60 * 60 * 1000);

    if (checkIn < today || stayNights <= 0 || stayNights > 30) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking dates",
      });
    }

    const totalRooms = rooms.reduce(
      (sum, room) => sum + room.quantity,
      0
    );

    if (
      totalRooms > 10 ||
      new Set(rooms.map((room) => room.roomTypeId)).size !== rooms.length
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid room selection",
      });
    }

    try {
      const updatedBooking = await prisma.$transaction(async (tx) => {

        // Serialize modifications to the same reservation.
        await tx.$executeRaw`
            SELECT pg_advisory_xact_lock(
            hashtextextended(${bookingId.data}, 1)
            )
        `;

        const existing = await tx.booking.findUnique({
          where: { id: bookingId.data },
          include: {
            bookingRooms: {
              include: {
                room: true,
              },
            },
          },
        });

        if (!existing) {
          throw new Error("BOOKING_NOT_FOUND");
        }

        if (existing.status === "CANCELLED") {
          throw new Error("BOOKING_CANCELLED");
        }

        
        const activePayment = await tx.payment.findFirst({
          where: {
            bookingId: existing.id,
            status: "PENDING",
          },
          select: {
            id: true,
          },
        });

        if (activePayment) {
          throw new Error("BOOKING_PAYMENT_PENDING");
}


        const branchIds = [
          ...new Set(
            existing.bookingRooms.map(
              (item) => item.room.branchId
            )
          ),
        ];

        if (branchIds.length !== 1) {
          throw new Error("INVALID_BOOKING_BRANCH");
        }

        const branchId = branchIds[0]!;

        // Match the advisory lock used during booking creation.
        await tx.$executeRaw`
          SELECT pg_advisory_xact_lock(
            hashtextextended(${branchId}, 0)
          )
        `;

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
              branch: {
                isActive: true,
              },
            },
          });

          if (!roomType) {
            throw new Error("ROOM_TYPE_NOT_FOUND");
          }

          totalCapacity +=
            roomType.maxGuests * requested.quantity;

          const availableRooms = await tx.room.findMany({
            where: {
              branchId,
              roomTypeId: roomType.id,
              isActive: true,
              bookingRooms: {
                none: {
                  bookingId: {
                    not: existing.id,
                  },
                  booking: {
                    status: {
                      in: ["PENDING", "CONFIRMED"],
                    },
                    checkIn: {
                      lt: checkOutDate,
                    },
                    checkOut: {
                      gt: checkInDate,
                    },
                  },
                },
              },
            },
            take: requested.quantity,
            orderBy: {
              roomNumber: "asc",
            },
            select: {
              id: true,
            },
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

        await tx.bookingRoom.deleteMany({
          where: {
            bookingId: existing.id,
          },
        });

        return tx.booking.update({
          where: {
            id: existing.id,
          },
          data: {
            checkIn: checkInDate,
            checkOut: checkOutDate,
            guestCount,
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
                    branch: true,
                  },
                },
              },
            },
          },
        });
      });

      return res.status(200).json({
        success: true,
        message: "Booking modified successfully",
        data: updatedBooking,
      });
    } catch (error) {
      if (error instanceof Error) {
        const knownErrors: Record<string, [number, string]> = {
          BOOKING_PAYMENT_PENDING: [
            409,
            "Booking has an active payment attempt",
          ],
          BOOKING_NOT_FOUND: [404, "Booking not found"],
          BOOKING_CANCELLED: [
            409,
            "Cancelled bookings cannot be modified",
          ],
          INVALID_BOOKING_BRANCH: [
            409,
            "Booking has invalid branch assignments",
          ],
          ROOM_TYPE_NOT_FOUND: [
            404,
            "Room type not found",
          ],
          INSUFFICIENT_AVAILABILITY: [
            409,
            "Not enough rooms available",
          ],
          GUEST_CAPACITY_EXCEEDED: [
            400,
            "Guest count exceeds room capacity",
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

      console.error("Failed to modify booking:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to modify booking",
      });
    }
  }
);


export default router;
