// =====================================================
//   Complaint Routes — HYDRAA
//   Routes for complaint management
// =====================================================

const express = require('express');
const router = express.Router();
const {
  lodgeComplaint,
  trackComplaint,
  getMyComplaints,
  rateComplaint,
  getAdminDashboard,
  getAllComplaints,
  assignComplaint,
  reassignComplaint,
  updateComplaintStatus,
  getOfficialComplaints,
  resolveComplaint,
  bulkResolveComplaints,
  requestReassignment,
  getReassignmentRequests,
  handleReassignmentRequest,
  getComments,
  addComment,
  uploadPhoto,
  getPhotos,
  checkDuplicate,
  getDistrictStats,
  getUserProfile,
} = require('../controllers/complaintController');
const { verifyToken } = require('../middleware/auth');

// ── User Routes (requires auth) ──
router.post('/lodge', verifyToken, lodgeComplaint);
router.get('/track/:complaint_no', trackComplaint); // Public - no auth required
router.get('/my-complaints', verifyToken, getMyComplaints);
router.post('/rate', verifyToken, rateComplaint);

// ── Admin Routes ──
router.get('/admin/dashboard', verifyToken, getAdminDashboard);
router.get('/admin/all', verifyToken, getAllComplaints);
router.put('/admin/assign/:id', verifyToken, assignComplaint);
router.put('/admin/reassign/:id', verifyToken, reassignComplaint);
router.put('/admin/status/:id', verifyToken, updateComplaintStatus);

// ── Official Routes ──
router.get('/official/assigned', verifyToken, getOfficialComplaints);
router.put('/official/resolve/:id', verifyToken, resolveComplaint);
router.post('/official/reassign-request', verifyToken, requestReassignment);

// ── Admin Reassignment Queue ──
router.get('/admin/reassign-requests', verifyToken, getReassignmentRequests);
router.put('/admin/reassign-requests/:id', verifyToken, handleReassignmentRequest);

// ── Comments / Notes (all roles) ──
router.get('/:id/comments', verifyToken, getComments);
router.post('/:id/comments', verifyToken, addComment);

// ── Photos ──
router.post('/:id/photos', verifyToken, uploadPhoto);
router.get('/:id/photos',  verifyToken, getPhotos);

// ── Duplicate check ──
router.get('/check-duplicate', verifyToken, checkDuplicate);

// ── District stats & user profile (citizen dashboard) ──
router.get('/district-stats', verifyToken, getDistrictStats);
router.get('/user-profile', verifyToken, getUserProfile);

// ── Push Notifications ──
const { VAPID_PUBLIC } = require('../utils/pushService');
const db = require('../utils/db');
router.get('/push/vapid-key', (req, res) => res.json({ success: true, key: VAPID_PUBLIC }));
router.post('/push/subscribe', verifyToken, async (req, res) => {
  const { endpoint, keys } = req.body;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return res.status(400).json({ success: false, message: 'Invalid subscription object.' });
  }
  const user_id = req.user.id;
  try {
    // Upsert: avoid duplicates by endpoint
    await db.query(
      `INSERT INTO user_push_subscriptions (user_id, endpoint, p256dh, auth)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE user_id = VALUES(user_id)`,
      [user_id, endpoint, keys.p256dh, keys.auth]
    );
    res.json({ success: true, message: 'Subscribed to push notifications.' });
  } catch (err) {
    console.error('Push subscribe error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});
router.delete('/push/unsubscribe', verifyToken, async (req, res) => {
  const user_id = req.user.id;
  try {
    await db.query(`DELETE FROM user_push_subscriptions WHERE user_id = ?`, [user_id]);
    res.json({ success: true, message: 'Unsubscribed.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
