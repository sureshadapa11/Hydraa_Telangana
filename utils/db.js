// =====================================================
//   Database Configuration — HYDRAA
// =====================================================

const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'hydraa',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Test connection (non-blocking - server runs even if DB unavailable)
pool.getConnection()
  .then((conn) => {
    console.log('✅ Database connected successfully');
    conn.release();
  })
  .catch((err) => {
    console.warn('⚠️  Database connection warning:', err.message);
    console.warn('   (Server will run, but API routes will fail until MySQL is available)');
  });

module.exports = pool;
