// =====================================================
//   HYDRAA — Updated authController.js
//   Drop-in replacement for backend/controllers/authController.js
//   Changes: adds email on register, change-password, forgot-password
// =====================================================

const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db     = require('../utils/db');
const {
  sendWelcomeEmail,
  sendPasswordChangedEmail,
  sendForgotPasswordOTP,
  sendSafe,
} = require('../utils/emailService');
require('dotenv').config();

const generateToken = (id, role) =>
  jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

// In-memory OTP store  { email: { otp, expiresAt, name, role } }
// For production use Redis or a DB table instead
const otpStore = {};

// ────────────────────────────────────────────────────
//  USER: Register
// ────────────────────────────────────────────────────
const registerUser = async (req, res) => {
  const { full_name, email, phone, address, password } = req.body;

  if (!full_name || !email || !password)
    return res.status(400).json({ success: false, message: 'Full name, email and password are required.' });

  try {
    const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0)
      return res.status(409).json({ success: false, message: 'Email already registered.' });

    const hashedPassword = await bcrypt.hash(password, 10);

    await db.query(
      'INSERT INTO users (name, full_name, email, phone, address, password, is_verified) VALUES (?, ?, ?, ?, ?, ?, 1)',
      [full_name, full_name, email, phone || null, address || null, hashedPassword]
    );

    // Send welcome email (non-blocking)
    sendSafe(sendWelcomeEmail, { to: email, name: full_name, verificationUrl: null });

    res.status(201).json({
      success: true,
      message: 'Registration successful! You can now login.',
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ success: false, message: err.message || 'Server error during registration.' });
  }
};

// ────────────────────────────────────────────────────
//  USER: Login
// ────────────────────────────────────────────────────
const loginUser = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ success: false, message: 'Email and password are required.' });

  try {
    const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (users.length === 0)
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });

    const user    = users[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });

    await db.query('INSERT INTO user_logs (user_id, action, ip_address) VALUES (?, ?, ?)',
      [user.id, 'LOGIN', req.ip]);

    const token = generateToken(user.id, 'user');
    res.json({
      success: true,
      message: 'Login successful.',
      token,
      user: { id: user.id, full_name: user.full_name, email: user.email, role: 'user' },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Server error during login.' });
  }
};

// ────────────────────────────────────────────────────
//  USER: Verify Email
// ────────────────────────────────────────────────────
const verifyEmail = async (req, res) => {
  const { token } = req.params;
  try {
    const [result] = await db.query(
      'UPDATE users SET is_verified = 1, verification_token = NULL WHERE verification_token = ?', [token]
    );
    if (result.affectedRows === 0)
      return res.status(400).json({ success: false, message: 'Invalid or expired verification link.' });

    res.json({ success: true, message: 'Email verified successfully! You can now login.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ────────────────────────────────────────────────────
//  ADMIN: Login
// ────────────────────────────────────────────────────
const loginAdmin = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ success: false, message: 'Email and password are required.' });

  try {
    const [admins] = await db.query('SELECT * FROM admins WHERE email = ?', [email]);
    if (admins.length === 0)
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });

    const admin   = admins[0];
    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch)
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });

    const token = generateToken(admin.id, 'admin');
    res.json({
      success: true,
      message: 'Admin login successful.',
      token,
      user: { id: admin.id, username: admin.username, email: admin.email, role: 'admin' },
    });
  } catch (err) {
    console.error('Admin login error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ────────────────────────────────────────────────────
//  OFFICIAL: Login
// ────────────────────────────────────────────────────
const loginOfficial = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ success: false, message: 'Email and password are required.' });

  try {
    const [officials] = await db.query(
      `SELECT o.*, d.name AS district_name
       FROM officials o
       LEFT JOIN districts d ON d.id = o.district_id
       WHERE o.email = ? AND o.is_active = 1`,
      [email]
    );
    if (officials.length === 0)
      return res.status(401).json({ success: false, message: 'Invalid credentials or account inactive.' });

    const official = officials[0];
    const isMatch  = await bcrypt.compare(password, official.password);
    if (!isMatch)
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });

    const token = generateToken(official.id, 'official');
    res.json({
      success: true,
      message: 'Login successful.',
      token,
      user: {
        id: official.id,
        full_name: official.full_name,
        email: official.email,
        department: official.department,
        role: 'official',
        district_id: official.district_id || null,
        district_name: official.district_name || null,
      },
    });
  } catch (err) {
    console.error('Official login error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ────────────────────────────────────────────────────
//  ALL ROLES: Change Password
// ────────────────────────────────────────────────────
const changePassword = async (req, res) => {
  const { current_password, new_password } = req.body;
  const { id, role } = req.user;

  if (!current_password || !new_password)
    return res.status(400).json({ success: false, message: 'Both current and new passwords are required.' });

  try {
    const table = role === 'admin' ? 'admins' : role === 'official' ? 'officials' : 'users';
    const [rows] = await db.query(`SELECT password, email, full_name FROM ${table} WHERE id = ?`, [id]);
    if (rows.length === 0)
      return res.status(404).json({ success: false, message: 'User not found.' });

    const isMatch = await bcrypt.compare(current_password, rows[0].password);
    if (!isMatch)
      return res.status(400).json({ success: false, message: 'Current password is incorrect.' });

    const hashed = await bcrypt.hash(new_password, 10);
    await db.query(`UPDATE ${table} SET password = ? WHERE id = ?`, [hashed, id]);

    // Send password changed notification (non-blocking)
    sendSafe(sendPasswordChangedEmail, {
      to:   rows[0].email,
      name: rows[0].full_name || rows[0].username || 'User',
      role,
    });

    res.json({ success: true, message: 'Password changed successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ────────────────────────────────────────────────────
//  FORGOT PASSWORD — Step 1: Request OTP
// ────────────────────────────────────────────────────
const forgotPasswordRequest = async (req, res) => {
  const { email, role = 'user' } = req.body;
  if (!email)
    return res.status(400).json({ success: false, message: 'Email is required.' });

  try {
    const table = role === 'admin' ? 'admins' : role === 'official' ? 'officials' : 'users';
    const nameCol = role === 'admin' ? 'username' : 'full_name';
    const [rows] = await db.query(`SELECT id, email, ${nameCol} AS name FROM ${table} WHERE email = ?`, [email]);

    // Always return success to prevent email enumeration
    if (rows.length === 0)
      return res.json({ success: true, message: 'If this email exists, an OTP has been sent.' });

    const user = rows[0];
    const otp  = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP

    // Store OTP (10 min expiry)
    otpStore[email] = { otp, role, name: user.name, expiresAt: Date.now() + 10 * 60 * 1000 };

    sendSafe(sendForgotPasswordOTP, { to: email, name: user.name, otp, role });

    res.json({ success: true, message: 'OTP sent to your email address. Valid for 10 minutes.' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ────────────────────────────────────────────────────
//  FORGOT PASSWORD — Step 2: Verify OTP + Reset
// ────────────────────────────────────────────────────
const forgotPasswordReset = async (req, res) => {
  const { email, otp, new_password, role = 'user' } = req.body;
  if (!email || !otp || !new_password)
    return res.status(400).json({ success: false, message: 'Email, OTP and new password are required.' });

  const stored = otpStore[email];
  if (!stored)
    return res.status(400).json({ success: false, message: 'No OTP found for this email. Please request again.' });
  if (Date.now() > stored.expiresAt)
    return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new one.' });
  if (stored.otp !== otp)
    return res.status(400).json({ success: false, message: 'Invalid OTP. Please check and try again.' });

  try {
    const table  = stored.role === 'admin' ? 'admins' : stored.role === 'official' ? 'officials' : 'users';
    const hashed = await bcrypt.hash(new_password, 10);
    await db.query(`UPDATE ${table} SET password = ? WHERE email = ?`, [hashed, email]);

    // Clear OTP
    delete otpStore[email];

    // Notify user
    sendSafe(sendPasswordChangedEmail, { to: email, name: stored.name, role: stored.role });

    res.json({ success: true, message: 'Password reset successfully. You can now login with your new password.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ────────────────────────────────────────────────────
//  SESSION VERIFY — used by frontend polling to detect deleted/deactivated accounts
// ────────────────────────────────────────────────────
const verifySession = async (req, res) => {
  const { id, role } = req.user;
  try {
    let rows;
    if (role === 'user') {
      [rows] = await db.query('SELECT id FROM users WHERE id = ?', [id]);
    } else if (role === 'official') {
      [rows] = await db.query('SELECT id FROM officials WHERE id = ? AND is_active = 1', [id]);
    } else if (role === 'admin') {
      [rows] = await db.query('SELECT id FROM admins WHERE id = ?', [id]);
    } else {
      return res.json({ success: true });
    }
    if (!rows || rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Account no longer exists.' });
    }
    res.json({ success: true });
  } catch (err) {
    // On DB error don't kick out — just say OK and let the next poll retry
    res.json({ success: true });
  }
};

module.exports = {
  registerUser,
  loginUser,
  verifyEmail,
  loginAdmin,
  loginOfficial,
  changePassword,
  forgotPasswordRequest,
  forgotPasswordReset,
  verifySession,
};
