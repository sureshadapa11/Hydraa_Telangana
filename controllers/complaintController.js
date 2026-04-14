// =====================================================
//   Complaint Controller — HYDRAA
//   Handles complaint lodge, track, retrieval, rating
// =====================================================

const db = require('../utils/db');
const { v4: uuidv4 } = require('uuid');
const {
  sendComplaintNotification,
  sendComplaintStatusUpdate,
  sendComplaintAssigned,
  sendStatusUpdate,
  sendSafe,
} = require('../utils/emailService');
const { notifyStatusChange, notifyComplaintLodged } = require('../utils/whatsapp');

// ────────────────────────────────────────────────────
//  LODGE COMPLAINT
// ────────────────────────────────────────────────────
const lodgeComplaint = async (req, res) => {
  const { title, description, category_id, subcategory_id, priority, address, district_id, mandal_id, land_district, land_mandal, land_village, land_address, land_survey_no, khata_no } = req.body;
  const user_id = req.user.id;

  const missing = [];
  if (!title) missing.push('Title');
  if (!description) missing.push('Description');
  if (!category_id) missing.push('Category');
  if (!address) missing.push('Address');
  if (!district_id) missing.push('District');
  if (missing.length > 0) {
    return res.status(400).json({ success: false, message: `Missing: ${missing.join(', ')}` });
  }

  try {
    // ── Duplicate detection ──
    const [dupes] = await db.query(
      `SELECT complaint_no, title FROM complaints
       WHERE user_id = ? AND category_id = ? AND district_id = ?
         AND status NOT IN ('resolved','closed','rejected')
       LIMIT 1`,
      [user_id, category_id, district_id]
    );
    if (dupes.length > 0 && !req.body.force_submit) {
      return res.status(409).json({
        success: false,
        duplicate: true,
        message: `You already have an open complaint in this category and district.`,
        existing: { complaint_no: dupes[0].complaint_no, title: dupes[0].title },
      });
    }

    // Generate unique complaint number
    const complaint_no = `HYD${Date.now()}${Math.floor(Math.random() * 1000)}`;

    // Insert complaint
    const [result] = await db.query(
      `INSERT INTO complaints (
        complaint_no, user_id, title, description, category_id, subcategory_id,
        priority, address, district_id, mandal_id, status,
        land_district, land_mandal, land_village, land_address, land_survey_no, khata_no, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [complaint_no, user_id, title, description, category_id || null, subcategory_id || null,
       priority || 'medium', address, district_id || null, mandal_id || null, 'open',
       land_district || null, land_mandal || null, land_village || null,
       land_address || null, land_survey_no || null, khata_no || null]
    );

    const complaint_id = result.insertId;

    // Insert status history (non-fatal)
    try {
      await db.query(
        `INSERT INTO complaint_history (complaint_id, old_status, new_status, changed_by_id, changed_by_role, remarks)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [complaint_id, null, 'open', user_id, 'user', 'Complaint lodged']
      );
    } catch (e) { console.warn('complaint_history insert skipped:', e.message); }

    // Send confirmation email + WhatsApp (non-blocking, non-fatal)
    try {
      const [users] = await db.query('SELECT full_name, email, phone FROM users WHERE id = ?', [user_id]);
      if (users[0]) {
        sendSafe(sendComplaintNotification, {
          to: users[0].email,
          name: users[0].full_name,
          complaintNo: complaint_no,
          title,
          priority,
        });
        notifyComplaintLodged({ phone: users[0].phone, complaintNo: complaint_no, title });
      }
    } catch (e) { /* email non-critical */ }

    res.status(201).json({
      success: true,
      message: 'Complaint lodged successfully!',
      data: { complaint_id, complaint_no, status: 'open' },
    });
  } catch (err) {
    console.error('Lodge complaint error:', err.message);
    res.status(500).json({ success: false, message: err.message || 'Server error.' });
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
        c.official_id, o.full_name as official_name,
        c.land_district, c.land_mandal, c.land_village, c.land_address, c.land_survey_no, c.khata_no
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
    const [statusRows] = await db.query(`SELECT status, COUNT(*) as count FROM complaints GROUP BY status`);
    const sc = statusRows.reduce((acc, s) => ({ ...acc, [s.status]: Number(s.count) }), {});
    const total = statusRows.reduce((sum, s) => sum + Number(s.count), 0);

    // Overdue: open/assigned complaints older than 7 days
    const [[{ overdue }]] = await db.query(
      `SELECT COUNT(*) as overdue FROM complaints WHERE status NOT IN ('resolved','closed','rejected') AND created_at < DATE_SUB(NOW(), INTERVAL 7 DAY)`
    );

    // Today's complaints
    const [[{ today }]] = await db.query(
      `SELECT COUNT(*) as today FROM complaints WHERE DATE(created_at) = CURDATE()`
    );

    // Resolved this week
    const [[{ this_week }]] = await db.query(
      `SELECT COUNT(*) as this_week FROM complaints WHERE status = 'resolved' AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`
    );

    // Total users & officials
    const [[{ total_users }]] = await db.query(`SELECT COUNT(*) as total_users FROM users`);
    const [[{ total_officials }]] = await db.query(`SELECT COUNT(*) as total_officials FROM officials WHERE is_active = 1`);

    // Avg rating
    const [[{ avg_rating }]] = await db.query(`SELECT ROUND(AVG(rating),1) as avg_rating FROM complaint_ratings`);

    // District breakdown (top 6)
    const [district_stats] = await db.query(`
      SELECT d.name AS district, COUNT(*) AS total,
             SUM(CASE WHEN c.status = 'resolved' THEN 1 ELSE 0 END) AS resolved,
             SUM(CASE WHEN c.status NOT IN ('resolved','closed','rejected') THEN 1 ELSE 0 END) AS pending
      FROM complaints c
      LEFT JOIN districts d ON c.district_id = d.id
      WHERE d.name IS NOT NULL
      GROUP BY c.district_id, d.name
      ORDER BY total DESC LIMIT 6
    `);

    // Priority breakdown
    const [priority_stats] = await db.query(
      `SELECT priority, COUNT(*) as count FROM complaints GROUP BY priority`
    );

    // Recent complaints
    const [recent] = await db.query(`
      SELECT c.id, c.complaint_no, c.title, c.status, c.priority, c.created_at,
        u.full_name as user_name, cat.name as category_name
      FROM complaints c
      JOIN users u ON c.user_id = u.id
      LEFT JOIN categories cat ON c.category_id = cat.id
      ORDER BY c.created_at DESC LIMIT 10
    `);

    res.json({
      success: true,
      data: {
        complaints: {
          total,
          open:        sc.open        || 0,
          pending:     sc.open        || 0,
          assigned:    sc.assigned    || 0,
          in_progress: sc.in_progress || 0,
          resolved:    sc.resolved    || 0,
          closed:      sc.closed      || 0,
          rejected:    sc.rejected    || 0,
          overdue:     Number(overdue) || 0,
          today:       Number(today)   || 0,
          this_week:   Number(this_week) || 0,
        },
        total_users:    Number(total_users)    || 0,
        total_officials: Number(total_officials) || 0,
        avg_rating:     avg_rating || 0,
        district_stats,
        priority_stats,
        recent,
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

    // Send emails to citizen + official (non-blocking)
    try {
      const [[emailData]] = await db.query(
        `SELECT c.complaint_no, c.title,
                u.email AS citizen_email, u.full_name AS citizen_name,
                o.email AS official_email, o.full_name AS official_name, o.department
         FROM complaints c
         JOIN users u ON c.user_id = u.id
         JOIN officials o ON o.id = ?
         WHERE c.id = ?`,
        [official_id, id]
      );
      if (emailData) {
        sendSafe(sendComplaintAssigned, {
          citizenEmail: emailData.citizen_email,
          citizenName:  emailData.citizen_name,
          officialEmail: emailData.official_email,
          officialName:  emailData.official_name,
          complaint_no:  emailData.complaint_no,
          title:         emailData.title,
          remarks:       remarks,
          department:    emailData.department,
        });
      }
    } catch (e) { /* email non-critical */ }

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
  const { status, remarks, priority } = req.body;
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

    // Update complaint (with optional priority change)
    if (priority) {
      await db.query(
        'UPDATE complaints SET status = ?, admin_remarks = ?, resolved_at = ?, priority = ? WHERE id = ?',
        [status, remarks || null, resolved_at, priority, id]
      );
    } else {
      await db.query(
        'UPDATE complaints SET status = ?, admin_remarks = ?, resolved_at = ? WHERE id = ?',
        [status, remarks || null, resolved_at, id]
      );
    }

    // Log status change
    await db.query(
      `INSERT INTO complaint_history (complaint_id, old_status, new_status, changed_by_id, changed_by_role, remarks)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, oldStatus, status, admin_id, 'admin', remarks]
    );

    // Send email + WhatsApp to user (non-blocking)
    const [users] = await db.query('SELECT email, full_name, phone FROM users WHERE id = ?', [complaints[0].user_id]);
    if (users.length > 0) {
      sendSafe(sendComplaintStatusUpdate, {
        to: users[0].email,
        name: users[0].full_name,
        status,
        remarks,
      });
      const [[comp]] = await db.query('SELECT complaint_no FROM complaints WHERE id = ?', [id]);
      notifyStatusChange({ phone: users[0].phone, complaintNo: comp?.complaint_no, oldStatus, newStatus: status, remarks });
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
        u.full_name as user_name, u.email as user_email,
        c.land_district, c.land_mandal, c.land_village, c.land_address, c.land_survey_no, c.khata_no,
        d.name as district_name, m.name as mandal_name
      FROM complaints c
      JOIN users u ON c.user_id = u.id
      LEFT JOIN categories cat ON c.category_id = cat.id
      LEFT JOIN districts d ON c.district_id = d.id
      LEFT JOIN mandals m ON c.mandal_id = m.id
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
  const { status, remarks, priority } = req.body;
  const official_id = req.user.id;

  const validStatuses = ['in_progress', 'resolved', 'rejected', 'closed'];
  if (!status || !validStatuses.includes(status)) {
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

    // Update complaint (with optional priority change)
    if (priority) {
      await db.query(
        'UPDATE complaints SET status = ?, official_remarks = ?, resolved_at = ?, priority = ? WHERE id = ?',
        [status, remarks || null, resolved_at, priority, id]
      );
    } else {
      await db.query(
        'UPDATE complaints SET status = ?, official_remarks = ?, resolved_at = ? WHERE id = ?',
        [status, remarks || null, resolved_at, id]
      );
    }

    // Log status change
    await db.query(
      `INSERT INTO complaint_history (complaint_id, old_status, new_status, changed_by_id, changed_by_role, remarks)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, oldStatus, status, official_id, 'official', remarks]
    );

    // Send email to citizen (non-blocking)
    try {
      const [[comp]] = await db.query(
        `SELECT c.complaint_no, c.title, u.email, u.full_name, of.full_name AS official_name
         FROM complaints c JOIN users u ON c.user_id = u.id
         LEFT JOIN officials of ON of.id = ?
         WHERE c.id = ?`, [official_id, id]
      );
      if (comp) {
        sendSafe(sendStatusUpdate, {
          to: comp.email, name: comp.full_name,
          complaint_no: comp.complaint_no, title: comp.title,
          oldStatus, newStatus: status, remarks,
          officialName: comp.official_name,
        });
      }
    } catch (e) { /* email non-critical */ }

    res.json({
      success: true,
      message: 'Complaint updated successfully.',
    });
  } catch (err) {
    console.error('Resolve complaint error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ────────────────────────────────────────────────────
//  ADMIN: GET ALL COMPLAINTS
// ────────────────────────────────────────────────────
const getAllComplaints = async (req, res) => {
  const { status, category_id, district_id, priority, search, date_from, date_to, limit = 200 } = req.query;

  try {
    let where = '1=1';
    const params = [];
    if (status)      { where += ' AND c.status = ?';      params.push(status); }
    if (category_id) { where += ' AND c.category_id = ?'; params.push(category_id); }
    if (district_id) { where += ' AND c.district_id = ?'; params.push(district_id); }
    if (priority)    { where += ' AND c.priority = ?';    params.push(priority); }
    if (search)      { where += ' AND (c.complaint_no LIKE ? OR c.title LIKE ? OR u.full_name LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
    if (date_from)   { where += ' AND DATE(c.created_at) >= ?'; params.push(date_from); }
    if (date_to)     { where += ' AND DATE(c.created_at) <= ?'; params.push(date_to); }

    const [complaints] = await db.query(
      `SELECT
        c.id, c.complaint_no, c.title, c.description, c.status, c.priority,
        c.category_id, cat.name AS category_name,
        c.subcategory_id, subcat.name AS subcategory_name,
        c.address, c.created_at, c.resolved_at,
        c.official_id, o.full_name AS official_name,
        c.admin_remarks, c.official_remarks,
        u.full_name AS user_name, u.email AS user_email,
        d.name AS district_name, m.name AS mandal_name,
        c.land_district, c.land_mandal, c.land_village, c.land_address, c.land_survey_no, c.khata_no
      FROM complaints c
      JOIN users u ON c.user_id = u.id
      LEFT JOIN categories cat ON c.category_id = cat.id
      LEFT JOIN subcategories subcat ON c.subcategory_id = subcat.id
      LEFT JOIN officials o ON c.official_id = o.id
      LEFT JOIN districts d ON c.district_id = d.id
      LEFT JOIN mandals m ON c.mandal_id = m.id
      WHERE ${where}
      ORDER BY c.created_at DESC
      LIMIT ?`,
      [...params, parseInt(limit)]
    );

    res.json({ success: true, data: complaints });
  } catch (err) {
    console.error('Get all complaints error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ────────────────────────────────────────────────────
//  GET COMMENTS FOR A COMPLAINT
// ────────────────────────────────────────────────────
const getComments = async (req, res) => {
  const { id } = req.params;
  const role = req.user?.role;
  try {
    // Citizens only see non-internal comments
    const where = (role === 'user') ? 'complaint_id = ? AND is_internal = 0' : 'complaint_id = ?';
    const [comments] = await db.query(
      `SELECT id, author_role, author_name, message, is_internal, created_at
       FROM complaint_comments WHERE ${where} ORDER BY created_at ASC`,
      [id]
    );
    res.json({ success: true, data: comments });
  } catch (err) {
    console.error('Get comments error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ────────────────────────────────────────────────────
//  ADD COMMENT / NOTE
// ────────────────────────────────────────────────────
const addComment = async (req, res) => {
  const { id } = req.params;
  const { message, is_internal = 0 } = req.body;
  const author_id   = req.user.id;
  const author_role = req.user.role;
  const author_name = req.user.full_name || req.user.username || req.user.email || 'User';

  if (!message || !message.trim()) {
    return res.status(400).json({ success: false, message: 'Message is required.' });
  }
  // Citizens cannot post internal notes
  if (author_role === 'user' && is_internal) {
    return res.status(403).json({ success: false, message: 'Not allowed.' });
  }

  try {
    // Verify complaint exists and requester has access
    const [rows] = await db.query('SELECT id, user_id, official_id FROM complaints WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Complaint not found.' });
    if (author_role === 'user' && rows[0].user_id !== author_id) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }

    await db.query(
      `INSERT INTO complaint_comments (complaint_id, author_id, author_role, author_name, message, is_internal, created_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [id, author_id, author_role, author_name, message.trim(), is_internal ? 1 : 0]
    );
    res.json({ success: true, message: 'Comment added.' });
  } catch (err) {
    console.error('Add comment error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ────────────────────────────────────────────────────
//  PHOTO UPLOAD (official/admin)
// ────────────────────────────────────────────────────
const uploadPhoto = async (req, res) => {
  const { id } = req.params;
  const { photo_data, caption } = req.body;
  const uploader_id   = req.user.id;
  const uploader_role = req.user.role;

  if (!photo_data) return res.status(400).json({ success: false, message: 'photo_data required.' });

  try {
    // Max 5 photos per complaint
    const [[cnt]] = await db.query('SELECT COUNT(*) AS c FROM complaint_photos WHERE complaint_id = ?', [id]);
    if (cnt.c >= 5) return res.status(400).json({ success: false, message: 'Max 5 photos per complaint.' });

    await db.query(
      `INSERT INTO complaint_photos (complaint_id, photo_data, caption, uploaded_by_id, uploaded_by_role)
       VALUES (?, ?, ?, ?, ?)`,
      [id, photo_data, caption || null, uploader_id, uploader_role]
    );
    res.json({ success: true, message: 'Photo uploaded.' });
  } catch (err) {
    console.error('Photo upload error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ────────────────────────────────────────────────────
//  GET PHOTOS
// ────────────────────────────────────────────────────
const getPhotos = async (req, res) => {
  const { id } = req.params;
  try {
    const [photos] = await db.query(
      `SELECT id, caption, uploaded_by_role, created_at, photo_data
       FROM complaint_photos WHERE complaint_id = ? ORDER BY created_at ASC`,
      [id]
    );
    res.json({ success: true, data: photos });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ────────────────────────────────────────────────────
//  CHECK DUPLICATE (called by frontend before submit)
// ────────────────────────────────────────────────────
const checkDuplicate = async (req, res) => {
  const { category_id, district_id } = req.query;
  const user_id = req.user.id;
  if (!category_id || !district_id) return res.json({ success: true, duplicate: false });
  try {
    const [dupes] = await db.query(
      `SELECT complaint_no, title FROM complaints
       WHERE user_id = ? AND category_id = ? AND district_id = ?
         AND status NOT IN ('resolved','closed','rejected') LIMIT 1`,
      [user_id, category_id, district_id]
    );
    if (dupes.length > 0) {
      return res.json({ success: true, duplicate: true, existing: { complaint_no: dupes[0].complaint_no, title: dupes[0].title } });
    }
    res.json({ success: true, duplicate: false });
  } catch (err) {
    res.json({ success: true, duplicate: false });
  }
};

module.exports = {
  lodgeComplaint,
  trackComplaint,
  getMyComplaints,
  rateComplaint,
  getAdminDashboard,
  getAllComplaints,
  assignComplaint,
  updateComplaintStatus,
  getOfficialComplaints,
  resolveComplaint,
  getComments,
  addComment,
  uploadPhoto,
  getPhotos,
  checkDuplicate,
};
