
import "dotenv/config";
import { prisma } from "../src/lib/prisma.js";

const roomUpdates = [
  {
    id: "d7b6c2a1-8e45-4d93-b102-5f6e7a8c9012",
    name: "Standard Room",
    branchName: "Velora Sandton",
    amenities: [
      "Free Wi-Fi",
      "Air conditioning",
      "Queen-size bed",
      "Flat-screen TV",
      "Private bathroom",
      "Work desk",
      "Wardrobe",
    ],
  },
  {
    id: "23e94c74-88fa-4867-8da1-992c7187d653",
    name: "Deluxe King Room",
    branchName: "Velora Pretoria",
    amenities: [
      "Free Wi-Fi",
      "Air conditioning",
      "King-size bed",
      "Smart TV",
      "Private bathroom",
      "Minibar",
      "Coffee and tea facilities",
      "Work desk",
      "In-room safe",
    ],
  },
];

async function main() {
  // Validate both records before making any changes.
  for (const room of roomUpdates) {
    const existing = await prisma.roomType.findUnique({
      where: { id: room.id },
      include: {
        branch: {
          select: { name: true },
        },
      },
    });

    if (
      !existing ||
      existing.name !== room.name ||
      existing.branch.name !== room.branchName
    ) {
      throw new Error(
        `Room verification failed: ${room.branchName} / ${room.name}`
      );
    }

    if (existing.amenities.length > 0) {
      throw new Error(
        `Room already has amenities: ${room.name}. Refusing to overwrite.`
      );
    }
  }

  // Apply both updates atomically.
  const updated = await prisma.$transaction(
    roomUpdates.map((room) =>
      prisma.roomType.update({
        where: {
          id: room.id,
        },
        data: {
          amenities: room.amenities,
        },
        select: {
          name: true,
          amenities: true,
        },
      })
    )
  );

  for (const room of updated) {
    console.log(`\nUpdated: ${room.name}`);
    console.log(`Amenities: ${room.amenities.join(", ")}`);
  }

  console.log("\nRoom amenities populated successfully.");
}

main()
  .catch((error) => {
    console.error("Population failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
