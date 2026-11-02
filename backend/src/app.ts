import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import branchRoutes from "./routes/branchRoutes.js";
import availabilityRoutes from "./routes/availabilityRoutes.js";
import { sessionMiddleware } from "./config/session.js";
import authRoutes from "./routes/authRoutes.js";
import { csrfSynchronisedProtection } from "./config/csrf.js";
import type { ErrorRequestHandler } from "express";
import { errorHandler } from "./middleware/errorHandler.js";
import adminBranchRoutes from "./routes/adminBranchRoutes.js";

export const app = express();

// Trust Render's reverse proxy in production
if (process.env.NODE_ENV === "production") {
    app.set("trust proxy", 1);
}

// disable express identification header
app.disable("x-powered-by");

// basic security header
app.use(helmet());

app.use(
    cors({
        origin: process.env.FRONTEND_URL ?? "http://localhost:5173",
        credentials: true,
    })
);

// parse JSON request bodies
app.use(express.json({ limit: "100kb" }));

app.use(sessionMiddleware);

// validate CSRF token for all requests except GET, HEAD, OPTIONS
app.use(csrfSynchronisedProtection);

// rate limit API requests
app.use(
    "/api",
    rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: 100,
        standardHeaders: "draft-8",
        legacyHeaders: false,
    })
);

app.use("/api/v1/auth", authRoutes);

// health check endpoint
app.get("/api/v1/health", (_req, res) => {
    res.status(200).json({
        success: true,
        message: "Velora Hotels API is running",
        timestamp: new Date().toISOString(),
    });
});

app.use("/api/v1/branches", branchRoutes);
app.use("/api/v1/branches", availabilityRoutes);
app.use("/api/v1/admin", adminBranchRoutes);

const csrfErrorHandler: ErrorRequestHandler = (
  error,
  _req,
  res,
  next
) => {
  if (error.code === "EBADCSRFTOKEN") {
    res.status(403).json({
      success: false,
      message: "Invalid or missing CSRF token",
    });
    return;
  }

  next(error);
};

app.use(csrfErrorHandler);

// handles unknown routes
app.use((_req, res) => {
    res.status(404).json({
        success: false,
        message: "Route not found",
    });
});

// Handle unexpected API errors.
app.use(errorHandler);