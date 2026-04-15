// =====================================================
//   Admin Controller — HYDRAA
//   Handles admin management functions
// =====================================================

const bcrypt = require('bcryptjs');
const db = require('../utils/db');
const { v4: uuidv4 } = require('uuid');
const { sendOfficialWelcome, sendAccountDeleted, sendSafe } = require('../utils/emailService');

// ────────────────────────────────────────────────────
//  CATEGORIES: GET
// ────────────────────────────────────────────────────
const getCategories = async (req, res) => {
  try {
    const [categories] = await db.query(`
      SELECT id, name, description, created_at FROM categories ORDER BY name ASC
    `);

    res.json({
      success: true,
      data: categories,
    });
  } catch (err) {
    console.error('Get categories error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ────────────────────────────────────────────────────
//  CATEGORIES: CREATE
// ────────────────────────────────────────────────────
const createCategory = async (req, res) => {
  const { name, description } = req.body;

  if (!name) {
    return res.status(400).json({ success: false, message: 'Category name required.' });
  }

  try {
    const [result] = await db.query(
      'INSERT INTO categories (name, description, created_at) VALUES (?, ?, NOW())',
      [name, description || null]
    );

    res.status(201).json({
      success: true,
      message: 'Category created.',
      data: { id: result.insertId, name, description },
    });
  } catch (err) {
    console.error('Create category error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ────────────────────────────────────────────────────
//  CATEGORIES: DELETE
// ────────────────────────────────────────────────────
const deleteCategory = async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await db.query('DELETE FROM categories WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Category not found.' });
    }

    res.json({ success: true, message: 'Category deleted.' });
  } catch (err) {
    console.error('Delete category error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ────────────────────────────────────────────────────
//  SUBCATEGORIES: GET
// ────────────────────────────────────────────────────
const getSubcategories = async (req, res) => {
  const { category_id } = req.query;

  if (!category_id) {
    return res.status(400).json({ success: false, message: 'Category ID required.' });
  }

  try {
    const [subcategories] = await db.query(`
      SELECT id, name, category_id FROM subcategories
      WHERE category_id = ? ORDER BY name ASC
    `, [category_id]);

    res.json({
      success: true,
      data: subcategories,
    });
  } catch (err) {
    console.error('Get subcategories error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ────────────────────────────────────────────────────
//  SUBCATEGORIES: CREATE
// ────────────────────────────────────────────────────
const createSubcategory = async (req, res) => {
  const { name, category_id } = req.body;

  if (!name || !category_id) {
    return res.status(400).json({
      success: false,
      message: 'Subcategory name and category ID required.',
    });
  }

  try {
    const [result] = await db.query(
      'INSERT INTO subcategories (name, category_id, created_at) VALUES (?, ?, NOW())',
      [name, category_id]
    );

    res.status(201).json({
      success: true,
      message: 'Subcategory created.',
      data: { id: result.insertId, name, category_id },
    });
  } catch (err) {
    console.error('Create subcategory error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ────────────────────────────────────────────────────
//  SUBCATEGORIES: DELETE
// ────────────────────────────────────────────────────
const deleteSubcategory = async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await db.query('DELETE FROM subcategories WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Subcategory not found.' });
    }

    res.json({ success: true, message: 'Subcategory deleted.' });
  } catch (err) {
    console.error('Delete subcategory error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ────────────────────────────────────────────────────
//  OFFICIALS: GET LIST
// ────────────────────────────────────────────────────
const getOfficials = async (req, res) => {
  try {
    const [officials] = await db.query(`
      SELECT o.id, o.full_name, o.email, o.phone, o.department, o.is_active, o.created_at,
             o.district_id, d.name AS district_name
      FROM officials o
      LEFT JOIN districts d ON d.id = o.district_id
      ORDER BY o.full_name ASC
    `);
    res.json({ success: true, data: officials });
  } catch (err) {
    console.error('Get officials error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ────────────────────────────────────────────────────
//  OFFICIALS: CREATE
// ────────────────────────────────────────────────────
const createOfficial = async (req, res) => {
  const { full_name, email, phone, department, password, district_id } = req.body;

  if (!full_name || !email || !password || !department || !district_id) {
    return res.status(400).json({
      success: false,
      message: 'Full name, email, district, department and password are required.',
    });
  }

  try {
    const [existing] = await db.query('SELECT id FROM officials WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'Email already in use.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await db.query(
      `INSERT INTO officials (full_name, email, phone, department, password, is_active, district_id, created_at)
       VALUES (?, ?, ?, ?, ?, 1, ?, NOW())`,
      [full_name, email, phone || null, department, hashedPassword, district_id || null]
    );

    // Send welcome email with credentials (non-blocking)
    sendSafe(sendOfficialWelcome, { to: email, name: full_name, email, password, department });

    res.status(201).json({
      success: true,
      message: 'Official created.',
      data: {
        id: result.insertId,
        full_name,
        email,
        department,
      },
    });
  } catch (err) {
    console.error('Create official error:', err);
    res.status(500).json({ success: false, message: err.message || 'Server error.' });
  }
};

// ────────────────────────────────────────────────────
//  OFFICIALS: DELETE
// ────────────────────────────────────────────────────
const deleteOfficial = async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await db.query('DELETE FROM officials WHERE id = ?', [id]);
    if (result.affectedRows === 0)
      return res.status(404).json({ success: false, message: 'Official not found.' });
    res.json({ success: true, message: 'Official deleted.' });
  } catch (err) {
    console.error('Delete official error:', err);
    res.status(500).json({ success: false, message: err.message || 'Server error.' });
  }
};

// ────────────────────────────────────────────────────
//  OFFICIALS: UPDATE
// ────────────────────────────────────────────────────
const updateOfficial = async (req, res) => {
  const { id } = req.params;
  const { full_name, phone, department, is_active } = req.body;

  try {
    const [result] = await db.query(
      `UPDATE officials SET full_name = ?, phone = ?, department = ?, is_active = ? WHERE id = ?`,
      [full_name, phone || null, department, is_active, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Official not found.' });
    }

    res.json({ success: true, message: 'Official updated.' });
  } catch (err) {
    console.error('Update official error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ────────────────────────────────────────────────────
//  USERS: GET LIST
// ────────────────────────────────────────────────────
const getUsers = async (req, res) => {
  try {
    const [users] = await db.query(`
      SELECT u.id, u.full_name, u.email, u.phone, u.is_verified,
             u.created_at,
             COUNT(c.id) AS complaint_count,
             SUM(c.status = 'resolved') AS resolved_count
      FROM users u
      LEFT JOIN complaints c ON c.user_id = u.id
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `);

    res.json({ success: true, data: users });
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const deactivateUser = async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await db.query('UPDATE users SET is_verified = 0 WHERE id = ?', [id]);
    if (result.affectedRows === 0)
      return res.status(404).json({ success: false, message: 'User not found.' });
    res.json({ success: true, message: 'User deactivated.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const activateUser = async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await db.query('UPDATE users SET is_verified = 1 WHERE id = ?', [id]);
    if (result.affectedRows === 0)
      return res.status(404).json({ success: false, message: 'User not found.' });
    res.json({ success: true, message: 'User activated.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const deleteUser = async (req, res) => {
  const { id } = req.params;
  try {
    const [[user]] = await db.query('SELECT id, email, full_name, phone FROM users WHERE id = ?', [id]);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    // Fetch full complaint records BEFORE deletion for audit
    const [complaints] = await db.query(
      `SELECT c.complaint_no, c.title, c.description, c.status, c.priority,
              c.address, c.created_at, c.resolved_at,
              cat.name AS category, o.full_name AS assigned_official,
              c.official_remarks
       FROM complaints c
       LEFT JOIN categories cat ON cat.id = c.category_id
       LEFT JOIN officials o ON o.id = c.official_id
       WHERE c.user_id = ?
       ORDER BY c.created_at DESC`,
      [id]
    );

    // Delete related records first to avoid FK constraint errors
    if (complaints.length > 0) {
      const cIds = (await db.query('SELECT id FROM complaints WHERE user_id = ?', [id]))[0].map(c => c.id);
      await db.query('DELETE FROM complaint_photos   WHERE complaint_id IN (?)', [cIds]);
      await db.query('DELETE FROM complaint_comments WHERE complaint_id IN (?)', [cIds]);
      await db.query('DELETE FROM complaint_timeline WHERE complaint_id IN (?)', [cIds]).catch(() => {});
      await db.query('DELETE FROM complaint_ratings  WHERE complaint_id IN (?)', [cIds]).catch(() => {});
      await db.query('DELETE FROM complaints WHERE user_id = ?', [id]);
    }

    await db.query('DELETE FROM users WHERE id = ?', [id]);

    // Save audit record with full complaint history as JSON
    await db.query(
      `INSERT INTO deleted_users (original_user_id, full_name, email, phone, complaints_count, complaints_data, deleted_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [user.id, user.full_name || '', user.email || '', user.phone || null,
       complaints.length, JSON.stringify(complaints), 'admin']
    ).catch(e => console.warn('Audit record insert failed:', e.message));

    // Send deletion email to the user
    console.log('[DELETE USER] Sending deletion email to:', user.email);
    try {
      await sendAccountDeleted({ to: user.email, name: user.full_name || 'Citizen' });
      console.log('[DELETE USER] Deletion email sent successfully to:', user.email);
    } catch (emailErr) {
      console.error('[DELETE USER] Failed to send deletion email:', emailErr.message);
    }

    res.json({ success: true, message: 'User and all associated complaints deleted.' });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ success: false, message: err.message || 'Server error.' });
  }
};

// ────────────────────────────────────────────────────
//  DELETED USERS AUDIT LOG
// ────────────────────────────────────────────────────
const getDeletedUsers = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, original_user_id, full_name, email, phone, complaints_count, complaints_data, deleted_at, deleted_by
       FROM deleted_users ORDER BY deleted_at DESC`
    );
    // Parse complaints_data JSON
    rows.forEach(r => {
      try { r.complaints_data = r.complaints_data ? JSON.parse(r.complaints_data) : []; }
      catch { r.complaints_data = []; }
    });
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Get deleted users error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ────────────────────────────────────────────────────
//  USERS: VIEW LOGS
// ────────────────────────────────────────────────────
const getUserLogs = async (req, res) => {
  const { id } = req.params;

  try {
    const [logs] = await db.query(`
      SELECT action, ip_address, created_at 
      FROM user_logs 
      WHERE user_id = ? 
      ORDER BY created_at DESC 
      LIMIT 50
    `, [id]);

    res.json({
      success: true,
      data: logs,
    });
  } catch (err) {
    console.error('Get user logs error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ────────────────────────────────────────────────────
//  STATES: GET LIST
// ────────────────────────────────────────────────────
const getStates = async (req, res) => {
  try {
    // Simple query first; complaint_count is added via subquery so missing state_id column won't break it
    const [states] = await db.query(`
      SELECT id, state_name, code FROM states
      WHERE state_name IS NOT NULL AND state_name != ''
      ORDER BY state_name ASC
    `);

    // Try to add complaint counts (non-fatal if complaints.state_id doesn't exist yet)
    let result = states;
    try {
      const [withCount] = await db.query(`
        SELECT s.id, s.state_name, s.code,
               COUNT(c.id) AS complaint_count
        FROM states s
        LEFT JOIN complaints c ON c.state_id = s.id
        WHERE s.state_name IS NOT NULL AND s.state_name != ''
        GROUP BY s.id, s.state_name, s.code
        ORDER BY s.state_name ASC
      `);
      result = withCount;
    } catch (_) { /* complaints.state_id not yet available — return states without count */ }

    res.json({ success: true, data: result });
  } catch (err) {
    console.error('Get states error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ────────────────────────────────────────────────────
//  STATES: CREATE
// ────────────────────────────────────────────────────
const createState = async (req, res) => {
  const { state_name, code } = req.body;
  if (!state_name) return res.status(400).json({ success: false, message: 'State name required.' });

  try {
    const [result] = await db.query(
      'INSERT INTO states (state_name, code) VALUES (?, ?)',
      [state_name, code || null]
    );
    res.status(201).json({
      success: true,
      message: 'State created.',
      data: { id: result.insertId, state_name, code: code || null },
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'State already exists.' });
    console.error('Create state error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ────────────────────────────────────────────────────
//  STATES: DELETE
// ────────────────────────────────────────────────────
const deleteState = async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await db.query('DELETE FROM states WHERE id = ?', [id]);
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'State not found.' });
    res.json({ success: true, message: 'State deleted.' });
  } catch (err) {
    console.error('Delete state error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ────────────────────────────────────────────────────
//  ANALYTICS
// ────────────────────────────────────────────────────
const getAnalytics = async (req, res) => {
  try {
    // Status counts
    const [statusCounts] = await db.query(`
      SELECT status, COUNT(*) AS count FROM complaints GROUP BY status
    `);

    // Priority counts
    const [priorityCounts] = await db.query(`
      SELECT priority, COUNT(*) AS count FROM complaints GROUP BY priority
    `);

    // Category breakdown
    const [categoryCounts] = await db.query(`
      SELECT c.name, COUNT(comp.id) AS count
      FROM categories c
      LEFT JOIN complaints comp ON comp.category_id = c.id
      GROUP BY c.id, c.name ORDER BY count DESC
    `);

    // Monthly trend (last 6 months)
    const [monthlyTrend] = await db.query(`
      SELECT DATE_FORMAT(created_at, '%b %Y') AS month,
             DATE_FORMAT(created_at, '%Y-%m') AS sort_key,
             COUNT(*) AS total,
             SUM(status = 'resolved') AS resolved
      FROM complaints
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
      GROUP BY month, sort_key
      ORDER BY sort_key ASC
    `);

    // Official performance
    const [officialStats] = await db.query(`
      SELECT o.full_name, o.department,
             COUNT(c.id) AS assigned,
             SUM(c.status = 'resolved') AS resolved,
             SUM(c.status = 'in_progress') AS in_progress
      FROM officials o
      LEFT JOIN complaints c ON c.official_id = o.id
      GROUP BY o.id, o.full_name, o.department
      ORDER BY resolved DESC LIMIT 10
    `);

    // Key metrics
    const [[totals]] = await db.query(`
      SELECT
        COUNT(*) AS total,
        SUM(status = 'resolved') AS resolved,
        SUM(status IN ('open','assigned','in_progress')) AS pending,
        AVG(CASE WHEN resolved_at IS NOT NULL THEN TIMESTAMPDIFF(HOUR, created_at, resolved_at) END) AS avg_resolution_hours
      FROM complaints
    `);

    // Avg rating
    const [[ratingData]] = await db.query(`
      SELECT ROUND(AVG(rating), 1) AS avg_rating, COUNT(*) AS total_ratings FROM complaint_ratings
    `);

    // Total users & officials
    const [[userCount]]     = await db.query('SELECT COUNT(*) AS count FROM users');
    const [[officialCount]] = await db.query('SELECT COUNT(*) AS count FROM officials');

    // District-wise stats
    let districtStats = [];
    try {
      [districtStats] = await db.query(`
        SELECT
          d.id, d.name AS district,
          COUNT(c.id)                          AS total,
          SUM(c.status = 'resolved')           AS resolved,
          SUM(c.status IN ('open','assigned','in_progress')) AS pending,
          SUM(c.status = 'rejected')           AS rejected,
          SUM(c.priority = 'urgent')           AS urgent,
          ROUND(
            100.0 * SUM(c.status = 'resolved') / NULLIF(COUNT(c.id), 0), 1
          ) AS resolution_rate
        FROM districts d
        LEFT JOIN complaints c ON c.district_id = d.id
        GROUP BY d.id, d.name
        ORDER BY total DESC
      `);
    } catch(e) { /* districts table may not exist yet */ }

    res.json({
      success: true,
      data: {
        totals: {
          ...totals,
          avg_rating: ratingData.avg_rating || 0,
          total_ratings: ratingData.total_ratings || 0,
          total_users: userCount.count,
          total_officials: officialCount.count,
        },
        statusCounts,
        priorityCounts,
        categoryCounts,
        monthlyTrend,
        officialStats,
        districtStats,
      },
    });
  } catch (err) {
    console.error('Analytics error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ────────────────────────────────────────────────────
//  HEATMAP DATA
// ────────────────────────────────────────────────────
const getHeatmapData = async (req, res) => {
  try {
    // Complaints by state
    const [stateData] = await db.query(`
      SELECT s.state_name, s.code, COUNT(c.id) AS total,
             SUM(c.status = 'resolved') AS resolved,
             SUM(c.status IN ('open','assigned','in_progress')) AS pending
      FROM states s
      LEFT JOIN complaints c ON c.state_id = s.id
      GROUP BY s.id, s.state_name, s.code
      ORDER BY total DESC
    `);

    // Hour × day-of-week activity grid
    const [timeGrid] = await db.query(`
      SELECT HOUR(created_at) AS hour,
             DAYOFWEEK(created_at) AS dow,
             COUNT(*) AS count
      FROM complaints
      GROUP BY hour, dow
    `);

    // Category × Priority matrix
    const [catPriMatrix] = await db.query(`
      SELECT c.name AS category, comp.priority, COUNT(*) AS count
      FROM complaints comp
      JOIN categories c ON comp.category_id = c.id
      GROUP BY c.name, comp.priority
      ORDER BY c.name, comp.priority
    `);

    // Last 30 days daily count
    const [dailyCount] = await db.query(`
      SELECT DATE(created_at) AS day, COUNT(*) AS count
      FROM complaints
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY day ORDER BY day ASC
    `);

    res.json({ success: true, data: { stateData, timeGrid, catPriMatrix, dailyCount } });
  } catch (err) {
    console.error('Heatmap error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ────────────────────────────────────────────────────
//  DISTRICTS
// ────────────────────────────────────────────────────
const getDistricts = async (req, res) => {
  try {
    const [districts] = await db.query(`
      SELECT d.id, d.name, d.created_at,
             COUNT(DISTINCT m.id)  AS mandal_count,
             COUNT(DISTINCT c.id)  AS complaint_count
      FROM districts d
      LEFT JOIN mandals m  ON m.district_id = d.id
      LEFT JOIN complaints c ON c.district_id = d.id
      GROUP BY d.id, d.name, d.created_at
      ORDER BY d.name ASC
    `);
    res.json({ success: true, data: districts });
  } catch (err) {
    console.error('Get districts error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const createDistrict = async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ success: false, message: 'District name required.' });
  try {
    const [result] = await db.query('INSERT INTO districts (name) VALUES (?)', [name]);
    res.status(201).json({ success: true, message: 'District added.', data: { id: result.insertId, name } });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'District already exists.' });
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const deleteDistrict = async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await db.query('DELETE FROM districts WHERE id = ?', [id]);
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'District not found.' });
    res.json({ success: true, message: 'District deleted.' });
  } catch (err) {
    console.error('Delete district error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const seedDistricts = async (req, res) => {
  const TELANGANA_DISTRICTS = [
    'Adilabad','Bhadradri Kothagudem','Hyderabad','Jagtial','Jangaon',
    'Jayashankar Bhupalpally','Jogulamba Gadwal','Kamareddy','Karimnagar',
    'Khammam','Kumuram Bheem Asifabad','Mahabubabad','Mahabubnagar',
    'Mancherial','Medak','Medchal-Malkajgiri','Mulugu','Nagarkurnool',
    'Nalgonda','Narayanpet','Nirmal','Nizamabad','Peddapalli',
    'Rajanna Sircilla','Rangareddy','Sangareddy','Siddipet','Suryapet',
    'Vikarabad','Wanaparthy','Warangal Rural','Warangal Urban','Yadadri Bhuvanagiri',
  ];
  try {
    let added = 0;
    for (const name of TELANGANA_DISTRICTS) {
      try {
        await db.query('INSERT INTO districts (name) VALUES (?)', [name]);
        added++;
      } catch (e) { /* skip duplicates */ }
    }
    res.json({ success: true, message: `Seeded ${added} new districts (${TELANGANA_DISTRICTS.length - added} already existed).` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ────────────────────────────────────────────────────
//  MANDALS
// ────────────────────────────────────────────────────
const getMandals = async (req, res) => {
  const { district_id } = req.query;
  if (!district_id) return res.status(400).json({ success: false, message: 'district_id required.' });
  try {
    const [mandals] = await db.query(
      'SELECT id, name, district_id FROM mandals WHERE district_id = ? ORDER BY name ASC',
      [district_id]
    );
    res.json({ success: true, data: mandals });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const createMandal = async (req, res) => {
  const { name, district_id } = req.body;
  if (!name || !district_id) return res.status(400).json({ success: false, message: 'Name and district_id required.' });
  try {
    const [result] = await db.query('INSERT INTO mandals (name, district_id) VALUES (?, ?)', [name, district_id]);
    res.status(201).json({ success: true, message: 'Mandal added.', data: { id: result.insertId, name, district_id } });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'Mandal already exists in this district.' });
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const deleteMandal = async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await db.query('DELETE FROM mandals WHERE id = ?', [id]);
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Mandal not found.' });
    res.json({ success: true, message: 'Mandal deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const seedMandals = async (req, res) => {
  const MANDALS_BY_DISTRICT = {
    'Adilabad':                   ['Adilabad','Bela','Boath','Gudihatnoor','Ichoda','Jainoor','Mavala','Narnoor','Talamadugu','Bazarhatnoor','Neradigonda','Kubeer','Tamsi','Tiryani','Utnoor','Gadiguda','Indervelly'],
    'Bhadradri Kothagudem':       ['Aswaraopet','Aswapuram','Bhadrachalam','Bhurgampadu','Chandrugonda','Cherla','Dammapet','Dummugudem','Gundala','Julurpad','Kothagudem','Kunavaram','Laxmidevipally','Manuguru','Mulkalapalli','Palvoncha','Pinapaka','Sujathanagar','Tekulapally','Thirumalayapalem','Venkatapuram','Wazeedu','Yellandu','Burgampadu','Rajolu','Seetharampuram'],
    'Hyderabad':                  ['Amberpet','Bahadurpura','Bandlaguda Jagir','Charminar','Golconda','Hayathnagar','Kapra','Khairatabad','LB Nagar','Malakpet','Malkajgiri','Musheerabad','Neredmet','Saroornagar','Secunderabad','Shaikpet'],
    'Jagtial':                    ['Buggaram','Dharmapuri','Gollapally','Jagtial','Korutla','Mallapur','Medipally','Metpally','Pegadapally','Raikal','Sarangapur','Vadlapally','Velgatoor','Kodimial','Ibrahimpatnam','Beerpur','Kathlapur','Channaram','Julapally','Konaraopet','Manthani','Sultanabad','Gambhiraopet'],
    'Jangaon':                    ['Bachannapeta','Chilpur','Devaruppula','Ghanpur Station','Jangaon','Kodakandla','Lingal Ghanpur','Narsimhulapet','Nellipaka','Palakurthi','Raghunathapally','Regonda','Roopanagudi','Shayampet','Tadvai','Thorrur','Zaffergadh'],
    'Jayashankar Bhupalpally':    ['Bhupalpally','Chityal','Eleswaram','Gambhiraopet','Govindaraopet','Kataram','Mahadevpur','Maripeda','Mogullapally','Mulug','Palimela','Regonda','Tadvai','Tekumatla','Venkatapur','Wazedu','Eturunagaram','Kothaguda','Mangapet'],
    'Jogulamba Gadwal':           ['Alampur','Atturu','Dharur','Gadwal','Gattu','Gopal','Ieeja','Itikyala','Kalwakurthy','Krishnur','Lingal','Maldakal','Undavalli','Waddepally','Makthal','Wanaparthy','Nagarkurnool','Dhanwada'],
    'Kamareddy':                  ['Banswada','Bichkunda','Bhiknur','Bommakal','Domakonda','Ellareddy','Gandhari','Jakranpally','Jukkal','Kamareddy','Lingampet','Machnur','Madnur','Makloor','Mupkal','Narayankhed','Nizamsagar','Pitlam','Ramareddy','Ranjole','Sadasivanagar','Thimmapur','Yellareddy','Bibipet','Kotagiri','Nagireddypet','Rajampet','Tadwai','Wargal','Dichpally'],
    'Karimnagar':                 ['Bommakal','Choppadandi','Dharmapuri','Gangadhara','Husnabad','Huzurabad','Jammikunta','Karimnagar','Kattangur','Koheda','Manakondur','Manthani','Metpally','Ramadugu','Saidapur','Shankarapatnam','Sultanabad','Timmapur','Veenavanka','Yellareddypet','Kodimial','Ibrahimpatnam','Konaraopet','Kathlapur','Gambhiraopet','Pegadapally','Julapally'],
    'Khammam':                    ['Bonakal','Chintakani','Enkoor','Errupalem','Garla','Kallur','Khanapuram Haveli','Khammam','Kusumanchi','Madhira','Mudigonda','Nelakondapally','Nellipaka','Raghunadhapalem','Sattupally','Singareni','Thirumalayapalem','Vemsoor','Wyra','Konijerla','Nuguru','Penuballi','Tallapally','Tallada','Yerrupalem','Dammapet','Tirumalayapalem','Bonakal','Madhira','Khammam Rural'],
    'Kumuram Bheem Asifabad':     ['Asifabad','Bejjur','Chenur','Dahegaon','Gadiguda','Gunjala','Jainoor','Kagaznagar','Kouthala','Lingapur','Narsapur','Rebbena','Sirpur T','Tiryani','Tamsi','Utnoor','Wankidi','Kerameri'],
    'Mahabubabad':                ['Bayyaram','Cheriyal','Dornakal','Gudur','Kesamudram','Khanapur','Kodakandla','Mahabubabad','Maripeda','Narsimhulapet','Nellikudur','Nellipaka','Palakurthi','Reguvanipalle','Santhoshpur','Subhashpur','Thorrur','Usikayal','Garla','Kothaguda','Kuravi','Mahbubabad'],
    'Mahabubnagar':               ['Achampet','Addakal','Amarchintha','Atmakur','Balanagar','Bhoothpur','Bijinapally','Devarkadra','Hanwada','Jadcherla','Kalwakurthi','Kothakota','Mahabubnagar','Makthal','Midjil','Pangal','Ravinuthala','Shadnagar','Utkoor','Veldanda','Gadwal','Kodangal','Narayanpet','Wanaparthy','Dharur','Chinnachintakunta'],
    'Mancherial':                 ['Bellampally','Bheemaram','Bopapuram','Chennur','Dandepally','Hajipur','Jaipur','Kasipet','Kotapally','Laxmipur','Luxettipet','Mancherial','Mandamarri','Naspur','Nennel','Ramakrishnapur','Soanpet','Tandur','Vemanpally','Yellareddypet','Jannaram','Umerabad'],
    'Medak':                      ['Alladurg','Andole','Chegunta','Chilodde','Doulathabad','Dubbak','Gajwel','Havelighanpur','Jogipet','Kondapak','Kulcharam','Medak','Narsapur','Papannapet','Ramayampet','Shankarampet','Siddipet','Tekmal','Toopran','Yeldurthy','Narayankhed','Manoor','Sadasivapet','Ramayampet A','Shankarampet R'],
    'Medchal-Malkajgiri':         ['Badangpet','Ghatkesar','Keesara','Kompally','Malkajgiri','Medchal','Quthbullapur','Shamirpet','Uppal','Alwal','Dundigal','Kapra','Balanagar','Medipally'],
    'Mulugu':                     ['Eturnagaram','Govindaraopet','Mangapet','Mulugu','Tekumatla','Tadvai','Venkatapuram','Wazeedu','Venkatapur'],
    'Nagarkurnool':               ['Achampet','Amarchintha','Bijinapally','Chandampet','Charakonda','Chinnachintakunta','Kollapur','Kodair','Kothakota','Lingal','Maddur','Nagarkurnool','Nawabpet','Padara','Peddakothapally','Telkapally','Thimmajipet','Utkoor','Veldanda','Vangoor','Vatwarlapally','Waddepally','Kalwakurthi','Tadoor','Amrabad','Badvel'],
    'Nalgonda':                   ['Addakal','Alair','Aler','Bhongir','Bibinagar','Chandur','Chivvemla','Chityal','Devarakonda','Dindi','Huzurnagar','Kodad','Mothkur','Munagala','Nalgonda','Nakrekal','Narketpally','Nampally','Nidmanur','Pampanur','Peddavoora','Ramannapeta','Thirumalagiri','Tripuraram','Tungaturthy','Valigonda','Yadagirigutta','Yacharam','Anumula','Decherla','Marriguda','Kanagal','Suryapet','Thungathurthi','Mellacheruvu','Mattampally','Garidepally','Katangur','Ramannapeta'],
    'Narayanpet':                 ['Amangal','Balanagar','Damaragidda','Dhanwada','Kosgi','Kulkacherla','Maddur','Maganur','Marikal','Makthal','Narayanpet','Utkoor'],
    'Nirmal':                     ['Armur','Bhainsa','Bheemgal','Dilawarpur','Kaddam','Kanapur','Kubeer','Lokeshwaram','Laxmanchanda','Mamda','Mudhole','Muzafarabad','Narsapur','Nirmal','Pembi','Pitlapur','Ranjole','Sarangapur','Tanur','Talamadugu','Utnoor','Wankidi','Khanapur'],
    'Nizamabad':                  ['Armur','Balanagar','Banswada','Bheemgal','Bhiknur','Bodhan','Dichpally','Domakonda','Enkuru','Gandhari','Indalwai','Jakranpally','Jukkal','Kotagiri','Linkaspur','Lokeshwaram','Morthad','Mudhole','Nandipet','Navipet','Nidgul','Nizamabad Rural','Nizamabad Urban','Pitlam','Renjal','Rudrur','Sirkilla','Sultanabad','Velpur','Yellareddy','Rajampet','Wargal','Bichkunda','Kamareddy','Thimmapur','Varni'],
    'Peddapalli':                 ['Dharmaram','Gambhiraopet','Godavarikhani','Husnabad','Julapally','Kataram','Konaraopet','Manthani','Mutharam','Odela','Peddapalli','Ramagiri','Ramakrishnapur','Sultanabad','Veenavanka','Karimnagar Urban'],
    'Rajanna Sircilla':           ['Boinpally','Choppadandi','Dharmapuri','Elkaturthi','Gambhiraopet','Illanthakunta','Koheda','Konaraopet','Mustabad','Pegadapally','Sircilla','Thangallapally','Vemulawada','Yellareddypet','Rudrannapet','Kotapally'],
    'Rangareddy':                 ['Abdullapurmet','Amangal','Balapur','Chevella','Farooqnagar','Gandeed','Hayathnagar','Ibrahimpatnam','Kandukur','Keesara','Kothur','Maheswaram','Manchal','Marpalle','Nawabpet','Pudur','Rajendranagar','Saroornagar','Shamshabad','Shadnagar','Shabad','Tandur','Yacharam','Vikarabad','Meerkhanpet'],
    'Sangareddy':                 ['Andole','Chegunta','Gummadidala','Isnapur','Jinnaram','Jogipet','Kangti','Kondapur','Kandi','Manur','Narayankhed','Nyalkal','Patancheru','Pulkal','Ramachandrapuram','Sadasivapet','Sangareddy','Shankarampet A','Shankarampet R','Tekmal','Vatpally','Zahirabad','Hathnoora','Narsapur','Masaipet','Mogudampally','Doulatabad','Kalher','Kohir','Raikode','Wargal'],
    'Siddipet':                   ['Akkannapet','Bejjanki','Cheriyal','Chinnaodela','Doultabad','Dubbak','Gajwel','Ghanpur Siddipet','Husnabad','Kondapak','Koheda','Komuravelli','Mirdoddi','Nanganur','Narayanraopet','Pragnapur','Siddipet','Thoguta','Yeldurthy','Rajpet','Hatnoora','Waddepally','Sirikonda','Medak','Sirdhan','Mulug','Wargal','Cheriyal'],
    'Suryapet':                   ['Alair','Athmakur','Bhongir','Decherla','Devarakonda','Dindi','Garidepally','Huzurnagar','Kodad','Mothkur','Nampally','Nidmanur','Nuthankal','Penpahad','Rayagiri','Sattupally','Suryapet','Thungathurthi','Tripuraram','Tungaturthy','Vemsoor','Chityal','Mellacheruvu','Mattampally','Marriguda','Anumula','Tirumalgiri','Munagala','Adavi Devulapally','Yadagirigutta'],
    'Vikarabad':                  ['Basheerabad','Dhulkote','Doulatabad','Kulkacherla','Kotapally','Kodangal','Marpalle','Mominpet','Nawabpet','Parigi','Pudur','Shabad','Tandur','Vikarabad','Yalal','Dharur','Doma','Bomraspet','Lagacherla','Peddemul','Chevella','Bantwaram','Imampur'],
    'Wanaparthy':                 ['Addakal','Atmakur','Chennaraopet','Chinnambavi','Gopalpet','Hanwada','Kothakota','Madanapuram','Maddur','Peddamandadi','Pebbair','Pangal','Reddyal','Revelly','Roopanagudi','Sribhavani','Utkoor','Veepanagandla','Wanaparthy','Ghanpur','Shabad','Amarpur','Bhoothpur','Marikal','Damaragidda'],
    'Warangal Rural':             ['Atmakur','Cherial','Chityal','Dharmasagar','Duggondi','Geesugonda','Khanapur','Narsampet','Nekkonda','Nellipaka','Parkal','Parvathagiri','Rayaparthi','Sangem','Shayampet','Thorrur'],
    'Warangal Urban':             ['Dharmasagar','Geesugonda','Hasanparthy','Khanapur','Parkal','Rayaparthi','Sangem','Shayampet','Wardhannapet'],
    'Yadadri Bhuvanagiri':        ['Addaguduru','Alair','Aler','Bibinagar','Bhuvanagiri','Bhongir','Choutuppal','Chivvemla','Chityal','Mothkur','Munagala','Narketpally','Nampally','Penpahad','Ramannapeta','Yadadri','Devarakonda'],
  };

  try {
    let added = 0, skipped = 0;
    for (const [districtName, mandals] of Object.entries(MANDALS_BY_DISTRICT)) {
      const [[district]] = await db.query('SELECT id FROM districts WHERE name = ?', [districtName]);
      if (!district) { skipped += mandals.length; continue; }
      for (const mandalName of mandals) {
        try {
          await db.query('INSERT INTO mandals (name, district_id) VALUES (?, ?)', [mandalName, district.id]);
          added++;
        } catch (e) { skipped++; /* skip duplicates */ }
      }
    }
    res.json({ success: true, message: `Seeded ${added} mandals (${skipped} already existed or district not found).` });
  } catch (err) {
    console.error('Seed mandals error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ────────────────────────────────────────────────────
//  BULK ASSIGN
// ────────────────────────────────────────────────────
const bulkAssign = async (req, res) => {
  const { complaint_ids, official_id, remarks } = req.body;
  const admin_id = req.user.id;
  if (!complaint_ids?.length || !official_id) {
    return res.status(400).json({ success: false, message: 'complaint_ids and official_id required.' });
  }
  try {
    const [[official]] = await db.query('SELECT full_name FROM officials WHERE id = ?', [official_id]);
    if (!official) return res.status(404).json({ success: false, message: 'Official not found.' });

    let assigned = 0;
    for (const cid of complaint_ids) {
      const [[comp]] = await db.query('SELECT status FROM complaints WHERE id = ?', [cid]);
      if (!comp || ['resolved','closed','rejected'].includes(comp.status)) continue;
      const oldStatus = comp.status;
      await db.query(
        `UPDATE complaints SET official_id = ?, status = 'assigned', admin_remarks = ? WHERE id = ?`,
        [official_id, remarks || null, cid]
      );
      await db.query(
        `INSERT INTO complaint_history (complaint_id, old_status, new_status, changed_by_id, changed_by_role, remarks)
         VALUES (?, ?, 'assigned', ?, 'admin', ?)`,
        [cid, oldStatus, admin_id, `Bulk assigned to ${official.full_name}. ${remarks || ''}`]
      );
      assigned++;
    }
    res.json({ success: true, message: `${assigned} complaint(s) assigned to ${official.full_name}.`, assigned });
  } catch (err) {
    console.error('Bulk assign error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ────────────────────────────────────────────────────
//  OFFICIAL PERFORMANCE DASHBOARD
// ────────────────────────────────────────────────────
const getOfficialPerformance = async (req, res) => {
  try {
    const [performance] = await db.query(`
      SELECT
        o.id, o.full_name, o.department, o.is_active,
        COUNT(c.id)                                                        AS total_assigned,
        SUM(c.status = 'resolved')                                         AS resolved,
        SUM(c.status = 'in_progress')                                      AS in_progress,
        SUM(c.status = 'rejected')                                         AS rejected,
        SUM(c.status IN ('open','assigned'))                               AS pending,
        ROUND(AVG(CASE WHEN c.resolved_at IS NOT NULL
          THEN TIMESTAMPDIFF(HOUR, c.created_at, c.resolved_at) END), 1)  AS avg_resolution_hours,
        ROUND(100 * SUM(c.status = 'resolved') / NULLIF(COUNT(c.id), 0), 1) AS resolution_rate
      FROM officials o
      LEFT JOIN complaints c ON c.official_id = o.id
      GROUP BY o.id, o.full_name, o.department, o.is_active
      ORDER BY resolved DESC
    `);
    res.json({ success: true, data: performance });
  } catch (err) {
    console.error('Official performance error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ────────────────────────────────────────────────────
//  CATEGORY-WISE HEATMAP DATA
// ────────────────────────────────────────────────────
const getCategoryHeatmap = async (req, res) => {
  try {
    // Category breakdown per district
    const [districtCategory] = await db.query(`
      SELECT d.name AS district, cat.name AS category, COUNT(c.id) AS total
      FROM complaints c
      JOIN districts d ON c.district_id = d.id
      JOIN categories cat ON c.category_id = cat.id
      GROUP BY d.name, cat.name
      ORDER BY d.name, total DESC
    `);

    // Top category per district
    const [topByDistrict] = await db.query(`
      SELECT d.name AS district, cat.name AS category, COUNT(c.id) AS total
      FROM complaints c
      JOIN districts d ON c.district_id = d.id
      JOIN categories cat ON c.category_id = cat.id
      GROUP BY d.id, cat.id
      HAVING total = (
        SELECT MAX(cnt) FROM (
          SELECT COUNT(id) AS cnt FROM complaints c2
          WHERE c2.district_id = c.district_id AND c2.category_id = c.category_id
        ) sub
      )
    `);

    // Category totals overall
    const [categoryTotals] = await db.query(`
      SELECT cat.name AS category, COUNT(c.id) AS total,
             SUM(c.status = 'resolved') AS resolved,
             SUM(c.status NOT IN ('resolved','closed','rejected')) AS open
      FROM complaints c
      JOIN categories cat ON c.category_id = cat.id
      GROUP BY cat.name ORDER BY total DESC
    `);

    res.json({ success: true, data: { districtCategory, topByDistrict, categoryTotals } });
  } catch (err) {
    console.error('Category heatmap error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ────────────────────────────────────────────────────
//  MONTHLY REPORT DATA
// ────────────────────────────────────────────────────
const getMonthlyReport = async (req, res) => {
  const { year, month } = req.query;
  const y = parseInt(year)  || new Date().getFullYear();
  const m = parseInt(month) || new Date().getMonth() + 1;

  try {
    const [[summary]] = await db.query(`
      SELECT
        COUNT(*)                              AS total,
        SUM(status = 'resolved')              AS resolved,
        SUM(status = 'rejected')              AS rejected,
        SUM(status = 'closed')                AS closed,
        SUM(status NOT IN ('resolved','closed','rejected')) AS pending,
        SUM(priority = 'urgent')              AS urgent,
        ROUND(AVG(CASE WHEN resolved_at IS NOT NULL
          THEN TIMESTAMPDIFF(HOUR, created_at, resolved_at) END), 1) AS avg_resolution_hours
      FROM complaints
      WHERE YEAR(created_at) = ? AND MONTH(created_at) = ?
    `, [y, m]);

    const [byDistrict] = await db.query(`
      SELECT d.name AS district_name, COUNT(c.id) AS total,
             SUM(c.status = 'resolved') AS resolved,
             SUM(c.status NOT IN ('resolved','closed','rejected')) AS pending
      FROM complaints c JOIN districts d ON c.district_id = d.id
      WHERE YEAR(c.created_at) = ? AND MONTH(c.created_at) = ?
      GROUP BY d.id, d.name ORDER BY total DESC
    `, [y, m]);

    const [byCategory] = await db.query(`
      SELECT cat.name AS category_name, COUNT(c.id) AS total,
             SUM(c.status = 'resolved') AS resolved,
             SUM(c.status NOT IN ('resolved','closed','rejected')) AS pending
      FROM complaints c JOIN categories cat ON c.category_id = cat.id
      WHERE YEAR(c.created_at) = ? AND MONTH(c.created_at) = ?
      GROUP BY cat.id, cat.name ORDER BY total DESC
    `, [y, m]);

    const [byOfficial] = await db.query(`
      SELECT o.full_name, o.department, COUNT(c.id) AS assigned,
             SUM(c.status = 'resolved') AS resolved,
             SUM(c.status = 'rejected') AS rejected,
             ROUND(AVG(CASE WHEN c.resolved_at IS NOT NULL
               THEN TIMESTAMPDIFF(HOUR, c.created_at, c.resolved_at) END), 1) AS avg_hours
      FROM complaints c JOIN officials o ON c.official_id = o.id
      WHERE YEAR(c.created_at) = ? AND MONTH(c.created_at) = ?
      GROUP BY o.id, o.full_name, o.department ORDER BY resolved DESC
    `, [y, m]);

    const [dailyTrend] = await db.query(`
      SELECT DATE(created_at) AS date, COUNT(*) AS count
      FROM complaints
      WHERE YEAR(created_at) = ? AND MONTH(created_at) = ?
      GROUP BY DATE(created_at) ORDER BY date
    `, [y, m]);

    const monthName = new Date(y, m - 1, 1).toLocaleString('default', { month: 'long' });

    res.json({ success: true, data: { year: y, month: m, monthName, summary, byDistrict, byCategory, byOfficial, dailyTrend } });
  } catch (err) {
    console.error('Monthly report error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ────────────────────────────────────────────────────
//  SEED DEMO COMPLAINTS (admin-only, one-time use)
// ────────────────────────────────────────────────────
const seedDemoComplaints = async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Admin only.' });

  try {
    const [categories] = await db.query('SELECT id, name FROM categories ORDER BY id');
    const [districts]  = await db.query('SELECT id FROM districts LIMIT 15');
    const [users]      = await db.query("SELECT id FROM users WHERE role IN ('citizen','user') ORDER BY id LIMIT 10");

    if (!categories.length) return res.status(400).json({ success: false, message: 'No categories found. Boot server first.' });
    if (!districts.length)  return res.status(400).json({ success: false, message: 'No districts found.' });
    if (!users.length)      return res.status(400).json({ success: false, message: 'No citizen users found. Register a citizen account first.' });

    const catMap  = Object.fromEntries(categories.map(c => [c.name, c.id]));
    const distIds = districts.map(d => d.id);
    const userIds = users.map(u => u.id);

    const pick  = arr => arr[Math.floor(Math.random() * arr.length)];
    const catId = name => catMap[name] || categories[0].id;
    const ts    = (daysAgo) => {
      const d = new Date();
      d.setDate(d.getDate() - daysAgo);
      return d.toISOString().slice(0, 19).replace('T', ' ');
    };

    const complaints = [
      { title:'Illegal construction on lake buffer zone in Kukatpally', description:'A multi-storey building is being constructed within the 30-metre buffer zone of Nizampet Lake. Construction started 2 months ago and heavy machinery is visible. This is destroying the natural drainage and causing flooding risk to nearby residents.', category:'Lake / Water Body Encroachment', priority:'urgent', address:'Plot No. 45, Near Nizampet Lake, Kukatpally', status:'open', daysAgo:2 },
      { title:'Unauthorized commercial building blocking footpath near LB Nagar', description:'A shop owner has extended his commercial structure 8 feet into the public footpath. Pedestrians are forced to walk on the busy road, causing danger especially for school children and elderly residents. The structure is semi-permanent with concrete pillars.', category:'Road / Footpath Obstruction', priority:'high', address:'LB Nagar Main Road, Near Saraswati School, Rangareddy', status:'assigned', daysAgo:5 },
      { title:'Sewage overflow from blocked drain near Malkajgiri colony', description:'The main drain near our colony has been blocked by construction debris dumped by a contractor. Sewage has been overflowing into the street for the past 10 days. Several residents have reported skin and stomach issues. Immediate action required.', category:'Flooding & Drainage Issue', priority:'urgent', address:'Road No. 7, Malkajgiri Colony, Malkajgiri', status:'in_progress', daysAgo:10 },
      { title:'Poramboke land occupied by unauthorized residents near Uppal', description:'Approximately 2 acres of government poramboke land near Uppal X roads has been illegally occupied. Temporary structures and fences have been erected. This land was designated for a community park as per old revenue records.', category:'Government Land Encroachment', priority:'high', address:'Uppal X Roads, Survey No. 234, Uppal', status:'open', daysAgo:15 },
      { title:'Massive illegal hoarding near Begumpet flyover causing traffic distraction', description:'A 40x20 feet unauthorized LED hoarding has been installed on the Begumpet flyover pillar without any NOC or permission from GHMC. The bright flashing LED lights are distracting drivers and causing traffic hazards especially at night.', category:'Illegal Advertisements', priority:'medium', address:'Begumpet Flyover, Pillar No. 12, Begumpet', status:'resolved', daysAgo:25, resolvedAgo:5 },
      { title:'Building collapse risk: 3-storey structure without approval in Kondapur', description:'A 3-storey residential building constructed without any building permission is showing large cracks on external walls. Residents of neighboring buildings are alarmed. Urgent structural inspection needed before the next rain.', category:'Disaster / Emergency', priority:'urgent', address:'Plot 89, Near DLF Cyber City, Kondapur', status:'in_progress', daysAgo:1 },
      { title:'Park land encroached by builder — children have no play space', description:'The open space reserved as a park in our layout (as per approved plan) has been fenced off by a builder who claims he purchased it. Over 300 families in the colony have no park. Children used to play here every evening.', category:'Park / Open Space Violation', priority:'high', address:'Srinagar Colony, Layout Sector 4, Dilsukhnagar', status:'open', daysAgo:8 },
      { title:'Nala filled with construction material causing waterlogging', description:'A natural nala running through our area has been partially filled with earth to facilitate vehicular movement to a new construction site. During last rain this caused 3 feet of waterlogging in 6 houses. The debris must be removed immediately.', category:'Lake / Water Body Encroachment', priority:'high', address:'Near ORR Exit 14, Narsingi Village', status:'assigned', daysAgo:12 },
      { title:'Vendor stalls blocking entire road near Charminar', description:'Unauthorized street vendors have set up permanent stalls with concrete bases on the road near Charminar south side. The road has narrowed from 2 lanes to barely 1 lane, causing severe traffic jams and making ambulance access nearly impossible.', category:'Road / Footpath Obstruction', priority:'medium', address:'South Side, Charminar Road, Old City', status:'resolved', daysAgo:30, resolvedAgo:12 },
      { title:'Revenue land grabbed using forged documents in Shamshabad', description:'Government revenue land of 5 acres near Shamshabad has been illegally occupied using forged pattedar documents. The land is clearly marked as government property in revenue records. The occupants have built a compound wall and are claiming ownership.', category:'Government Land Encroachment', priority:'urgent', address:'Survey No. 789, Shamshabad Mandal, Rangareddy', status:'open', daysAgo:3 },
      { title:'Illegal banners of political party covering heritage wall', description:'The historic boundary wall near Nizam Museum has been completely covered with unauthorized political banners and flex prints. This is damaging the heritage structure and violates the High Court order banning unauthorized banners.', category:'Illegal Advertisements', priority:'medium', address:'Near Nizam Museum, Purani Haveli, Hyderabad', status:'rejected', daysAgo:20 },
      { title:'Excess floors built in residential area violating FSI rules', description:'A builder has constructed a 7-storey apartment in a zone that permits only G+3. The additional floors are completely unauthorized. GHMC had issued a notice 6 months ago but no action was taken. The building is now occupied by residents.', category:'Illegal Construction', priority:'high', address:'Plot 22, Road No. 4, Banjara Hills', status:'in_progress', daysAgo:45 },
      { title:'Storm drain blocked by restaurant kitchen waste near Jubilee Hills', description:'A restaurant owner has connected kitchen waste water directly into the open storm drain on the main road. The drain is completely blocked with food waste and grease, causing overflow during even light rain. The smell is unbearable for nearby residents.', category:'Flooding & Drainage Issue', priority:'medium', address:'Road No. 36, Jubilee Hills, Hyderabad', status:'open', daysAgo:7 },
      { title:'Tree fell on compound wall — urgent clearance needed', description:'A massive old neem tree fell on a private compound wall during heavy wind yesterday. Parts of the tree are also blocking the lane making it inaccessible. No injuries reported but hanging branches pose danger to passersby. Request immediate clearance.', category:'Disaster / Emergency', priority:'urgent', address:'Lane 5, Basheer Bagh Colony, Basheer Bagh', status:'resolved', daysAgo:6, resolvedAgo:2 },
      { title:'Playground converted to parking lot by apartment builder', description:'The children\'s playground in Greenfields Apartment, shown in the approved building plan as mandatory open space, has been converted into paid parking by the builder. Over 200 children have no place to play and parents have been complaining for a year.', category:'Park / Open Space Violation', priority:'medium', address:'Greenfields Apartment, Miyapur Main Road, Miyapur', status:'assigned', daysAgo:18 },
      { title:'Unauthorized construction on FTL of Hussain Sagar', description:'Concrete pillars for what appears to be a commercial structure have been erected within the Full Tank Level boundary of Hussain Sagar Lake. This is in clear violation of GO Ms. No. 111 and court orders protecting the lake. Work is progressing rapidly.', category:'Lake / Water Body Encroachment', priority:'urgent', address:'Near Lumbini Park Gate, Tank Bund Road, Hyderabad', status:'in_progress', daysAgo:4 },
      { title:'Digital billboard installed without NOC on national highway', description:'A large digital billboard (50x30 feet) has been installed on the median of NH-44 near Gachibowli without any NOC from NHAI or GHMC. The rotating LED display is blinding drivers especially after dark.', category:'Illegal Advertisements', priority:'high', address:'NH-44, Near Gachibowli Signal, Gachibowli', status:'open', daysAgo:9 },
      { title:'Setback rules violated — neighbour\'s construction touching boundary wall', description:'My neighbour is constructing a building with zero setback on my side, violating building regulations that require minimum 3 metres. They have also started digging my side of the compound wall foundation. Despite repeated requests they have not stopped.', category:'Illegal Construction', priority:'medium', address:'H.No. 14-A, Sai Nagar, Boduppal, Medchal-Malkajgiri', status:'open', daysAgo:11 },
      { title:'Long-term encroachment of government land near Tolichowki', description:'A commercial establishment has been operating on government land for 15 years near Tolichowki. The land was allotted temporarily but occupants refuse to vacate. Multiple notices have been issued with no action taken. A permanent 2-storey structure has now been built.', category:'Government Land Encroachment', priority:'low', address:'Survey No. 112, Tolichowki Main Road, Tolichowki', status:'resolved', daysAgo:60, resolvedAgo:15 },
      { title:'Footpath encroached by flower vendors near Secunderabad station', description:'The entire footpath on the west side of Secunderabad railway station has been taken over by unauthorized flower and fruit vendors who installed semi-permanent metal structures. Commuters especially senior citizens are forced to walk on the busy road.', category:'Road / Footpath Obstruction', priority:'low', address:'West Side, Secunderabad Railway Station, Secunderabad', status:'open', daysAgo:22 },
    ];

    let inserted = 0;
    const results = [];

    for (const c of complaints) {
      const complaint_no = `HYD${Date.now()}${Math.floor(Math.random() * 9999)}`;
      const created_at   = ts(c.daysAgo);
      const resolved_at  = c.resolvedAgo ? ts(c.resolvedAgo) : null;
      const user_id      = pick(userIds);
      const district_id  = pick(distIds);
      const category_id  = catId(c.category);

      const [result] = await db.query(`
        INSERT INTO complaints
          (complaint_no, user_id, title, description, category_id, priority,
           address, district_id, status, created_at, resolved_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [complaint_no, user_id, c.title, c.description, category_id,
          c.priority, c.address, district_id, c.status, created_at, resolved_at]);

      const cid = result.insertId;

      // History: lodged
      await db.query(`
        INSERT INTO complaint_history (complaint_id, old_status, new_status, changed_by_id, changed_by_role, remarks, changed_at)
        VALUES (?, NULL, 'open', ?, 'citizen', 'Complaint lodged', ?)
      `, [cid, user_id, created_at]).catch(() => {});

      // History: status change if not open
      if (c.status !== 'open') {
        await db.query(`
          INSERT INTO complaint_history (complaint_id, old_status, new_status, changed_by_id, changed_by_role, remarks, changed_at)
          VALUES (?, 'open', ?, 1, 'admin', 'Status updated', NOW())
        `, [cid, c.status]).catch(() => {});
      }

      results.push({ complaint_no, title: c.title, status: c.status, priority: c.priority });
      inserted++;
      await new Promise(r => setTimeout(r, 20));
    }

    res.json({ success: true, message: `✅ Seeded ${inserted} demo complaints successfully.`, data: results });
  } catch (err) {
    console.error('Seed error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  deleteOfficial,
  getCategories,
  createCategory,
  deleteCategory,
  getSubcategories,
  createSubcategory,
  deleteSubcategory,
  getOfficials,
  createOfficial,
  updateOfficial,
  getUsers,
  deactivateUser,
  activateUser,
  deleteUser,
  getDeletedUsers,
  getUserLogs,
  getStates,
  createState,
  deleteState,
  getAnalytics,
  getHeatmapData,
  getDistricts,
  createDistrict,
  deleteDistrict,
  seedDistricts,
  getMandals,
  createMandal,
  deleteMandal,
  seedMandals,
  bulkAssign,
  getOfficialPerformance,
  getCategoryHeatmap,
  getMonthlyReport,
  seedDemoComplaints,
};
