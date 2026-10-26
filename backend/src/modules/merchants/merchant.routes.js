const express = require('express');
const { body } = require('express-validator');
const ctrl = require('./merchant.controller');
const { authenticate } = require('../../middlewares/authenticate');
const { authorize } = require('../../middlewares/authorize');
const { validate } = require('../../middlewares/validate');

const router = express.Router();

// POST /api/v1/merchants/register — register merchant profile (logged in user)
router.post('/register', authenticate, [
  body('businessName').trim().notEmpty().withMessage('Business name required'),
  body('businessEmail').isEmail().normalizeEmail().withMessage('Valid business email required'),
  body('webhookUrl').optional().isURL().withMessage('Valid webhook URL required'),
], validate, ctrl.registerMerchant);

// GET /api/v1/merchants/dashboard
router.get('/dashboard', authenticate, authorize('MERCHANT'), ctrl.getMyDashboard);

// GET /api/v1/merchants/orders
router.get('/orders', authenticate, authorize('MERCHANT'), ctrl.getMyOrders);

// POST /api/v1/merchants/api-key/regenerate
router.post('/api-key/regenerate', authenticate, authorize('MERCHANT'), ctrl.regenerateApiKey);

// PATCH /api/v1/merchants/webhook
router.patch('/webhook', authenticate, authorize('MERCHANT'), [
  body('webhookUrl').isURL().withMessage('Valid webhook URL required'),
], validate, ctrl.updateWebhook);

module.exports = router;
