// =====================================================
//   HYDRAA — complaintController.js EMAIL PATCHES
//   These are the 3 functions to UPDATE in your existing
//   backend/controllers/complaintController.js
//   Add the email imports at the top, then replace
//   the 3 functions below.
// =====================================================

// ── ADD THESE IMPORTS AT THE TOP of complaintController.js ──
// const { sendComplaintConfirmation, sendComplaintAssigned, sendStatusUpdate, sendSafe } = require('../utils/emailService');


// ══════════════════════════════════════════════════════════
//  REPLACE: lodgeComplaint
// ══════════════════════════════════════════════════════════
const lodgeComplaint = async (req, res) => {
  const { title, description, category_id, subcategory_id, state_id, address, priority, location_lat, location_lng } = req.body;
  const user_id    = req.user.id;
  const attachment = req.file ? req.file.filename : null;

  if (!title || !description || !category_id)
    return res.status(400).json({ success: false, message: 'Title, description and category are required.' });

  try {
    const { classifyComplaint } = require('../utils/aiClassifier');
    const aiResult       = classifyComplaint(title, description);
    const finalPriority  = priority || aiResult.suggested_priority;
    const complaint_no   = 'HYD' + Date.now().toString().slice(-7);

    await db.query(
      `INSERT INTO complaints
       (complaint_no, user_id, category_id, subcategory_id, state_id, title, description,
        address, attachment, priority, suggested_category, suggested_department,
        confidence_score, due_date, sla_days, location_lat, location_lng, org_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [complaint_no, user_id, category_id, subcategory_id || null, state_id || null,
       title, description, address || null, attachment, finalPriority,
       aiResult.suggested_category, aiResult.suggested_department,
       aiResult.confidence_score, aiResult.due_date, aiResult.sla_days,
       location_lat || null, location_lng || null]
    );

    await db.query('INSERT INTO user_logs (user_id, action, ip_address) VALUES (?, ?, ?)',
      [user_id, `LODGE_COMPLAINT:${complaint_no}`, req.ip]);

    // ── EMAIL: Send confirmation to citizen ──
    const [userRows] = await db.query('SELECT email, full_name FROM users WHERE id = ?', [user_id]);
    const [catRows]  = await db.query('SELECT name FROM categories WHERE id = ?', [category_id]);
    if (userRows.length > 0) {
      sendSafe(sendComplaintConfirmation, {
        to:           userRows[0].email,
        name:         userRows[0].full_name,
        complaint_no,
        title,
        category:     catRows[0]?.name || 'General',
        priority:     finalPriority,
        address:      address || 'Not specified',
      });
    }

    res.status(201).json({ success: true, message: 'Complaint lodged successfully!', complaint_no });
  } catch (err) {
    console.error('Lodge complaint error:', err);
    res.status(500).json({ success: false, message: 'Server error while lodging complaint.' });
  }
};


// ══════════════════════════════════════════════════════════
//  REPLACE: assignComplaint
// ══════════════════════════════════════════════════════════
const assignComplaint = async (req, res) => {
  const { id } = req.params;
  const { official_id, remarks } = req.body;
  const admin_id = req.user.id;

  try {
    const [[complaint]] = await db.query('SELECT * FROM complaints WHERE id = ?', [id]);
    if (!complaint)
      return res.status(404).json({ success: false, message: 'Complaint not found.' });

    await db.query('UPDATE complaints SET official_id = ?, status = ?, admin_remarks = ? WHERE id = ?',
      [official_id, 'assigned', remarks || null, id]);

    await db.query(
      'INSERT INTO complaint_history (complaint_id, changed_by_role, changed_by_id, old_status, new_status, remarks) VALUES (?, ?, ?, ?, ?, ?)',
      [id, 'admin', admin_id, complaint.status, 'assigned', remarks || 'Assigned to official']
    );

    // ── EMAIL: Notify citizen + official ──
    const [[citizenRow]]  = await db.query('SELECT u.email, u.full_name FROM users u WHERE u.id = ?', [complaint.user_id]);
    const [[officialRow]] = await db.query('SELECT email, full_name, department FROM officials WHERE id = ?', [official_id]);

    sendSafe(sendComplaintAssigned, {
      citizenEmail:  citizenRow?.email,
      citizenName:   citizenRow?.full_name,
      officialEmail: officialRow?.email,
      officialName:  officialRow?.full_name,
      complaint_no:  complaint.complaint_no,
      title:         complaint.title,
      remarks:       remarks || '',
      department:    officialRow?.department || 'HYDRAA',
    });

    res.json({ success: true, message: 'Complaint assigned successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};


// ══════════════════════════════════════════════════════════
//  REPLACE: resolveComplaint  (official updates status)
// ══════════════════════════════════════════════════════════
const resolveComplaint = async (req, res) => {
  const { id } = req.params;
  const { status, remarks } = req.body;
  const official_id = req.user.id;

  try {
    const [[complaint]] = await db.query(
      'SELECT * FROM complaints WHERE id = ? AND official_id = ?', [id, official_id]
    );
    if (!complaint)
      return res.status(404).json({ success: false, message: 'Not found or not assigned to you.' });

    const resolved_at = status === 'resolved' ? new Date() : null;
    await db.query('UPDATE complaints SET status = ?, official_remarks = ?, resolved_at = ? WHERE id = ?',
      [status, remarks || null, resolved_at, id]);

    await db.query(
      'INSERT INTO complaint_history (complaint_id, changed_by_role, changed_by_id, old_status, new_status, remarks) VALUES (?, ?, ?, ?, ?, ?)',
      [id, 'official', official_id, complaint.status, status, remarks]
    );

    // ── EMAIL: Notify citizen of status update ──
    const [[citizenRow]]  = await db.query('SELECT email, full_name FROM users WHERE id = ?', [complaint.user_id]);
    const [[officialRow]] = await db.query('SELECT full_name FROM officials WHERE id = ?', [official_id]);

    if (citizenRow) {
      sendSafe(sendStatusUpdate, {
        to:           citizenRow.email,
        name:         citizenRow.full_name,
        complaint_no: complaint.complaint_no,
        title:        complaint.title,
        oldStatus:    complaint.status,
        newStatus:    status,
        remarks:      remarks || '',
        officialName: officialRow?.full_name || 'HYDRAA Official',
      });
    }

    res.json({ success: true, message: 'Updated successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};


// ══════════════════════════════════════════════════════════
//  REPLACE: updateComplaintStatus  (admin updates status)
// ══════════════════════════════════════════════════════════
const updateComplaintStatus = async (req, res) => {
  const { id } = req.params;
  const { status, remarks } = req.body;
  const admin_id = req.user.id;

  try {
    const [[complaint]] = await db.query('SELECT * FROM complaints WHERE id = ?', [id]);
    if (!complaint)
      return res.status(404).json({ success: false, message: 'Complaint not found.' });

    const resolved_at = status === 'resolved' ? new Date() : null;
    await db.query('UPDATE complaints SET status = ?, admin_remarks = ?, resolved_at = ? WHERE id = ?',
      [status, remarks || null, resolved_at, id]);

    await db.query(
      'INSERT INTO complaint_history (complaint_id, changed_by_role, changed_by_id, old_status, new_status, remarks) VALUES (?, ?, ?, ?, ?, ?)',
      [id, 'admin', admin_id, complaint.status, status, remarks]
    );

    // ── EMAIL: Notify citizen of status change by admin ──
    const [[citizenRow]] = await db.query('SELECT email, full_name FROM users WHERE id = ?', [complaint.user_id]);
    if (citizenRow) {
      sendSafe(sendStatusUpdate, {
        to:           citizenRow.email,
        name:         citizenRow.full_name,
        complaint_no: complaint.complaint_no,
        title:        complaint.title,
        oldStatus:    complaint.status,
        newStatus:    status,
        remarks:      remarks || '',
        officialName: 'HYDRAA Administration',
      });
    }

    res.json({ success: true, message: 'Status updated.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};


module.exports = {
  lodgeComplaint,
  assignComplaint,
  resolveComplaint,
  updateComplaintStatus,
  // ... keep all your other existing exports unchanged
};
