
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";

const router = Router();

const querySchema = z.object({
  checkIn: z.iso.date(),
  checkOut: z.iso.date(),
  guests: z.coerce.number().int().positive(),
});

router.get("/:id/availability", async (req, res) => {
  const branchId = z.uuid().safeParse(req.params.id);
  const query = querySchema.safeParse(req.query);

  if (!branchId.success || !query.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid branch ID or availability parameters",
    });
  }

  const { checkIn, checkOut, guests } = query.data;

  if (checkIn >= checkOut) {
    return res.status(400).json({
      success: false,
      message: "Check-out must be after check-in",
    });
  }

  try {
    const branch = await prisma.branch.findFirst({
      where: {
        id: branchId.data,
        isActive: true,
      },
      select: { id: true },
    });

    if (!branch) {
      return res.status(404).json({
        success: false,
        message: "Hotel branch not found",
      });
    }

    const roomTypes = await prisma.roomType.findMany({
      where: {
        branchId: branchId.data,
        isActive: true,
        maxGuests: { gte: guests },
      },
      include: {
        rooms: {
          where: {
            isActive: true,
            bookingRooms: {
              none: {
                booking: {
                    status: "CONFIRMED",
                    checkIn: { lt: new Date(checkOut) },
                    checkOut: { gt: new Date(checkIn) },
                },
              },
            },
          },
          select: { id: true },
        },
      },
      orderBy: { basePrice: "asc" },
    });

    const availability = roomTypes.map((roomType) => ({
      roomTypeId: roomType.id,
      name: roomType.name,
      maxGuests: roomType.maxGuests,
      basePrice: roomType.basePrice,
      currency: roomType.currency,
      availableRooms: roomType.rooms.length,
    }));

    return res.status(200).json({
      success: true,
      data: availability,
    });
  } catch (error) {
    console.error("Failed to check availability:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to check availability",
    });
  }
});

export default router;
