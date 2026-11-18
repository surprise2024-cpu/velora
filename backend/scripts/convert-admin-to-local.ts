
import "dotenv/config";
import bcrypt from "bcrypt";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/prisma.js";

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim();
  const password = process.env.ADMIN_NEW_PASSWORD;

  if (!email || !password || password.length < 12) {
    throw new Error(
      "Set ADMIN_EMAIL and ADMIN_NEW_PASSWORD (minimum 12 characters)."
    );
  }

  const admin = await prisma.user.findUnique({
    where: { email },
  });

  if (!admin) {
    throw new Error("Administrator account not found.");
  }

  if (
    admin.role !== "ADMIN" ||
    admin.provider.toLowerCase() !== "google" ||
    admin.passwordHash !== null
  ) {
    throw new Error(
      "Account is not an eligible Google administrator."
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.update({
    where: { id: admin.id },
    data: {
      provider: "local",
      providerId: randomUUID(),
      passwordHash,
    },
  });

  console.log("Administrator converted successfully.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
