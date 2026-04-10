const express = require('express');
const router  = express.Router();
const { searchLandRecord } = require('../controllers/landController');
const { verifyToken } = require('../middleware/auth');

// Officials & admins only — auth required
router.get('/search', verifyToken, searchLandRecord);

module.exports = router;
