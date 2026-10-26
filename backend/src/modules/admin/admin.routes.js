const express = require('express');
const { prisma } = require('../../config/database');
const merchantService = require('../merchants/merchant.service');
const { authenticate } = require('../../middlewares/authenticate');
const { authorize } = require('../../middlewares/authorize');
const { AppError } = require('../../middlewares/errorHandler');

const router = express.Router();

// All admin routes require ADMIN or DISPATCHER role
router.use(authenticate, authorize('ADMIN', 'DISPATCHER'));

// GET /api/v1/admin/reports — basic analytics
router.get('/reports', async (req, res, next) => {
  try {
    const now = new Date();
    const startOfDay = new Date(now.setHours(0, 0, 0, 0));
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - 7);
    startOfWeek.setHours(0, 0, 0, 0);

    const [totalParcels, todayParcels, statusBreakdown, deliveredToday, failedToday, weeklyTrend] = await Promise.all([
      prisma.parcel.count(),
      prisma.parcel.count({ where: { createdAt: { gte: startOfDay } } }),
      prisma.parcel.groupBy({ by: ['status'], _count: { id: true } }),
      prisma.parcel.count({ where: { status: 'DELIVERED', deliveredAt: { gte: startOfDay } } }),
      prisma.parcel.count({ where: { status: 'FAILED', updatedAt: { gte: startOfDay } } }),
      prisma.$queryRaw`
        SELECT DATE(created_at) as date, COUNT(*) as count
        FROM parcels
        WHERE created_at >= ${startOfWeek}
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `,
    ]);

    const successRate = totalParcels > 0
      ? ((await prisma.parcel.count({ where: { status: 'DELIVERED' } })) / totalParcels * 100).toFixed(1)
      : 0;

    res.json({
      success: true,
      data: {
        totalParcels, todayParcels, deliveredToday, failedToday, successRate,
        statusBreakdown, weeklyTrend,
      },
    });
  } catch (err) { next(err); }
});

// GET /api/v1/admin/users
router.get('/users', authorize('ADMIN'), async (req, res, next) => {
  try {
    const { role, page = 1, limit = 20 } = req.query;
    const where = role ? { role } : {};
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where, skip: (page - 1) * limit, take: parseInt(limit),
        select: { id: true, email: true, name: true, phone: true, role: true, isActive: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);
    res.json({ success: true, data: { users, total, page: parseInt(page), pages: Math.ceil(total / limit) } });
  } catch (err) { next(err); }
});

// PATCH /api/v1/admin/users/:id/toggle — activate/deactivate user
router.patch('/users/:id/toggle', authorize('ADMIN'), async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) throw new AppError('User not found', 404);
    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: { isActive: !user.isActive },
    });
    res.json({ success: true, data: { isActive: updated.isActive } });
  } catch (err) { next(err); }
});

// GET /api/v1/admin/merchants
router.get('/merchants', authorize('ADMIN'), async (req, res, next) => {
  try {
    const { approved, page, limit } = req.query;
    const data = await merchantService.getAllMerchants({ page: parseInt(page) || 1, limit: parseInt(limit) || 20, approved });
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// PATCH /api/v1/admin/merchants/:id/approve
router.patch('/merchants/:id/approve', authorize('ADMIN'), async (req, res, next) => {
  try {
    const data = await merchantService.approveMerchant(req.params.id);
    res.json({ success: true, message: 'Merchant approved', data });
  } catch (err) { next(err); }
});

module.exports = router;
