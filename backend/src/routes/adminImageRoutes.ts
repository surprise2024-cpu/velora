import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { cloudinary } from "../lib/cloudinary.js";
import { prisma } from "../lib/prisma.js";
import { requireAdmin } from "../middleware/requireAdmin.js";

const router = Router();
router.use(requireAdmin);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (_req, file, callback) => {
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(
        file.mimetype
      )
    ) {
      callback(new Error("Only JPG, PNG and WebP are allowed"));
      return;
    }
    callback(null, true);
  },
});

function validImage(buffer: Buffer): boolean {
  const jpeg =
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff;

  const png =
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
    );

  const webp =
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP";

  return jpeg || png || webp;
}

function uploadToCloudinary(buffer: Buffer) {
  return new Promise<{
    url: string;
    publicId: string;
  }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "velora",
        resource_type: "image",
      },
      (error, result) => {
        if (error || !result) {
          reject(error ?? new Error("Cloudinary upload failed"));
          return;
        }

        resolve({
          url: result.secure_url,
          publicId: result.public_id,
        });
      }
    );

    stream.on("error", reject);
    stream.end(buffer);
  });
}

const assignmentSchema = z.object({
  targetType: z.enum(["branch", "roomType"]),
  targetId: z.uuid(),
});

router.post(
  "/images/assign",
  upload.single("image"),
  async (req, res, next) => {
    const parsed = assignmentSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid image assignment",
      });
    }

    if (!req.file || !validImage(req.file.buffer)) {
      return res.status(400).json({
        success: false,
        message: "A valid JPG, PNG or WebP image is required",
      });
    }

    const { targetType, targetId } = parsed.data;

    try {
      // Check the target before uploading anything.
      const target =
        targetType === "branch"
          ? await prisma.branch.findUnique({
              where: { id: targetId },
              select: { id: true },
            })
          : await prisma.roomType.findUnique({
              where: { id: targetId },
              select: { id: true },
            });

      if (!target) {
        return res.status(404).json({
          success: false,
          message: "Selected branch or room type not found",
        });
      }

      const uploaded = await uploadToCloudinary(
        req.file.buffer
      );

      try {
        // Lock the target row to prevent concurrent uploads
        // from overwriting each other's image arrays.
        const updated = await prisma.$transaction(
          async (tx) => {
            if (targetType === "branch") {
              const rows = await tx.$queryRaw<
                { images: string[] }[]
              >`
                SELECT images
                FROM "Branch"
                WHERE id = ${targetId}::uuid
                FOR UPDATE
              `;

              if (!rows[0]) {
                throw new Error("Target no longer exists");
              }

              return tx.branch.update({
                where: { id: targetId },
                data: {
                  images: [
                    ...rows[0].images,
                    uploaded.url,
                  ],
                },
                select: {
                  id: true,
                  images: true,
                },
              });
            }

            const rows = await tx.$queryRaw<
              { images: string[] }[]
            >`
              SELECT images
              FROM "RoomType"
              WHERE id = ${targetId}::uuid
              FOR UPDATE
            `;

            if (!rows[0]) {
              throw new Error("Target no longer exists");
            }

            return tx.roomType.update({
              where: { id: targetId },
              data: {
                images: [
                  ...rows[0].images,
                  uploaded.url,
                ],
              },
              select: {
                id: true,
                images: true,
              },
            });
          }
        );

        return res.status(201).json({
          success: true,
          message: "Image uploaded and assigned successfully",
          data: {
            url: uploaded.url,
            publicId: uploaded.publicId,
            targetType,
            targetId,
            images: updated.images,
          },
        });
      } catch (databaseError) {
        // Undo the Cloudinary upload if assignment fails.
        try {
          await cloudinary.uploader.destroy(
            uploaded.publicId
          );
        } catch (cleanupError) {
          console.error(
            "Cloudinary cleanup failed:",
            cleanupError
          );
        }

        throw databaseError;
      }
    } catch (error) {
      next(error);
    }
  }
);

// Handle file-size and file-type errors.
router.use(
  (
    error: Error,
    _req: import("express").Request,
    res: import("express").Response,
    next: import("express").NextFunction
  ) => {
    if (error instanceof multer.MulterError) {
      return res.status(400).json({
        success: false,
        message:
          error.code === "LIMIT_FILE_SIZE"
            ? "Image must not exceed 5 MB"
            : error.message,
      });
    }

    if (
      error.message ===
      "Only JPG, PNG and WebP are allowed"
    ) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    next(error);
  }
);

export default router;