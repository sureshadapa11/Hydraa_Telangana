// =====================================================
//   Admin Routes — HYDRAA
//   Routes for admin management
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
const { verifyToken } = require('../middleware/auth');

// ── Categories ──
router.get('/categories', verifyToken, getCategories);
router.post('/categories', verifyToken, createCategory);
router.delete('/categories/:id', verifyToken, deleteCategory);

// ── Subcategories ──
router.get('/subcategories', verifyToken, getSubcategories);
router.post('/subcategories', verifyToken, createSubcategory);
router.delete('/subcategories/:id', verifyToken, deleteSubcategory);

// ── Officials ──
router.get('/officials', verifyToken, getOfficials);
router.post('/officials', verifyToken, createOfficial);
router.put('/officials/:id', verifyToken, updateOfficial);
router.delete('/officials/:id', verifyToken, deleteOfficial);

// ── Users ──
router.get('/users', verifyToken, getUsers);
router.get('/users/deleted', verifyToken, getDeletedUsers);
router.post('/users/deleted/:id/restore', verifyToken, restoreUser);
router.delete('/users/deleted/:id/permanent', verifyToken, permanentDeleteUser);
router.get('/users/:id/logs', verifyToken, getUserLogs);
router.put('/users/:id/deactivate', verifyToken, deactivateUser);
router.put('/users/:id/activate', verifyToken, activateUser);
router.delete('/users/:id', verifyToken, deleteUser);

// ── States ──
router.get('/states', verifyToken, getStates);
router.post('/states', verifyToken, createState);
router.delete('/states/:id', verifyToken, deleteState);

// ── Districts ──
router.get('/districts', verifyToken, getDistricts);
router.post('/districts', verifyToken, createDistrict);
router.delete('/districts/:id', verifyToken, deleteDistrict);
router.post('/districts/seed', verifyToken, seedDistricts);

// ── Mandals ──
router.get('/mandals', verifyToken, getMandals);
router.post('/mandals', verifyToken, createMandal);
router.delete('/mandals/:id', verifyToken, deleteMandal);
router.post('/mandals/seed', verifyToken, seedMandals);

// ── Analytics ──
router.get('/analytics', verifyToken, getAnalytics);

// ── Heatmap ──
router.get('/heatmap', verifyToken, getHeatmapData);

// ── Bulk Assign ──
router.post('/bulk-assign', verifyToken, bulkAssign);

// ── Official Performance ──
router.get('/official-performance', verifyToken, getOfficialPerformance);

// ── Category Heatmap ──
router.get('/category-heatmap', verifyToken, getCategoryHeatmap);

// ── Monthly Report ──
router.get('/monthly-report', verifyToken, getMonthlyReport);

// ── Duplicates ──
router.get('/duplicates', verifyToken, getDuplicates);
router.put('/duplicates/:id/resolve', verifyToken, resolveDuplicate);

// ── Overdue ──
router.get('/overdue', verifyToken, getOverdueComplaints);

// ── Announcements ──
router.get('/announcements', verifyToken, getAnnouncements);
router.post('/announcements', verifyToken, createAnnouncement);
router.delete('/announcements/:id', verifyToken, deleteAnnouncement);
router.put('/announcements/:id/toggle', verifyToken, toggleAnnouncement);

module.exports = router;
