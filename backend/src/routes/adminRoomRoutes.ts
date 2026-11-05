
import { Router } from "express";
import { z } from "zod";
import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import { requireAdmin } from "../middleware/requireAdmin.js";

const router = Router();

router.use(requireAdmin);

async function lockBranch(
  tx: Prisma.TransactionClient,
  branchId: string
) {
  await tx.$executeRaw`
    SELECT pg_advisory_xact_lock(
      hashtextextended(${branchId}::text, 0)
    )
  `;
}


// Protect future confirmed bookings and pending bookings
// with unresolved or completed payments.

async function countProtectedReservations(
  tx: Prisma.TransactionClient,
  roomId: string
) {
  const dates = await tx.$queryRaw<{ today: Date }[]>`
    SELECT CURRENT_DATE AS today
  `;

  const today = dates[0]?.today;

  if (!today) {
    throw new Error("Unable to determine database date");
  }

  return tx.booking.count({
    where: {
      checkOut: {
        gt: today,
      },
      bookingRooms: {
        some: {
          roomId,
        },
      },
      OR: [
        {
          status: "CONFIRMED",
        },
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
}


// =====================================================
// GET ALL PHYSICAL ROOMS
// =====================================================

router.get("/rooms", async (_req, res, next) => {
  try {
    const rooms = await prisma.room.findMany({
      select: {
        id: true,
        branchId: true,
        roomTypeId: true,
        roomNumber: true,
        floor: true,
        isActive: true,
        branch: {
          select: {
            id: true,
            name: true,
            city: true,
            isActive: true,
          },
        },
        roomType: {
          select: {
            id: true,
            name: true,
            maxGuests: true,
            basePrice: true,
            currency: true,
            isActive: true,
          },
        },
      },
      orderBy: [
        { branch: { name: "asc" } },
        { roomNumber: "asc" },
      ],
    });

    return res.status(200).json({
      success: true,
      data: rooms,
    });
  } catch (error) {
    next(error);
  }
});

// =====================================================
// CREATE PHYSICAL ROOM
// =====================================================

const createRoomSchema = z.object({
  branchId: z.uuid(),
  roomTypeId: z.uuid(),
  roomNumber: z.string().trim().min(1).max(20),
  floor: z.number().int().optional(),
});

router.post("/rooms", async (req, res, next) => {
  const parsed = createRoomSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid room details",
    });
  }

  const data = parsed.data;

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        await lockBranch(tx, data.branchId);

        const roomType = await tx.roomType.findFirst({
          where: {
            id: data.roomTypeId,
            branchId: data.branchId,
            isActive: true,
            branch: {
              isActive: true,
            },
          },
          select: {
            id: true,
          },
        });

        if (!roomType) {
          return {
            status: 404,
            message:
              "Active room type not found at this accommodation",
          };
        }

        const room = await tx.room.create({
          data: {
            branchId: data.branchId,
            roomTypeId: data.roomTypeId,
            roomNumber: data.roomNumber,
            ...(data.floor !== undefined && {
              floor: data.floor,
            }),
          },
        });

        return {
          status: 201,
          message: "Room created successfully",
          data: room,
        };
      },
      { timeout: 15000 }
    );

    return res.status(result.status).json({
      success: result.status === 201,
      message: result.message,
      ...("data" in result ? { data: result.data } : {}),
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return res.status(409).json({
        success: false,
        message:
          "Room number already exists at this accommodation",
      });
    }

    next(error);
  }
});

// =====================================================
// EDIT ROOM DETAILS
// Active status changes are intentionally excluded.
// =====================================================

const updateRoomSchema = z
  .object({
    roomNumber: z.string().trim().min(1).max(20).optional(),
    floor: z.number().int().optional(),
  })
  .strict()
  .refine(
    (data) => Object.keys(data).length > 0,
    "At least one field must be provided"
  );

router.patch("/rooms/:id", async (req, res, next) => {
  const parsedId = z.uuid().safeParse(req.params.id);
  const parsed = updateRoomSchema.safeParse(req.body);

  if (!parsedId.success || !parsed.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid room update",
    });
  }

  try {
    // Read the branch ID before taking the branch lock.
    const existing = await prisma.room.findUnique({
      where: {
        id: parsedId.data,
      },
      select: {
        id: true,
        branchId: true,
      },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Room not found",
      });
    }

    const result = await prisma.$transaction(
      async (tx) => {
        await lockBranch(tx, existing.branchId);

        const current = await tx.room.findUnique({
          where: {
            id: existing.id,
          },
          select: {
            id: true,
            branchId: true,
            branch: {
              select: {
                isActive: true,
              },
            },
            roomType: {
              select: {
                isActive: true,
              },
            },
          },
        });

        if (
          !current ||
          current.branchId !== existing.branchId ||
          !current.branch.isActive ||
          !current.roomType.isActive
        ) {
          return {
            status: 404,
            message:
              "Room not found at an active accommodation",
          };
        }

        const room = await tx.room.update({
          where: {
            id: current.id,
          },
          data: {
            ...(parsed.data.roomNumber !== undefined && {
              roomNumber: parsed.data.roomNumber,
            }),
            ...(parsed.data.floor !== undefined && {
              floor: parsed.data.floor,
            }),
          },
        });

        return {
          status: 200,
          message: "Room updated successfully",
          data: room,
        };
      },
      { timeout: 15000 }
    );

    return res.status(result.status).json({
      success: result.status === 200,
      message: result.message,
      ...("data" in result ? { data: result.data } : {}),
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return res.status(409).json({
        success: false,
        message:
          "Room number already exists at this accommodation",
      });
    }

    next(error);
  }
});

// =====================================================
// ACTIVATE PHYSICAL ROOM
// =====================================================

router.patch(
  "/rooms/:id/activate",
  async (req, res, next) => {
    const parsedId = z.uuid().safeParse(req.params.id);

    if (!parsedId.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid room ID",
      });
    }

    try {
      const existing = await prisma.room.findUnique({
        where: {
          id: parsedId.data,
        },
        select: {
          id: true,
          branchId: true,
        },
      });

      if (!existing) {
        return res.status(404).json({
          success: false,
          message: "Room not found",
        });
      }

      const result = await prisma.$transaction(
        async (tx) => {
          await lockBranch(tx, existing.branchId);

          const room = await tx.room.findUnique({
            where: {
              id: existing.id,
            },
            select: {
              id: true,
              branchId: true,
              isActive: true,
              branch: {
                select: {
                  isActive: true,
                },
              },
              roomType: {
                select: {
                  isActive: true,
                },
              },
            },
          });

          if (
            !room ||
            room.branchId !== existing.branchId
          ) {
            return {
              status: 404,
              message: "Room not found",
            };
          }

          if (!room.branch.isActive) {
            return {
              status: 409,
              message:
                "Cannot activate a room in an inactive branch",
            };
          }

          if (!room.roomType.isActive) {
            return {
              status: 409,
              message:
                "Cannot activate a room with an inactive room type",
            };
          }

          if (room.isActive) {
            return {
              status: 409,
              message: "Room is already active",
            };
          }

          const updated = await tx.room.update({
            where: {
              id: room.id,
            },
            data: {
              isActive: true,
            },
          });

          return {
            status: 200,
            message: "Room activated successfully",
            data: updated,
          };
        },
        { timeout: 15000 }
      );

      return res.status(result.status).json({
        success: result.status === 200,
        message: result.message,
        ...("data" in result ? { data: result.data } : {}),
      });
    } catch (error) {
      next(error);
    }
  }
);

// =====================================================
// DEACTIVATE PHYSICAL ROOM
// =====================================================

router.delete("/rooms/:id", async (req, res, next) => {
  const parsedId = z.uuid().safeParse(req.params.id);

  if (!parsedId.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid room ID",
    });
  }

  try {
    const existing = await prisma.room.findUnique({
      where: {
        id: parsedId.data,
      },
      select: {
        id: true,
        branchId: true,
      },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Room not found",
      });
    }

    const result = await prisma.$transaction(
      async (tx) => {
        await lockBranch(tx, existing.branchId);

        const room = await tx.room.findUnique({
          where: {
            id: existing.id,
          },
          select: {
            id: true,
            branchId: true,
            isActive: true,
          },
        });

        if (
          !room ||
          room.branchId !== existing.branchId
        ) {
          return {
            status: 404,
            message: "Room not found",
          };
        }

        if (!room.isActive) {
          return {
            status: 409,
            message: "Room is already inactive",
          };
        }

        const protectedCount =
          await countProtectedReservations(tx, room.id);

        if (protectedCount > 0) {
          return {
            status: 409,
            message:
              `Cannot deactivate this room. ` +
              `${protectedCount} protected future ` +
              `reservation(s) exist.`,
          };
        }

        const updated = await tx.room.update({
          where: {
            id: room.id,
          },
          data: {
            isActive: false,
          },
        });

        return {
          status: 200,
          message: "Room deactivated successfully",
          data: updated,
        };
      },
      { timeout: 15000 }
    );

    return res.status(result.status).json({
      success: result.status === 200,
      message: result.message,
      ...("data" in result ? { data: result.data } : {}),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
