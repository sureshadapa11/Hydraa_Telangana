// =====================================================
//   Case File Routes — HYDRAA
// =====================================================

const express = require('express');
const router  = express.Router();
const { verifyToken } = require('../middleware/auth');
const {
  getAccused, addAccused, updateAccused, deleteAccused,
  getSiteVisitReport, saveSiteVisitReport,
  getDocuments, getDocumentFile, uploadDocument, deleteDocument,
  getCaseFileNotes, addCaseFileNote,
  getPoliceStations, createPoliceStation, updatePoliceStation, deletePoliceStation,
  getPetitionHistory,
  generatePetition, generateNotice,
} = require('../controllers/caseFileController');

// ── Accused Persons ──
router.get('/complaints/:complaint_id/accused',      verifyToken, getAccused);
router.post('/complaints/:complaint_id/accused',     verifyToken, addAccused);
router.put('/accused/:id',                           verifyToken, updateAccused);
router.delete('/accused/:id',                        verifyToken, deleteAccused);

// ── Site Visit Report ──
router.get('/complaints/:complaint_id/site-visit',   verifyToken, getSiteVisitReport);
router.post('/complaints/:complaint_id/site-visit',  verifyToken, saveSiteVisitReport);

// ── Document Vault ──
router.get('/complaints/:complaint_id/documents',    verifyToken, getDocuments);
router.post('/complaints/:complaint_id/documents',   verifyToken, uploadDocument);
router.get('/documents/:id/file',                    verifyToken, getDocumentFile);
router.delete('/documents/:id',                      verifyToken, deleteDocument);

// ── Case File Notes (Admin ↔ Official thread) ──
router.get('/complaints/:complaint_id/case-notes',   verifyToken, getCaseFileNotes);
router.post('/complaints/:complaint_id/case-notes',  verifyToken, addCaseFileNote);

// ── Police Stations (admin: full CRUD, official: read-only GET) ──
router.get('/police-stations',                       verifyToken, getPoliceStations);
router.post('/police-stations',                      verifyToken, createPoliceStation);
router.put('/police-stations/:id',                   verifyToken, updatePoliceStation);
router.delete('/police-stations/:id',                verifyToken, deletePoliceStation);

// ── Petition / Notice history ──
router.get('/complaints/:complaint_id/petitions',    verifyToken, getPetitionHistory);

// ── PDF Generation ──
router.post('/complaints/:complaint_id/generate-petition', verifyToken, generatePetition);
router.post('/complaints/:complaint_id/generate-notice',   verifyToken, generateNotice);

module.exports = router;
