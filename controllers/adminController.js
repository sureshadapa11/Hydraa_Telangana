// =====================================================
//   Admin Controller — HYDRAA
//   Handles admin management functions
// =====================================================

const bcrypt = require('bcryptjs');
const db = require('../utils/db');
const { v4: uuidv4 } = require('uuid');

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
      SELECT id, full_name, email, phone, department, is_active, created_at 
      FROM officials ORDER BY full_name ASC
    `);

    res.json({
      success: true,
      data: officials,
    });
  } catch (err) {
    console.error('Get officials error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ────────────────────────────────────────────────────
//  OFFICIALS: CREATE
// ────────────────────────────────────────────────────
const createOfficial = async (req, res) => {
  const { full_name, email, phone, department, password } = req.body;

  if (!full_name || !email || !password || !department) {
    return res.status(400).json({
      success: false,
      message: 'Full name, email, password, and department are required.',
    });
  }

  try {
    // Check if email exists
    const [existing] = await db.query('SELECT id FROM officials WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'Email already in use.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await db.query(
      `INSERT INTO officials (full_name, email, phone, department, password, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, 1, NOW())`,
      [full_name, email, phone || null, department, hashedPassword]
    );

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
      SELECT u.id, u.full_name, u.email, u.phone, u.is_verified, u.created_at,
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
  getUserLogs,
  getStates,
  createState,
  deleteState,
  getAnalytics,
  getHeatmapData,
};
