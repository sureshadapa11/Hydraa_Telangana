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
// HTML files: never cache — always fetch fresh so deployments show immediately
app.use(express.static(__dirname, {
  etag: false,
  lastModified: false,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
}));

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
const landRoutes = require('./routes/landRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/land', landRoutes);

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
    // Add district_id column if missing (migration for district feature)
    if (!colNames.includes('district_id')) {
      try {
        await db.query('ALTER TABLE officials ADD COLUMN district_id INT DEFAULT NULL');
        console.log('✅ Officials table: district_id column added');
      } catch (e) {
        console.warn('  Could not add district_id to officials:', e.message);
      }
    }
    // Widen department column to support multiple departments (comma-separated)
    try {
      await db.query("ALTER TABLE officials MODIFY COLUMN department VARCHAR(500) NOT NULL DEFAULT ''");
      console.log('✅ Officials table: department column widened to VARCHAR(500)');
    } catch (e) {
      console.warn('  Could not widen department column:', e.message);
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

    // If old 'name' column exists with no default, give it one so it doesn't block inserts
    if (colNames.includes('name')) {
      try {
        const [colInfo] = await db.query(
          `SELECT COLUMN_TYPE, IS_NULLABLE FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'states' AND COLUMN_NAME = 'name'`
        );
        const colType = colInfo[0] ? colInfo[0].COLUMN_TYPE : 'VARCHAR(100)';
        await db.query(`ALTER TABLE states MODIFY COLUMN name ${colType} DEFAULT ''`);
        console.log('✅ states.name column default fixed');
      } catch (e) { console.warn('  states.name default fix failed:', e.message); }
    }
  } catch (err) {
    console.warn('⚠️  States table check skipped:', err.message);
  }
}

// ── Fix Complaints Table ──
async function fixComplaintsTable() {
  try {
    const db = require('./utils/db');

    // Check if id column has AUTO_INCREMENT — if not, recreate the table
    const [extra] = await db.query(
      `SELECT EXTRA FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'complaints' AND COLUMN_NAME = 'id'`
    );
    const hasAutoInc = extra[0] && extra[0].EXTRA && extra[0].EXTRA.includes('auto_increment');

    if (!hasAutoInc) {
      console.log('⚠️  complaints.id missing AUTO_INCREMENT — fixing...');

      // Drop FK constraints that block MODIFY, then fix id column
      const [fks] = await db.query(
        `SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'complaint_history'
         AND REFERENCED_TABLE_NAME = 'complaints'`
      );
      for (const fk of fks) {
        try {
          await db.query(`ALTER TABLE complaint_history DROP FOREIGN KEY ${fk.CONSTRAINT_NAME}`);
          console.log(`  Dropped FK: ${fk.CONSTRAINT_NAME}`);
        } catch(e) { console.warn('  Drop FK skipped:', e.message); }
      }
      const [fks2] = await db.query(
        `SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'complaint_ratings'
         AND REFERENCED_TABLE_NAME = 'complaints'`
      );
      for (const fk of fks2) {
        try {
          await db.query(`ALTER TABLE complaint_ratings DROP FOREIGN KEY ${fk.CONSTRAINT_NAME}`);
        } catch(e) {}
      }

      try {
        await db.query(`ALTER TABLE complaints MODIFY COLUMN id INT NOT NULL AUTO_INCREMENT`);
        console.log('✅ complaints.id AUTO_INCREMENT fixed');
      } catch(e) {
        console.warn('  MODIFY failed:', e.message, '— will try DROP+CREATE');
        await db.query(`SET FOREIGN_KEY_CHECKS = 0`);

        // Find ALL tables with FKs referencing complaints and drop those FKs/tables
        const [refs] = await db.query(
          `SELECT TABLE_NAME, CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
           WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME = 'complaints'`
        );
        for (const ref of refs) {
          try { await db.query(`ALTER TABLE \`${ref.TABLE_NAME}\` DROP FOREIGN KEY \`${ref.CONSTRAINT_NAME}\``); console.log(`  Dropped FK ${ref.CONSTRAINT_NAME} on ${ref.TABLE_NAME}`); }
          catch(ex) { try { await db.query(`DROP TABLE IF EXISTS \`${ref.TABLE_NAME}\``); console.log(`  Dropped table ${ref.TABLE_NAME}`); } catch(ex2) {} }
        }
        await db.query(`DROP TABLE IF EXISTS complaint_history`);
        await db.query(`DROP TABLE IF EXISTS complaint_ratings`);
        await db.query(`DROP TABLE IF EXISTS ratings`);
        await db.query(`DROP TABLE IF EXISTS complaints`);
        console.log('  Step 4 done: complaints dropped');
      console.log('  Step 5: create complaints');
      await db.query(`
        CREATE TABLE complaints (
          id INT PRIMARY KEY AUTO_INCREMENT,
          complaint_no VARCHAR(50) NOT NULL DEFAULT '',
          user_id INT NOT NULL DEFAULT 0,
          title VARCHAR(200) NOT NULL DEFAULT '',
          description TEXT,
          category_id INT DEFAULT NULL,
          subcategory_id INT DEFAULT NULL,
          priority VARCHAR(20) DEFAULT 'medium',
          state_id INT DEFAULT NULL,
          address TEXT,
          status VARCHAR(30) DEFAULT 'open',
          official_id INT DEFAULT NULL,
          admin_remarks TEXT,
          official_remarks TEXT,
          attachment VARCHAR(255),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          resolved_at TIMESTAMP NULL,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_user (user_id),
          INDEX idx_status (status),
          INDEX idx_official (official_id)
        )
      `);
      console.log('  Step 6: create complaint_history');
      await db.query(`
        CREATE TABLE complaint_history (
          id INT PRIMARY KEY AUTO_INCREMENT,
          complaint_id INT NOT NULL DEFAULT 0,
          old_status VARCHAR(50),
          new_status VARCHAR(50) NOT NULL DEFAULT '',
          changed_by_id INT,
          changed_by_role VARCHAR(20) DEFAULT 'admin',
          remarks TEXT,
          changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_complaint (complaint_id)
        )
      `);
      console.log('  Step 7: create complaint_ratings');
      await db.query(`
        CREATE TABLE complaint_ratings (
          id INT PRIMARY KEY AUTO_INCREMENT,
          complaint_id INT NOT NULL DEFAULT 0,
          user_id INT NOT NULL DEFAULT 0,
          rating INT,
          comment TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY unique_rating (complaint_id, user_id)
        )
      `);
      console.log('  Step 8: re-enable FK checks');
      await db.query(`SET FOREIGN_KEY_CHECKS = 1`);
      console.log('✅ Complaints table recreated');
      }
      return;
    }

    const [cols] = await db.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'complaints'`
    );
    const colNames = cols.map(c => c.COLUMN_NAME);
    const required = [
      { name: 'complaint_no',      def: "VARCHAR(50) DEFAULT ''" },
      { name: 'title',             def: "VARCHAR(200) DEFAULT ''" },
      { name: 'description',       def: 'TEXT' },
      { name: 'address',           def: 'TEXT' },
      { name: 'status',            def: "ENUM('open','assigned','in_progress','resolved','rejected','closed') DEFAULT 'open'" },
      { name: 'official_id',       def: 'INT' },
      { name: 'state_id',          def: 'INT' },
      { name: 'category_id',       def: 'INT' },
      { name: 'subcategory_id',    def: 'INT' },
      { name: 'priority',          def: "ENUM('low','medium','high','urgent') DEFAULT 'medium'" },
      { name: 'admin_remarks',     def: 'TEXT' },
      { name: 'official_remarks',  def: 'TEXT' },
      { name: 'attachment',        def: 'VARCHAR(255)' },
      { name: 'resolved_at',       def: 'TIMESTAMP NULL' },
      { name: 'created_at',        def: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP' },
      { name: 'updated_at',        def: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP' },
      { name: 'land_district',     def: 'VARCHAR(150) DEFAULT NULL' },
      { name: 'land_mandal',       def: 'VARCHAR(150) DEFAULT NULL' },
      { name: 'land_village',      def: 'VARCHAR(150) DEFAULT NULL' },
      { name: 'land_address',      def: 'VARCHAR(255) DEFAULT NULL' },
      { name: 'land_survey_no',    def: 'VARCHAR(100) DEFAULT NULL' },
      { name: 'khata_no',          def: 'VARCHAR(100) DEFAULT NULL' },
      { name: 'is_duplicate',      def: 'TINYINT DEFAULT 0' },
      { name: 'duplicate_of',      def: 'INT DEFAULT NULL' },
    ];
    const missing = required.filter(c => !colNames.includes(c.name));
    if (missing.length > 0) {
      for (const col of missing) {
        try { await db.query(`ALTER TABLE complaints ADD COLUMN ${col.name} ${col.def}`); }
        catch (e) { console.warn(`  Could not add column ${col.name}:`, e.message); }
      }
    }
    // Fix ENUM columns
    try { await db.query(`ALTER TABLE complaints MODIFY COLUMN status ENUM('open','assigned','in_progress','resolved','rejected','closed') DEFAULT 'open'`); } catch(e){}
    try { await db.query(`ALTER TABLE complaints MODIFY COLUMN priority ENUM('low','medium','high','urgent') DEFAULT 'medium'`); } catch(e){}
    console.log('✅ Complaints table OK');

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
      { name: 'last_login',          def: 'TIMESTAMP NULL' },
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
        const [colInfo] = await db.query(
          `SELECT COLUMN_TYPE FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'name'`
        );
        const colType = colInfo[0] ? colInfo[0].COLUMN_TYPE : 'VARCHAR(100)';
        await db.query(`ALTER TABLE users MODIFY COLUMN name ${colType} DEFAULT ''`);
        console.log('✅ users.name column default fixed');
      } catch (e) { console.warn('  users.name default fix failed:', e.message); }
    }
  } catch (err) {
    console.warn('⚠️  Users table check skipped:', err.message);
  }
}

// ── Seed States ──
async function seedStates() {
  try {
    const db = require('./utils/db');

    // Check which columns exist so we build INSERT/UPDATE dynamically
    const [colRows] = await db.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'states'`
    );
    const colNames = colRows.map(c => c.COLUMN_NAME);
    const hasName      = colNames.includes('name');
    const hasStateName = colNames.includes('state_name');

    // If legacy 'name' column exists with no default, fix it now
    if (hasName) {
      try {
        const [ci] = await db.query(
          `SELECT COLUMN_TYPE FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'states' AND COLUMN_NAME = 'name'`
        );
        const colType = ci[0] ? ci[0].COLUMN_TYPE : 'VARCHAR(100)';
        await db.query(`ALTER TABLE states MODIFY COLUMN name ${colType} DEFAULT ''`);
        console.log('✅ states.name column default fixed');
      } catch (e) { /* already OK */ }
    }

    if (!hasStateName) {
      console.warn('⚠️  states.state_name column missing — skipping seed');
      return;
    }

    const stateList = [
      { state_name: 'Telangana',      code: 'TG' },
      { state_name: 'Andhra Pradesh', code: 'AP' },
      { state_name: 'Maharashtra',    code: 'MH' },
      { state_name: 'Karnataka',      code: 'KA' },
      { state_name: 'Tamil Nadu',     code: 'TN' },
    ];

    for (const s of stateList) {
      const [[exists]] = await db.query(
        `SELECT id FROM states WHERE state_name = ?`, [s.state_name]
      );
      if (exists) continue; // already seeded

      // Build INSERT dynamically — only include 'name' if the column exists
      if (hasName) {
        await db.query(
          `INSERT INTO states (state_name, code, name) VALUES (?, ?, ?)`,
          [s.state_name, s.code, s.state_name]
        );
      } else {
        await db.query(
          `INSERT INTO states (state_name, code) VALUES (?, ?)`,
          [s.state_name, s.code]
        );
      }
    }
    console.log('✅ States seeded');
  } catch (err) {
    console.warn('⚠️  State seed skipped:', err.message);
  }
}

// ── Ensure Districts & Mandals Tables ──
async function ensureDistrictsTables() {
  try {
    const db = require('./utils/db');
    await db.query(`
      CREATE TABLE IF NOT EXISTS districts (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(100) NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS mandals (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(100) NOT NULL,
        district_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (district_id) REFERENCES districts(id) ON DELETE CASCADE,
        UNIQUE KEY unique_mandal (district_id, name)
      )
    `);
    // Add district_id / mandal_id to complaints if missing
    const [cols] = await db.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'complaints'`
    );
    const colNames = cols.map(c => c.COLUMN_NAME);
    if (!colNames.includes('district_id'))
      try { await db.query('ALTER TABLE complaints ADD COLUMN district_id INT DEFAULT NULL'); } catch(e){}
    if (!colNames.includes('mandal_id'))
      try { await db.query('ALTER TABLE complaints ADD COLUMN mandal_id INT DEFAULT NULL'); } catch(e){}
    console.log('✅ Districts & Mandals tables OK');
  } catch (err) {
    console.warn('⚠️  Districts/Mandals setup skipped:', err.message);
  }
}

// ── Ensure Complaint Photos Table ──
async function ensurePhotosTable() {
  try {
    const db = require('./utils/db');
    await db.query(`
      CREATE TABLE IF NOT EXISTS complaint_photos (
        id INT PRIMARY KEY AUTO_INCREMENT,
        complaint_id INT NOT NULL,
        photo_data MEDIUMTEXT NOT NULL,
        caption VARCHAR(200),
        uploaded_by_id INT,
        uploaded_by_role VARCHAR(20) DEFAULT 'official',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_complaint (complaint_id)
      )
    `);
    console.log('✅ complaint_photos table OK');
  } catch (err) {
    console.warn('⚠️  complaint_photos table skipped:', err.message);
  }
}

// ── Ensure Announcements Table ──
async function ensureAnnouncementsTable() {
  try {
    const db = require('./utils/db');
    await db.query(`
      CREATE TABLE IF NOT EXISTS announcements (
        id INT PRIMARY KEY AUTO_INCREMENT,
        title VARCHAR(200) NOT NULL,
        message TEXT NOT NULL,
        is_active TINYINT DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ announcements table OK');
  } catch (err) {
    console.warn('⚠️  announcements table skipped:', err.message);
  }
}

// ── Ensure Deleted Users Audit Table ──
async function ensureDeletedUsersTable() {
  try {
    const db = require('./utils/db');
    await db.query(`
      CREATE TABLE IF NOT EXISTS deleted_users (
        id INT PRIMARY KEY AUTO_INCREMENT,
        original_user_id INT NOT NULL,
        full_name VARCHAR(150) NOT NULL DEFAULT '',
        email VARCHAR(255) NOT NULL DEFAULT '',
        phone VARCHAR(20) DEFAULT NULL,
        complaints_count INT DEFAULT 0,
        complaints_data MEDIUMTEXT DEFAULT NULL,
        deleted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_by VARCHAR(100) DEFAULT 'admin',
        INDEX idx_deleted_at (deleted_at)
      )
    `);
    // Add complaints_data column to existing tables that were created before this column existed
    const [duCols] = await db.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'deleted_users'`
    );
    const duColNames = duCols.map(c => c.COLUMN_NAME);
    if (!duColNames.includes('complaints_data')) {
      await db.query(`ALTER TABLE deleted_users ADD COLUMN complaints_data MEDIUMTEXT DEFAULT NULL`);
      console.log('✅ deleted_users.complaints_data column added');
    }
    console.log('✅ deleted_users table OK');
  } catch (err) {
    console.warn('⚠️  deleted_users table skipped:', err.message);
  }
}

// ── Ensure Complaint Comments Table ──
async function ensureCommentTable() {
  try {
    const db = require('./utils/db');
    await db.query(`
      CREATE TABLE IF NOT EXISTS complaint_comments (
        id INT PRIMARY KEY AUTO_INCREMENT,
        complaint_id INT NOT NULL,
        author_id INT NOT NULL,
        author_role VARCHAR(20) NOT NULL DEFAULT 'user',
        author_name VARCHAR(100) NOT NULL DEFAULT '',
        message TEXT NOT NULL,
        is_internal TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_complaint (complaint_id),
        INDEX idx_created (created_at)
      )
    `);
    // Fix existing tables that used the old ENUM which excluded 'user'
    await db.query(`
      ALTER TABLE complaint_comments
        MODIFY COLUMN author_role VARCHAR(20) NOT NULL DEFAULT 'user'
    `).catch(() => {}); // ignore if already correct
    console.log('✅ complaint_comments table OK');
  } catch (err) {
    console.warn('⚠️  complaint_comments table skipped:', err.message);
  }
}

// ── Seed Correct Categories ──
async function seedCategories() {
  try {
    const db = require('./utils/db');

    // Deduplicate: keep lowest id per name, delete the rest
    const [dupes] = await db.query(
      `SELECT name, MIN(id) AS keep_id FROM categories GROUP BY name HAVING COUNT(*) > 1`
    );
    for (const d of dupes) {
      await db.query(`DELETE FROM categories WHERE name = ? AND id != ?`, [d.name, d.keep_id]);
      await db.query(`UPDATE subcategories SET category_id = ? WHERE category_id IN (SELECT id FROM (SELECT id FROM categories WHERE name = ? AND id != ?) t)`, [d.keep_id, d.name, d.keep_id]);
    }

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
  await seedStates();
  await ensureDistrictsTables();
  await seedCategories();
  await seedDefaultAdmin();
  await ensureCommentTable();
  await ensurePhotosTable();
  await ensureDeletedUsersTable();
  await ensureAnnouncementsTable();
});

module.exports = app;
