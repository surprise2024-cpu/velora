import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import z from "zod";

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

router.get("/:id", async (req, res) => {
    const { id } = req.params;

    const parseId = z.uuid().safeParse(id);

    if (!parseId.success) { 

        return res.status(400).json({
            success: false,
            message: "Invalid branch ID format",
        });
    }
    
    try {
        const branch = await prisma.branch.findFirst({
            where: {
                id: parseId.data,
                isActive: true,
            },
        });
        
        if (!branch) {
            return res.status(404).json({
                success: false,
                message: "Hotel branch not found",
            });
        }

        return res.status(200).json({
            success: true,
            data: branch,
        });
    } 
    catch (error) {
        console.error("Failed to fetch branch:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch hotel branch",
        });

    }
    
});

export default router;