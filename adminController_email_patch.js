// =====================================================
//   HYDRAA — adminController.js EMAIL PATCH
//   Only the addOfficial function needs updating.
//   Add the import at the top, then replace addOfficial.
// =====================================================

// ── ADD THIS IMPORT at the top of adminController.js ──
// const { sendOfficialWelcome, sendSafe } = require('../utils/emailService');


// ══════════════════════════════════════════════════════════
//  REPLACE: addOfficial
// ══════════════════════════════════════════════════════════
const addOfficial = async (req, res) => {
  const { full_name, email, phone, department, password } = req.body;

  if (!full_name || !email || !password)
    return res.status(400).json({ success: false, message: 'Name, email and password are required.' });

  try {
    const [existing] = await db.query('SELECT id FROM officials WHERE email = ?', [email]);
    if (existing.length > 0)
      return res.status(409).json({ success: false, message: 'Email already registered as an official.' });

    const hashed = await bcrypt.hash(password, 10);
    await db.query(
      'INSERT INTO officials (full_name, email, phone, department, password) VALUES (?, ?, ?, ?, ?)',
      [full_name, email, phone || null, department || null, hashed]
    );

    // ── EMAIL: Send welcome email with credentials to new official ──
    sendSafe(sendOfficialWelcome, {
      to:         email,
      name:       full_name,
      email,
      password,   // send plain password ONLY in the welcome email (first-time setup)
      department: department || 'HYDRAA',
    });

    res.status(201).json({ success: true, message: 'Official added successfully! Login credentials sent to their email.' });
  } catch (err) {
    console.error('Add official error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};
