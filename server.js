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

    // Check if admins table has all required columns
    const [cols] = await db.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'admins'`
    );
    const colNames = cols.map(c => c.COLUMN_NAME);
    const required = ['id', 'username', 'email', 'password', 'full_name', 'is_active'];
    const missing  = required.filter(c => !colNames.includes(c));

    if (missing.length > 0) {
      console.log('⚠️  Admins table missing columns:', missing.join(', '), '— recreating...');
      await db.query('DROP TABLE IF EXISTS admins');
      await db.query(`
        CREATE TABLE admins (
          id INT PRIMARY KEY AUTO_INCREMENT,
          username VARCHAR(100) UNIQUE NOT NULL,
          email VARCHAR(100) UNIQUE NOT NULL,
          password VARCHAR(255) NOT NULL,
          full_name VARCHAR(100),
          is_active BOOLEAN DEFAULT 1,
          last_login TIMESTAMP NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('✅ Admins table recreated');
    }

    const email    = process.env.ADMIN_EMAIL     || 'admin@hydraa.telangana';
    const password = process.env.ADMIN_PASSWORD  || 'Hydraatelangana@9511';
    const username = process.env.ADMIN_USERNAME  || 'Admin';
    const fullName = process.env.ADMIN_FULL_NAME || 'HYDRAA Administrator';

    const [rows] = await db.query('SELECT id FROM admins WHERE email = ?', [email]);
    if (rows.length > 0) {
      console.log('✅ Admin already exists:', email);
      return;
    }

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

// ── Fix Officials Table (recreate if missing required columns) ──
async function fixOfficialsTable() {
  try {
    const db = require('./utils/db');
    const [cols] = await db.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'officials'`
    );
    const colNames = cols.map(c => c.COLUMN_NAME);
    const required = ['id', 'full_name', 'email', 'phone', 'department', 'password', 'is_active'];
    const missing  = required.filter(c => !colNames.includes(c));

    if (missing.length > 0) {
      console.log('⚠️  Officials table missing columns:', missing.join(', '), '— fixing with ALTER TABLE...');
      for (const col of missing) {
        try {
          let def = '';
          if (col === 'email')      def = 'VARCHAR(100) UNIQUE NOT NULL DEFAULT ""';
          if (col === 'phone')      def = 'VARCHAR(15)';
          if (col === 'department') def = 'VARCHAR(100) NOT NULL DEFAULT ""';
          if (col === 'password')   def = 'VARCHAR(255) NOT NULL DEFAULT ""';
          if (col === 'is_active')  def = 'BOOLEAN DEFAULT 1';
          if (col === 'last_login') def = 'TIMESTAMP NULL';
          if (col === 'full_name')  def = 'VARCHAR(100) NOT NULL DEFAULT ""';
          if (def) await db.query(`ALTER TABLE officials ADD COLUMN ${col} ${def}`);
        } catch (e) {
          console.warn(`  Could not add column ${col}:`, e.message);
        }
      }
      console.log('✅ Officials table altered');
    } else {
      console.log('✅ Officials table OK');
    }
  } catch (err) {
    console.warn('⚠️  Officials table check skipped:', err.message);
  }
}

// ── Fix User Logs Table ──
async function fixUserLogsTable() {
  try {
    const db = require('./utils/db');
    const [tables] = await db.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_logs'`
    );
    if (tables.length === 0) {
      console.log('⚠️  user_logs table missing — creating...');
      await db.query(`
        CREATE TABLE user_logs (
          id INT PRIMARY KEY AUTO_INCREMENT,
          user_id INT NOT NULL,
          action VARCHAR(100),
          ip_address VARCHAR(50),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_user (user_id),
          INDEX idx_created (created_at)
        )
      `);
      console.log('✅ user_logs table created');
    } else {
      console.log('✅ user_logs table OK');
    }
  } catch (err) {
    console.warn('⚠️  user_logs table check skipped:', err.message);
  }
}

// ── Fix States Table ──
async function fixStatesTable() {
  try {
    const db = require('./utils/db');
    const [cols] = await db.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'states'`
    );
    const colNames = cols.map(c => c.COLUMN_NAME);
    const required = [
      { name: 'state_name', def: "VARCHAR(100) NOT NULL DEFAULT ''" },
      { name: 'code',       def: 'VARCHAR(10)' },
    ];
    const missing = required.filter(c => !colNames.includes(c.name));
    if (missing.length > 0) {
      console.log('⚠️  States table missing columns:', missing.map(c => c.name).join(', '), '— fixing...');
      for (const col of missing) {
        try { await db.query(`ALTER TABLE states ADD COLUMN ${col.name} ${col.def}`); }
        catch (e) { console.warn(`  Could not add column ${col.name}:`, e.message); }
      }
      console.log('✅ States table altered');
    } else {
      console.log('✅ States table OK');
    }
  } catch (err) {
    console.warn('⚠️  States table check skipped:', err.message);
  }
}

// ── Fix Complaints Table ──
async function fixComplaintsTable() {
  try {
    const db = require('./utils/db');
    const [cols] = await db.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'complaints'`
    );
    const colNames = cols.map(c => c.COLUMN_NAME);
    const required = [
      { name: 'official_id',       def: 'INT' },
      { name: 'state_id',          def: 'INT' },
      { name: 'category_id',       def: 'INT' },
      { name: 'subcategory_id',    def: 'INT' },
      { name: 'priority',          def: "ENUM('low','medium','high','urgent') DEFAULT 'medium'" },
      { name: 'admin_remarks',     def: 'TEXT' },
      { name: 'official_remarks',  def: 'TEXT' },
      { name: 'attachment',        def: 'VARCHAR(255)' },
      { name: 'resolved_at',       def: 'TIMESTAMP NULL' },
    ];
    const missing = required.filter(c => !colNames.includes(c.name));
    if (missing.length > 0) {
      console.log('⚠️  Complaints table missing columns:', missing.map(c => c.name).join(', '), '— fixing...');
      for (const col of missing) {
        try { await db.query(`ALTER TABLE complaints ADD COLUMN ${col.name} ${col.def}`); }
        catch (e) { console.warn(`  Could not add column ${col.name}:`, e.message); }
      }
      console.log('✅ Complaints table altered');
    } else {
      console.log('✅ Complaints table OK');
    }
  } catch (err) {
    console.warn('⚠️  Complaints table check skipped:', err.message);
  }
}

// ── Fix Users Table (add missing columns) ──
async function fixUsersTable() {
  try {
    const db = require('./utils/db');
    const [cols] = await db.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'`
    );
    const colNames = cols.map(c => c.COLUMN_NAME);
    const required = [
      { name: 'full_name',           def: "VARCHAR(100) NOT NULL DEFAULT ''" },
      { name: 'email',               def: "VARCHAR(100) UNIQUE NOT NULL DEFAULT ''" },
      { name: 'phone',               def: 'VARCHAR(15)' },
      { name: 'address',             def: 'VARCHAR(255)' },
      { name: 'password',            def: "VARCHAR(255) NOT NULL DEFAULT ''" },
      { name: 'is_verified',         def: 'BOOLEAN DEFAULT 0' },
      { name: 'verification_token',  def: 'VARCHAR(255)' },
      { name: 'created_at',          def: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP' },
    ];
    const missing = required.filter(c => !colNames.includes(c.name));
    if (missing.length > 0) {
      console.log('⚠️  Users table missing columns:', missing.map(c => c.name).join(', '), '— fixing...');
      for (const col of missing) {
        try {
          await db.query(`ALTER TABLE users ADD COLUMN ${col.name} ${col.def}`);
        } catch (e) {
          console.warn(`  Could not add column ${col.name}:`, e.message);
        }
      }
      console.log('✅ Users table altered');
    } else {
      console.log('✅ Users table OK');
    }

    // If old 'name' column exists with no default, give it one so it doesn't block inserts
    if (colNames.includes('name')) {
      try {
        await db.query(`ALTER TABLE users ALTER COLUMN name SET DEFAULT ''`);
        console.log('✅ users.name column default fixed');
      } catch (e) { /* already has default */ }
    }
  } catch (err) {
    console.warn('⚠️  Users table check skipped:', err.message);
  }
}

// ── Seed Correct Categories ──
async function seedCategories() {
  try {
    const db = require('./utils/db');

    const correctCategories = [
      { name: 'Lake / Water Body Encroachment', description: 'Illegal construction within FTL or 30m buffer zones around lakes and nalas' },
      { name: 'Illegal Construction',           description: 'Unauthorized buildings violating GHMC or town planning regulations' },
      { name: 'Park / Open Space Violation',    description: 'Encroachment on designated parks, playgrounds, or open layout spaces' },
      { name: 'Road / Footpath Obstruction',    description: 'Blocking of carriageways, footpaths, or public roads by unauthorized structures' },
      { name: 'Flooding & Drainage Issue',      description: 'Blocked drains, waterlogging, or flood-risk due to encroachment' },
      { name: 'Government Land Encroachment',   description: 'Unauthorized occupation of government-owned land parcels in Hyderabad' },
      { name: 'Illegal Advertisements',         description: 'Unauthorized hoardings, banners, or flex boards on public property' },
      { name: 'Disaster / Emergency',           description: 'Fire, collapse, or flood emergency requiring immediate HYDRAA response' },
    ];

    const oldNames = ['Water Supply','Drainage','Roads','Electricity','Sanitation','Other'];

    // Remove old wrong categories that have no complaints attached
    for (const old of oldNames) {
      const [[row]] = await db.query(
        `SELECT COUNT(c.id) AS cnt FROM categories cat
         LEFT JOIN complaints c ON c.category_id = cat.id
         WHERE cat.name = ?`, [old]
      );
      if (row.cnt === 0) {
        await db.query('DELETE FROM categories WHERE name = ?', [old]);
      }
    }

    // Insert correct categories if not already present
    for (const cat of correctCategories) {
      const [[exists]] = await db.query('SELECT id FROM categories WHERE name = ?', [cat.name]);
      if (!exists) {
        await db.query('INSERT INTO categories (name, description) VALUES (?, ?)', [cat.name, cat.description]);
      }
    }

    // Seed subcategories for each category
    const subcategoryMap = {
      'Lake / Water Body Encroachment': [
        'FTL Zone Encroachment', 'Nala / Drain Encroachment', 'Buffer Zone Violation', 'Lake Bund Damage', 'Illegal Filling of Water Body',
      ],
      'Illegal Construction': [
        'Residential Illegal Building', 'Commercial Illegal Building', 'Building Without Permission', 'Violation of Setback Rules', 'Excess Floor Area',
      ],
      'Park / Open Space Violation': [
        'Park Land Encroachment', 'Playground Encroachment', 'Open Layout Space Misuse', 'Unauthorized Structure in Park', 'Dumping in Open Space',
      ],
      'Road / Footpath Obstruction': [
        'Footpath Encroachment', 'Road Blocked by Structure', 'Unauthorized Parking Area', 'Construction Material on Road', 'Vendor Encroachment on Road',
      ],
      'Flooding & Drainage Issue': [
        'Blocked Storm Drain', 'Waterlogging', 'Sewage Overflow', 'Drain Encroachment Causing Flood', 'Nala Blockage',
      ],
      'Government Land Encroachment': [
        'Poramboke Land Occupied', 'Revenue Land Encroachment', 'GHMC Land Misuse', 'Unauthorized Fence / Wall', 'Long-term Unauthorized Occupation',
      ],
      'Illegal Advertisements': [
        'Unauthorized Hoarding', 'Illegal Flex / Banner', 'Wall Painting Without Permission', 'Digital Sign Without NOC', 'Temporary Structure for Advertisement',
      ],
      'Disaster / Emergency': [
        'Building Collapse', 'Fire Incident', 'Flood Emergency', 'Tree Fall', 'Structural Instability',
      ],
    };

    for (const [catName, subs] of Object.entries(subcategoryMap)) {
      const [[cat]] = await db.query('SELECT id FROM categories WHERE name = ?', [catName]);
      if (!cat) continue;
      for (const subName of subs) {
        const [[exists]] = await db.query('SELECT id FROM subcategories WHERE name = ? AND category_id = ?', [subName, cat.id]);
        if (!exists) {
          await db.query('INSERT INTO subcategories (name, category_id) VALUES (?, ?)', [subName, cat.id]);
        }
      }
    }

    console.log('✅ Categories and subcategories seeded correctly');
  } catch (err) {
    console.warn('⚠️  Category seed skipped:', err.message);
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
  await fixUserLogsTable();
  await fixStatesTable();
  await fixComplaintsTable();
  await fixUsersTable();
  await fixOfficialsTable();
  await seedCategories();
  await seedDefaultAdmin();
});

module.exports = app;
