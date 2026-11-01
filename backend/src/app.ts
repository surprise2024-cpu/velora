import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import branchRoutes from "./routes/branchRoutes.js";
import availabilityRoutes from "./routes/availabilityRoutes.js";
import { sessionMiddleware } from "./config/session.js";
import authRoutes from "./routes/authRoutes.js";

export const app = express();

// disable express identification header
app.disable("x-powered-by");

// basic security header
app.use(helmet());

app.use(
    cors({
        origin: process.env.FRONTEND_URL ?? "http://localhost:5137",
        credentials: true,
    })
);

// parse JSON request bodies
app.use(express.json({ limit: "100kb" }));

app.use(sessionMiddleware);

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



// handles unknown routes
app.use((_req, res) => {
    res.status(404).json({
        success: false,
        message: "Route not found",
    });
});