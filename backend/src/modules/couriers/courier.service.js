const { prisma } = require('../../config/database');
const { AppError } = require('../../middlewares/errorHandler');

async function getCourierProfile(userId) {
  const courier = await prisma.courier.findUnique({
    where: { userId },
    include: { user: { select: { id: true, name: true, email: true, phone: true } } },
  });
  if (!courier) throw new AppError('Courier profile not found', 404);
  return courier;
}

async function getAssignedDeliveries(userId, { status, date }) {
  const courier = await prisma.courier.findUnique({ where: { userId } });
  if (!courier) throw new AppError('Courier profile not found', 404);

  const where = { courierId: courier.id };
  if (status) where.status = status;
  if (date) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    where.createdAt = { gte: start, lte: end };
  }

  const parcels = await prisma.parcel.findMany({
    where,
    include: {
      zone: true,
      customer: { select: { name: true, phone: true } },
      statusHistory: { orderBy: { timestamp: 'desc' }, take: 1 },
    },
    orderBy: { createdAt: 'desc' },
  });

  return { courier, parcels, count: parcels.length };
}

async function getAllCouriers() {
  const couriers = await prisma.courier.findMany({
    include: { user: { select: { name: true, email: true, phone: true } } },
    orderBy: { createdAt: 'desc' },
  });

  // Add workload count
  const withWorkload = await Promise.all(
    couriers.map(async (c) => {
      const activeCount = await prisma.parcel.count({
        where: {
          courierId: c.id,
          status: { in: ['PENDING_PICKUP', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'] },
        },
      });
      return { ...c, activeDeliveries: activeCount };
    })
  );

  return withWorkload;
}

async function updateCourierAvailability(userId, isAvailable) {
  const courier = await prisma.courier.findUnique({ where: { userId } });
  if (!courier) throw new AppError('Courier profile not found', 404);
  return prisma.courier.update({ where: { id: courier.id }, data: { isAvailable } });
}

module.exports = { getCourierProfile, getAssignedDeliveries, getAllCouriers, updateCourierAvailability };
