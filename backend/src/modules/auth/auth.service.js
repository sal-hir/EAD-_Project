const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { prisma } = require('../../config/database');
const { AppError } = require('../../middlewares/errorHandler');
const logger = require('../../config/logger');

const SALT_ROUNDS = 12;

async function registerUser({ email, password, name, phone, role = 'CUSTOMER' }) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new AppError('Email already in use', 409);

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await prisma.user.create({
    data: { email, passwordHash, name, phone, role },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });

  logger.info(`New user registered: ${email} (${role})`);
  return user;
}

async function loginUser({ email, password }) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash) {
    throw new AppError('Invalid email or password', 401);
  }
  if (!user.isActive) throw new AppError('Account is deactivated', 403);

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new AppError('Invalid email or password', 401);

  const token = generateToken(user);
  return {
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  };
}

function generateToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET || 'fallback_secret',
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

async function verifyToken(token) {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      select: { id: true, email: true, name: true, role: true, isActive: true },
    });
    if (!user || !user.isActive) throw new AppError('User not found or inactive', 401);
    return user;
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError('Invalid token', 401);
  }
}

async function getProfile(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, phone: true, role: true, createdAt: true },
  });
  if (!user) throw new AppError('User not found', 404);
  return user;
}

async function updateProfile(userId, data) {
  const { name, phone } = data;
  return prisma.user.update({
    where: { id: userId },
    data: { name, phone },
    select: { id: true, email: true, name: true, phone: true, role: true },
  });
}

module.exports = { registerUser, loginUser, generateToken, verifyToken, getProfile, updateProfile };
