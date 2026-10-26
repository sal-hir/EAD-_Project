const request = require('supertest');
const { app } = require('../src/server');
const { prisma } = require('../src/config/database');
const bcrypt = require('bcryptjs');

// Mock rabbitmq so tests run standalone
jest.mock('../src/config/rabbitmq', () => ({
  connectRabbitMQ: jest.fn().mockResolvedValue(true),
  publishEvent: jest.fn().mockResolvedValue(true),
  getChannel: jest.fn().mockReturnValue({}),
  EXCHANGE_NAME: 'swiftdrop.events',
}));

describe('Auth Service & RBAC Tests', () => {
  beforeAll(async () => {
    // Clean up test users if any
    await prisma.user.deleteMany({
      where: { email: { in: ['testcustomer@swiftdrop.lk', 'testcourier1@swiftdrop.lk', 'testcourier2@swiftdrop.lk'] } }
    }).catch(() => {});
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { in: ['testcustomer@swiftdrop.lk', 'testcourier1@swiftdrop.lk', 'testcourier2@swiftdrop.lk'] } }
    }).catch(() => {});
    await prisma.$disconnect();
  });

  describe('POST /api/v1/auth/register', () => {
    it('should register a new customer with hashed password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'testcustomer@swiftdrop.lk',
          password: 'Password123!',
          name: 'Test Customer',
          phone: '+94770000001',
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe('testcustomer@swiftdrop.lk');
      expect(res.body.data.role).toBe('CUSTOMER');
      // Password must NEVER be returned in response
      expect(res.body.data.password).toBeUndefined();
      expect(res.body.data.passwordHash).toBeUndefined();

      // Check DB to verify password is encrypted
      const dbUser = await prisma.user.findUnique({
        where: { email: 'testcustomer@swiftdrop.lk' },
      });
      expect(dbUser.passwordHash).toBeDefined();
      expect(dbUser.passwordHash).not.toBe('Password123!');
      const match = await bcrypt.compare('Password123!', dbUser.passwordHash);
      expect(match).toBe(true);
    });

    it('should reject registration if email is already taken', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'testcustomer@swiftdrop.lk',
          password: 'Password123!',
          name: 'Duplicate',
        });

      expect(res.statusCode).toBe(409);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('should authenticate user and return JWT token', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'testcustomer@swiftdrop.lk',
          password: 'Password123!',
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.user.role).toBe('CUSTOMER');
    });

    it('should reject invalid credentials', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'testcustomer@swiftdrop.lk',
          password: 'WrongPassword!',
        });

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });
});
