
import { Router, type Request, type Response } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAdmin } from "../middleware/requireAdmin.js";

const router = Router();

router.get("/payments", requireAdmin, async (_req: Request, res: Response) => {
  try {
    const payments = await prisma.payment.findMany({
      select: {
        id: true,
        bookingId: true,
        reference: true,
        amount: true,
        currency: true,
        status: true,
        paidAt: true,
        createdAt: true,
        booking: {
          select: {
            id: true,
            status: true,
            checkIn: true,
            checkOut: true,
            user: {
              select: {
                name: true,
                email: true,
              },
            },
            bookingRooms: {
              select: {
                room: {
                  select: {
                    roomNumber: true,
                    branch: {
                      select: {
                        id: true,
                        name: true,
                        city: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.status(200).json({
      success: true,
      data: payments.map((payment) => ({
        ...payment,
        amount: payment.amount.toFixed(2),
      })),
    });
  } catch (error) {
    console.error("Failed to retrieve admin payments:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve payments",
    });
  }
});

export default router;
