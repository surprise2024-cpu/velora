
import { Router } from "express";
import { z } from "zod";
import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import { requireAdmin } from "../middleware/requireAdmin.js";

const router = Router();

router.use(requireAdmin);


router.get("/room-types", async (_req, res, next) => {
  try {
    const roomTypes = await prisma.roomType.findMany({
      select: {
        id: true,
        branchId: true,
        name: true,
        description: true,
        maxGuests: true,
        basePrice: true,
        currency: true,
        isActive: true,
        images: true,
        amenities: true,
        createdAt: true,
        updatedAt: true,
        branch: {
          select: {
            id: true,
            name: true,
            city: true,
            isActive: true,
          },
        },
        _count: {
          select: {
            rooms: true,
          },
        },
      },
      orderBy: [
        {
          branch: {
            name: "asc",
          },
        },
        {
          name: "asc",
        },
      ],
    });

    return res.status(200).json({
      success: true,
      data: roomTypes,
    });
  } catch (error) {
    next(error);
  }
});


const createRoomTypeSchema = z.object({
  name: z.string().trim().min(1).max(150),
  description: z.string().trim().optional(),
  maxGuests: z.number().int().positive(),
  basePrice: z.number().positive(),
  currency: z.string().trim().length(3).default("ZAR"),
  images: z.array(z.url()).default([]),
  amenities: z.array(z.string().trim().min(1)).default([]),
});

router.post(
  "/branches/:branchId/room-types",
  async (req, res, next) => {
    const branchId = z.uuid().safeParse(req.params.branchId);
    const parsed = createRoomTypeSchema.safeParse(req.body);

    if (!branchId.success || !parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid room type details",
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
          message: "Active accommodation not found",
        });
      }

      const data = parsed.data;

      const roomType = await prisma.roomType.create({
        data: {
          branchId: branchId.data,
          name: data.name,
          maxGuests: data.maxGuests,
          basePrice: data.basePrice,
          currency: data.currency.toUpperCase(),
          images: data.images,
          amenities: data.amenities,
          ...(data.description !== undefined && {
            description: data.description,
          }),
        },
      });

      return res.status(201).json({
        success: true,
        message: "Room type created successfully",
        data: roomType,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return res.status(409).json({
          success: false,
          message: "Room type already exists at this accommodation",
        });
      }

      next(error);
    }
  }
);


const updateRoomTypeSchema = createRoomTypeSchema
  .partial()
  .refine(
    (data) => Object.keys(data).length > 0,
    "At least one field must be provided"
  );

router.patch("/room-types/:id", async (req, res, next) => {
  const parsedId = z.uuid().safeParse(req.params.id);
  const parsed = updateRoomTypeSchema.safeParse(req.body);

  if (!parsedId.success || !parsed.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid room type update",
    });
  }

  try {
    const existing = await prisma.roomType.findUnique({
      where: { id: parsedId.data },
      select: {
        id: true,
        branch: {
          select: { isActive: true },
        },
      },
    });

    if (!existing || !existing.branch.isActive) {
      return res.status(404).json({
        success: false,
        message: "Active room type not found",
      });
    }

    const data = parsed.data;

    const roomType = await prisma.roomType.update({
      where: { id: parsedId.data },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && {
          description: data.description,
        }),
        ...(data.maxGuests !== undefined && {
          maxGuests: data.maxGuests,
        }),
        ...(data.basePrice !== undefined && {
          basePrice: data.basePrice,
        }),
        ...(data.currency !== undefined && {
          currency: data.currency.toUpperCase(),
        }),
        ...(data.images !== undefined && {
          images: data.images,
        }),
        ...(data.amenities !== undefined && {
          amenities: data.amenities,
        }),
      },
    });

    return res.status(200).json({
      success: true,
      message: "Room type updated successfully",
      data: roomType,
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return res.status(409).json({
        success: false,
        message: "Room type name already exists at this accommodation",
      });
    }

    next(error);
  }
});



router.delete("/room-types/:id", async (req, res, next) => {
  const parsedId = z.uuid().safeParse(req.params.id);

  if (!parsedId.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid room type ID",
    });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.roomType.findUnique({
        where: { id: parsedId.data },
        select: {
          id: true,
          branchId: true,
        },
      });

      if (!existing) {
        return { outcome: "NOT_FOUND" as const };
      }

      // Coordinate with booking creation and branch operations.
      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(
          hashtextextended(${existing.branchId}::text, 0)
        )
      `;


      const roomType = await tx.roomType.findUnique({
        where: { id: existing.id },
        select: {
          id: true,
          name: true,
          isActive: true,
        },
      });

      if (!roomType) {
        return { outcome: "NOT_FOUND" as const };
      }

      if (!roomType.isActive) {
        return { outcome: "ALREADY_INACTIVE" as const };
      }

      const dates = await tx.$queryRaw<{ today: Date }[]>`
        SELECT CURRENT_DATE AS today
      `;

      const today = dates[0]?.today;

      if (!today) {
        throw new Error("Unable to determine database date");
      }

      const protectedBookings = await tx.booking.count({
        where: {
          checkOut: { gt: today },
          bookingRooms: {
            some: {
              room: {
                roomTypeId: roomType.id,
              },
            },
          },
          OR: [
            { status: "CONFIRMED" },
            {
              status: "PENDING",
              payments: {
                some: {
                  status: {
                    in: ["PENDING", "COMPLETED"],
                  },
                },
              },
            },
          ],
        },
      });

      if (protectedBookings > 0) {
        return {
          outcome: "HAS_RESERVATIONS" as const,
          count: protectedBookings,
        };
      }

      await tx.roomType.update({
        where: { id: roomType.id },
        data: { isActive: false },
      });

      return {
        outcome: "DEACTIVATED" as const,
        name: roomType.name,
      };
    });

    switch (result.outcome) {
      case "NOT_FOUND":
        return res.status(404).json({
          success: false,
          message: "Room type not found",
        });

      case "ALREADY_INACTIVE":
        return res.status(409).json({
          success: false,
          message: "Room type is already inactive",
        });

      case "HAS_RESERVATIONS":
        return res.status(409).json({
          success: false,
          message:
            `Cannot deactivate this room type. ` +
            `${result.count} protected reservation(s) ` +
            `have not yet checked out.`,
        });

      case "DEACTIVATED":
        return res.status(200).json({
          success: true,
          message: `${result.name} deactivated successfully`,
        });
    }
  } catch (error) {
    next(error);
  }
});

router.patch("/room-types/:id/activate", async (req, res, next) => {
    const parsedId = z.uuid().safeParse(req.params.id);

    if (!parsedId.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid room type ID",
      });
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        // Read the branch ID before acquiring its lock.
        const existing = await tx.roomType.findUnique({
          where: { id: parsedId.data },
          select: {
            id: true,
            branchId: true,
          },
        });

        if (!existing) {
          return { outcome: "NOT_FOUND" as const };
        }

        // Coordinate with branch and booking operations.
        await tx.$executeRaw`
          SELECT pg_advisory_xact_lock(
            hashtextextended(${existing.branchId}::text, 0)
          )
        `;


        // Recheck state after acquiring the lock.
        const roomType = await tx.roomType.findUnique({
          where: { id: existing.id },
          select: {
            id: true,
            name: true,
            isActive: true,
            branch: {
              select: { isActive: true },
            },
          },
        });

        if (!roomType) {
          return { outcome: "NOT_FOUND" as const };
        }

        if (!roomType.branch.isActive) {
          return { outcome: "BRANCH_INACTIVE" as const };
        }

        if (roomType.isActive) {
          return { outcome: "ALREADY_ACTIVE" as const };
        }

        const updated = await tx.roomType.update({
          where: { id: roomType.id },
          data: { isActive: true },
          select: {
            id: true,
            name: true,
            isActive: true,
          },
        });

        return {
          outcome: "ACTIVATED" as const,
          roomType: updated,
        };
      });

      switch (result.outcome) {
        case "NOT_FOUND":
          return res.status(404).json({
            success: false,
            message: "Room type not found",
          });

        case "BRANCH_INACTIVE":
          return res.status(409).json({
            success: false,
            message:
              "Activate the hotel branch before activating this room type",
          });

        case "ALREADY_ACTIVE":
          return res.status(409).json({
            success: false,
            message: "Room type is already active",
          });

        case "ACTIVATED":
          return res.status(200).json({
            success: true,
            message: `${result.roomType.name} activated successfully`,
            data: result.roomType,
          });
      }
    } catch (error) {
      next(error);
    }
  }
);

export default router;
