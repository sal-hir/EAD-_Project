const request = require('supertest');
const { app } = require('../src/server');
const { prisma } = require('../src/config/database');
const { generateToken } = require('../src/modules/auth/auth.service');
const rabbitmq = require('../src/config/rabbitmq');

jest.mock('../src/config/rabbitmq', () => ({
  connectRabbitMQ: jest.fn().mockResolvedValue(true),
  publishEvent: jest.fn().mockResolvedValue(true),
  getChannel: jest.fn().mockReturnValue({}),
  EXCHANGE_NAME: 'swiftdrop.events',
}));

describe('Integration & Messaging Flow Tests', () => {
  let customerUser, customerToken;
  let dispatcherUser, dispatcherToken;
  let zone, createdParcelId, trackingNumber;

  beforeAll(async () => {
    // Setup test zone
    zone = await prisma.zone.upsert({
      where: { name: 'Integration Zone' },
      update: {},
      create: {
        name: 'Integration Zone',
        baseFee: 250,
        feePerKg: 50,
        estimatedDays: 2,
      },
    });

    customerUser = await prisma.user.create({
      data: {
        email: `integ_cust_${Date.now()}@test.com`,
        name: 'Integ Customer',
        role: 'CUSTOMER',
      },
    });
    customerToken = generateToken(customerUser);

    dispatcherUser = await prisma.user.create({
      data: {
        email: `integ_disp_${Date.now()}@test.com`,
        name: 'Integ Dispatcher',
        role: 'DISPATCHER',
      },
    });
    dispatcherToken = generateToken(dispatcherUser);
  });

  afterAll(async () => {
    if (createdParcelId) {
      await prisma.parcelStatusHistory.deleteMany({ where: { parcelId: createdParcelId } });
      await prisma.parcel.delete({ where: { id: createdParcelId } }).catch(() => {});
    }
    if (customerUser) await prisma.user.delete({ where: { id: customerUser.id } }).catch(() => {});
    if (dispatcherUser) await prisma.user.delete({ where: { id: dispatcherUser.id } }).catch(() => {});
    if (zone) await prisma.zone.delete({ where: { id: zone.id } }).catch(() => {});
    await prisma.$disconnect();
  });

  it('Strategy Pattern: calculates fee based on zone, weight, and size multiplier correctly', async () => {
    // Formula: (baseFee + feePerKg * weight) * sizeMultiplier
    // Base: 250, feePerKg: 50, weight: 3kg -> 250 + 150 = 400
    // LARGE size multiplier is 1.7 -> 400 * 1.7 = 680
    const res = await request(app)
      .get('/api/v1/parcels/estimate')
      .query({
        zoneId: zone.id,
        weightKg: 3,
        size: 'LARGE',
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.estimatedFee).toBe(680);
    expect(res.body.data.currency).toBe('LKR');
  });

  it('End-to-End Delivery Creation: saves parcel and publishes parcel.created event to RabbitMQ', async () => {
    const res = await request(app)
      .post('/api/v1/parcels')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        zoneId: zone.id,
        pickupAddress: 'No 10, Main Street',
        pickupCity: 'Colombo',
        dropoffAddress: 'No 45, Temple Road',
        dropoffCity: 'Kandy',
        recipientName: 'Sunil Shantha',
        recipientPhone: '+94712345678',
        recipientEmail: 'recipient@test.com',
        weightKg: 1.5,
        size: 'SMALL',
        description: 'Fragile Handicrafts',
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.trackingNumber).toMatch(/^SD/);
    expect(res.body.data.status).toBe('CREATED');

    createdParcelId = res.body.data.id;
    trackingNumber = res.body.data.trackingNumber;

    // Verify RabbitMQ publish was invoked with correct routing key and payload
    expect(rabbitmq.publishEvent).toHaveBeenCalledWith(
      'parcel.created',
      expect.objectContaining({
        event: 'parcel.created',
        parcelId: createdParcelId,
        trackingNumber: trackingNumber,
        status: 'CREATED',
      })
    );
  });

  it('Public Tracking: retrieves live parcel status without requiring authentication', async () => {
    const res = await request(app)
      .get(`/api/v1/parcels/track/${trackingNumber}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.trackingNumber).toBe(trackingNumber);
    expect(res.body.data.status).toBe('CREATED');
    expect(res.body.data.statusHistory).toBeInstanceOf(Array);
    expect(res.body.data.statusHistory.length).toBeGreaterThanOrEqual(1);
  });

  it('Status Transition & Pub/Sub: updates status to CANCELLED and publishes parcel.status_changed event', async () => {
    const res = await request(app)
      .patch(`/api/v1/parcels/${createdParcelId}/status`)
      .set('Authorization', `Bearer ${dispatcherToken}`)
      .send({
        status: 'CANCELLED',
        note: 'Customer requested cancellation',
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('CANCELLED');

    // Verify status changed event published to RabbitMQ broker
    expect(rabbitmq.publishEvent).toHaveBeenCalledWith(
      'parcel.status_changed',
      expect.objectContaining({
        event: 'parcel.status_changed',
        parcelId: createdParcelId,
        trackingNumber: trackingNumber,
        newStatus: 'CANCELLED',
      })
    );
  });
});
