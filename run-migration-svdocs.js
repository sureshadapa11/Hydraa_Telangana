// Add site_visit_id column to complaint_documents to link docs to specific visits
const mysql = require('mysql2/promise');
require('dotenv').config();

async function run() {
  const conn = await mysql.createConnection({
    host:     process.env.DB_HOST     || process.env.MYSQLHOST     || 'localhost',
    port:     process.env.DB_PORT     || process.env.MYSQLPORT     || 3306,
    user:     process.env.DB_USER     || process.env.MYSQLUSER     || 'root',
    password: process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || process.env.MYSQL_ROOT_PASSWORD || '',
    database: process.env.DB_NAME     || process.env.MYSQLDATABASE || process.env.MYSQL_DATABASE || 'railway',
  });

  try {
    await conn.query('ALTER TABLE complaint_documents ADD COLUMN site_visit_id INT NULL AFTER complaint_id');
    console.log('✅ site_visit_id column added to complaint_documents.');
  } catch (err) {
    if (err.code === 'ER_DUP_FIELDNAME') {
      console.log('ℹ️  site_visit_id column already exists. Nothing to do.');
    } else {
      console.error('Migration error:', err.message);
    }
  }

  try {
    await conn.query('ALTER TABLE complaint_documents ADD INDEX idx_svdocs (site_visit_id)');
    console.log('✅ Index idx_svdocs added.');
  } catch (err) {
    if (err.code === 'ER_DUP_KEYNAME') {
      console.log('ℹ️  Index idx_svdocs already exists.');
    } else {
      console.error('Index error:', err.message);
    }
  }

  await conn.end();
}

run();
