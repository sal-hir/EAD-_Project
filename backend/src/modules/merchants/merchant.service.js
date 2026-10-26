const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { prisma } = require('../../config/database');
const { AppError } = require('../../middlewares/errorHandler');
const logger = require('../../config/logger');

async function registerMerchant(userId, data) {
  const { businessName, businessEmail, webhookUrl } = data;
  const existing = await prisma.merchant.findUnique({ where: { userId } });
  if (existing) throw new AppError('Merchant profile already exists for this user', 409);

  const rawApiKey = `sk_${crypto.randomBytes(24).toString('hex')}`;
  const apiKeyHash = await bcrypt.hash(rawApiKey, 10);
  const webhookSecret = crypto.randomBytes(32).toString('hex');

  const merchant = await prisma.merchant.create({
    data: {
      userId, businessName, businessEmail,
      apiKey: rawApiKey,
      apiKeyHash,
      webhookUrl: webhookUrl || null,
      webhookSecret,
      isApproved: false,
    },
  });

  logger.info(`Merchant registered: ${businessName} (pending approval)`);
  return { ...merchant, rawApiKey };
}

async function getMerchantDashboard(merchantId) {
  const [merchant, stats] = await Promise.all([
    prisma.merchant.findUnique({
      where: { id: merchantId },
      include: { user: { select: { name: true, email: true } } },
    }),
    prisma.parcel.groupBy({
      by: ['status'],
      where: { merchantId },
      _count: { id: true },
    }),
  ]);
  if (!merchant) throw new AppError('Merchant not found', 404);
  return { merchant, statusBreakdown: stats };
}

async function getMerchantOrders(merchantId, { page = 1, limit = 20, status }) {
  const where = { merchantId, ...(status && { status }) };
  const [parcels, total] = await Promise.all([
    prisma.parcel.findMany({
      where, skip: (page - 1) * limit, take: limit,
      orderBy: { createdAt: 'desc' },
      include: { zone: true, statusHistory: { orderBy: { timestamp: 'desc' }, take: 1 } },
    }),
    prisma.parcel.count({ where }),
  ]);
  return { parcels, total, page, pages: Math.ceil(total / limit) };
}

async function regenerateApiKey(merchantId) {
  const rawApiKey = `sk_${crypto.randomBytes(24).toString('hex')}`;
  const apiKeyHash = await bcrypt.hash(rawApiKey, 10);
  await prisma.merchant.update({
    where: { id: merchantId },
    data: { apiKey: rawApiKey, apiKeyHash },
  });
  logger.info(`API key regenerated for merchant ${merchantId}`);
  return { apiKey: rawApiKey };
}

async function updateWebhook(merchantId, webhookUrl) {
  return prisma.merchant.update({
    where: { id: merchantId },
    data: { webhookUrl },
  });
}

async function getAllMerchants({ page = 1, limit = 20, approved }) {
  const where = approved !== undefined ? { isApproved: approved === 'true' } : {};
  const [merchants, total] = await Promise.all([
    prisma.merchant.findMany({
      where, skip: (page - 1) * limit, take: limit,
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.merchant.count({ where }),
  ]);
  return { merchants, total, page, pages: Math.ceil(total / limit) };
}

async function approveMerchant(merchantId) {
  const merchant = await prisma.merchant.update({
    where: { id: merchantId },
    data: { isApproved: true },
  });
  logger.info(`Merchant approved: ${merchantId}`);
  return merchant;
}

module.exports = { registerMerchant, getMerchantDashboard, getMerchantOrders, regenerateApiKey, updateWebhook, getAllMerchants, approveMerchant };
