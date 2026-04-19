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

module.exports = router;
