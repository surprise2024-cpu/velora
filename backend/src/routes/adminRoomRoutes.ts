
import { Router } from "express";
import { z } from "zod";
import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import { requireAdmin } from "../middleware/requireAdmin.js";

const router = Router();

router.use(requireAdmin);

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
    const roomType = await prisma.roomType.findFirst({
      where: {
        id: data.roomTypeId,
        branchId: data.branchId,
        isActive: true,
        branch: {
          isActive: true,
        },
      },
      select: { id: true },
    });

    if (!roomType) {
      return res.status(404).json({
        success: false,
        message: "Active room type not found at this accommodation",
      });
    }

    const room = await prisma.room.create({
      data: {
        branchId: data.branchId,
        roomTypeId: data.roomTypeId,
        roomNumber: data.roomNumber,
        ...(data.floor !== undefined && {
          floor: data.floor,
        }),
      },
    });

    return res.status(201).json({
      success: true,
      message: "Room created successfully",
      data: room,
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return res.status(409).json({
        success: false,
        message: "Room number already exists at this accommodation",
      });
    }

    next(error);
  }
});


const updateRoomSchema = z.object({
  roomNumber: z.string().trim().min(1).max(20).optional(),
  floor: z.number().int().optional(),
  isActive: z.boolean().optional(),
}).refine(
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
    const existing = await prisma.room.findUnique({
      where: { id: parsedId.data },
      select: {
        id: true,
        branch: {
          select: { isActive: true },
        },
        roomType: {
          select: { isActive: true },
        },
      },
    });

    if (
      !existing ||
      !existing.branch.isActive ||
      !existing.roomType.isActive
    ) {
      return res.status(404).json({
        success: false,
        message: "Room not found at an active accommodation",
      });
    }

    const room = await prisma.room.update({
      where: { id: parsedId.data },
      data: {
        ...(parsed.data.roomNumber !== undefined && {
          roomNumber: parsed.data.roomNumber,
        }),
        ...(parsed.data.floor !== undefined && {
          floor: parsed.data.floor,
        }),
        ...(parsed.data.isActive !== undefined && {
          isActive: parsed.data.isActive,
        }),
      },
    });

    return res.status(200).json({
      success: true,
      message: "Room updated successfully",
      data: room,
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return res.status(409).json({
        success: false,
        message: "Room number already exists at this accommodation",
      });
    }

    next(error);
  }
});


router.delete("/rooms/:id", async (req, res, next) => {
  const parsedId = z.uuid().safeParse(req.params.id);

  if (!parsedId.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid room ID",
    });
  }

  try {
    const room = await prisma.room.findUnique({
      where: { id: parsedId.data },
      select: {
        id: true,
        isActive: true,
      },
    });

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found",
      });
    }

    if (!room.isActive) {
      return res.status(409).json({
        success: false,
        message: "Room is already inactive",
      });
    }

    await prisma.room.update({
      where: { id: parsedId.data },
      data: { isActive: false },
    });

    return res.status(200).json({
      success: true,
      message: "Room deactivated successfully",
    });
  } catch (error) {
    next(error);
  }
});

export default router;
