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
    const [[user]] = await db.query('SELECT id, email, full_name FROM users WHERE id = ?', [id]);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    // Delete related records first to avoid FK constraint errors
    const [comp] = await db.query('SELECT id FROM complaints WHERE user_id = ?', [id]);
    if (comp.length > 0) {
      const cIds = comp.map(c => c.id);
      await db.query('DELETE FROM complaint_photos   WHERE complaint_id IN (?)', [cIds]);
      await db.query('DELETE FROM complaint_comments WHERE complaint_id IN (?)', [cIds]);
      await db.query('DELETE FROM complaint_timeline WHERE complaint_id IN (?)', [cIds]).catch(() => {});
      await db.query('DELETE FROM complaint_ratings  WHERE complaint_id IN (?)', [cIds]).catch(() => {});
      await db.query('DELETE FROM complaints WHERE user_id = ?', [id]);
    }

    await db.query('DELETE FROM users WHERE id = ?', [id]);

    // Notify the user by email (non-blocking)
    await sendSafe(sendAccountDeleted, { to: user.email, name: user.full_name || 'Citizen' });

    res.json({ success: true, message: 'User and all associated complaints deleted.' });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ success: false, message: err.message || 'Server error.' });
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
      SELECT d.name AS district, COUNT(c.id) AS total,
             SUM(c.status = 'resolved') AS resolved,
             SUM(c.status NOT IN ('resolved','closed','rejected')) AS pending
      FROM complaints c JOIN districts d ON c.district_id = d.id
      WHERE YEAR(c.created_at) = ? AND MONTH(c.created_at) = ?
      GROUP BY d.name ORDER BY total DESC
    `, [y, m]);

    const [byCategory] = await db.query(`
      SELECT cat.name AS category, COUNT(c.id) AS total,
             SUM(c.status = 'resolved') AS resolved
      FROM complaints c JOIN categories cat ON c.category_id = cat.id
      WHERE YEAR(c.created_at) = ? AND MONTH(c.created_at) = ?
      GROUP BY cat.name ORDER BY total DESC
    `, [y, m]);

    const [byOfficial] = await db.query(`
      SELECT o.full_name AS official, COUNT(c.id) AS assigned,
             SUM(c.status = 'resolved') AS resolved,
             SUM(c.status = 'rejected') AS rejected
      FROM complaints c JOIN officials o ON c.official_id = o.id
      WHERE YEAR(c.created_at) = ? AND MONTH(c.created_at) = ?
      GROUP BY o.full_name ORDER BY resolved DESC
    `, [y, m]);

    const [dailyTrend] = await db.query(`
      SELECT DAY(created_at) AS day, COUNT(*) AS total
      FROM complaints
      WHERE YEAR(created_at) = ? AND MONTH(created_at) = ?
      GROUP BY DAY(created_at) ORDER BY day
    `, [y, m]);

    const monthName = new Date(y, m - 1, 1).toLocaleString('default', { month: 'long' });

    res.json({ success: true, data: { year: y, month: m, monthName, summary, byDistrict, byCategory, byOfficial, dailyTrend } });
  } catch (err) {
    console.error('Monthly report error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
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
};
