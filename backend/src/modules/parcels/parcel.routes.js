const express = require('express');
const { body, query, param } = require('express-validator');
const ctrl = require('./parcel.controller');
const { authenticate } = require('../../middlewares/authenticate');
const { authorize } = require('../../middlewares/authorize');
const { apiKeyAuth } = require('../../middlewares/apiKeyAuth');
const { validate } = require('../../middlewares/validate');

const router = express.Router();

const createParcelValidation = [
  body('zoneId').isUUID().withMessage('Valid zone ID required'),
  body('pickupAddress').trim().notEmpty().withMessage('Pickup address required'),
  body('pickupCity').trim().notEmpty().withMessage('Pickup city required'),
  body('dropoffAddress').trim().notEmpty().withMessage('Drop-off address required'),
  body('dropoffCity').trim().notEmpty().withMessage('Drop-off city required'),
  body('recipientName').trim().notEmpty().withMessage('Recipient name required'),
  body('recipientPhone').matches(/^\+?[0-9]{7,15}$/).withMessage('Valid recipient phone required'),
  body('recipientEmail').optional().isEmail().withMessage('Valid recipient email'),
  body('weightKg').isFloat({ min: 0.1, max: 200 }).withMessage('Weight must be 0.1-200 kg'),
  body('size').isIn(['SMALL', 'MEDIUM', 'LARGE']).withMessage('Size must be SMALL, MEDIUM, or LARGE'),
];

// Public: track by tracking number
router.get('/track/:trackingNumber', ctrl.trackParcel);

// Estimate fee (no auth needed)
router.get('/estimate', ctrl.estimateFee);

// Customer: create parcel
router.post('/', authenticate, authorize('CUSTOMER', 'ADMIN'), createParcelValidation, validate, ctrl.createParcel);

// Merchant: create parcel via API key
router.post('/merchant', apiKeyAuth, createParcelValidation, validate, ctrl.createParcel);

// Customer: list own parcels
router.get('/my', authenticate, authorize('CUSTOMER'), ctrl.listMyParcels);

// Admin/Dispatcher: list all parcels
router.get('/', authenticate, authorize('ADMIN', 'DISPATCHER'), ctrl.listParcels);

// Get single parcel
router.get('/:id', authenticate, ctrl.getParcel);

// Update parcel status (courier, dispatcher, admin)
router.patch('/:id/status', authenticate, authorize('COURIER', 'DISPATCHER', 'ADMIN'), [
  body('status').isIn(['PENDING_PICKUP','PICKED_UP','IN_TRANSIT','OUT_FOR_DELIVERY','DELIVERED','FAILED','CANCELLED']),
  body('note').optional().trim().isLength({ max: 500 }),
  body('failureReason').optional().trim().isLength({ max: 500 }),
], validate, ctrl.updateStatus);

// Assign courier (dispatcher, admin)
router.patch('/:id/assign', authenticate, authorize('DISPATCHER', 'ADMIN'), [
  body('courierId').isUUID().withMessage('Valid courier ID required'),
], validate, ctrl.assignCourier);

// Download delivery receipt (customer, admin)
router.get('/:id/receipt', authenticate, authorize('CUSTOMER', 'ADMIN'), ctrl.downloadReceipt);

module.exports = router;
