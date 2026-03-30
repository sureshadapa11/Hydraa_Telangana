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
  updateComplaintStatus,
  getOfficialComplaints,
  resolveComplaint,
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
router.put('/admin/status/:id', verifyToken, updateComplaintStatus);

// ── Official Routes ──
router.get('/official/assigned', verifyToken, getOfficialComplaints);
router.put('/official/resolve/:id', verifyToken, resolveComplaint);

module.exports = router;
