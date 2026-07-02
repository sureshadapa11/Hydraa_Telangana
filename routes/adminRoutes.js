// =====================================================
//   Admin Routes — HYDRAA (HARDENED)
//   Routes for admin management with role guards
// =====================================================

const express = require('express');
const router = express.Router();
const {
  deleteOfficial,
  getAnnouncements,
  createAnnouncement,
  deleteAnnouncement,
  toggleAnnouncement,
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
  getDeletedUsers,
  restoreUser,
  permanentDeleteUser,
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
  getDuplicates,
  resolveDuplicate,
  getOverdueComplaints,
} = require('../controllers/adminController');
const { verifyToken, isAdmin } = require('../middleware/auth');

// ✅ FIX: Add isAdmin middleware to ALL admin routes to prevent privilege escalation

// ── Categories ──
router.get('/categories', verifyToken, isAdmin, getCategories);
router.post('/categories', verifyToken, isAdmin, createCategory);
router.delete('/categories/:id', verifyToken, isAdmin, deleteCategory);

// ── Subcategories ──
router.get('/subcategories', verifyToken, isAdmin, getSubcategories);
router.post('/subcategories', verifyToken, isAdmin, createSubcategory);
router.delete('/subcategories/:id', verifyToken, isAdmin, deleteSubcategory);

// ── Officials ──
router.get('/officials', verifyToken, isAdmin, getOfficials);
router.post('/officials', verifyToken, isAdmin, createOfficial);
router.put('/officials/:id', verifyToken, isAdmin, updateOfficial);
router.delete('/officials/:id', verifyToken, isAdmin, deleteOfficial);

// ── Users ──
router.get('/users', verifyToken, isAdmin, getUsers);
router.get('/users/deleted', verifyToken, isAdmin, getDeletedUsers);
router.post('/users/deleted/:id/restore', verifyToken, isAdmin, restoreUser);
router.delete('/users/deleted/:id/permanent', verifyToken, isAdmin, permanentDeleteUser);
router.get('/users/:id/logs', verifyToken, isAdmin, getUserLogs);
router.put('/users/:id/deactivate', verifyToken, isAdmin, deactivateUser);
router.put('/users/:id/activate', verifyToken, isAdmin, activateUser);
router.delete('/users/:id', verifyToken, isAdmin, deleteUser);

// ── States ──
router.get('/states', verifyToken, isAdmin, getStates);
router.post('/states', verifyToken, isAdmin, createState);
router.delete('/states/:id', verifyToken, isAdmin, deleteState);

// ── Districts ──
router.get('/districts', verifyToken, isAdmin, getDistricts);
router.post('/districts', verifyToken, isAdmin, createDistrict);
router.delete('/districts/:id', verifyToken, isAdmin, deleteDistrict);
router.post('/districts/seed', verifyToken, isAdmin, seedDistricts);

// ── Mandals ──
router.get('/mandals', verifyToken, isAdmin, getMandals);
router.post('/mandals', verifyToken, isAdmin, createMandal);
router.delete('/mandals/:id', verifyToken, isAdmin, deleteMandal);
router.post('/mandals/seed', verifyToken, isAdmin, seedMandals);

// ── Analytics ──
router.get('/analytics', verifyToken, isAdmin, getAnalytics);

// ── Heatmap ──
router.get('/heatmap', verifyToken, isAdmin, getHeatmapData);

// ── Bulk Assign ──
router.post('/bulk-assign', verifyToken, isAdmin, bulkAssign);

// ── Official Performance ──
router.get('/official-performance', verifyToken, isAdmin, getOfficialPerformance);

// ── Category Heatmap ──
router.get('/category-heatmap', verifyToken, isAdmin, getCategoryHeatmap);

// ── Monthly Report ──
router.get('/monthly-report', verifyToken, isAdmin, getMonthlyReport);

// ── Duplicates ──
router.get('/duplicates', verifyToken, isAdmin, getDuplicates);
router.put('/duplicates/:id/resolve', verifyToken, isAdmin, resolveDuplicate);

// ── Overdue ──
router.get('/overdue', verifyToken, isAdmin, getOverdueComplaints);

// ── Announcements ──
router.get('/announcements', verifyToken, isAdmin, getAnnouncements);
router.post('/announcements', verifyToken, isAdmin, createAnnouncement);
router.delete('/announcements/:id', verifyToken, isAdmin, deleteAnnouncement);
router.put('/announcements/:id/toggle', verifyToken, isAdmin, toggleAnnouncement);

module.exports = router;
