const merchantService = require('./merchant.service');
const { prisma } = require('../../config/database');
const { AppError } = require('../../middlewares/errorHandler');

async function registerMerchant(req, res, next) {
  try {
    const result = await merchantService.registerMerchant(req.user.id, req.body);
    res.status(201).json({ success: true, message: 'Merchant registered. Awaiting admin approval.', data: result });
  } catch (err) { next(err); }
}

async function getMyDashboard(req, res, next) {
  try {
    const merchant = await prisma.merchant.findUnique({ where: { userId: req.user.id } });
    if (!merchant) throw new AppError('Merchant profile not found', 404);
    const data = await merchantService.getMerchantDashboard(merchant.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

async function getMyOrders(req, res, next) {
  try {
    const merchant = await prisma.merchant.findUnique({ where: { userId: req.user.id } });
    if (!merchant) throw new AppError('Merchant profile not found', 404);
    const { page, limit, status } = req.query;
    const data = await merchantService.getMerchantOrders(merchant.id, {
      page: parseInt(page) || 1, limit: parseInt(limit) || 20, status,
    });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

async function regenerateApiKey(req, res, next) {
  try {
    const merchant = await prisma.merchant.findUnique({ where: { userId: req.user.id } });
    if (!merchant) throw new AppError('Merchant profile not found', 404);
    const data = await merchantService.regenerateApiKey(merchant.id);
    res.json({ success: true, message: 'API key regenerated', data });
  } catch (err) { next(err); }
}

async function updateWebhook(req, res, next) {
  try {
    const merchant = await prisma.merchant.findUnique({ where: { userId: req.user.id } });
    if (!merchant) throw new AppError('Merchant profile not found', 404);
    const data = await merchantService.updateWebhook(merchant.id, req.body.webhookUrl);
    res.json({ success: true, message: 'Webhook URL updated', data });
  } catch (err) { next(err); }
}

module.exports = { registerMerchant, getMyDashboard, getMyOrders, regenerateApiKey, updateWebhook };
