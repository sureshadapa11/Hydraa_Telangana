// =====================================================
//   Complaint Controller — HYDRAA
//   Handles complaint lodge, track, retrieval, rating
// =====================================================

const db = require('../utils/db');
const { v4: uuidv4 } = require('uuid');
const {
  sendComplaintNotification,
  sendComplaintStatusUpdate,
  sendSafe,
} = require('../utils/emailService');

// ────────────────────────────────────────────────────
//  LODGE COMPLAINT
// ────────────────────────────────────────────────────
const lodgeComplaint = async (req, res) => {
  const { title, description, category_id, subcategory_id, priority, state_id, address } = req.body;
  const user_id = req.user.id;

  const missing = [];
  if (!title) missing.push('Title');
  if (!description) missing.push('Description');
  if (!category_id) missing.push('Category');
  if (!address) missing.push('Address');
  if (missing.length > 0) {
    return res.status(400).json({ success: false, message: `Missing: ${missing.join(', ')}` });
  }

  try {
    // Generate unique complaint number
    const complaint_no = `HYD${Date.now()}${Math.floor(Math.random() * 1000)}`;

    // Insert complaint
    const [result] = await db.query(
      `INSERT INTO complaints (
        complaint_no, user_id, title, description, category_id, subcategory_id,
        priority, state_id, address, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [complaint_no, user_id, title, description, category_id || null, subcategory_id || null, priority || 'medium', state_id || null, address, 'open']
    );

    const complaint_id = result.insertId;

    // Insert initial status history
    await db.query(
      `INSERT INTO complaint_history (complaint_id, old_status, new_status, changed_by_id, changed_by_role, remarks) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [complaint_id, 'draft', 'open', user_id, 'user', 'Complaint lodged']
    );

    // Get user details for email
    const [users] = await db.query('SELECT full_name, email FROM users WHERE id = ?', [user_id]);
    const user = users[0];

    // Send confirmation email (non-blocking)
    sendSafe(sendComplaintNotification, {
      to: user.email,
      name: user.full_name,
      complaintNo: complaint_no,
      title,
      priority,
    });

    res.status(201).json({
      success: true,
      message: 'Complaint lodged successfully!',
      data: {
        complaint_id,
        complaint_no,
        status: 'open',
      },
    });
  } catch (err) {
    console.error('Lodge complaint error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ────────────────────────────────────────────────────
//  TRACK COMPLAINT
// ────────────────────────────────────────────────────
const trackComplaint = async (req, res) => {
  const { complaint_no } = req.params;

  if (!complaint_no) {
    return res.status(400).json({ success: false, message: 'Complaint number required.' });
  }

  try {
    const query = `
      SELECT 
        c.id, c.complaint_no, c.title, c.description, c.status, c.priority,
        c.category_id, cat.name as category_name,
        c.subcategory_id, subcat.name as subcategory_name,
        c.state_id, s.state_name,
        c.address, c.created_at, c.resolved_at,
        c.official_id, o.full_name as official_name, o.department,
        c.admin_remarks, c.official_remarks
      FROM complaints c
      LEFT JOIN categories cat ON c.category_id = cat.id
      LEFT JOIN subcategories subcat ON c.subcategory_id = subcat.id
      LEFT JOIN states s ON c.state_id = s.id
      LEFT JOIN officials o ON c.official_id = o.id
      WHERE c.complaint_no = ?
    `;

    const [complaints] = await db.query(query, [complaint_no]);

    if (complaints.length === 0) {
      return res.status(404).json({ success: false, message: 'Complaint not found.' });
    }

    const complaint = complaints[0];

    // Get status history
    const [history] = await db.query(
      `SELECT old_status, new_status, changed_by_role, remarks, changed_at 
       FROM complaint_history 
       WHERE complaint_id = ? 
       ORDER BY changed_at ASC`,
      [complaint.id]
    );

    res.json({
      success: true,
      data: {
        complaint,
        history,
      },
    });
  } catch (err) {
    console.error('Track complaint error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ────────────────────────────────────────────────────
//  GET MY COMPLAINTS
// ────────────────────────────────────────────────────
const getMyComplaints = async (req, res) => {
  const user_id = req.user.id;

  try {
    const [complaints] = await db.query(
      `SELECT 
        c.id, c.complaint_no, c.title, c.description, c.status, c.priority,
        c.category_id, cat.name as category_name,
        c.created_at, c.resolved_at,
        c.official_id, o.full_name as official_name
      FROM complaints c
      LEFT JOIN categories cat ON c.category_id = cat.id
      LEFT JOIN officials o ON c.official_id = o.id
      WHERE c.user_id = ?
      ORDER BY c.created_at DESC`,
      [user_id]
    );

    res.json({
      success: true,
      data: complaints,
    });
  } catch (err) {
    console.error('Get my complaints error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ────────────────────────────────────────────────────
//  RATE COMPLAINT
// ────────────────────────────────────────────────────
const rateComplaint = async (req, res) => {
  const { complaint_id, rating, comment } = req.body;
  const user_id = req.user.id;

  if (!complaint_id || !rating || rating < 1 || rating > 5) {
    return res.status(400).json({
      success: false,
      message: 'Valid complaint ID and rating (1-5) are required.',
    });
  }

  try {
    // Check complaint belongs to user
    const [complaints] = await db.query(
      'SELECT email, full_name FROM users WHERE id = ? AND id IN (SELECT user_id FROM complaints WHERE id = ?)',
      [user_id, complaint_id]
    );

    if (complaints.length === 0) {
      return res.status(403).json({ success: false, message: 'Unauthorized.' });
    }

    // Insert/update rating
    await db.query(
      `INSERT INTO complaint_ratings (complaint_id, user_id, rating, comment, created_at)
       VALUES (?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE rating = ?, comment = ?, updated_at = NOW()`,
      [complaint_id, user_id, rating, comment || null, rating, comment || null]
    );

    res.json({
      success: true,
      message: 'Thank you for your feedback!',
    });
  } catch (err) {
    console.error('Rate complaint error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ────────────────────────────────────────────────────
//  ADMIN: GET DASHBOARD DATA
// ────────────────────────────────────────────────────
const getAdminDashboard = async (req, res) => {
  try {
    // Status counts
    const [statusCounts] = await db.query(`
      SELECT status, COUNT(*) as count FROM complaints GROUP BY status
    `);

    // Priority distribution
    const [priorityCounts] = await db.query(`
      SELECT priority, COUNT(*) as count FROM complaints GROUP BY priority
    `);

    // Recent complaints
    const [recentComplaints] = await db.query(`
      SELECT 
        c.id, c.complaint_no, c.title, c.status, c.priority, c.created_at,
        u.full_name, cat.name as category_name
      FROM complaints c
      JOIN users u ON c.user_id = u.id
      LEFT JOIN categories cat ON c.category_id = cat.id
      ORDER BY c.created_at DESC
      LIMIT 10
    `);

    // Official assignment stats
    const [officialStats] = await db.query(`
      SELECT o.full_name, COUNT(c.id) as complaints_handled
      FROM officials o
      LEFT JOIN complaints c ON o.id = c.official_id
      GROUP BY o.id
      ORDER BY complaints_handled DESC
      LIMIT 5
    `);

    res.json({
      success: true,
      data: {
        statusCounts: statusCounts.reduce((acc, s) => ({ ...acc, [s.status]: s.count }), {}),
        priorityCounts: priorityCounts.reduce((acc, p) => ({ ...acc, [p.priority]: p.count }), {}),
        recentComplaints,
        officialStats,
        totalComplaints: statusCounts.reduce((sum, s) => sum + s.count, 0),
        unresolvedComplaints: statusCounts.find(s => s.status !== 'resolved')?.count || 0,
      },
    });
  } catch (err) {
    console.error('Get admin dashboard error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ────────────────────────────────────────────────────
//  ADMIN: ASSIGN COMPLAINT
// ────────────────────────────────────────────────────
const assignComplaint = async (req, res) => {
  const { id } = req.params;
  const { official_id, remarks } = req.body;
  const admin_id = req.user.id;

  if (!official_id) {
    return res.status(400).json({ success: false, message: 'Official ID required.' });
  }

  try {
    // Get current complaint
    const [complaints] = await db.query('SELECT status FROM complaints WHERE id = ?', [id]);
    if (complaints.length === 0) {
      return res.status(404).json({ success: false, message: 'Complaint not found.' });
    }

    // Update complaint
    await db.query(
      'UPDATE complaints SET official_id = ?, status = ?, admin_remarks = ? WHERE id = ?',
      [official_id, 'assigned', remarks || null, id]
    );

    // Log status change
    await db.query(
      `INSERT INTO complaint_history (complaint_id, old_status, new_status, changed_by_id, changed_by_role, remarks)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, complaints[0].status, 'assigned', admin_id, 'admin', remarks || 'Assigned to official']
    );

    res.json({
      success: true,
      message: 'Complaint assigned successfully.',
    });
  } catch (err) {
    console.error('Assign complaint error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ────────────────────────────────────────────────────
//  ADMIN: UPDATE COMPLAINT STATUS
// ────────────────────────────────────────────────────
const updateComplaintStatus = async (req, res) => {
  const { id } = req.params;
  const { status, remarks } = req.body;
  const admin_id = req.user.id;

  if (!status) {
    return res.status(400).json({ success: false, message: 'Status required.' });
  }

  try {
    // Get current complaint
    const [complaints] = await db.query('SELECT status, user_id FROM complaints WHERE id = ?', [id]);
    if (complaints.length === 0) {
      return res.status(404).json({ success: false, message: 'Complaint not found.' });
    }

    const oldStatus = complaints[0].status;
    const resolved_at = (status === 'resolved') ? new Date() : null;

    // Update complaint
    await db.query(
      'UPDATE complaints SET status = ?, admin_remarks = ?, resolved_at = ? WHERE id = ?',
      [status, remarks || null, resolved_at, id]
    );

    // Log status change
    await db.query(
      `INSERT INTO complaint_history (complaint_id, old_status, new_status, changed_by_id, changed_by_role, remarks)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, oldStatus, status, admin_id, 'admin', remarks]
    );

    // Send email to user (non-blocking)
    const [users] = await db.query('SELECT email, full_name FROM users WHERE id = ?', [complaints[0].user_id]);
    if (users.length > 0) {
      sendSafe(sendComplaintStatusUpdate, {
        to: users[0].email,
        name: users[0].full_name,
        status,
        remarks,
      });
    }

    res.json({
      success: true,
      message: 'Status updated successfully.',
    });
  } catch (err) {
    console.error('Update complaint status error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ────────────────────────────────────────────────────
//  OFFICIAL: GET ASSIGNED COMPLAINTS
// ────────────────────────────────────────────────────
const getOfficialComplaints = async (req, res) => {
  const official_id = req.user.id;

  try {
    const [complaints] = await db.query(
      `SELECT 
        c.id, c.complaint_no, c.title, c.description, c.status, c.priority,
        c.category_id, cat.name as category_name,
        c.created_at, c.address,
        u.full_name as user_name, u.email as user_email
      FROM complaints c
      JOIN users u ON c.user_id = u.id
      LEFT JOIN categories cat ON c.category_id = cat.id
      WHERE c.official_id = ?
      ORDER BY c.status ASC, c.created_at DESC`,
      [official_id]
    );

    res.json({
      success: true,
      data: complaints,
    });
  } catch (err) {
    console.error('Get official complaints error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ────────────────────────────────────────────────────
//  OFFICIAL: RESOLVE COMPLAINT
// ────────────────────────────────────────────────────
const resolveComplaint = async (req, res) => {
  const { id } = req.params;
  const { status, remarks } = req.body;
  const official_id = req.user.id;

  if (!status || !['resolved', 'rejected'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Valid status required.' });
  }

  try {
    // Get current complaint
    const [complaints] = await db.query('SELECT status, user_id FROM complaints WHERE id = ? AND official_id = ?', [id, official_id]);
    if (complaints.length === 0) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }

    const oldStatus = complaints[0].status;
    const resolved_at = (status === 'resolved') ? new Date() : null;

    // Update complaint
    await db.query(
      'UPDATE complaints SET status = ?, official_remarks = ?, resolved_at = ? WHERE id = ?',
      [status, remarks || null, resolved_at, id]
    );

    // Log status change
    await db.query(
      `INSERT INTO complaint_history (complaint_id, old_status, new_status, changed_by_id, changed_by_role, remarks)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, oldStatus, status, official_id, 'official', remarks]
    );

    res.json({
      success: true,
      message: 'Complaint updated successfully.',
    });
  } catch (err) {
    console.error('Resolve complaint error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = {
  lodgeComplaint,
  trackComplaint,
  getMyComplaints,
  rateComplaint,
  getAdminDashboard,
  assignComplaint,
  updateComplaintStatus,
  getOfficialComplaints,
  resolveComplaint,
};
