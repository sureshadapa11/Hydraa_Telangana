// Run case file migration
const mysql = require('mysql2/promise');
const fs = require('fs');
require('dotenv').config();

async function run() {
  const conn = await mysql.createConnection({
    host:     process.env.DB_HOST     || process.env.MYSQLHOST     || 'localhost',
    port:     process.env.DB_PORT     || process.env.MYSQLPORT     || 3306,
    user:     process.env.DB_USER     || process.env.MYSQLUSER     || 'root',
    password: process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || process.env.MYSQL_ROOT_PASSWORD || '',
    database: process.env.DB_NAME     || process.env.MYSQLDATABASE || process.env.MYSQL_DATABASE || 'railway',
    multipleStatements: true,
  });

  const sql = fs.readFileSync('./migrate-casefile.sql', 'utf8');
  try {
    await conn.query(sql);
    console.log('✅ Case file migration completed successfully.');
  } catch (err) {
    console.error('Migration error:', err.message);
  }
  await conn.end();
}

run();
