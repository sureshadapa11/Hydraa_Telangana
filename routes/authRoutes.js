// =====================================================
//   HYDRAA — Updated authRoutes.js
//   Drop-in replacement for backend/routes/authRoutes.js
//   Changes: adds forgot-password and reset-password routes
// =====================================================

const express = require('express');
const router  = express.Router();
const {
  registerUser,
  loginUser,
  verifyEmail,
  loginAdmin,
  loginOfficial,
  changePassword,
  forgotPasswordRequest,
  forgotPasswordReset,
  verifySession,
  updateProfile,
} = require('../controllers/authController');
const { verifyToken } = require('../middleware/auth');

// ── Citizen ──
router.post('/register',       registerUser);
router.post('/login',          loginUser);
router.get( '/verify/:token',  verifyEmail);

// ── Admin ──
router.post('/admin/login',      loginAdmin);

// ── Official ──
router.post('/official/login',   loginOfficial);

// ── All roles: Change password (requires login) ──
router.put('/change-password', verifyToken, changePassword);

// ── Citizen: Update profile ──
router.put('/profile', verifyToken, updateProfile);

// ── Session validity check (frontend polls this to detect deleted accounts) ──
router.get('/verify-session', verifyToken, verifySession);

// ── Forgot password (no auth required) ──
router.post('/forgot-password',        forgotPasswordRequest);  // Step 1: Send OTP
router.post('/forgot-password/reset',  forgotPasswordReset);    // Step 2: Verify OTP + reset

module.exports = router;
