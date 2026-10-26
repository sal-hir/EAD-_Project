const { registerUser, loginUser, generateToken, getProfile, updateProfile } = require('./auth.service');
const { AppError } = require('../../middlewares/errorHandler');

async function register(req, res, next) {
  try {
    const { email, password, name, phone } = req.body;
    const user = await registerUser({ email, password, name, phone });
    res.status(201).json({ success: true, message: 'Registration successful', data: user });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const result = await loginUser({ email, password });
    res.json({ success: true, message: 'Login successful', data: result });
  } catch (err) {
    next(err);
  }
}

async function googleCallback(req, res, next) {
  try {
    if (!req.user) throw new AppError('Google authentication failed', 401);
    const token = generateToken(req.user);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/auth/callback?token=${token}&role=${req.user.role}`);
  } catch (err) {
    next(err);
  }
}

async function getMe(req, res, next) {
  try {
    const user = await getProfile(req.user.id);
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
}

async function patchMe(req, res, next) {
  try {
    const user = await updateProfile(req.user.id, req.body);
    res.json({ success: true, message: 'Profile updated', data: user });
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login, googleCallback, getMe, patchMe };
