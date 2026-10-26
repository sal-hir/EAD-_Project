const express = require('express');
const { body } = require('express-validator');
const { prisma } = require('../../config/database');
const { authenticate } = require('../../middlewares/authenticate');
const { authorize } = require('../../middlewares/authorize');
const { validate } = require('../../middlewares/validate');
const { AppError } = require('../../middlewares/errorHandler');

const router = express.Router();

// GET /api/v1/zones — public list
router.get('/', async (req, res, next) => {
  try {
    const zones = await prisma.zone.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, data: zones });
  } catch (err) { next(err); }
});

// POST /api/v1/zones — admin only
router.post('/', authenticate, authorize('ADMIN'), [
  body('name').trim().notEmpty().withMessage('Zone name required'),
  body('baseFee').isFloat({ min: 0 }).withMessage('Base fee must be >= 0'),
  body('feePerKg').isFloat({ min: 0 }).withMessage('Fee per kg must be >= 0'),
  body('estimatedDays').isInt({ min: 1 }).withMessage('Estimated days must be >= 1'),
], validate, async (req, res, next) => {
  try {
    const { name, description, baseFee, feePerKg, estimatedDays } = req.body;
    const zone = await prisma.zone.create({ data: { name, description, baseFee, feePerKg, estimatedDays } });
    res.status(201).json({ success: true, data: zone });
  } catch (err) { next(err); }
});

// PATCH /api/v1/zones/:id — admin only
router.patch('/:id', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const { name, description, baseFee, feePerKg, estimatedDays, isActive } = req.body;
    const zone = await prisma.zone.update({
      where: { id: req.params.id },
      data: { name, description, baseFee, feePerKg, estimatedDays, isActive },
    });
    res.json({ success: true, data: zone });
  } catch (err) { next(err); }
});

module.exports = router;
