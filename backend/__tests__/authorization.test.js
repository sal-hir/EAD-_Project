const request = require('supertest');
const { app } = require('../src/server');
const { prisma } = require('../src/config/database');
const { generateToken } = require('../src/modules/auth/auth.service');

jest.mock('../src/config/rabbitmq', () => ({
  connectRabbitMQ: jest.fn().mockResolvedValue(true),
  publishEvent: jest.fn().mockResolvedValue(true),
  getChannel: jest.fn().mockReturnValue({}),
  EXCHANGE_NAME: 'swiftdrop.events',
}));

describe('Authorization & Access Control Rules', () => {
  let courier1, courier2, courier1User, courier2User;
  let courier1Token, courier2Token;
  let customerUser, customerToken;
  let zone, parcelCourier1;

  beforeAll(async () => {
    // Create test zone
    zone = await prisma.zone.upsert({
      where: { name: 'Test Zone Auth' },
      update: {},
      create: {
        name: 'Test Zone Auth',
        baseFee: 200,
        feePerKg: 50,
        estimatedDays: 1,
      },
    });

    // Create Customer
    customerUser = await prisma.user.create({
      data: {
        email: `cust_${Date.now()}@test.com`,
        name: 'Customer Test',
        role: 'CUSTOMER',
      },
    });
    customerToken = generateToken(customerUser);

    // Create Courier 1
    courier1User = await prisma.user.create({
      data: {
        email: `courier1_${Date.now()}@test.com`,
        name: 'Courier 1 Test',
        role: 'COURIER',
      },
    });
    courier1 = await prisma.courier.create({
      data: { userId: courier1User.id, vehicleType: 'Bike' },
    });
    courier1Token = generateToken(courier1User);

    // Create Courier 2
    courier2User = await prisma.user.create({
      data: {
        email: `courier2_${Date.now()}@test.com`,
        name: 'Courier 2 Test',
        role: 'COURIER',
      },
    });
    courier2 = await prisma.courier.create({
      data: { userId: courier2User.id, vehicleType: 'Van' },
    });
    courier2Token = generateToken(courier2User);

    // Create parcel assigned to Courier 1
    parcelCourier1 = await prisma.parcel.create({
      data: {
        trackingNumber: `SDTEST${Date.now()}`,
        customerId: customerUser.id,
        courierId: courier1.id,
        zoneId: zone.id,
        pickupAddress: 'Pickup 1',
        pickupCity: 'City A',
        dropoffAddress: 'Dropoff 1',
        dropoffCity: 'City B',
        recipientName: 'Recipient 1',
        recipientPhone: '+94771234567',
        weightKg: 2,
        size: 'SMALL',
        estimatedFee: 300,
        status: 'PENDING_PICKUP',
      },
    });
  });

  afterAll(async () => {
    if (parcelCourier1) {
      await prisma.parcelStatusHistory.deleteMany({ where: { parcelId: parcelCourier1.id } });
      await prisma.courierAssignment.deleteMany({ where: { parcelId: parcelCourier1.id } });
      await prisma.parcel.delete({ where: { id: parcelCourier1.id } }).catch(() => {});
    }
    if (courier1) await prisma.courier.delete({ where: { id: courier1.id } }).catch(() => {});
    if (courier2) await prisma.courier.delete({ where: { id: courier2.id } }).catch(() => {});
    if (courier1User) await prisma.user.delete({ where: { id: courier1User.id } }).catch(() => {});
    if (courier2User) await prisma.user.delete({ where: { id: courier2User.id } }).catch(() => {});
    if (customerUser) await prisma.user.delete({ where: { id: customerUser.id } }).catch(() => {});
    if (zone) await prisma.zone.delete({ where: { id: zone.id } }).catch(() => {});
    await prisma.$disconnect();
  });

  it('Courier 1 SHOULD be able to access their own assigned parcel', async () => {
    const res = await request(app)
      .get(`/api/v1/parcels/${parcelCourier1.id}`)
      .set('Authorization', `Bearer ${courier1Token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(parcelCourier1.id);
  });

  it('Courier 2 MUST NOT be able to view Courier 1 parcel (403 Forbidden)', async () => {
    const res = await request(app)
      .get(`/api/v1/parcels/${parcelCourier1.id}`)
      .set('Authorization', `Bearer ${courier2Token}`);

    expect(res.statusCode).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/permission|access/i);
  });

  it('Courier 2 MUST NOT be able to update status of Courier 1 parcel (403 Forbidden)', async () => {
    const res = await request(app)
      .patch(`/api/v1/parcels/${parcelCourier1.id}/status`)
      .set('Authorization', `Bearer ${courier2Token}`)
      .send({
        status: 'PICKED_UP',
        note: 'Illegitimate update attempt',
      });

    expect(res.statusCode).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/not assigned to this parcel/i);
  });

  it('Courier 1 CAN update status of their own assigned parcel', async () => {
    const res = await request(app)
      .patch(`/api/v1/parcels/${parcelCourier1.id}/status`)
      .set('Authorization', `Bearer ${courier1Token}`)
      .send({
        status: 'PICKED_UP',
        note: 'Parcel picked up successfully',
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('PICKED_UP');
  });

  it('Customer MUST NOT be able to assign couriers (Role authorization check)', async () => {
    const res = await request(app)
      .patch(`/api/v1/parcels/${parcelCourier1.id}/assign`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        courierId: courier2.id,
      });

    expect(res.statusCode).toBe(403);
    expect(res.body.success).toBe(false);
  });
});
