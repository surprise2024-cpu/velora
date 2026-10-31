import { Router } from "express";
import { prisma } from "../lib/prisma.js";

const router = Router();

router.get("/", async (_req, res) => {
    try {
        const branches = await prisma.branch.findMany({
            where: {
                isActive: true,
            },
            orderBy: {
                name: "asc",
            },
        });

        res.status(200).json({
            success: true,
            data: branches,
        });

    } catch (error) {
        console.error("Failed to fetch branches:", error);

        res.status(500).json({
            success: false, 
            message: "Failed to fetch hotel branches",
        });
    }
});

export default router;