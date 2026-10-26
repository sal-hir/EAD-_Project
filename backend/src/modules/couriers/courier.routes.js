const express = require('express');
const { body } = require('express-validator');
const courierService = require('./courier.service');
const { authenticate } = require('../../middlewares/authenticate');
const { authorize } = require('../../middlewares/authorize');
const { validate } = require('../../middlewares/validate');

const router = express.Router();

// GET /api/v1/couriers/me — courier profile
router.get('/me', authenticate, authorize('COURIER'), async (req, res, next) => {
  try {
    const data = await courierService.getCourierProfile(req.user.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// GET /api/v1/couriers/my-deliveries — assigned deliveries
router.get('/my-deliveries', authenticate, authorize('COURIER'), async (req, res, next) => {
  try {
    const { status, date } = req.query;
    const data = await courierService.getAssignedDeliveries(req.user.id, { status, date });
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// PATCH /api/v1/couriers/availability
router.patch('/availability', authenticate, authorize('COURIER'), [
  body('isAvailable').isBoolean().withMessage('isAvailable must be boolean'),
], validate, async (req, res, next) => {
  try {
    const data = await courierService.updateCourierAvailability(req.user.id, req.body.isAvailable);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// GET /api/v1/couriers — admin/dispatcher: list all with workload
router.get('/', authenticate, authorize('ADMIN', 'DISPATCHER'), async (req, res, next) => {
  try {
    const data = await courierService.getAllCouriers();
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

module.exports = router;
