
import type { RequestHandler } from "express";
import { requireAuth } from "./requireAuth.js";

const checkAdminRole: RequestHandler = (_req, res, next) => {
  const user = res.locals.authUser;

  if (!user || user.role !== "ADMIN") {
    res.status(403).json({
      success: false,
      message: "Administrator access required",
    });
    return;
  }

  next();
};

export const requireAdmin = [
  requireAuth,
  checkAdminRole,
];
