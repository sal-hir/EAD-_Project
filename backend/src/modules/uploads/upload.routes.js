const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { authenticate } = require('../../middlewares/authenticate');
const { authorize } = require('../../middlewares/authorize');
const { AppError } = require('../../middlewares/errorHandler');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../../uploads'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `proof_${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp/;
    if (allowed.test(path.extname(file.originalname).toLowerCase())) {
      cb(null, true);
    } else {
      cb(new AppError('Only JPEG, PNG, and WebP images are allowed', 400));
    }
  },
});

// POST /api/v1/uploads/proof — upload proof of delivery image
router.post('/proof', authenticate, authorize('COURIER'), upload.single('image'), (req, res, next) => {
  try {
    if (!req.file) throw new AppError('No file uploaded', 400);
    const fileUrl = `${process.env.API_BASE_URL || 'http://localhost:4000'}/uploads/${req.file.filename}`;
    res.json({ success: true, data: { url: fileUrl, filename: req.file.filename } });
  } catch (err) { next(err); }
});

module.exports = router;
