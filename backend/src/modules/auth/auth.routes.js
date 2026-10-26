const express = require('express');
const passport = require('passport');
const { body } = require('express-validator');
const { register, login, googleCallback, getMe, patchMe } = require('./auth.controller');
const { authenticate } = require('../../middlewares/authenticate');
const { validate } = require('../../middlewares/validate');

const router = express.Router();

const registerValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('Password must contain an uppercase letter')
    .matches(/[0-9]/).withMessage('Password must contain a number'),
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
  body('phone').optional().matches(/^\+?[0-9]{7,15}$/).withMessage('Invalid phone number'),
];

const loginValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
];

// POST /api/v1/auth/register
router.post('/register', registerValidation, validate, register);

// POST /api/v1/auth/login
router.post('/login', loginValidation, validate, login);

// GET /api/v1/auth/google
router.get('/google',
  (req, res, next) => {
    if (!process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID === 'your_google_client_id_here') {
      return res.status(501).json({
        success: false,
        message: 'Google OAuth is not configured on this server. Please use email/password login.',
      });
    }
    next();
  },
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })
);

// GET /api/v1/auth/google/callback
router.get('/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/login' }),
  googleCallback
);

// GET /api/v1/auth/me
router.get('/me', authenticate, getMe);

// PATCH /api/v1/auth/me
router.patch('/me', authenticate, [
  body('name').optional().trim().isLength({ min: 2, max: 100 }),
  body('phone').optional().matches(/^\+?[0-9]{7,15}$/),
], validate, patchMe);

module.exports = router;
