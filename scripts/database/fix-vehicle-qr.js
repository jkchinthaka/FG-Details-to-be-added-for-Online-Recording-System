const { PrismaClient } = require("../../apps/api/generated/prisma-client");

const prisma = new PrismaClient();

(async () => {
  const vehicles = await prisma.vehicle.findMany();
  let fixed = 0;
  for (const vehicle of vehicles) {
    if (!vehicle.qrIdentifier) {
      await prisma.vehicle.update({
        where: { id: vehicle.id },
        data: { qrIdentifier: `QR-${vehicle.vehicleNumber}` },
      });
      fixed += 1;
    }
  }
  console.log(JSON.stringify({ scanned: vehicles.length, fixed }));
  await prisma.$disconnect();
})().catch(async (error) => {
  console.error(String(error.message).slice(0, 300));
  await prisma.$disconnect();
  process.exit(1);
});
