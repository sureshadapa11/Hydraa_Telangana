// =====================================================
//   Auth Middleware — HYDRAA (HARDENED)
//   JWT verification and role checking
// =====================================================

const jwt = require('jsonwebtoken');
require('dotenv').config();

// ────────────────────────────────────────────────────
//  VERIFY TOKEN (with algorithm pinning)
// ────────────────────────────────────────────────────
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'No token provided. Please login.',
    });
  }

  try {
    // ✅ FIX: Pin algorithm to HS256 to prevent algorithm switching attacks
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ['HS256'],
    });
    req.user = decoded;
    next();
  } catch (err) {
    // ✅ FIX: Distinguish expired vs invalid tokens
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token has expired. Please login again.',
      });
    }
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token.',
    });
  }
};

// ────────────────────────────────────────────────────
//  CHECK ROLE
// ────────────────────────────────────────────────────
const checkRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Unauthorized.' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. Insufficient permissions.',
      });
    }

    next();
  };
};

// ────────────────────────────────────────────────────
//  IS ADMIN
// ────────────────────────────────────────────────────
const isAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Admin access required.',
    });
  }
  next();
};

// ────────────────────────────────────────────────────
//  IS OFFICIAL
// ────────────────────────────────────────────────────
const isOfficial = (req, res, next) => {
  if (!req.user || req.user.role !== 'official') {
    return res.status(403).json({
      success: false,
      message: 'Official access required.',
    });
  }
  next();
};

// ────────────────────────────────────────────────────
//  IS USER
// ────────────────────────────────────────────────────
const isUser = (req, res, next) => {
  if (!req.user || req.user.role !== 'user') {
    return res.status(403).json({
      success: false,
      message: 'User access required.',
    });
  }
  next();
};

module.exports = {
  verifyToken,
  checkRole,
  isAdmin,
  isOfficial,
  isUser,
};
