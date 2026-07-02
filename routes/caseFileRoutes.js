// =====================================================
//   Case File Routes — HYDRAA (HARDENED)
// =====================================================

const express = require('express');
const router  = express.Router();
const { verifyToken, isAdmin, isOfficial } = require('../middleware/auth');
const {
  getAccused, addAccused, updateAccused, deleteAccused,
  getSiteVisitReport, saveSiteVisitReport, deleteSiteVisitReport, generateSiteVisitPdf,
  getDocuments, getDocumentFile, uploadDocument, deleteDocument,
  getCaseFileNotes, addCaseFileNote,
  getPoliceStations, createPoliceStation, updatePoliceStation, deletePoliceStation,
  getPetitionHistory,
  generatePetition, generateNotice,
  sendPetitionEmail, sendNoticeEmail,
} = require('../controllers/caseFileController');

// ✅ FIX: Add role guards to protect case file operations

// ── Accused Persons ──
router.get('/complaints/:complaint_id/accused',      verifyToken, getAccused);
router.post('/complaints/:complaint_id/accused',     verifyToken, addAccused);
router.put('/accused/:id',                           verifyToken, updateAccused);
router.delete('/accused/:id',                        verifyToken, isAdmin, deleteAccused);

// ── Site Visit Reports ──
router.get('/complaints/:complaint_id/site-visit',   verifyToken, getSiteVisitReport);
router.post('/complaints/:complaint_id/site-visit',  verifyToken, saveSiteVisitReport);
router.delete('/site-visits/:id',                    verifyToken, isAdmin, deleteSiteVisitReport);
router.get('/site-visits/:id/generate-pdf',         verifyToken, generateSiteVisitPdf);

// ── Document Vault ──
router.get('/complaints/:complaint_id/documents',    verifyToken, getDocuments);
router.post('/complaints/:complaint_id/documents',   verifyToken, uploadDocument);
router.get('/documents/:id/file',                    verifyToken, getDocumentFile);
router.delete('/documents/:id',                      verifyToken, isAdmin, deleteDocument);

// ── Case File Notes (Admin ↔ Official thread) ──
router.get('/complaints/:complaint_id/case-notes',   verifyToken, getCaseFileNotes);
router.post('/complaints/:complaint_id/case-notes',  verifyToken, addCaseFileNote);

// ── Police Stations (admin: full CRUD, official: read-only GET) ──
router.get('/police-stations',                       verifyToken, getPoliceStations);
router.post('/police-stations',                      verifyToken, isAdmin, createPoliceStation);
router.put('/police-stations/:id',                   verifyToken, isAdmin, updatePoliceStation);
router.delete('/police-stations/:id',                verifyToken, isAdmin, deletePoliceStation);

// ── Petition / Notice history ──
router.get('/complaints/:complaint_id/petitions',    verifyToken, getPetitionHistory);

// ── PDF Generation (download) ──
router.post('/complaints/:complaint_id/generate-petition', verifyToken, generatePetition);
router.post('/complaints/:complaint_id/generate-notice',   verifyToken, generateNotice);

// ── PDF Send via Email ──
router.post('/complaints/:complaint_id/send-petition', verifyToken, sendPetitionEmail);
router.post('/complaints/:complaint_id/send-notice',   verifyToken, sendNoticeEmail);

module.exports = router;
