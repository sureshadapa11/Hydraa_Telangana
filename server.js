// =====================================================
//   Main Server — HYDRAA
//   Backend API server with Express
// =====================================================
const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// ── Middleware ──
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ── Serve static files (HTML, CSS, JS, images) ──
app.use(express.static(__dirname));

// ── Root Route — serve your main HTML page ──
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'hydraa-index.html'));
});

// Optional: redirect old URL to root
app.get('/hydraa-index.html', (req, res) => {
  res.redirect('/');
});

// ── API Routes ──
const authRoutes = require('./routes/authRoutes');
const complaintRoutes = require('./routes/complaintRoutes');
const adminRoutes = require('./routes/adminRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/admin', adminRoutes);

// ── Health Check ──
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'HYDRAA API is running',
    timestamp: new Date().toISOString(),
  });
});

// ── 404 Handler ──
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found.',
  });
});

// ── Error Handler ──
app.use((err, req, res, next) => {
  console.error('Server error:', err);

  res.status(500).json({
    success: false,
    message: 'Internal server error.',
    error:
      process.env.NODE_ENV === 'development'
        ? err.message
        : undefined,
  });
});

// ── Run Schema (creates tables if they don't exist) ──
async function runSchema() {
  try {
    const fs   = require('fs');
    const path = require('path');
    const db   = require('./utils/db');

    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    const statements = schema
      .split('\n')
      .filter(line => !line.trim().startsWith('--') && !line.trim().startsWith('USE ') && !line.trim().startsWith('CREATE DATABASE'))
      .join('\n')
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const stmt of statements) {
      try { await db.query(stmt); } catch (e) { /* ignore already-exists errors */ }
    }
    console.log('✅ Schema applied successfully');
  } catch (err) {
    console.warn('⚠️  Schema apply skipped:', err.message);
  }
}

// ── Seed Default Admin (runs once on startup if no admin exists) ──
async function seedDefaultAdmin() {
  try {
    const bcrypt = require('bcryptjs');
    const db     = require('./utils/db');

    // Ensure username column exists (in case table was created without it)
    await db.query('ALTER TABLE admins ADD COLUMN IF NOT EXISTS username VARCHAR(100)').catch(() => {});

    const [rows] = await db.query('SELECT id FROM admins LIMIT 1');
    if (rows.length > 0) return; // admin already exists

    const email    = process.env.ADMIN_EMAIL     || 'admin@hydraa.telangana';
    const password = process.env.ADMIN_PASSWORD  || 'Hydraatelangana@9511';
    const username = process.env.ADMIN_USERNAME  || 'Admin';
    const fullName = process.env.ADMIN_FULL_NAME || 'HYDRAA Administrator';

    const hashed = await bcrypt.hash(password, 12);
    await db.query(
      'INSERT INTO admins (username, email, password, full_name, is_active) VALUES (?, ?, ?, ?, 1)',
      [username, email, hashed, fullName]
    );
    console.log('✅ Default admin seeded:', email);
  } catch (err) {
    console.warn('⚠️  Admin seed skipped:', err.message);
  }
}

// ── Start Server ──
const PORT = process.env.PORT || 5000;

app.listen(PORT, async () => {
  console.log(`
╔════════════════════════════════════════╗
║   HYDRAA API Server Started            ║
║   Port: ${PORT}                          ║
║   Environment: ${process.env.NODE_ENV || 'development'} ║
║   Status: ✅ Running                    ║
╚════════════════════════════════════════╝
  `);
  await runSchema();
  await seedDefaultAdmin();
});

module.exports = app;
