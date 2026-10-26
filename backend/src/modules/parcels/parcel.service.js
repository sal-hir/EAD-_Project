const { v4: uuidv4 } = require('uuid');
const { prisma } = require('../../config/database');
const { publishEvent } = require('../../config/rabbitmq');
const { AppError } = require('../../middlewares/errorHandler');
const logger = require('../../config/logger');

// Generate unique tracking number
function generateTrackingNumber() {
  const prefix = 'SD';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}${timestamp}${random}`;
}

// Calculate delivery fee based on zone, weight, and size
function calculateFee(zone, weightKg, size) {
  const sizeMultiplier = { SMALL: 1.0, MEDIUM: 1.3, LARGE: 1.7 };
  const base = zone.baseFee + zone.feePerKg * weightKg;
  return Math.round(base * (sizeMultiplier[size] || 1.0));
}

async function estimateFee({ zoneId, weightKg, size }) {
  const zone = await prisma.zone.findUnique({ where: { id: zoneId, isActive: true } });
  if (!zone) throw new AppError('Zone not found', 404);
  const fee = calculateFee(zone, weightKg, size);
  return { zone: zone.name, estimatedFee: fee, estimatedDays: zone.estimatedDays, currency: 'LKR' };
}

async function createParcel(data, userId, merchantId = null) {
  const {
    zoneId, pickupAddress, pickupCity, pickupPostcode,
    dropoffAddress, dropoffCity, dropoffPostcode,
    recipientName, recipientPhone, recipientEmail,
    weightKg, size, description,
  } = data;

  const zone = await prisma.zone.findUnique({ where: { id: zoneId, isActive: true } });
  if (!zone) throw new AppError('Zone not found or inactive', 404);

  const estimatedFee = calculateFee(zone, weightKg, size);
  const trackingNumber = generateTrackingNumber();

  const parcel = await prisma.parcel.create({
    data: {
      trackingNumber,
      customerId: userId,
      merchantId,
      zoneId,
      pickupAddress, pickupCity, pickupPostcode,
      dropoffAddress, dropoffCity, dropoffPostcode,
      recipientName, recipientPhone, recipientEmail,
      weightKg, size, description,
      estimatedFee,
      status: 'CREATED',
      statusHistory: {
        create: {
          status: 'CREATED',
          note: 'Parcel booking confirmed.',
          updatedBy: userId,
        },
      },
    },
    include: { zone: true, statusHistory: true },
  });

  // Publish event to RabbitMQ
  await publishEvent('parcel.created', {
    event: 'parcel.created',
    parcelId: parcel.id,
    trackingNumber: parcel.trackingNumber,
    customerId: userId,
    merchantId,
    estimatedFee,
    status: 'CREATED',
    timestamp: new Date().toISOString(),
  });

  logger.info(`Parcel created: ${trackingNumber} by user ${userId}`);
  return parcel;
}

async function getParcelById(parcelId, user) {
  const parcel = await prisma.parcel.findUnique({
    where: { id: parcelId },
    include: {
      zone: true,
      customer: { select: { id: true, name: true, email: true, phone: true } },
      courier: { include: { user: { select: { name: true, phone: true } } } },
      statusHistory: { orderBy: { timestamp: 'asc' } },
      merchant: { select: { id: true, businessName: true } },
    },
  });

  if (!parcel) throw new AppError('Parcel not found', 404);

  // Authorization: customers can only see their own
  if (user.role === 'CUSTOMER' && parcel.customerId !== user.id) {
    throw new AppError('You do not have access to this parcel', 403);
  }
  if (user.role === 'COURIER' && parcel.courier?.userId !== user.id) {
    throw new AppError('You do not have access to this parcel', 403);
  }
  if (user.role === 'MERCHANT') {
    const merchant = await prisma.merchant.findUnique({ where: { userId: user.id } });
    if (!merchant || parcel.merchantId !== merchant.id) {
      throw new AppError('You do not have access to this parcel', 403);
    }
  }

  return parcel;
}

async function trackParcelPublic(trackingNumber) {
  const parcel = await prisma.parcel.findUnique({
    where: { trackingNumber },
    select: {
      id: true, trackingNumber: true, status: true, size: true,
      pickupCity: true, dropoffCity: true, dropoffAddress: true,
      recipientName: true, estimatedFee: true, createdAt: true, deliveredAt: true,
      zone: { select: { name: true, estimatedDays: true } },
      statusHistory: { orderBy: { timestamp: 'asc' }, select: { status: true, note: true, timestamp: true } },
      courier: { include: { user: { select: { name: true } } } },
    },
  });
  if (!parcel) throw new AppError('Tracking number not found', 404);
  return parcel;
}

async function listCustomerParcels(customerId, { page = 1, limit = 10, status }) {
  const where = { customerId, ...(status && { status }) };
  const [parcels, total] = await Promise.all([
    prisma.parcel.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { zone: true, statusHistory: { orderBy: { timestamp: 'desc' }, take: 1 } },
    }),
    prisma.parcel.count({ where }),
  ]);
  return { parcels, total, page, pages: Math.ceil(total / limit) };
}

async function listAllParcels({ page = 1, limit = 20, status, courierId, unassignedOnly }) {
  const where = {
    ...(status && { status }),
    ...(courierId && { courierId }),
    ...(unassignedOnly && { courierId: null, status: { in: ['CREATED', 'PENDING_PICKUP'] } }),
  };
  const [parcels, total] = await Promise.all([
    prisma.parcel.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        zone: true,
        customer: { select: { name: true, email: true, phone: true } },
        courier: { include: { user: { select: { name: true } } } },
        statusHistory: { orderBy: { timestamp: 'desc' }, take: 1 },
      },
    }),
    prisma.parcel.count({ where }),
  ]);
  return { parcels, total, page, pages: Math.ceil(total / limit) };
}

async function updateParcelStatus(parcelId, { status, note, proofImageUrl, failureReason }, updaterUser, io) {
  const parcel = await prisma.parcel.findUnique({
    where: { id: parcelId },
    include: { customer: true, merchant: true },
  });
  if (!parcel) throw new AppError('Parcel not found', 404);

  // Couriers can only update their own assigned parcels
  if (updaterUser.role === 'COURIER') {
    const courier = await prisma.courier.findUnique({ where: { userId: updaterUser.id } });
    if (!courier || parcel.courierId !== courier.id) {
      throw new AppError('You are not assigned to this parcel', 403);
    }
  }

  // Validate status transition
  const validTransitions = {
    CREATED: ['PENDING_PICKUP', 'CANCELLED'],
    PENDING_PICKUP: ['PICKED_UP', 'CANCELLED'],
    PICKED_UP: ['IN_TRANSIT'],
    IN_TRANSIT: ['OUT_FOR_DELIVERY'],
    OUT_FOR_DELIVERY: ['DELIVERED', 'FAILED'],
    DELIVERED: [],
    FAILED: ['PENDING_PICKUP'],
    CANCELLED: [],
  };

  if (!validTransitions[parcel.status]?.includes(status)) {
    throw new AppError(`Cannot transition from ${parcel.status} to ${status}`, 400);
  }

  const updatedParcel = await prisma.$transaction(async (tx) => {
    const updated = await tx.parcel.update({
      where: { id: parcelId },
      data: {
        status,
        ...(status === 'DELIVERED' && { deliveredAt: new Date() }),
      },
    });
    await tx.parcelStatusHistory.create({
      data: {
        parcelId,
        status,
        note,
        proofImageUrl,
        failureReason,
        updatedBy: updaterUser.id,
      },
    });
    return updated;
  });

  // Publish status change event
  const eventPayload = {
    event: 'parcel.status_changed',
    parcelId,
    trackingNumber: parcel.trackingNumber,
    oldStatus: parcel.status,
    newStatus: status,
    customerId: parcel.customerId,
    customerEmail: parcel.customer.email,
    customerName: parcel.customer.name,
    merchantId: parcel.merchantId,
    webhookUrl: parcel.merchant?.webhookUrl,
    webhookSecret: parcel.merchant?.webhookSecret,
    note,
    timestamp: new Date().toISOString(),
  };

  await publishEvent('parcel.status_changed', eventPayload);

  // Real-time socket emit
  if (io) {
    io.to(`parcel:${parcel.trackingNumber}`).emit('status:update', {
      trackingNumber: parcel.trackingNumber,
      status,
      note,
      timestamp: new Date().toISOString(),
    });
  }

  logger.info(`Parcel ${parcel.trackingNumber} status: ${parcel.status} → ${status}`);
  return updatedParcel;
}

async function assignCourier(parcelId, courierId, dispatcherId) {
  const [parcel, courier] = await Promise.all([
    prisma.parcel.findUnique({ where: { id: parcelId } }),
    prisma.courier.findUnique({ where: { id: courierId }, include: { user: true } }),
  ]);

  if (!parcel) throw new AppError('Parcel not found', 404);
  if (!courier) throw new AppError('Courier not found', 404);
  if (!['CREATED', 'PENDING_PICKUP', 'FAILED'].includes(parcel.status)) {
    throw new AppError(`Cannot assign courier to parcel with status ${parcel.status}`, 400);
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.parcel.update({
      where: { id: parcelId },
      data: { courierId: courier.id, status: 'PENDING_PICKUP' },
    });
    await tx.courierAssignment.upsert({
      where: { parcelId },
      update: { courierId: courier.id, assignedAt: new Date(), assignedBy: dispatcherId, completedAt: null },
      create: { courierId: courier.id, parcelId, assignedBy: dispatcherId },
    });
    await tx.parcelStatusHistory.create({
      data: { parcelId, status: 'PENDING_PICKUP', note: `Assigned to courier: ${courier.user.name}`, updatedBy: dispatcherId },
    });
    return updated;
  });
}

module.exports = {
  estimateFee, createParcel, getParcelById, trackParcelPublic,
  listCustomerParcels, listAllParcels, updateParcelStatus, assignCourier,
};
