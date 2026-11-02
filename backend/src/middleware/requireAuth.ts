
import type { RequestHandler } from "express";
import { prisma } from "../lib/prisma.js";

export const requireAuth: RequestHandler = async (
  req,
  res,
  next
) => {
  const userId = req.session.userId;

  if (!userId) {
    res.status(401).json({
      success: false,
      message: "Authentication required",
    });
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
      },
    });

    if (!user) {
      res.status(401).json({
        success: false,
        message: "User account not found",
      });
      return;
    }

    res.locals.authUser = user;
    next();
  } catch (error) {
    next(error);
  }
};
