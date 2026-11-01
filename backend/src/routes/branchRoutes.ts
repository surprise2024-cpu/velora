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

router.get("/:id/room-types", async (req, res) =>{
    const parseId = z.uuid().safeParse(req.params.id);

    if(!parseId.success) {
        return res.status(400).json({
            success: false,
            message: "Invalid branch ID format"
        });
    }

    try {
        const branch = await prisma.branch.findFirst({
            where: {
                id: parseId.data,
                isActive: true,
            },
            select: {
                id: true,
            },
        });

        if (!branch) {
            return res.status(404).json({
                success: false,
                message: "Hotel branch not found",
            });
        }

        const roomTypes = await prisma.roomType.findMany({
            where: {
                branchId: parseId.data,
                isActive: true,
            },
            select: {
                id: true,
                name: true,
                description: true,
                maxGuests: true,
                basePrice: true,
                currency: true,
            },
            orderBy: {
                basePrice: "asc",
            },
            
        });

        return res.status(200).json({
            success: true,
            data: roomTypes,
        });

    }
    catch (error) {
        console.error("Failed to fetch room types:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch room types for the hotel branch",
        });

    }

});

export default router;