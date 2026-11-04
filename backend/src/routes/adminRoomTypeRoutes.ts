
import { Router } from "express";
import { z } from "zod";
import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import { requireAdmin } from "../middleware/requireAdmin.js";

const router = Router();

router.use(requireAdmin);

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
    const roomType = await prisma.roomType.findUnique({
      where: { id: parsedId.data },
      select: {
        id: true,
        isActive: true,
      },
    });

    if (!roomType) {
      return res.status(404).json({
        success: false,
        message: "Room type not found",
      });
    }

    if (!roomType.isActive) {
      return res.status(409).json({
        success: false,
        message: "Room type is already inactive",
      });
    }

    await prisma.roomType.update({
      where: { id: parsedId.data },
      data: { isActive: false },
    });

    return res.status(200).json({
      success: true,
      message: "Room type deactivated successfully",
    });
  } catch (error) {
    next(error);
  }
});


export default router;
