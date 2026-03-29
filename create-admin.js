// =====================================================
//   Create Default Admin — HYDRAA
//   Run once after DB setup: node create-admin.js
// =====================================================

const bcrypt = require('bcryptjs');
const mysql  = require('mysql2/promise');
require('dotenv').config();

const ADMIN = {
  username:  process.env.ADMIN_USERNAME  || 'hydraa_admin',
  email:     process.env.ADMIN_EMAIL     || 'admin@hydraa.telangana',
  password:  process.env.ADMIN_PASSWORD  || 'ChangeMe@1234',
  full_name: process.env.ADMIN_FULL_NAME || 'HYDRAA Administrator',
};

async function createAdmin() {
  const conn = await mysql.createConnection({
    host:     process.env.DB_HOST     || 'localhost',
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME     || 'hydraa',
  });

  try {
    // Check if admin already exists
    const [existing] = await conn.query(
      'SELECT id, email FROM admins WHERE email = ? OR username = ?',
      [ADMIN.email, ADMIN.username]
    );

    if (existing.length > 0) {
      console.log(`⚠️  Admin already exists: ${existing[0].email}`);
      console.log('   Use Change Password in the admin panel to update credentials.');
      return;
    }

    const hashedPassword = await bcrypt.hash(ADMIN.password, 12);

    await conn.query(
      'INSERT INTO admins (username, email, password, full_name, is_active) VALUES (?, ?, ?, ?, 1)',
      [ADMIN.username, ADMIN.email, hashedPassword, ADMIN.full_name]
    );

    console.log('✅ Default admin created successfully!');
    console.log('');
    console.log('   Email    :', ADMIN.email);
    console.log('   Username :', ADMIN.username);
    console.log('   Password :', ADMIN.password);
    console.log('');
    console.log('⚠️  IMPORTANT: Change the password immediately after first login!');

  } finally {
    await conn.end();
  }
}

createAdmin().catch(err => {
  console.error('❌ Error creating admin:', err.message);
  process.exit(1);
});
