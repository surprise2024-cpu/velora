import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import branchRoutes from "./routes/branchRoutes.js";

export const app = express();

// disable express identification header
app.disable("x-powered-by");

// basic security header
app.use(helmet());

app.use(
    cors({
        origin: process.env.FRONTEND_URL ?? "http:localhost:5137",
    })
);

// parse JSON request bodies
app.use(express.json({ limit: "100kb" }));

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

app.use("/api/v1/branches", branchRoutes);

// health check endpoint
app.get("/api/v1/health", (_req, res) => {
    res.status(200).json({
        success: true,
        message: "Velora Hotels API is running",
        timestamp: new Date().toISOString(),
    });
});

// handles unknown routes
app.use((_req, res) => {
    res.status(404).json({
        success: false,
        message: "Route not found",
    });
});