// =====================================================
//   Admin Routes — HYDRAA
//   Routes for admin management
// =====================================================

const express = require('express');
const router = express.Router();
const {
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
  getAnalytics,
  getHeatmapData,
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

// ── Users ──
router.get('/users', verifyToken, getUsers);
router.get('/users/:id/logs', verifyToken, getUserLogs);

// ── States ──
router.get('/states', verifyToken, getStates);

// ── Analytics ──
router.get('/analytics', verifyToken, getAnalytics);

// ── Heatmap ──
router.get('/heatmap', verifyToken, getHeatmapData);

module.exports = router;
