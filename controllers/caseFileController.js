// =====================================================
//   Case File Controller — HYDRAA
//   Handles accused details, site visit reports,
//   document vault, case notes, police stations,
//   and petition/notice PDF generation
// =====================================================

const db = require('../utils/db');
const PDFDocument = require('pdfkit');

// ────────────────────────────────────────────────────
//  ACCUSED PERSONS
// ────────────────────────────────────────────────────
const getAccused = async (req, res) => {
  const { complaint_id } = req.params;
  try {
    const [rows] = await db.query(
      `SELECT * FROM accused_persons WHERE complaint_id = ? ORDER BY created_at ASC`,
      [complaint_id]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('getAccused error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const addAccused = async (req, res) => {
  const { complaint_id } = req.params;
  const { name, phone, email, address, aadhaar_no, relation, occupation } = req.body;
  const role = req.user.role;

  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, message: 'Accused name is required.' });
  }

  try {
    const [result] = await db.query(
      `INSERT INTO accused_persons (complaint_id, name, phone, email, address, aadhaar_no, relation, occupation, added_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [complaint_id, name.trim(), phone || null, email || null, address || null,
       aadhaar_no || null, relation || null, occupation || null, role]
    );
    res.status(201).json({ success: true, message: 'Accused person added.', id: result.insertId });
  } catch (err) {
    console.error('addAccused error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const updateAccused = async (req, res) => {
  const { id } = req.params;
  const { name, phone, email, address, aadhaar_no, relation, occupation } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, message: 'Accused name is required.' });
  }

  try {
    const [result] = await db.query(
      `UPDATE accused_persons SET name=?, phone=?, email=?, address=?, aadhaar_no=?, relation=?, occupation=?
       WHERE id=?`,
      [name.trim(), phone || null, email || null, address || null,
       aadhaar_no || null, relation || null, occupation || null, id]
    );
    if (result.affectedRows === 0)
      return res.status(404).json({ success: false, message: 'Accused record not found.' });
    res.json({ success: true, message: 'Accused person updated.' });
  } catch (err) {
    console.error('updateAccused error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const deleteAccused = async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM accused_persons WHERE id = ?', [id]);
    res.json({ success: true, message: 'Accused person removed.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ────────────────────────────────────────────────────
//  SITE VISIT REPORT
// ────────────────────────────────────────────────────
const getSiteVisitReport = async (req, res) => {
  const { complaint_id } = req.params;
  try {
    const [[report]] = await db.query(
      `SELECT svr.*, o.full_name AS official_name
       FROM site_visit_reports svr
       JOIN officials o ON o.id = svr.official_id
       WHERE svr.complaint_id = ?`,
      [complaint_id]
    );
    res.json({ success: true, data: report || null });
  } catch (err) {
    console.error('getSiteVisitReport error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const saveSiteVisitReport = async (req, res) => {
  const { complaint_id } = req.params;
  const { visit_date, visit_time, encroachment_area, construction_type, current_status, findings, geo_lat, geo_lng } = req.body;
  const official_id = req.user.id;

  if (!visit_date) {
    return res.status(400).json({ success: false, message: 'Visit date is required.' });
  }

  try {
    await db.query(
      `INSERT INTO site_visit_reports
         (complaint_id, official_id, visit_date, visit_time, encroachment_area, construction_type, current_status, findings, geo_lat, geo_lng)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         visit_date=VALUES(visit_date), visit_time=VALUES(visit_time),
         encroachment_area=VALUES(encroachment_area), construction_type=VALUES(construction_type),
         current_status=VALUES(current_status), findings=VALUES(findings),
         geo_lat=VALUES(geo_lat), geo_lng=VALUES(geo_lng), updated_at=NOW()`,
      [complaint_id, official_id, visit_date, visit_time || null,
       encroachment_area || null, construction_type || null,
       current_status || null, findings || null,
       geo_lat || null, geo_lng || null]
    );
    res.json({ success: true, message: 'Site visit report saved.' });
  } catch (err) {
    console.error('saveSiteVisitReport error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ────────────────────────────────────────────────────
//  DOCUMENT VAULT
// ────────────────────────────────────────────────────
const getDocuments = async (req, res) => {
  const { complaint_id } = req.params;
  try {
    const [docs] = await db.query(
      `SELECT id, doc_type, file_name, file_mime, caption, uploaded_by_role, created_at
       FROM complaint_documents WHERE complaint_id = ? ORDER BY created_at ASC`,
      [complaint_id]
    );
    res.json({ success: true, data: docs });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const getDocumentFile = async (req, res) => {
  const { id } = req.params;
  try {
    const [[doc]] = await db.query(
      `SELECT file_name, file_data, file_mime FROM complaint_documents WHERE id = ?`, [id]
    );
    if (!doc) return res.status(404).json({ success: false, message: 'Document not found.' });

    const fileBuffer = Buffer.from(doc.file_data, 'base64');
    res.setHeader('Content-Type', doc.file_mime || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${doc.file_name}"`);
    res.send(fileBuffer);
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const uploadDocument = async (req, res) => {
  const { complaint_id } = req.params;
  const { doc_type, file_name, file_data, file_mime, caption } = req.body;
  const uploader_id   = req.user.id;
  const uploader_role = req.user.role;

  if (!file_name || !file_data) {
    return res.status(400).json({ success: false, message: 'file_name and file_data required.' });
  }

  try {
    const [[cnt]] = await db.query(
      'SELECT COUNT(*) AS c FROM complaint_documents WHERE complaint_id = ?', [complaint_id]
    );
    if (cnt.c >= 25) {
      return res.status(400).json({ success: false, message: 'Maximum 25 documents per complaint.' });
    }

    await db.query(
      `INSERT INTO complaint_documents (complaint_id, doc_type, file_name, file_data, file_mime, caption, uploaded_by_id, uploaded_by_role)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [complaint_id, doc_type || 'Other', file_name, file_data, file_mime || null, caption || null, uploader_id, uploader_role]
    );
    res.json({ success: true, message: 'Document uploaded.' });
  } catch (err) {
    console.error('uploadDocument error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const deleteDocument = async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM complaint_documents WHERE id = ?', [id]);
    res.json({ success: true, message: 'Document deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ────────────────────────────────────────────────────
//  CASE FILE NOTES (Admin ↔ Official thread)
// ────────────────────────────────────────────────────
const getCaseFileNotes = async (req, res) => {
  const { complaint_id } = req.params;
  try {
    const [notes] = await db.query(
      `SELECT id, author_role, author_name, message, created_at
       FROM case_file_notes WHERE complaint_id = ? ORDER BY created_at ASC`,
      [complaint_id]
    );
    res.json({ success: true, data: notes });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const addCaseFileNote = async (req, res) => {
  const { complaint_id } = req.params;
  const { message } = req.body;
  const author_id   = req.user.id;
  const author_role = req.user.role;
  const author_name = req.user.full_name || req.user.username || 'User';

  if (!message || !message.trim()) {
    return res.status(400).json({ success: false, message: 'Message is required.' });
  }

  try {
    await db.query(
      `INSERT INTO case_file_notes (complaint_id, author_id, author_role, author_name, message)
       VALUES (?, ?, ?, ?, ?)`,
      [complaint_id, author_id, author_role, author_name, message.trim()]
    );
    res.json({ success: true, message: 'Note added.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ────────────────────────────────────────────────────
//  POLICE STATIONS
// ────────────────────────────────────────────────────
const getPoliceStations = async (req, res) => {
  const { district_id, mandal_id } = req.query;
  try {
    let where = '1=1';
    const params = [];
    if (district_id) { where += ' AND ps.district_id = ?'; params.push(district_id); }
    if (mandal_id)   { where += ' AND ps.mandal_id = ?';   params.push(mandal_id); }

    const [rows] = await db.query(
      `SELECT ps.id, ps.name, ps.address, ps.phone, ps.email, ps.officer_in_charge, ps.is_active,
              d.name AS district_name, m.name AS mandal_name
       FROM police_stations ps
       LEFT JOIN districts d ON d.id = ps.district_id
       LEFT JOIN mandals m ON m.id = ps.mandal_id
       WHERE ${where}
       ORDER BY d.name ASC, ps.name ASC`,
      params
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('getPoliceStations error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const createPoliceStation = async (req, res) => {
  const { name, district_id, mandal_id, address, phone, email, officer_in_charge } = req.body;
  if (!name) return res.status(400).json({ success: false, message: 'Station name required.' });
  try {
    const [result] = await db.query(
      `INSERT INTO police_stations (name, district_id, mandal_id, address, phone, email, officer_in_charge)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name, district_id || null, mandal_id || null, address || null, phone || null, email || null, officer_in_charge || null]
    );
    res.status(201).json({ success: true, message: 'Police station added.', id: result.insertId });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const updatePoliceStation = async (req, res) => {
  const { id } = req.params;
  const { name, district_id, mandal_id, address, phone, email, officer_in_charge, is_active } = req.body;
  try {
    await db.query(
      `UPDATE police_stations SET name=?, district_id=?, mandal_id=?, address=?, phone=?, email=?, officer_in_charge=?, is_active=?
       WHERE id=?`,
      [name, district_id || null, mandal_id || null, address || null, phone || null, email || null, officer_in_charge || null, is_active !== undefined ? is_active : 1, id]
    );
    res.json({ success: true, message: 'Police station updated.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const deletePoliceStation = async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM police_stations WHERE id = ?', [id]);
    res.json({ success: true, message: 'Police station deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ────────────────────────────────────────────────────
//  PETITION / NOTICE HISTORY
// ────────────────────────────────────────────────────
const getPetitionHistory = async (req, res) => {
  const { complaint_id } = req.params;
  try {
    const [rows] = await db.query(
      `SELECT pn.*, ps.name AS station_name
       FROM petition_notices pn
       LEFT JOIN police_stations ps ON ps.id = pn.police_station_id
       WHERE pn.complaint_id = ? ORDER BY pn.created_at DESC`,
      [complaint_id]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ────────────────────────────────────────────────────
//  HELPER — fetch full complaint data for PDF
// ────────────────────────────────────────────────────
async function fetchComplaintFull(complaint_id) {
  const [[complaint]] = await db.query(
    `SELECT c.*,
            u.full_name AS citizen_name, u.email AS citizen_email, u.phone AS citizen_phone,
            cat.name AS category_name, subcat.name AS subcategory_name,
            d.name AS district_name, m.name AS mandal_name,
            o.full_name AS official_name, o.phone AS official_phone, o.department AS official_dept
     FROM complaints c
     JOIN users u ON u.id = c.user_id
     LEFT JOIN categories cat ON cat.id = c.category_id
     LEFT JOIN subcategories subcat ON subcat.id = c.subcategory_id
     LEFT JOIN districts d ON d.id = c.district_id
     LEFT JOIN mandals m ON m.id = c.mandal_id
     LEFT JOIN officials o ON o.id = c.official_id
     WHERE c.id = ?`,
    [complaint_id]
  );

  const [accused] = await db.query(
    `SELECT * FROM accused_persons WHERE complaint_id = ? ORDER BY created_at ASC`, [complaint_id]
  );

  const [[visitReport]] = await db.query(
    `SELECT svr.*, o.full_name AS official_name
     FROM site_visit_reports svr JOIN officials o ON o.id = svr.official_id
     WHERE svr.complaint_id = ?`,
    [complaint_id]
  ).catch(() => [[null]]);

  const [history] = await db.query(
    `SELECT ch.old_status, ch.new_status, ch.changed_by_role, ch.remarks, ch.changed_at
     FROM complaint_history ch WHERE ch.complaint_id = ? ORDER BY ch.changed_at ASC`,
    [complaint_id]
  );

  const [documents] = await db.query(
    `SELECT doc_type, file_name, caption, uploaded_by_role, created_at
     FROM complaint_documents WHERE complaint_id = ? ORDER BY created_at ASC`,
    [complaint_id]
  );

  return { complaint, accused, visitReport, history, documents };
}

// ────────────────────────────────────────────────────
//  HELPER — draw PDF header
// ────────────────────────────────────────────────────
function drawPdfHeader(doc, title) {
  doc.rect(0, 0, doc.page.width, 80).fill('#0b2040');
  doc.fill('#ffffff').font('Helvetica-Bold').fontSize(16)
     .text('HYDRAA — Hyderabad Disaster Response & Asset Protection Agency', 40, 20, { width: doc.page.width - 80, align: 'center' });
  doc.fill('#4dd6e8').font('Helvetica').fontSize(10)
     .text('Government of Telangana', 40, 42, { width: doc.page.width - 80, align: 'center' });
  doc.fill('#f4a820').font('Helvetica-Bold').fontSize(12)
     .text(title, 40, 58, { width: doc.page.width - 80, align: 'center' });
  doc.y = 100;
  doc.fill('#000000');
}

// ────────────────────────────────────────────────────
//  HELPER — section heading
// ────────────────────────────────────────────────────
function sectionHead(doc, text) {
  doc.moveDown(0.5);
  doc.rect(40, doc.y, doc.page.width - 80, 22).fill('#0b2040');
  doc.fill('#ffffff').font('Helvetica-Bold').fontSize(10)
     .text(text, 48, doc.y - 16);
  doc.fill('#000000').font('Helvetica').fontSize(10);
  doc.moveDown(0.4);
}

// ────────────────────────────────────────────────────
//  HELPER — key-value row
// ────────────────────────────────────────────────────
function kvRow(doc, key, value) {
  doc.font('Helvetica-Bold').fontSize(9).text(`${key}: `, { continued: true });
  doc.font('Helvetica').fontSize(9).text(value || '—');
}

// ────────────────────────────────────────────────────
//  FORMAT DATE
// ────────────────────────────────────────────────────
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ────────────────────────────────────────────────────
//  GENERATE PETITION PDF
// ────────────────────────────────────────────────────
const generatePetition = async (req, res) => {
  const { complaint_id } = req.params;
  const { to_name, to_address, police_station_id, action_requested } = req.body;
  const generated_by_id   = req.user.id;
  const generated_by_role = req.user.role;

  try {
    const { complaint, accused, visitReport, history, documents } = await fetchComplaintFull(complaint_id);
    if (!complaint) return res.status(404).json({ success: false, message: 'Complaint not found.' });

    let stationName = to_name || '';
    let stationEmail = null;
    if (police_station_id) {
      const [[ps]] = await db.query('SELECT name, email FROM police_stations WHERE id = ?', [police_station_id]);
      if (ps) { stationName = ps.name; stationEmail = ps.email; }
    }

    // Record in petition_notices
    await db.query(
      `INSERT INTO petition_notices (complaint_id, doc_type, generated_by_id, generated_by_role, sent_to_name, sent_to_email, sent_to_type, police_station_id, send_status)
       VALUES (?, 'petition', ?, ?, ?, ?, 'police_station', ?, 'generated')`,
      [complaint_id, generated_by_id, generated_by_role, stationName, stationEmail, police_station_id || null]
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Petition_${complaint.complaint_no}.pdf"`);

    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    doc.pipe(res);

    drawPdfHeader(doc, 'PETITION — Request for Action');

    // Reference & date
    doc.moveDown(0.5);
    doc.font('Helvetica').fontSize(10);
    doc.text(`Ref No: ${complaint.complaint_no}`, { align: 'right' });
    doc.text(`Date: ${fmtDate(new Date())}`, { align: 'right' });
    doc.moveDown(0.5);

    // To block
    doc.font('Helvetica-Bold').fontSize(10).text('To,');
    doc.font('Helvetica').fontSize(10)
       .text(stationName || 'The Station House Officer')
       .text(to_address || '');
    doc.moveDown(0.5);
    doc.font('Helvetica-Bold').text('Sub: ', { continued: true });
    doc.font('Helvetica').text(`Request for action regarding complaint ${complaint.complaint_no} — ${complaint.title}`);
    doc.font('Helvetica-Bold').text('Ref: ', { continued: true });
    doc.font('Helvetica').text(`HYDRAA Complaint No. ${complaint.complaint_no} dated ${fmtDate(complaint.created_at)}`);
    doc.moveDown(0.5);
    doc.font('Helvetica').fontSize(10)
       .text('Sir/Madam,', { indent: 20 }).moveDown(0.3)
       .text('This is to bring to your kind attention the following complaint registered with this office. The details are as follows:', { indent: 20 });

    // Complainant
    sectionHead(doc, '1. COMPLAINANT DETAILS');
    kvRow(doc, 'Name', complaint.citizen_name);
    kvRow(doc, 'Phone', complaint.citizen_phone);
    kvRow(doc, 'Email', complaint.citizen_email);

    // Complaint details
    sectionHead(doc, '2. COMPLAINT DETAILS');
    kvRow(doc, 'Complaint No', complaint.complaint_no);
    kvRow(doc, 'Date Filed', fmtDate(complaint.created_at));
    kvRow(doc, 'Category', complaint.category_name);
    kvRow(doc, 'Sub-Category', complaint.subcategory_name);
    kvRow(doc, 'Priority', (complaint.priority || '').toUpperCase());
    kvRow(doc, 'Status', (complaint.status || '').toUpperCase());
    kvRow(doc, 'Address of Complaint', complaint.address);
    doc.moveDown(0.3);
    doc.font('Helvetica-Bold').fontSize(9).text('Description:');
    doc.font('Helvetica').fontSize(9).text(complaint.description || '—', { indent: 10 });

    // Land details
    if (complaint.land_survey_no || complaint.khata_no) {
      sectionHead(doc, '3. LAND / PROPERTY DETAILS');
      kvRow(doc, 'District', complaint.land_district || complaint.district_name);
      kvRow(doc, 'Mandal', complaint.land_mandal || complaint.mandal_name);
      kvRow(doc, 'Village', complaint.land_village);
      kvRow(doc, 'Survey No', complaint.land_survey_no);
      kvRow(doc, 'Khata No', complaint.khata_no);
      kvRow(doc, 'Land Address', complaint.land_address);
    }

    // Accused
    if (accused.length > 0) {
      sectionHead(doc, `4. ACCUSED PERSON(S) — ${accused.length} person(s)`);
      accused.forEach((a, i) => {
        doc.font('Helvetica-Bold').fontSize(9).text(`Accused ${i + 1}:`);
        kvRow(doc, 'Name', a.name);
        kvRow(doc, 'Phone', a.phone);
        kvRow(doc, 'Address', a.address);
        kvRow(doc, 'Relation', a.relation);
        kvRow(doc, 'Occupation', a.occupation);
        if (i < accused.length - 1) doc.moveDown(0.3);
      });
    }

    // Site visit
    if (visitReport) {
      sectionHead(doc, '5. SITE VISIT REPORT');
      kvRow(doc, 'Visited On', fmtDate(visitReport.visit_date));
      kvRow(doc, 'Time', visitReport.visit_time || '—');
      kvRow(doc, 'Inspecting Official', visitReport.official_name);
      kvRow(doc, 'Encroachment Area', visitReport.encroachment_area);
      kvRow(doc, 'Construction Type', visitReport.construction_type);
      kvRow(doc, 'Current Status of Land', visitReport.current_status);
      if (visitReport.findings) {
        doc.moveDown(0.2);
        doc.font('Helvetica-Bold').fontSize(9).text('Findings:');
        doc.font('Helvetica').fontSize(9).text(visitReport.findings, { indent: 10 });
      }
    }

    // Documents
    if (documents.length > 0) {
      sectionHead(doc, '6. EVIDENCE & DOCUMENTS COLLECTED');
      documents.forEach((d, i) => {
        doc.font('Helvetica').fontSize(9)
           .text(`${i + 1}. [${d.doc_type}] ${d.file_name}${d.caption ? ' — ' + d.caption : ''} (uploaded by ${d.uploaded_by_role} on ${fmtDate(d.created_at)})`);
      });
    }

    // Complaint history
    if (history.length > 0) {
      sectionHead(doc, '7. COMPLAINT HISTORY');
      history.forEach(h => {
        doc.font('Helvetica').fontSize(8)
           .text(`${fmtDate(h.changed_at)} — ${(h.old_status || 'new').toUpperCase()} → ${h.new_status.toUpperCase()} (by ${h.changed_by_role})${h.remarks ? ': ' + h.remarks : ''}`);
      });
    }

    // Action requested
    sectionHead(doc, '8. ACTION REQUESTED');
    doc.font('Helvetica').fontSize(10)
       .text(action_requested || 'You are requested to take necessary action as per applicable laws and regulations and inform this office of the action taken at the earliest.', { indent: 10 });

    // Signature
    doc.moveDown(1.5);
    doc.font('Helvetica').fontSize(10)
       .text('Yours faithfully,', { indent: 20 }).moveDown(1.5);
    doc.font('Helvetica-Bold').fontSize(10)
       .text('________________________________', { align: 'right' });
    doc.font('Helvetica').fontSize(9)
       .text('Authorized Signatory', { align: 'right' })
       .text('HYDRAA — Government of Telangana', { align: 'right' })
       .text(`Date: ${fmtDate(new Date())}`, { align: 'right' });

    doc.end();
  } catch (err) {
    console.error('generatePetition error:', err);
    if (!res.headersSent) res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ────────────────────────────────────────────────────
//  GENERATE SHOW CAUSE NOTICE PDF
// ────────────────────────────────────────────────────
const generateNotice = async (req, res) => {
  const { complaint_id } = req.params;
  const { accused_id, response_days } = req.body;
  const generated_by_id   = req.user.id;
  const generated_by_role = req.user.role;

  try {
    const { complaint, accused, visitReport } = await fetchComplaintFull(complaint_id);
    if (!complaint) return res.status(404).json({ success: false, message: 'Complaint not found.' });

    let targetAccused = accused[0] || null;
    if (accused_id) {
      targetAccused = accused.find(a => a.id === parseInt(accused_id)) || targetAccused;
    }

    const deadline = new Date();
    deadline.setDate(deadline.getDate() + (parseInt(response_days) || 15));

    // Record in petition_notices
    await db.query(
      `INSERT INTO petition_notices (complaint_id, doc_type, generated_by_id, generated_by_role, sent_to_name, sent_to_email, sent_to_type, send_status)
       VALUES (?, 'notice', ?, ?, ?, ?, 'accused', 'generated')`,
      [complaint_id, generated_by_id, generated_by_role,
       targetAccused?.name || 'Accused Person', targetAccused?.email || null]
    );

    const noticeNo = `HYD-NOTICE-${complaint.complaint_no}-${Date.now().toString().slice(-5)}`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Notice_${complaint.complaint_no}.pdf"`);

    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    doc.pipe(res);

    drawPdfHeader(doc, 'SHOW CAUSE NOTICE');

    doc.moveDown(0.5);
    doc.font('Helvetica').fontSize(10);
    doc.text(`Notice No: ${noticeNo}`, { align: 'right' });
    doc.text(`Date: ${fmtDate(new Date())}`, { align: 'right' });
    doc.moveDown(0.5);

    // To block
    doc.font('Helvetica-Bold').fontSize(10).text('To,');
    if (targetAccused) {
      doc.font('Helvetica').fontSize(10)
         .text(targetAccused.name)
         .text(targetAccused.address || 'Address not on record');
    } else {
      doc.font('Helvetica').fontSize(10).text('The Accused Person / Responsible Party');
    }

    doc.moveDown(0.5);
    doc.font('Helvetica-Bold').text('Sub: ', { continued: true });
    doc.font('Helvetica').text('Show Cause Notice — Action under HYDRAA Act');
    doc.font('Helvetica-Bold').text('Ref: ', { continued: true });
    doc.font('Helvetica').text(`Complaint No. ${complaint.complaint_no} dated ${fmtDate(complaint.created_at)}`);

    doc.moveDown(0.5);
    doc.font('Helvetica').fontSize(10).text('Sir/Madam,', { indent: 20 }).moveDown(0.3);
    doc.text('It has been brought to the notice of this office that you have been involved in the following violation/encroachment within the jurisdiction of HYDRAA. You are hereby called upon to show cause why action should not be initiated against you under the provisions of applicable laws.', { indent: 20 });

    // Violation details
    sectionHead(doc, '1. NATURE OF VIOLATION / COMPLAINT');
    kvRow(doc, 'Complaint No', complaint.complaint_no);
    kvRow(doc, 'Date of Complaint', fmtDate(complaint.created_at));
    kvRow(doc, 'Category', complaint.category_name);
    kvRow(doc, 'Location', complaint.address);
    doc.moveDown(0.3);
    doc.font('Helvetica-Bold').fontSize(9).text('Details of Violation:');
    doc.font('Helvetica').fontSize(9).text(complaint.description || '—', { indent: 10 });

    // Land
    if (complaint.land_survey_no || complaint.khata_no) {
      sectionHead(doc, '2. PROPERTY / LAND DETAILS');
      kvRow(doc, 'Survey No', complaint.land_survey_no);
      kvRow(doc, 'Khata No', complaint.khata_no);
      kvRow(doc, 'Village', complaint.land_village);
      kvRow(doc, 'Mandal', complaint.land_mandal || complaint.mandal_name);
      kvRow(doc, 'District', complaint.land_district || complaint.district_name);
    }

    // Site visit findings
    if (visitReport) {
      sectionHead(doc, '3. INSPECTION FINDINGS');
      kvRow(doc, 'Inspected On', fmtDate(visitReport.visit_date));
      kvRow(doc, 'Encroachment Area', visitReport.encroachment_area);
      kvRow(doc, 'Construction Type', visitReport.construction_type);
      if (visitReport.findings) {
        doc.moveDown(0.2);
        doc.font('Helvetica').fontSize(9).text(visitReport.findings, { indent: 10 });
      }
    }

    // Response requirement
    sectionHead(doc, '4. RESPONSE REQUIRED');
    doc.font('Helvetica').fontSize(10).text(
      `You are hereby directed to appear before this office or submit a written explanation within ${response_days || 15} days from the date of this notice (i.e., on or before ${fmtDate(deadline)}).`,
      { indent: 10 }
    ).moveDown(0.3);
    doc.text('Failure to respond within the stipulated time will result in ex-parte action being taken against you as per applicable laws, including but not limited to demolition of unauthorized structures, legal proceedings, and/or penalty under HYDRAA Act.', { indent: 10 });

    // Consequences
    sectionHead(doc, '5. CONSEQUENCES OF NON-COMPLIANCE');
    const consequences = [
      'Demolition of unauthorized constructions at your cost',
      'Recovery of encroached government/public land',
      'Legal proceedings under applicable acts',
      'Penalty and fine as per HYDRAA regulations',
    ];
    consequences.forEach((c, i) => {
      doc.font('Helvetica').fontSize(9).text(`${i + 1}. ${c}`, { indent: 10 });
    });

    // Signature
    doc.moveDown(1.5);
    doc.font('Helvetica').fontSize(10).text('Issued by authority of:', { indent: 20 }).moveDown(1.5);
    doc.font('Helvetica-Bold').fontSize(10)
       .text('________________________________', { align: 'right' });
    doc.font('Helvetica').fontSize(9)
       .text('Authorized Signatory', { align: 'right' })
       .text('HYDRAA — Government of Telangana', { align: 'right' })
       .text(`Date: ${fmtDate(new Date())}`, { align: 'right' });

    doc.moveDown(1);
    doc.rect(40, doc.y, doc.page.width - 80, 1).fill('#cccccc');
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(8).fill('#666666')
       .text('This is an official notice issued by HYDRAA. For queries contact HYDRAA office, Hyderabad, Telangana.', { align: 'center' });

    doc.end();
  } catch (err) {
    console.error('generateNotice error:', err);
    if (!res.headersSent) res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = {
  getAccused,
  addAccused,
  updateAccused,
  deleteAccused,
  getSiteVisitReport,
  saveSiteVisitReport,
  getDocuments,
  getDocumentFile,
  uploadDocument,
  deleteDocument,
  getCaseFileNotes,
  addCaseFileNote,
  getPoliceStations,
  createPoliceStation,
  updatePoliceStation,
  deletePoliceStation,
  getPetitionHistory,
  generatePetition,
  generateNotice,
};
