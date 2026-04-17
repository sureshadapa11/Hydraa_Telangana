// =====================================================
//   Auth Middleware — HYDRAA
//   JWT verification and role checking
// =====================================================

const jwt = require('jsonwebtoken');
const db  = require('../utils/db');
require('dotenv').config();

// ────────────────────────────────────────────────────
//  VERIFY TOKEN
// ────────────────────────────────────────────────────
const verifyToken = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'No token provided. Please login.',
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;

    // Verify account still exists in DB (catches deleted/deactivated accounts mid-session)
    const { id, role } = decoded;
    let rows;
    if (role === 'user') {
      [rows] = await db.query('SELECT id FROM users WHERE id = ?', [id]);
    } else if (role === 'official') {
      [rows] = await db.query('SELECT id FROM officials WHERE id = ? AND is_active = 1', [id]);
    } else if (role === 'admin') {
      [rows] = await db.query('SELECT id FROM admins WHERE id = ?', [id]);
    } else {
      rows = [{}]; // unknown role — let other middleware handle
    }

    if (!rows || rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Account no longer exists. Please login again.',
      });
    }

    next();
  } catch (err) {
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
