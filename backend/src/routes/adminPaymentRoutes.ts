
import { Router, type Request, type Response } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAdmin } from "../middleware/requireAdmin.js";
import { z } from "zod";

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


router.get(
  "/payments/reviews",
  requireAdmin,
  async (_req: Request, res: Response) => {
    try {
      const payments = await prisma.payment.findMany({
        where: {
          requiresReview: true,
          reviewedAt: null,
          status: "COMPLETED",
        },
        select: {
          id: true,
          bookingId: true,
          reference: true,
          amount: true,
          currency: true,
          status: true,
          providerTransactionId: true,
          paidAt: true,
          createdAt: true,
          requiresReview: true,
          reviewedAt: true,
          reviewedById: true,
          booking: {
            select: {
              id: true,
              status: true,
              checkIn: true,
              checkOut: true,
              guestCount: true,
              guestName: true,
              guestEmail: true,
              user: {
                select: {
                  name: true,
                  email: true,
                },
              },
              bookingRooms: {
                select: {
                  price: true,
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
          booking: {
            ...payment.booking,
            bookingRooms: payment.booking.bookingRooms.map(
              (bookingRoom) => ({
                ...bookingRoom,
                price: bookingRoom.price?.toFixed(2) ?? null,
              })
            ),
          },
        })),
      });
    } catch (error) {
      console.error("Failed to retrieve payment reviews:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to retrieve payment reviews",
      });
    }
  }
);


router.patch(
  "/payments/reviews/:paymentId/resolve",
  requireAdmin,
  async (req: Request, res: Response) => {
    const parsedId = z.uuid().safeParse(req.params.paymentId);

    if (!parsedId.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment ID",
      });
    }

    const adminId = res.locals.authUser?.id;

    if (!adminId) {
      return res.status(403).json({
        success: false,
        message: "Administrator identity unavailable",
      });
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        // Find the booking ID needed for the shared lock.
        const payment = await tx.payment.findUnique({
          where: { id: parsedId.data },
          select: { bookingId: true },
        });

        if (!payment) {
          return { outcome: "NOT_FOUND" as const };
        }

        // Coordinate with payment verification and booking updates.
        await tx.$executeRaw`
          SELECT pg_advisory_xact_lock(
            hashtextextended(${payment.bookingId}, 1)
          )
        `;

        // Re-read the payment after acquiring the lock.
        const currentPayment = await tx.payment.findUnique({
          where: { id: parsedId.data },
        });

        if (!currentPayment) {
          return { outcome: "NOT_FOUND" as const };
        }

        if (
          currentPayment.status !== "COMPLETED" ||
          !currentPayment.requiresReview ||
          currentPayment.reviewedAt !== null
        ) {
          return { outcome: "NOT_REVIEWABLE" as const };
        }

        const updated = await tx.payment.update({
          where: { id: currentPayment.id },
          data: {
            requiresReview: false,
            reviewedAt: new Date(),
            reviewedById: adminId,
          },
        });

        return {
          outcome: "RESOLVED" as const,
          payment: updated,
        };
      });

      if (result.outcome === "NOT_FOUND") {
        return res.status(404).json({
          success: false,
          message: "Payment not found",
        });
      }

      if (result.outcome === "NOT_REVIEWABLE") {
        return res.status(409).json({
          success: false,
          message: "Payment is not awaiting manual review",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Payment review resolved successfully",
        data: {
          id: result.payment.id,
          bookingId: result.payment.bookingId,
          reference: result.payment.reference,
          status: result.payment.status,
          requiresReview: result.payment.requiresReview,
          reviewedAt: result.payment.reviewedAt,
          reviewedById: result.payment.reviewedById,
        },
      });
    } catch (error) {
      console.error("Failed to resolve payment review:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to resolve payment review",
      });
    }
  }
);


export default router;
