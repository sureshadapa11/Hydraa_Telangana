// =====================================================
//   Database Initialization Script — HYDRAA
//   Creates database and imports schema
// =====================================================

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const exec = require('child_process').exec;
require('dotenv').config();

async function initializeDatabase() {
  try {
    // Create connection WITHOUT database to create it first
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
    });

    console.log('✅ Connected to MySQL Server');

    // Create database
    const dbName = process.env.DB_NAME || 'hydraa';
    await connection.query(`CREATE DATABASE IF NOT EXISTS ${dbName}`);
    console.log(`✅ Database '${dbName}' ready`);

    // Switch to database
    await connection.query(`USE ${dbName}`);

    // Read schema file
    const schemaPath = path.join(__dirname, 'schema.sql');
    let schema = fs.readFileSync(schemaPath, 'utf8');

    // Remove USE statement and comments
    schema = schema
      .split('\n')
      .filter(line => !line.trim().startsWith('--') && !line.trim().startsWith('USE'))
      .join('\n');

    // Split by statements (more robust)
    const statements = schema
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);

    let created = 0;
    for (const statement of statements) {
      try {
        await connection.query(statement);
        created++;
      } catch (err) {
        if (err.code === 'ER_TABLE_EXISTS_ERROR') {
          // Table already exists, that's fine
        } else {
          console.warn(`Warning: ${err.code} - ${err.message.substring(0, 50)}`);
        }
      }
    }

    console.log(`✅ Schema processed (${statements.length} statements, ${created} successful)`);
    console.log('✅ Database fully initialized!');
    console.log('\n📊 Database Ready:');
    console.log('   - Host: ' + (process.env.DB_HOST || 'localhost'));
    console.log('   - Database: ' + dbName);
    console.log('   - User: ' + (process.env.DB_USER || 'root'));

    await connection.end();
    
  } catch (err) {
    console.error('❌ Initialization Error:', err.message);
    process.exit(1);
  }
}

initializeDatabase();
