
import "dotenv/config";
import { prisma } from "../src/lib/prisma.js";

async function main() {
  const branches = await prisma.branch.findMany({
    select: {
      name: true,
      city: true,
      roomTypes: {
        select: {
          id: true,
          name: true,
          description: true,
          maxGuests: true,
          amenities: true,
        },
        orderBy: {
          name: "asc",
        },
      },
    },
    orderBy: {
      name: "asc",
    },
  });

  if (branches.length === 0) {
    console.log("No hotel branches found in the database.");
    return;
  }

  let totalRoomTypes = 0;

  for (const branch of branches) {
    console.log(`\nHotel: ${branch.name}`);
    console.log(`City: ${branch.city}`);
    console.log("--------------------------------");

    for (const room of branch.roomTypes) {
      totalRoomTypes++;

      console.log(`Room: ${room.name}`);
      console.log(`ID: ${room.id}`);
      console.log(`Description: ${room.description ?? "None"}`);
      console.log(`Max guests: ${room.maxGuests}`);
      console.log(
        `Amenities: ${
          room.amenities.length
            ? room.amenities.join(", ")
            : "Not populated"
        }`
      );
      console.log("--------------------------------");
    }
  }

  console.log(`\nTotal branches: ${branches.length}`);
  console.log(`Total room types: ${totalRoomTypes}`);
}

main()
  .catch((error) => {
    console.error("Failed to retrieve room types:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
