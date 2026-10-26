const parcelService = require('./parcel.service');
const receiptService = require('./receipt.service');
const { AppError } = require('../../middlewares/errorHandler');

async function estimateFee(req, res, next) {
  try {
    const { zoneId, weightKg, size } = req.query;
    const estimate = await parcelService.estimateFee({
      zoneId, weightKg: parseFloat(weightKg), size: size?.toUpperCase() || 'SMALL',
    });
    res.json({ success: true, data: estimate });
  } catch (err) { next(err); }
}

async function createParcel(req, res, next) {
  try {
    const parcel = await parcelService.createParcel(req.body, req.user.id, req.merchant?.id || null);
    res.status(201).json({ success: true, message: 'Parcel created successfully', data: parcel });
  } catch (err) { next(err); }
}

async function getParcel(req, res, next) {
  try {
    const parcel = await parcelService.getParcelById(req.params.id, req.user);
    res.json({ success: true, data: parcel });
  } catch (err) { next(err); }
}

async function trackParcel(req, res, next) {
  try {
    const parcel = await parcelService.trackParcelPublic(req.params.trackingNumber);
    res.json({ success: true, data: parcel });
  } catch (err) { next(err); }
}

async function listMyParcels(req, res, next) {
  try {
    const { page, limit, status } = req.query;
    const result = await parcelService.listCustomerParcels(req.user.id, {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 10,
      status,
    });
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

async function listParcels(req, res, next) {
  try {
    const { page, limit, status, courierId, unassignedOnly } = req.query;
    const result = await parcelService.listAllParcels({
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
      status,
      courierId,
      unassignedOnly: unassignedOnly === 'true',
    });
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

async function updateStatus(req, res, next) {
  try {
    const io = req.app.get('io');
    const parcel = await parcelService.updateParcelStatus(
      req.params.id, req.body, req.user, io
    );
    res.json({ success: true, message: 'Status updated', data: { id: parcel.id, status: parcel.status } });
  } catch (err) { next(err); }
}

async function assignCourier(req, res, next) {
  try {
    const { courierId } = req.body;
    const parcel = await parcelService.assignCourier(req.params.id, courierId, req.user.id);
    res.json({ success: true, message: 'Courier assigned', data: parcel });
  } catch (err) { next(err); }
}

async function downloadReceipt(req, res, next) {
  try {
    const parcel = await parcelService.getParcelById(req.params.id, req.user);
    if (parcel.status !== 'DELIVERED') throw new AppError('Receipt available only for delivered parcels', 400);
    const pdfBuffer = await receiptService.generateReceipt(parcel);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=receipt-${parcel.trackingNumber}.pdf`);
    res.send(pdfBuffer);
  } catch (err) { next(err); }
}

module.exports = { estimateFee, createParcel, getParcel, trackParcel, listMyParcels, listParcels, updateStatus, assignCourier, downloadReceipt };
