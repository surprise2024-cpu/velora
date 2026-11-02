
import { Router } from "express";
import { z } from "zod";
import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import { requireAdmin } from "../middleware/requireAdmin.js";

const router = Router();

router.use(requireAdmin);

const createBranchSchema = z.object({
  brandId: z.uuid(),
  name: z.string().trim().min(1).max(150),
  description: z.string().trim().optional(),
  address: z.string().trim().min(1),
  city: z.string().trim().min(1),
  province: z.string().trim().min(1),
  country: z.string().trim().min(1).default("South Africa"),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  phone: z.string().trim().optional(),
  email: z.email().optional(),
  starRating: z.number().int().min(1).max(5).optional(),
  images: z.array(z.url()).default([]),
  amenities: z.array(z.string().trim().min(1)).default([]),
  policies: z.array(z.string().trim().min(1)).default([]),
});

router.post("/branches", async (req, res, next) => {
  const parsed = createBranchSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid accommodation details",
      errors: parsed.error.flatten(),
    });
  }

  try {
    const { brandId, ...details } = parsed.data;

    const brand = await prisma.hotelBrand.findUnique({
      where: { id: brandId },
      select: { id: true },
    });

    if (!brand) {
      return res.status(404).json({
        success: false,
        message: "Hotel brand not found",
      });
    }

    
    const branch = await prisma.branch.create({
        data: {
            brandId,
            name: details.name,
            address: details.address,
            city: details.city,
            province: details.province,
            country: details.country,
            images: details.images,
            amenities: details.amenities,
            policies: details.policies,
            ...(details.description !== undefined && {
            description: details.description,
            }),
            ...(details.latitude !== undefined && {
            latitude: details.latitude,
            }),
            ...(details.longitude !== undefined && {
            longitude: details.longitude,
            }),
            ...(details.phone !== undefined && {
            phone: details.phone,
            }),
            ...(details.email !== undefined && {
            email: details.email,
            }),
            ...(details.starRating !== undefined && {
            starRating: details.starRating,
            }),
        },
    });


    return res.status(201).json({
      success: true,
      message: "Accommodation created successfully",
      data: branch,
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return res.status(409).json({
        success: false,
        message: "An accommodation with this name already exists for this brand",
      });
    }

    next(error);
  }
});


const updateBranchSchema = createBranchSchema
  .omit({ brandId: true })
  .partial()
  .refine(
    (data) => Object.keys(data).length > 0,
    "At least one field must be provided"
  );

router.patch("/branches/:id", async (req, res, next) => {
  const id = z.uuid().safeParse(req.params.id);
  const parsed = updateBranchSchema.safeParse(req.body);

  if (!id.success || !parsed.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid accommodation update",
    });
  }

  try {
    const existing = await prisma.branch.findUnique({
      where: { id: id.data },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Accommodation not found",
      });
    }

    const data = Object.fromEntries(
      Object.entries(parsed.data).filter(
        ([, value]) => value !== undefined
      )
    );

    const branch = await prisma.branch.update({
      where: { id: id.data },
      data,
    });

    return res.status(200).json({
      success: true,
      message: "Accommodation updated successfully",
      data: branch,
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return res.status(409).json({
        success: false,
        message: "Accommodation name already exists",
      });
    }

    next(error);
  }
});


router.delete("/branches/:id", async (req, res, next) => {
  const parsedId = z.uuid().safeParse(req.params.id);

  if (!parsedId.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid accommodation ID",
    });
  }

  try {
    const branch = await prisma.branch.findUnique({
      where: { id: parsedId.data },
      select: {
        id: true,
        isActive: true,
      },
    });

    if (!branch) {
      return res.status(404).json({
        success: false,
        message: "Accommodation not found",
      });
    }

    if (!branch.isActive) {
      return res.status(409).json({
        success: false,
        message: "Accommodation is already inactive",
      });
    }

    await prisma.branch.update({
      where: { id: parsedId.data },
      data: { isActive: false },
    });

    return res.status(200).json({
      success: true,
      message: "Accommodation deactivated successfully",
    });
  } catch (error) {
    next(error);
  }
});


export default router;
