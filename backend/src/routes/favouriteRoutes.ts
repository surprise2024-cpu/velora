
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

const branchIdSchema = z.uuid();

const createFavouriteSchema = z.object({
  branchId: z.uuid(),
}).strict();

function getCustomerId(res: Parameters<Parameters<typeof router.get>[1]>[1]) {
  const user = res.locals.authUser;

  if (user.role !== "CUSTOMER") {
    return null;
  }

  return user.id as string;
}

// GET /favourites
router.get("/", requireAuth, async (_req, res) => {
  const userId = getCustomerId(res);

  if (!userId) {
    return res.status(403).json({
      success: false,
      message: "Customer access required.",
    });
  }

  const favourites = await prisma.favourite.findMany({
    where: { userId },
    include: {
      branch: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return res.status(200).json({
    success: true,
    data: favourites,
  });
});

// POST /favourites
router.post("/", requireAuth, async (req, res) => {
  const userId = getCustomerId(res);

  if (!userId) {
    return res.status(403).json({
      success: false,
      message: "Customer access required.",
    });
  }

  const parsed = createFavouriteSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: "A valid branchId is required.",
    });
  }

  const { branchId } = parsed.data;

  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    select: { id: true },
  });

  if (!branch) {
    return res.status(404).json({
      success: false,
      message: "Hotel branch not found.",
    });
  }

  const existing = await prisma.favourite.findUnique({
    where: {
      userId_branchId: { userId, branchId },
    },
  });

  if (existing) {
    return res.status(200).json({
      success: true,
      message: "Hotel is already in your favourites.",
      data: existing,
    });
  }

  const favourite = await prisma.favourite.create({
    data: { userId, branchId },
  });

  return res.status(201).json({
    success: true,
    message: "Hotel added to favourites.",
    data: favourite,
  });
});

// DELETE /favourites/:branchId
router.delete("/:branchId", requireAuth, async (req, res) => {
  const userId = getCustomerId(res);

  if (!userId) {
    return res.status(403).json({
      success: false,
      message: "Customer access required.",
    });
  }

  const parsed = branchIdSchema.safeParse(req.params.branchId);

  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid branch ID.",
    });
  }

  const result = await prisma.favourite.deleteMany({
    where: {
      userId,
      branchId: parsed.data,
    },
  });

  return res.status(200).json({
    success: true,
    message:
      result.count > 0
        ? "Hotel removed from favourites."
        : "Hotel was not in your favourites.",
  });
});

export default router;
