import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Fetching all events...");
  const events = await prisma.event.findMany({
    include: {
      prizes: true,
    },
  });

  console.log(`Found ${events.length} events.`);

  for (const event of events) {
    if (event.prizes && event.prizes.length > 0) {
      console.log(`Event ID ${event.id} ("${event.name}") already has ${event.prizes.length} prizes. Skipping...`);
      continue;
    }

    console.log(`Adding default prizes for Event ID ${event.id} ("${event.name}")...`);
    
    await prisma.eventPrize.createMany({
      data: [
        {
          eventId: event.id,
          name: "First Prize",
          description: "$10,000 + Gold Trophy",
          quantity: 1,
        },
        {
          eventId: event.id,
          name: "Second Prize",
          description: "$5,000 + Silver Trophy",
          quantity: 1,
        },
        {
          eventId: event.id,
          name: "Third Prize",
          description: "$2,500 + Bronze Trophy",
          quantity: 1,
        },
        {
          eventId: event.id,
          name: "Honorable Mention",
          description: "$1,000 + Certificate",
          quantity: 1,
        },
      ],
    });
  }

  console.log("Successfully seeded prizes for all events!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
