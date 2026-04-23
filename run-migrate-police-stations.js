require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const db   = require('./utils/db');

async function run() {
  const sql = fs.readFileSync(path.join(__dirname, 'migrate-police-stations.sql'), 'utf8');
  const statements = sql.split(';').map(s => s.trim()).filter(Boolean);
  for (const stmt of statements) {
    try {
      await db.query(stmt);
      console.log('OK:', stmt.slice(0, 80));
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') { console.log('SKIP (already exists):', stmt.slice(0, 80)); }
      else { console.error('ERR:', e.message, '\n', stmt.slice(0, 120)); }
    }
  }
  console.log('Migration complete.');
  process.exit(0);
}
run();
