// =====================================================
//   PATCH FILE: adminController.js SQL injection fixes
//   Apply these fixes to adminController.js
//   - bulkAssign: Fix SQL injection (line 972)
//   - permanentDeleteUser: Fix SQL injection (line 1152)
// =====================================================

// ✅ FIX 1: bulkAssign — Replace IN (${ids}) with parameterized placeholders
// BEFORE (line 972-1003):
// const bulkAssign = async (req, res) => {
//   const { complaint_ids, official_id, remarks } = req.body;
//   const admin_id = req.user.id;
//   if (!complaint_ids?.length || !official_id) {
//     return res.status(400).json({ success: false, message: 'complaint_ids and official_id required.' });
//   }
//   try {
//     const [[official]] = await db.query('SELECT full_name FROM officials WHERE id = ?', [official_id]);
//     if (!official) return res.status(404).json({ success: false, message: 'Official not found.' });
//
//     let assigned = 0;
//     for (const cid of complaint_ids) {
//       const [[comp]] = await db.query('SELECT status FROM complaints WHERE id = ?', [cid]);
//       if (!comp || ['resolved','closed','rejected'].includes(comp.status)) continue;
//       const oldStatus = comp.status;
//       await db.query(
//         `UPDATE complaints SET official_id = ?, status = 'assigned', admin_remarks = ? WHERE id = ?`,
//         [official_id, remarks || null, cid]
//       );
//       await db.query(
//         `INSERT INTO complaint_history (complaint_id, old_status, new_status, changed_by_id, changed_by_role, remarks)
//          VALUES (?, ?, 'assigned', ?, 'admin', ?)`,
//         [cid, oldStatus, admin_id, `Bulk assigned to ${official.full_name}. ${remarks || ''}`]
//       );
//       assigned++;
//     }
//     res.json({ success: true, message: `${assigned} complaint(s) assigned to ${official.full_name}.`, assigned });
//   } catch (err) {
//     console.error('Bulk assign error:', err);
//     res.status(500).json({ success: false, message: 'Server error.' });
//   }
// };

const bulkAssignFixed = async (req, res) => {
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

// ✅ FIX 2: permanentDeleteUser — Replace IN (${ids}) with parameterized placeholders
// BEFORE (line 1152-1188):
// const permanentDeleteUser = async (req, res) => {
//   const { id } = req.params; // deleted_users audit row id
//   try {
//     const [[audit]] = await db.query(
//       `SELECT id, original_user_id, full_name, email, complaints_data FROM deleted_users WHERE id = ?`, [id]
//     );
//     if (!audit) return res.status(404).json({ success: false, message: 'Audit record not found.' });
//
//     const userId = audit.original_user_id;
//     let complaints = [];
//     try { complaints = audit.complaints_data ? JSON.parse(audit.complaints_data) : []; } catch {}
//     const complaintIds = complaints.map(c => c.id).filter(Boolean);
//
//     // Wipe complaints and related data if any
//     if (complaintIds.length > 0) {
//       const ids = complaintIds.join(',');  // ❌ SQL INJECTION VULNERABILITY
//       await db.query(`DELETE FROM complaint_history WHERE complaint_id IN (${ids})`).catch(() => {});
//       await db.query(`DELETE FROM complaint_ratings  WHERE complaint_id IN (${ids})`).catch(() => {});
//       await db.query(`DELETE FROM complaint_comments WHERE complaint_id IN (${ids})`).catch(() => {});
//       await db.query(`DELETE FROM complaints         WHERE id           IN (${ids})`).catch(() => {});
//     }
//     // ...
//   }
// };

const permanentDeleteUserFixed = async (req, res) => {
  const { id } = req.params; // deleted_users audit row id
  try {
    const [[audit]] = await db.query(
      `SELECT id, original_user_id, full_name, email, complaints_data FROM deleted_users WHERE id = ?`, [id]
    );
    if (!audit) return res.status(404).json({ success: false, message: 'Audit record not found.' });

    const userId = audit.original_user_id;
    let complaints = [];
    try { complaints = audit.complaints_data ? JSON.parse(audit.complaints_data) : []; } catch {}
    const complaintIds = complaints.map(c => c.id).filter(Boolean);

    // ✅ FIX: Replace string interpolation with parameterized queries
    if (complaintIds.length > 0) {
      const placeholders = complaintIds.map(() => '?').join(',');
      await db.query(`DELETE FROM complaint_history WHERE complaint_id IN (${placeholders})`, complaintIds).catch(() => {});
      await db.query(`DELETE FROM complaint_ratings  WHERE complaint_id IN (${placeholders})`, complaintIds).catch(() => {});
      await db.query(`DELETE FROM complaint_comments WHERE complaint_id IN (${placeholders})`, complaintIds).catch(() => {});
      await db.query(`DELETE FROM complaint_photos   WHERE complaint_id IN (${placeholders})`, complaintIds).catch(() => {});
      await db.query(`DELETE FROM complaints         WHERE id           IN (${placeholders})`, complaintIds).catch(() => {});
    }

    // Wipe user record (in case soft-delete didn't fully remove)
    if (userId) {
      await db.query(`DELETE FROM users WHERE id = ?`, [userId]).catch(() => {});
    }

    // Wipe audit row — truly gone
    await db.query(`DELETE FROM deleted_users WHERE id = ?`, [id]);

    res.json({ success: true, message: `${audit.full_name} permanently deleted. All data erased.` });
  } catch (err) {
    console.error('permanentDeleteUser error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = {
  bulkAssignFixed,
  permanentDeleteUserFixed,
};
