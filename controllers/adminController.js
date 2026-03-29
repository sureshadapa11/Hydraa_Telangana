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
      SELECT id, name, category_id, created_at FROM subcategories 
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
    res.status(500).json({ success: false, message: 'Server error.' });
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
      SELECT id, full_name, email, phone, is_verified, created_at 
      FROM users ORDER BY created_at DESC
    `);

    res.json({
      success: true,
      data: users,
    });
  } catch (err) {
    console.error('Get users error:', err);
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
    const [states] = await db.query(`
      SELECT id, state_name FROM states ORDER BY state_name ASC
    `);

    res.json({
      success: true,
      data: states,
    });
  } catch (err) {
    console.error('Get states error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = {
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
  getUserLogs,
  getStates,
};
