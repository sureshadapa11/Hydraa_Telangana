// Drop the unique constraint from site_visit_reports to allow multiple visits per complaint
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
    await conn.query('ALTER TABLE site_visit_reports DROP INDEX one_report_per_complaint');
    console.log('✅ Unique constraint dropped — multiple visits per complaint now allowed.');
  } catch (err) {
    if (err.code === 'ER_CANT_DROP_FIELD_OR_KEY') {
      console.log('ℹ️  Index one_report_per_complaint not found (already dropped or never existed). Nothing to do.');
    } else {
      console.error('Migration error:', err.message);
    }
  }
  await conn.end();
}

run();
