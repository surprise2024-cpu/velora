
import {
  createHash,
  timingSafeEqual,
} from "node:crypto";

import { z } from "zod";
import { prisma } from "./prisma.js";

const guestTokenSchema = z
  .string()
  .regex(/^[a-f0-9]{64}$/);

export function hashGuestToken(token: string): string {
  return createHash("sha256")
    .update(token)
    .digest("hex");
}

export async function authorizeGuestBooking(
  bookingId: string,
  token: unknown
): Promise<boolean> {
  if (!z.uuid().safeParse(bookingId).success) {
    return false;
  }

  const parsedToken = guestTokenSchema.safeParse(token);

  if (!parsedToken.success) {
    return false;
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      userId: true,
      guestAccessTokenHash: true,
    },
  });

  if (
    !booking ||
    booking.userId !== null ||
    !booking.guestAccessTokenHash
  ) {
    return false;
  }

  const suppliedHash = Buffer.from(
    hashGuestToken(parsedToken.data),
    "hex"
  );

  const storedHash = Buffer.from(
    booking.guestAccessTokenHash,
    "hex"
  );

  if (
    suppliedHash.length !== 32 ||
    storedHash.length !== 32
  ) {
    return false;
  }

  return timingSafeEqual(suppliedHash, storedHash);
}
