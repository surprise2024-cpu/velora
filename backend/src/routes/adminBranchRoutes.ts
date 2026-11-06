
import { Router } from "express";
import { z } from "zod";
import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import { requireAdmin } from "../middleware/requireAdmin.js";

const router = Router();

router.use(requireAdmin);


router.get("/branches", async (_req, res, next) => {
  try {
    const branches = await prisma.branch.findMany({
      select: {
        id: true,
        brandId: true,
        name: true,
        description: true,
        address: true,
        city: true,
        province: true,
        country: true,
        starRating: true,
        isActive: true,
        images: true,
        amenities: true,
        policies: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            rooms: true,
            roomTypes: true,
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    return res.status(200).json({
      success: true,
      data: branches,
    });
  } catch (error) {
    next(error);
  }
});


const createBranchSchema = z.object({
  brandId: z.uuid().optional(),
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
    const { brandId: _providedBrandId, ...details } = parsed.data;

    const brand = await prisma.hotelBrand.findUnique({
      where: { name: "Velora Hotels" },
      select: { id: true },
    });

    if (!brand) {
      return res.status(409).json({
        success: false,
        message: "Velora Hotels brand has not been configured",
      });
    }

    const brandId = brand.id;

    
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

  const branchId = parsedId.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Serialize deactivation attempts for the same branch.
      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(
          hashtextextended(${branchId}::text, 0)
        )
      `;

      const branch = await tx.branch.findUnique({
        where: { id: branchId },
        select: {
          id: true,
          name: true,
          isActive: true,
        },
      });

      if (!branch) {
        return { outcome: "NOT_FOUND" as const };
      }

      if (!branch.isActive) {
        return { outcome: "ALREADY_INACTIVE" as const };
      }

      // PostgreSQL current date, avoiding timezone-dependent
      // comparisons against JavaScript's current timestamp.
      const dates = await tx.$queryRaw<{ today: Date }[]>`
        SELECT CURRENT_DATE AS today
      `;

      const today = dates[0]?.today;

      if (!today) {
        throw new Error("Unable to determine database date.");
      }

      
const protectedBookings = await tx.booking.count({
  where: {
    checkOut: {
      gt: today,
    },
    bookingRooms: {
      some: {
        room: {
          branchId,
        },
      },
    },
    OR: [
      // Confirmed reservations that have not checked out.
      {
        status: "CONFIRMED",
      },

      // Pending reservations with money received or
      // an unresolved payment attempt.
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

      await tx.branch.update({
        where: { id: branchId },
        data: { isActive: false },
      });

      return {
        outcome: "DEACTIVATED" as const,
        name: branch.name,
      };
    });

    switch (result.outcome) {
      case "NOT_FOUND":
        return res.status(404).json({
          success: false,
          message: "Accommodation not found",
        });

      case "ALREADY_INACTIVE":
        return res.status(409).json({
          success: false,
          message: "Accommodation is already inactive",
        });

      
      case "HAS_RESERVATIONS":
        return res.status(409).json({
          success: false,
          message:
            `Cannot deactivate this branch. ` +
            `${result.count} reservation(s) have not yet ` +
            `checked out and are confirmed or have ` +
            `unresolved/completed payments.`,
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


router.patch("/branches/:id/activate", async (req, res, next) => {
  const parsedId = z.uuid().safeParse(req.params.id);

  if (!parsedId.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid accommodation ID",
    });
  }

  const branchId = parsedId.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Use the same branch lock as deactivation.
      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(
          hashtextextended(${branchId}::text, 0)
        )
      `;

      const branch = await tx.branch.findUnique({
        where: { id: branchId },
        select: {
          id: true,
          name: true,
          isActive: true,
        },
      });

      if (!branch) {
        return { outcome: "NOT_FOUND" as const };
      }

      if (branch.isActive) {
        return { outcome: "ALREADY_ACTIVE" as const };
      }

      const updated = await tx.branch.update({
        where: { id: branchId },
        data: { isActive: true },
        select: {
          id: true,
          name: true,
          isActive: true,
        },
      });

      return {
        outcome: "ACTIVATED" as const,
        branch: updated,
      };
    });

    switch (result.outcome) {
      case "NOT_FOUND":
        return res.status(404).json({
          success: false,
          message: "Accommodation not found",
        });

      case "ALREADY_ACTIVE":
        return res.status(409).json({
          success: false,
          message: "Accommodation is already active",
        });

      case "ACTIVATED":
        return res.status(200).json({
          success: true,
          message: `${result.branch.name} activated successfully`,
          data: result.branch,
        });
    }
  } catch (error) {
    next(error);
  }
});


export default router;
