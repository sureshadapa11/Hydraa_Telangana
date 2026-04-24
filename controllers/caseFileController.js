// =====================================================
//   Case File Controller — HYDRAA
//   Handles accused details, site visit reports,
//   document vault, case notes, police stations,
//   and petition/notice PDF generation
// =====================================================

const db = require('../utils/db');
const PDFDocument = require('pdfkit');
const { PassThrough } = require('stream');
const { sendMail, sendSafe } = require('../utils/emailService');

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
    const [reports] = await db.query(
      `SELECT svr.*, o.full_name AS official_name
       FROM site_visit_reports svr
       JOIN officials o ON o.id = svr.official_id
       WHERE svr.complaint_id = ?
       ORDER BY svr.visit_date DESC, svr.created_at DESC`,
      [complaint_id]
    );

    if (reports.length > 0) {
      const visitIds = reports.map(r => r.id);
      const [docs] = await db.query(
        `SELECT id, site_visit_id, doc_type, file_name, file_mime, caption, uploaded_by_role, created_at
         FROM complaint_documents WHERE site_visit_id IN (?) ORDER BY created_at ASC`,
        [visitIds]
      );
      const docsByVisit = {};
      docs.forEach(d => {
        if (!docsByVisit[d.site_visit_id]) docsByVisit[d.site_visit_id] = [];
        docsByVisit[d.site_visit_id].push(d);
      });
      reports.forEach(r => { r.documents = docsByVisit[r.id] || []; });
    }

    res.json({ success: true, data: reports });
  } catch (err) {
    console.error('getSiteVisitReport error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const saveSiteVisitReport = async (req, res) => {
  const { complaint_id } = req.params;
  const { visit_date, visit_time, encroachment_area, construction_type, current_status, findings, geo_lat, geo_lng, documents } = req.body;
  const official_id   = req.user.id;
  const official_role = req.user.role;

  if (!visit_date) {
    return res.status(400).json({ success: false, message: 'Visit date is required.' });
  }

  try {
    const [result] = await db.query(
      `INSERT INTO site_visit_reports
         (complaint_id, official_id, visit_date, visit_time, encroachment_area, construction_type, current_status, findings, geo_lat, geo_lng)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [complaint_id, official_id, visit_date, visit_time || null,
       encroachment_area || null, construction_type || null,
       current_status || null, findings || null,
       geo_lat || null, geo_lng || null]
    );

    const visit_id = result.insertId;

    if (Array.isArray(documents) && documents.length > 0) {
      for (const doc of documents) {
        if (!doc.file_name || !doc.file_data) continue;
        await db.query(
          `INSERT INTO complaint_documents (complaint_id, site_visit_id, doc_type, file_name, file_data, file_mime, caption, uploaded_by_id, uploaded_by_role)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [complaint_id, visit_id, doc.doc_type || 'Site Visit Photo', doc.file_name,
           doc.file_data, doc.file_mime || null, doc.caption || null, official_id, official_role]
        );
      }
    }

    res.json({ success: true, message: 'Site visit logged.', visit_id });
  } catch (err) {
    console.error('saveSiteVisitReport error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const deleteSiteVisitReport = async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM complaint_documents WHERE site_visit_id = ?', [id]);
    await db.query('DELETE FROM site_visit_reports WHERE id = ?', [id]);
    res.json({ success: true, message: 'Site visit deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ────────────────────────────────────────────────────
//  GENERATE SITE VISIT PDF  (redesigned)
// ────────────────────────────────────────────────────
const generateSiteVisitPdf = async (req, res) => {
  const { id } = req.params;

  try {
    const [[visit]] = await db.query(
      `SELECT svr.*, o.full_name AS official_name, o.phone AS official_phone, o.department AS official_dept
       FROM site_visit_reports svr
       JOIN officials o ON o.id = svr.official_id
       WHERE svr.id = ?`,
      [id]
    );
    if (!visit) return res.status(404).json({ success: false, message: 'Site visit not found.' });

    const [[complaint]] = await db.query(
      `SELECT c.*,
              u.full_name AS citizen_name, u.email AS citizen_email, u.phone AS citizen_phone,
              cat.name AS category_name, subcat.name AS subcategory_name,
              d.name AS district_name, m.name AS mandal_name
       FROM complaints c
       JOIN users u ON u.id = c.user_id
       LEFT JOIN categories cat ON cat.id = c.category_id
       LEFT JOIN subcategories subcat ON subcat.id = c.subcategory_id
       LEFT JOIN districts d ON d.id = c.district_id
       LEFT JOIN mandals m ON m.id = c.mandal_id
       WHERE c.id = ?`,
      [visit.complaint_id]
    );

    // Fetch file_data so images can be embedded
    const [docs] = await db.query(
      `SELECT doc_type, file_name, file_mime, file_data, caption, uploaded_by_role, created_at
       FROM complaint_documents WHERE site_visit_id = ? ORDER BY created_at ASC`,
      [id]
    );

    const [[{ visit_no }]] = await db.query(
      `SELECT COUNT(*) AS visit_no FROM site_visit_reports
       WHERE complaint_id = ? AND (visit_date < ? OR (visit_date = ? AND created_at <= ?))`,
      [visit.complaint_id, visit.visit_date, visit.visit_date, visit.created_at]
    );

    // Split docs into embeddable images vs other files
    const embeddable = docs.filter(d => d.file_data && d.file_mime &&
      (d.file_mime.includes('jpeg') || d.file_mime.includes('jpg') || d.file_mime.includes('png')));
    const otherDocs  = docs.filter(d => !embeddable.includes(d));

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="SiteVisit_${complaint.complaint_no}_V${visit_no}.pdf"`);

    const doc = new PDFDocument({ margin: 0, size: 'A4', autoFirstPage: true });
    doc.pipe(res);

    const W  = doc.page.width;   // 595.28
    const M  = 36;               // margin
    const CW = W - M * 2;       // content width

    // ── HEADER ─────────────────────────────────────────
    doc.rect(0, 0, W, 82).fill('#0b2040');
    doc.fillColor('#4dd6e8').font('Helvetica').fontSize(7.5)
       .text('GOVERNMENT OF TELANGANA', M, 14, { width: CW, align: 'center', characterSpacing: 1.5 });
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(20)
       .text('HYDRAA', M, 24, { width: CW, align: 'center', characterSpacing: 2 });
    doc.fillColor('#a8c4d8').font('Helvetica').fontSize(7.5)
       .text('Hyderabad Disaster Response & Asset Protection Agency', M, 48, { width: CW, align: 'center' });

    // Gold title strip
    doc.rect(0, 64, W, 18).fill('#f4a820');
    doc.fillColor('#0b2040').font('Helvetica-Bold').fontSize(9)
       .text('SITE VISIT INSPECTION REPORT', M, 68.5, { width: CW, align: 'center', characterSpacing: 1 });

    // ── REFERENCE BAR ──────────────────────────────────
    doc.rect(0, 82, W, 22).fill('#f1f5f9');
    doc.rect(0, 104, W, 1).fill('#cbd5e1');
    const refText = `Complaint: ${complaint.complaint_no}   ·   Visit No. ${visit_no}   ·   Date: ${fmtDate(visit.visit_date)}   ·   Inspector: ${visit.official_name}   ·   Generated: ${fmtDate(new Date())}`;
    doc.fillColor('#475569').font('Helvetica').fontSize(7.5)
       .text(refText, M, 89, { width: CW, align: 'center' });

    // ── STATUS BADGES ROW ───────────────────────────────
    let y = 113;
    const statusColor = { resolved: '#065f46', in_progress: '#92400e', assigned: '#1e40af', pending: '#6b21a8' };
    const sc = statusColor[complaint.status] || '#374151';
    const priorityColor = { high: '#991b1b', medium: '#92400e', low: '#065f46' };
    const pc = priorityColor[(complaint.priority||'').toLowerCase()] || '#374151';

    // Status pill
    doc.roundedRect(M, y, 100, 18, 4).fill(sc + '18');
    doc.fillColor(sc).font('Helvetica-Bold').fontSize(7.5)
       .text(`STATUS: ${(complaint.status||'').toUpperCase().replace('_',' ')}`, M + 6, y + 5);
    // Priority pill
    doc.roundedRect(M + 108, y, 90, 18, 4).fill(pc + '18');
    doc.fillColor(pc).font('Helvetica-Bold').fontSize(7.5)
       .text(`PRIORITY: ${(complaint.priority||'—').toUpperCase()}`, M + 114, y + 5);
    // Category pill
    doc.roundedRect(M + 206, y, CW - 206, 18, 4).fill('#0b204018');
    doc.fillColor('#0b2040').font('Helvetica').fontSize(7.5)
       .text(`${complaint.category_name || ''}${complaint.subcategory_name ? ' · ' + complaint.subcategory_name : ''}`, M + 212, y + 5, { width: CW - 218 });

    y += 28;

    // ── HELPER: draw a labeled field box ───────────────
    function fieldBox(label, value, fx, fy, fw, fh) {
      fh = fh || 34;
      doc.rect(fx, fy, fw, fh).fill('#f8fafc').stroke('#e2e8f0');
      doc.fillColor('#94a3b8').font('Helvetica').fontSize(6.5)
         .text(label.toUpperCase(), fx + 7, fy + 6, { width: fw - 14, lineBreak: false });
      doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(9)
         .text(value || '—', fx + 7, fy + 16, { width: fw - 14, lineBreak: false, ellipsis: true });
    }

    function fieldBoxTall(label, value, fx, fy, fw) {
      const lines  = Math.ceil((value || '—').length / 55) + 1;
      const fh     = Math.max(34, 16 + lines * 11 + 6);
      doc.rect(fx, fy, fw, fh).fill('#f8fafc').stroke('#e2e8f0');
      doc.fillColor('#94a3b8').font('Helvetica').fontSize(6.5)
         .text(label.toUpperCase(), fx + 7, fy + 6, { width: fw - 14, lineBreak: false });
      doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(9)
         .text(value || '—', fx + 7, fy + 16, { width: fw - 14 });
      return fh;
    }

    function sectionLabel(text, sy) {
      doc.rect(M, sy, CW, 20).fill('#0b2040');
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8)
         .text(text, M + 10, sy + 6, { characterSpacing: 0.5 });
      return sy + 20;
    }

    // ── 1. COMPLAINT DETAILS ────────────────────────────
    y = sectionLabel('1.  COMPLAINT DETAILS', y);
    y += 6;

    const half = (CW - 4) / 2;
    fieldBox('Complaint No.', complaint.complaint_no, M, y, half);
    fieldBox('Citizen Name', complaint.citizen_name, M + half + 4, y, half);
    y += 38;
    const titleH = fieldBoxTall('Complaint Title', complaint.title, M, y, CW);
    y += titleH + 4;
    const addrH = fieldBoxTall('Address / Location', complaint.address, M, y, CW);
    y += addrH + 4;
    fieldBox('District', complaint.district_name, M, y, half);
    fieldBox('Mandal', complaint.mandal_name, M + half + 4, y, half);
    y += 38;
    fieldBox('Citizen Phone', complaint.citizen_phone, M, y, half);
    fieldBox('Citizen Email', complaint.citizen_email, M + half + 4, y, half);
    y += 38 + 10;

    // ── 2. SITE VISIT DETAILS ───────────────────────────
    y = sectionLabel('2.  SITE VISIT DETAILS', y);
    y += 6;

    const third = (CW - 8) / 3;
    fieldBox('Visit Date', fmtDate(visit.visit_date), M, y, third);
    fieldBox('Visit Time', visit.visit_time || '—', M + third + 4, y, third);
    fieldBox('Inspecting Official', visit.official_name, M + (third + 4) * 2, y, third);
    y += 38;
    if (visit.official_dept || visit.official_phone) {
      fieldBox('Department', visit.official_dept, M, y, half);
      fieldBox('Official Phone', visit.official_phone, M + half + 4, y, half);
      y += 38;
    }
    fieldBox('Encroachment Area', visit.encroachment_area, M, y, half);
    fieldBox('Construction Type', visit.construction_type, M + half + 4, y, half);
    y += 38;
    const csH = fieldBoxTall('Current Status of Land / Property', visit.current_status, M, y, CW);
    y += csH + 4;
    if (visit.geo_lat && visit.geo_lng) {
      fieldBox('GPS Coordinates', `${visit.geo_lat}, ${visit.geo_lng}`, M, y, CW);
      y += 38;
    }
    y += 10;

    // ── 3. DETAILED FINDINGS ────────────────────────────
    if (visit.findings) {
      y = sectionLabel('3.  DETAILED FINDINGS', y);
      y += 6;
      // Quote box with teal left accent
      const findingLines = visit.findings.split('\n').length;
      const findingH = Math.max(50, findingLines * 14 + 24);
      doc.rect(M, y, CW, findingH).fill('#f0fdfa').stroke('#99f6e4');
      doc.rect(M, y, 4, findingH).fill('#0d9488');
      doc.fillColor('#134e4a').font('Helvetica').fontSize(9.5)
         .text(visit.findings, M + 14, y + 10, { width: CW - 22, lineGap: 3 });
      y += findingH + 14;
    }

    // ── 4. DOCUMENTS LIST (non-image) ───────────────────
    const sectionNum = visit.findings ? 4 : 3;
    y = sectionLabel(`${sectionNum}.  DOCUMENTS ATTACHED  (${docs.length} file${docs.length !== 1 ? 's' : ''})`, y);
    y += 8;

    if (docs.length === 0) {
      doc.fillColor('#94a3b8').font('Helvetica').fontSize(9)
         .text('No documents were attached to this site visit.', M + 10, y);
      y += 20;
    } else {
      // List all docs (show images as "embedded below")
      docs.forEach((d, i) => {
        const isImg = embeddable.includes(d);
        const rowH = 24;
        const bg = i % 2 === 0 ? '#f8fafc' : '#ffffff';
        doc.rect(M, y, CW, rowH).fill(bg).stroke('#e2e8f0');

        // Index
        doc.fillColor('#94a3b8').font('Helvetica-Bold').fontSize(8)
           .text(`${i + 1}`, M + 6, y + 8, { width: 14, align: 'center' });

        // Type badge
        const badgeW = 90;
        doc.roundedRect(M + 22, y + 5, badgeW, 14, 3).fill('#0b204015');
        doc.fillColor('#0b2040').font('Helvetica-Bold').fontSize(7)
           .text(d.doc_type, M + 25, y + 8, { width: badgeW - 6 });

        // Filename
        doc.fillColor('#1e293b').font('Helvetica').fontSize(8.5)
           .text(d.file_name + (isImg ? '  [image — embedded below]' : '') + (d.caption ? '  · ' + d.caption : ''),
             M + 118, y + 8, { width: CW - 200 });

        // Date
        doc.fillColor('#94a3b8').font('Helvetica').fontSize(7)
           .text(fmtDate(d.created_at), M + CW - 74, y + 9, { width: 70, align: 'right' });

        y += rowH;
      });
      y += 10;
    }

    // ── 5. EMBEDDED IMAGES ──────────────────────────────
    if (embeddable.length > 0) {
      const imgSectionNum = sectionNum + 1;
      y = sectionLabel(`${imgSectionNum}.  PHOTOGRAPHIC EVIDENCE  (${embeddable.length} image${embeddable.length !== 1 ? 's' : ''})`, y);
      y += 10;

      for (const d of embeddable) {
        try {
          const imgBuf = Buffer.from(d.file_data, 'base64');
          // Check if we need a new page
          if (y + 260 > doc.page.height - 60) {
            doc.addPage({ margin: 0, size: 'A4' });
            y = 30;
          }
          // Image border box
          doc.rect(M, y, CW, 240).fill('#f1f5f9').stroke('#cbd5e1');
          doc.image(imgBuf, M + 6, y + 6, { fit: [CW - 12, 228], align: 'center', valign: 'center' });
          y += 244;
          // Caption row
          doc.rect(M, y, CW, 20).fill('#e2e8f0');
          doc.fillColor('#475569').font('Helvetica').fontSize(7.5)
             .text(`[${d.doc_type}]  ${d.file_name}${d.caption ? '  ·  ' + d.caption : ''}  —  ${fmtDate(d.created_at)}`,
               M + 8, y + 6, { width: CW - 16 });
          y += 22 + 10;
        } catch (_) {
          // If image fails to embed, show as filename only
          doc.fillColor('#94a3b8').font('Helvetica').fontSize(8)
             .text(`⚠ Could not embed: ${d.file_name}`, M + 10, y);
          y += 16;
        }
      }
      y += 6;
    }

    // ── SIGNATURE BLOCK ─────────────────────────────────
    if (y + 80 > doc.page.height - 40) {
      doc.addPage({ margin: 0, size: 'A4' });
      y = 40;
    }
    y += 10;
    doc.rect(M, y, CW, 1).fill('#cbd5e1');
    y += 12;
    doc.fillColor('#64748b').font('Helvetica').fontSize(8)
       .text('Prepared and submitted by:', M, y);
    y += 14;
    doc.rect(M + CW - 180, y, 180, 1).fill('#374151');
    y += 4;
    doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(9)
       .text(visit.official_name || 'Inspecting Official', M + CW - 180, y, { width: 180, align: 'center' });
    y += 13;
    doc.fillColor('#475569').font('Helvetica').fontSize(8)
       .text(visit.official_dept || 'HYDRAA', M + CW - 180, y, { width: 180, align: 'center' });
    y += 12;
    doc.fillColor('#475569').font('Helvetica').fontSize(8)
       .text(`Date: ${fmtDate(new Date())}`, M + CW - 180, y, { width: 180, align: 'center' });

    // ── FOOTER ──────────────────────────────────────────
    const footerY = doc.page.height - 26;
    doc.rect(0, footerY, W, 26).fill('#0b2040');
    doc.fillColor('#4dd6e8').font('Helvetica').fontSize(7)
       .text('HYDRAA  ·  Hyderabad Disaster Response & Asset Protection Agency  ·  Government of Telangana  ·  CONFIDENTIAL OFFICIAL DOCUMENT',
         M, footerY + 9, { width: CW, align: 'center' });

    doc.end();
  } catch (err) {
    console.error('generateSiteVisitPdf error:', err);
    if (!res.headersSent) res.status(500).json({ success: false, message: 'Server error.' });
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
  const { district_id, mandal_id, district_name, mandal_name } = req.query;
  try {
    let where = '1=1';
    const params = [];
    if (district_id)   { where += ' AND ps.district_id = ?';  params.push(district_id); }
    if (mandal_id)     { where += ' AND ps.mandal_id = ?';    params.push(mandal_id); }
    if (district_name) { where += ' AND d.name LIKE ?';       params.push('%' + district_name + '%'); }
    if (mandal_name)   { where += ' AND m.name LIKE ?';       params.push('%' + mandal_name + '%'); }

    const [rows] = await db.query(
      `SELECT ps.id, ps.name, ps.commissionerate, ps.address, ps.phone, ps.email, ps.officer_in_charge, ps.is_active,
              ps.ci_name, ps.ci_phone, ps.ci_email,
              ps.acp_name, ps.acp_phone, ps.acp_email,
              ps.sp_name, ps.sp_phone, ps.sp_email,
              ps.cp_name, ps.cp_phone, ps.cp_email,
              ps.district_id, ps.mandal_id,
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
  const { name, district_id, mandal_id, commissionerate, address, phone, email, officer_in_charge,
          ci_name, ci_phone, ci_email, acp_name, acp_phone, acp_email,
          sp_name, sp_phone, sp_email, cp_name, cp_phone, cp_email } = req.body;
  if (!name) return res.status(400).json({ success: false, message: 'Station name required.' });
  try {
    const [result] = await db.query(
      `INSERT INTO police_stations
         (name, district_id, mandal_id, commissionerate, address, phone, email, officer_in_charge,
          ci_name, ci_phone, ci_email, acp_name, acp_phone, acp_email,
          sp_name, sp_phone, sp_email, cp_name, cp_phone, cp_email)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [name, district_id||null, mandal_id||null, commissionerate||null, address||null, phone||null, email||null, officer_in_charge||null,
       ci_name||null, ci_phone||null, ci_email||null, acp_name||null, acp_phone||null, acp_email||null,
       sp_name||null, sp_phone||null, sp_email||null, cp_name||null, cp_phone||null, cp_email||null]
    );
    res.status(201).json({ success: true, message: 'Police station added.', id: result.insertId });
  } catch (err) {
    console.error('createPoliceStation error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const updatePoliceStation = async (req, res) => {
  const { id } = req.params;
  const { name, district_id, mandal_id, commissionerate, address, phone, email, officer_in_charge, is_active,
          ci_name, ci_phone, ci_email, acp_name, acp_phone, acp_email,
          sp_name, sp_phone, sp_email, cp_name, cp_phone, cp_email } = req.body;
  try {
    await db.query(
      `UPDATE police_stations SET
         name=?, district_id=?, mandal_id=?, commissionerate=?, address=?, phone=?, email=?, officer_in_charge=?, is_active=?,
         ci_name=?, ci_phone=?, ci_email=?, acp_name=?, acp_phone=?, acp_email=?,
         sp_name=?, sp_phone=?, sp_email=?, cp_name=?, cp_phone=?, cp_email=?
       WHERE id=?`,
      [name, district_id||null, mandal_id||null, commissionerate||null, address||null, phone||null, email||null,
       officer_in_charge||null, is_active !== undefined ? is_active : 1,
       ci_name||null, ci_phone||null, ci_email||null, acp_name||null, acp_phone||null, acp_email||null,
       sp_name||null, sp_phone||null, sp_email||null, cp_name||null, cp_phone||null, cp_email||null,
       id]
    );
    res.json({ success: true, message: 'Police station updated.' });
  } catch (err) {
    console.error('updatePoliceStation error:', err);
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
     WHERE svr.complaint_id = ?
     ORDER BY svr.visit_date DESC, svr.created_at DESC LIMIT 1`,
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
  // Dark navy bar
  doc.rect(0, 0, doc.page.width, 90).fill('#0b2040');
  doc.fill('#ffffff').font('Helvetica-Bold').fontSize(15)
     .text('HYDRAA', 40, 14, { width: doc.page.width - 80, align: 'center' });
  doc.fill('#4dd6e8').font('Helvetica').fontSize(8.5)
     .text('Hyderabad Disaster Response & Asset Protection Agency', 40, 31, { width: doc.page.width - 80, align: 'center' });
  doc.fill('#ffffff').font('Helvetica').fontSize(8)
     .text('Government of Telangana  |  HYDRAA Bhavan, Tank Bund Road, Hyderabad – 500 063  |  hydraa.telangana.gov.in', 40, 46, { width: doc.page.width - 80, align: 'center' });
  // Thin gold divider
  doc.rect(40, 60, doc.page.width - 80, 1).fill('#f4a820');
  doc.fill('#f4a820').font('Helvetica-Bold').fontSize(11)
     .text(title, 40, 67, { width: doc.page.width - 80, align: 'center' });
  doc.y = 108;
  doc.fill('#000000');
}

// ────────────────────────────────────────────────────
//  HELPER — section heading
// ────────────────────────────────────────────────────
function sectionHead(doc, text) {
  doc.moveDown(0.5);
  const y = doc.y;
  doc.rect(40, y, doc.page.width - 80, 20).fill('#0b2040');
  doc.fill('#ffffff').font('Helvetica-Bold').fontSize(9)
     .text(text, 48, y + 5, { width: doc.page.width - 100, lineBreak: false });
  doc.y = y + 26;
  doc.fill('#000000').font('Helvetica').fontSize(9.5);
}

// ────────────────────────────────────────────────────
//  HELPER — key-value row
// ────────────────────────────────────────────────────
function kvRow(doc, key, value) {
  doc.font('Helvetica-Bold').fontSize(9).text(`${key}: `, { continued: true });
  doc.font('Helvetica').fontSize(9).text(value || '—');
}

// ────────────────────────────────────────────────────
//  HELPER — horizontal rule
// ────────────────────────────────────────────────────
function hRule(doc) {
  doc.moveDown(0.3);
  doc.rect(40, doc.y, doc.page.width - 80, 0.5).fill('#cccccc');
  doc.fill('#000000');
  doc.moveDown(0.3);
}

// ────────────────────────────────────────────────────
//  FORMAT DATE
// ────────────────────────────────────────────────────
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
}

// ────────────────────────────────────────────────────
//  GENERATE PETITION NUMBER
// ────────────────────────────────────────────────────
function numberToWords(n) {
  const w = ['zero','one','two','three','four','five','six','seven','eight','nine','ten',
             'eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen','twenty',
             'thirty','forty','fifty','sixty'];
  if (n <= 20) return w[n];
  if (n === 30) return w[21]; if (n === 45) return 'forty-five'; if (n === 60) return w[23];
  return String(n);
}

function petitionNo(complaint_id) {
  const yr = new Date().getFullYear();
  return `HYDRAA/PET/${yr}/${String(complaint_id).padStart(5, '0')}`;
}
function noticeNo(complaint_id) {
  const yr = new Date().getFullYear();
  return `HYDRAA/SCN/${yr}/${String(complaint_id).padStart(5, '0')}`;
}

// ────────────────────────────────────────────────────
//  GENERATE PETITION PDF
// ────────────────────────────────────────────────────
const generatePetition = async (req, res) => {
  const { complaint_id } = req.params;
  const { to_name, to_address, to_email, police_station_id, action_requested } = req.body;
  const generated_by_id   = req.user.id;
  const generated_by_role = req.user.role;

  try {
    const { complaint, accused, visitReport, history, documents } = await fetchComplaintFull(complaint_id);
    if (!complaint) return res.status(404).json({ success: false, message: 'Complaint not found.' });

    let recipientName  = to_name || '';
    let recipientEmail = to_email || null;
    if (police_station_id && !to_name) {
      const [[ps]] = await db.query('SELECT name, email FROM police_stations WHERE id = ?', [police_station_id]);
      if (ps) { recipientName = ps.name; if (!recipientEmail) recipientEmail = ps.email; }
    }

    // Record in petition_notices
    await db.query(
      `INSERT INTO petition_notices (complaint_id, doc_type, generated_by_id, generated_by_role, sent_to_name, sent_to_email, sent_to_type, police_station_id, send_status)
       VALUES (?, 'petition', ?, ?, ?, ?, 'police_station', ?, 'generated')`,
      [complaint_id, generated_by_id, generated_by_role, recipientName, recipientEmail, police_station_id || null]
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Petition_${complaint.complaint_no}.pdf"`);

    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    doc.pipe(res);

    drawPdfHeader(doc, 'PETITION — REQUEST FOR POLICE ACTION');

    // Petition number, date, MOST URGENT tag
    const petNo = petitionNo(complaint_id);
    doc.font('Helvetica-Bold').fontSize(9).fill('#cc0000')
       .text('MOST URGENT', { align: 'right' });
    doc.fill('#000000').font('Helvetica').fontSize(9);
    doc.text(`Petition No: ${petNo}`, { align: 'right' });
    doc.text(`Date: ${fmtDate(new Date())}`, { align: 'right' });
    doc.text(`Ref. Complaint No: ${complaint.complaint_no}  (Filed: ${fmtDate(complaint.created_at)})`, { align: 'right' });
    hRule(doc);

    // To block
    doc.font('Helvetica-Bold').fontSize(10).text('To,');
    doc.font('Helvetica').fontSize(10)
       .text(recipientName || 'The Station House Officer')
       .text(to_address || (complaint.mandal_name ? `${complaint.mandal_name} Police Station, ${complaint.district_name || ''}` : ''));
    doc.moveDown(0.6);

    doc.font('Helvetica-Bold').fontSize(10).text('Sub: ', { continued: true });
    doc.font('Helvetica').text(`Request for police action under HYDRAA Act, 2024 — Complaint No. ${complaint.complaint_no} — ${complaint.title || complaint.category_name}`);
    doc.moveDown(0.2);
    doc.font('Helvetica-Bold').text('Ref: ', { continued: true });
    doc.font('Helvetica').text(`HYDRAA Complaint No. ${complaint.complaint_no} dated ${fmtDate(complaint.created_at)}, registered under ${complaint.category_name || 'General'}`);
    hRule(doc);

    doc.font('Helvetica').fontSize(10)
       .text('Sir / Madam,', { indent: 20 }).moveDown(0.4)
       .text(
         `This office has received a complaint under the provisions of the Hyderabad Disaster Response and Assets Protection Agency Act, 2024 (HYDRAA Act). After preliminary verification, it has been found that the complaint involves encroachment / illegal construction / unauthorised activity within the jurisdiction of your police station. The matter requires immediate police assistance to facilitate HYDRAA's field operations. The details are furnished below:`,
         { indent: 20, align: 'justify' }
       );

    // 1. Complainant
    sectionHead(doc, '1. COMPLAINANT DETAILS');
    kvRow(doc, 'Name', complaint.citizen_name);
    kvRow(doc, 'Mobile', complaint.citizen_phone);
    kvRow(doc, 'Email', complaint.citizen_email);

    // 2. Complaint details
    sectionHead(doc, '2. COMPLAINT DETAILS');
    kvRow(doc, 'HYDRAA Complaint No', complaint.complaint_no);
    kvRow(doc, 'Date of Filing', fmtDate(complaint.created_at));
    kvRow(doc, 'Category', complaint.category_name);
    kvRow(doc, 'Sub-Category', complaint.subcategory_name);
    kvRow(doc, 'Priority', (complaint.priority || '').toUpperCase());
    kvRow(doc, 'Current Status', (complaint.status || '').toUpperCase());
    kvRow(doc, 'Location / Address', complaint.address);
    kvRow(doc, 'District', complaint.district_name);
    kvRow(doc, 'Mandal', complaint.mandal_name);
    doc.moveDown(0.3);
    doc.font('Helvetica-Bold').fontSize(9).text('Description of Complaint:');
    doc.font('Helvetica').fontSize(9).text(complaint.description || '—', { indent: 10, align: 'justify' });

    // 3. Land/Property
    if (complaint.land_survey_no || complaint.khata_no) {
      sectionHead(doc, '3. LAND / PROPERTY DETAILS');
      kvRow(doc, 'District', complaint.land_district || complaint.district_name);
      kvRow(doc, 'Mandal', complaint.land_mandal || complaint.mandal_name);
      kvRow(doc, 'Village / Locality', complaint.land_village);
      kvRow(doc, 'Survey No', complaint.land_survey_no);
      kvRow(doc, 'Khata No', complaint.khata_no);
      kvRow(doc, 'Property Address', complaint.land_address);
    }

    // 4. Accused
    if (accused.length > 0) {
      sectionHead(doc, `4. ACCUSED / OFFENDER DETAILS (${accused.length} person(s))`);
      accused.forEach((a, i) => {
        if (i > 0) doc.moveDown(0.3);
        doc.font('Helvetica-Bold').fontSize(9).text(`Accused ${i + 1}:`);
        kvRow(doc, 'Name', a.name);
        kvRow(doc, 'Mobile', a.phone);
        kvRow(doc, 'Address', a.address);
        kvRow(doc, 'Relation to Complainant', a.relation);
        kvRow(doc, 'Occupation', a.occupation);
      });
    }

    // 5. Site visit
    if (visitReport) {
      sectionHead(doc, '5. HYDRAA FIELD INSPECTION REPORT');
      kvRow(doc, 'Date of Inspection', fmtDate(visitReport.visit_date));
      kvRow(doc, 'Time', visitReport.visit_time || '—');
      kvRow(doc, 'Inspecting Officer', visitReport.official_name);
      kvRow(doc, 'Encroachment Area', visitReport.encroachment_area);
      kvRow(doc, 'Type of Construction', visitReport.construction_type);
      kvRow(doc, 'Current Status of Site', visitReport.current_status);
      if (visitReport.findings) {
        doc.moveDown(0.2);
        doc.font('Helvetica-Bold').fontSize(9).text('Field Findings:');
        doc.font('Helvetica').fontSize(9).text(visitReport.findings, { indent: 10, align: 'justify' });
      }
    }

    // 6. Complaint status history
    if (history.length > 0) {
      sectionHead(doc, '6. ACTION TRAIL / STATUS HISTORY');
      history.forEach(h => {
        doc.font('Helvetica').fontSize(8)
           .text(`${fmtDate(h.changed_at)}  —  ${(h.old_status || 'NEW').toUpperCase()} → ${h.new_status.toUpperCase()}  (${h.changed_by_role})${h.remarks ? ':  ' + h.remarks : ''}`);
      });
    }

    // 7. Action requested
    sectionHead(doc, '7. ACTION REQUESTED FROM POLICE');
    doc.font('Helvetica').fontSize(9.5).text(
      action_requested ||
      `You are hereby requested to: (i) register an FIR / complaint as applicable under the Indian Penal Code and relevant sections; (ii) provide police protection to HYDRAA field teams during inspection and demolition proceedings; (iii) prevent the accused from obstructing HYDRAA operations; and (iv) intimate this office of the action taken within 7 days, as required under the HYDRAA Act, 2024.`,
      { indent: 10, align: 'justify' }
    );

    // Signature block
    doc.moveDown(2);
    doc.font('Helvetica').fontSize(10).text('Yours faithfully,', { indent: 20 }).moveDown(2);
    const sigX = doc.page.width - 240;
    doc.font('Helvetica-Bold').fontSize(10).text('________________________________', sigX, doc.y);
    doc.font('Helvetica').fontSize(9)
       .text('Commissioner / Authorised Officer', sigX)
       .text('HYDRAA — Hyderabad Disaster Response &', sigX)
       .text('Asset Protection Agency', sigX)
       .text('Government of Telangana', sigX)
       .text(`Date: ${fmtDate(new Date())}`, sigX);

    // Copy to
    hRule(doc);
    doc.font('Helvetica-Bold').fontSize(8.5).text('Copy to:', 40, doc.y);
    doc.font('Helvetica').fontSize(8.5)
       .text(`1. The Superintendent of Police / Deputy Commissioner of Police, ${complaint.district_name || 'concerned district'}.`)
       .text('2. The Director, HYDRAA, Hyderabad (for records).')
       .text('3. Office file.');

    // Enclosures — listed at end in proper government letter format
    if (documents.length > 0) {
      doc.moveDown(1.2);
      hRule(doc);
      doc.font('Helvetica-Bold').fontSize(9).text('ENCLOSURES / EVIDENCE DOCUMENTS', 40, doc.y).moveDown(0.3);
      documents.forEach((d, i) => {
        doc.font('Helvetica').fontSize(8.5)
           .text(`${i + 1}.  [${d.doc_type}]  ${d.file_name}${d.caption ? '  —  ' + d.caption : ''}  (Uploaded: ${fmtDate(d.created_at)})`);
      });
    }

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

    const scnNo = noticeNo(complaint_id);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Notice_${complaint.complaint_no}.pdf"`);

    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    doc.pipe(res);

    drawPdfHeader(doc, 'SHOW CAUSE NOTICE');

    // Notice number + date
    doc.font('Helvetica').fontSize(9);
    doc.text(`Notice No: ${scnNo}`, { align: 'right' });
    doc.text(`Date: ${fmtDate(new Date())}`, { align: 'right' });
    doc.text(`Ref. Complaint No: ${complaint.complaint_no}  (Filed: ${fmtDate(complaint.created_at)})`, { align: 'right' });
    hRule(doc);

    // To block
    doc.font('Helvetica-Bold').fontSize(10).text('To,');
    if (targetAccused) {
      doc.font('Helvetica').fontSize(10)
         .text(targetAccused.name)
         .text(targetAccused.address || 'Address not on record');
    } else {
      doc.font('Helvetica').fontSize(10).text('The Accused Person / Responsible Party');
    }
    doc.moveDown(0.6);

    doc.font('Helvetica-Bold').fontSize(10).text('Sub: ', { continued: true });
    doc.font('Helvetica').text(`Show Cause Notice — Action under HYDRAA Act, 2024 — ${complaint.category_name || 'Encroachment / Unauthorised Construction'}`);
    doc.moveDown(0.2);
    doc.font('Helvetica-Bold').text('Ref: ', { continued: true });
    doc.font('Helvetica').text(`HYDRAA Complaint No. ${complaint.complaint_no} dated ${fmtDate(complaint.created_at)}`);
    hRule(doc);

    doc.font('Helvetica').fontSize(10).text('Sir / Madam,', { indent: 20 }).moveDown(0.4);
    doc.text(
      `It has been brought to the notice of this office that you have been involved in the encroachment / unauthorised construction / illegal activity detailed herein, within the jurisdiction of the Hyderabad Disaster Response and Assets Protection Agency (HYDRAA), established under the HYDRAA Act, 2024. After field inspection and verification by HYDRAA officials, a prima facie case of violation has been established against you.`,
      { indent: 20, align: 'justify' }
    ).moveDown(0.3);
    doc.text(
      `You are hereby called upon to SHOW CAUSE, in writing, within the stipulated period below, as to why action should not be initiated against you under the provisions of the HYDRAA Act, 2024 and other applicable laws.`,
      { indent: 20, align: 'justify' }
    );

    // 1. Violation
    sectionHead(doc, '1. NATURE OF ALLEGED VIOLATION');
    kvRow(doc, 'HYDRAA Complaint No', complaint.complaint_no);
    kvRow(doc, 'Date of Complaint', fmtDate(complaint.created_at));
    kvRow(doc, 'Category of Violation', complaint.category_name);
    kvRow(doc, 'Sub-Category', complaint.subcategory_name);
    kvRow(doc, 'Location / Address', complaint.address);
    kvRow(doc, 'District', complaint.district_name);
    kvRow(doc, 'Mandal', complaint.mandal_name);
    doc.moveDown(0.3);
    doc.font('Helvetica-Bold').fontSize(9).text('Details of Alleged Violation:');
    doc.font('Helvetica').fontSize(9).text(complaint.description || '—', { indent: 10, align: 'justify' });

    // 2. Property
    if (complaint.land_survey_no || complaint.khata_no) {
      sectionHead(doc, '2. PROPERTY / LAND DETAILS');
      kvRow(doc, 'Survey No', complaint.land_survey_no);
      kvRow(doc, 'Khata No', complaint.khata_no);
      kvRow(doc, 'Village / Locality', complaint.land_village);
      kvRow(doc, 'Mandal', complaint.land_mandal || complaint.mandal_name);
      kvRow(doc, 'District', complaint.land_district || complaint.district_name);
    }

    // 3. Inspection findings
    if (visitReport) {
      sectionHead(doc, '3. HYDRAA FIELD INSPECTION REPORT');
      kvRow(doc, 'Date of Inspection', fmtDate(visitReport.visit_date));
      kvRow(doc, 'Inspecting Officer', visitReport.official_name);
      kvRow(doc, 'Encroachment Area', visitReport.encroachment_area);
      kvRow(doc, 'Type of Construction', visitReport.construction_type);
      kvRow(doc, 'Current Status of Site', visitReport.current_status);
      if (visitReport.findings) {
        doc.moveDown(0.2);
        doc.font('Helvetica-Bold').fontSize(9).text('Inspection Findings:');
        doc.font('Helvetica').fontSize(9).text(visitReport.findings, { indent: 10, align: 'justify' });
      }
    }

    // 4. Response required
    sectionHead(doc, '4. SHOW CAUSE — RESPONSE REQUIRED');
    doc.font('Helvetica').fontSize(9.5).text(
      `You are hereby DIRECTED to submit a written reply / explanation to this office within ${response_days || 15} (${numberToWords(parseInt(response_days) || 15)}) days from the date of this notice, i.e., on or before ${fmtDate(deadline)}.`,
      { indent: 10 }
    ).moveDown(0.3);
    doc.text(
      `Your response must be addressed to: The Commissioner / Authorised Officer, HYDRAA, HYDRAA Bhavan, Tank Bund Road, Hyderabad – 500 063, or submitted in person at the HYDRAA office during working hours.`,
      { indent: 10, align: 'justify' }
    ).moveDown(0.3);
    doc.font('Helvetica-Bold').fontSize(9.5).fill('#cc0000')
       .text('IMPORTANT: Failure to respond within the prescribed period will result in ex-parte proceedings being initiated against you without further notice.', { indent: 10 });
    doc.fill('#000000');

    // 5. Consequences
    sectionHead(doc, '5. CONSEQUENCES OF NON-COMPLIANCE (HYDRAA Act, 2024)');
    const consequences = [
      'Demolition / removal of unauthorised structures at your cost under Section 16(1) of HYDRAA Act, 2024',
      'Recovery of encroached Government / public / FTL / buffer zone land',
      'Prosecution under applicable provisions of the Bharatiya Nyaya Sanhita (BNS), 2023',
      'Levy of penalty and fine as prescribed under HYDRAA Act, 2024',
      'Recovery of cost of demolition and restoration from the accused as arrears of land revenue',
    ];
    consequences.forEach((c, i) => {
      doc.font('Helvetica').fontSize(9).text(`${i + 1}.  ${c}`, { indent: 10 });
    });

    // Signature
    doc.moveDown(2);
    doc.font('Helvetica').fontSize(10).text('Issued under the authority of:', { indent: 20 }).moveDown(2);
    const sigX2 = doc.page.width - 240;
    doc.font('Helvetica-Bold').fontSize(10).text('________________________________', sigX2, doc.y);
    doc.font('Helvetica').fontSize(9)
       .text('Commissioner / Authorised Officer', sigX2)
       .text('HYDRAA — Hyderabad Disaster Response &', sigX2)
       .text('Asset Protection Agency', sigX2)
       .text('Government of Telangana', sigX2)
       .text(`Date: ${fmtDate(new Date())}`, sigX2);

    hRule(doc);
    doc.font('Helvetica').fontSize(7.5).fill('#555555')
       .text(
         'This is an official notice issued under the HYDRAA Act, 2024 by the Government of Telangana. Any attempt to tamper with, destroy, or obstruct the service of this notice is a punishable offence. For queries: HYDRAA Bhavan, Tank Bund Road, Hyderabad – 500 063.',
         { align: 'center' }
       );

    doc.end();
  } catch (err) {
    console.error('generateNotice error:', err);
    if (!res.headersSent) res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ────────────────────────────────────────────────────
//  HELPER — generate PDF to Buffer (for email attachment)
// ────────────────────────────────────────────────────
function generatePdfToBuffer(buildFn) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const chunks = [];
    const pass = new PassThrough();
    pass.on('data', chunk => chunks.push(chunk));
    pass.on('end', () => resolve(Buffer.concat(chunks)));
    pass.on('error', reject);
    doc.pipe(pass);
    buildFn(doc);
    doc.end();
  });
}

// ────────────────────────────────────────────────────
//  SEND PETITION EMAIL
// ────────────────────────────────────────────────────
const sendPetitionEmail = async (req, res) => {
  const { complaint_id } = req.params;
  const { to_name, to_address, to_email, police_station_id, action_requested } = req.body;
  const generated_by_id   = req.user.id;
  const generated_by_role = req.user.role;

  try {
    const { complaint, accused, visitReport, history, documents } = await fetchComplaintFull(complaint_id);
    if (!complaint) return res.status(404).json({ success: false, message: 'Complaint not found.' });

    let recipientName  = to_name || '';
    let recipientEmail = to_email || null;
    if (police_station_id && !to_name) {
      const [[ps]] = await db.query('SELECT name, email FROM police_stations WHERE id = ?', [police_station_id]);
      if (ps) { recipientName = ps.name; if (!recipientEmail) recipientEmail = ps.email; }
    }

    if (!recipientEmail) {
      return res.json({ success: false, noEmail: true, message: 'No email address for this officer. Please update in Police Stations management.' });
    }

    const pdfBuffer = await generatePdfToBuffer((doc) => {
      drawPdfHeader(doc, 'PETITION — Request for Action');
      doc.moveDown(0.5);
      doc.font('Helvetica').fontSize(10);
      doc.text(`Ref No: ${complaint.complaint_no}`, { align: 'right' });
      doc.text(`Date: ${fmtDate(new Date())}`, { align: 'right' });
      doc.moveDown(0.5);
      doc.font('Helvetica-Bold').fontSize(10).text('To,');
      doc.font('Helvetica').fontSize(10)
         .text(recipientName || 'The Station House Officer')
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

      sectionHead(doc, '1. COMPLAINANT DETAILS');
      kvRow(doc, 'Name', complaint.citizen_name);
      kvRow(doc, 'Phone', complaint.citizen_phone);
      kvRow(doc, 'Email', complaint.citizen_email);

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

      if (complaint.land_survey_no || complaint.khata_no) {
        sectionHead(doc, '3. LAND / PROPERTY DETAILS');
        kvRow(doc, 'District', complaint.land_district || complaint.district_name);
        kvRow(doc, 'Mandal', complaint.land_mandal || complaint.mandal_name);
        kvRow(doc, 'Village', complaint.land_village);
        kvRow(doc, 'Survey No', complaint.land_survey_no);
        kvRow(doc, 'Khata No', complaint.khata_no);
        kvRow(doc, 'Land Address', complaint.land_address);
      }

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

      if (documents.length > 0) {
        sectionHead(doc, '6. EVIDENCE & DOCUMENTS COLLECTED');
        documents.forEach((d, i) => {
          doc.font('Helvetica').fontSize(9)
             .text(`${i + 1}. [${d.doc_type}] ${d.file_name}${d.caption ? ' — ' + d.caption : ''} (uploaded by ${d.uploaded_by_role} on ${fmtDate(d.created_at)})`);
        });
      }

      if (history.length > 0) {
        sectionHead(doc, '7. COMPLAINT HISTORY');
        history.forEach(h => {
          doc.font('Helvetica').fontSize(8)
             .text(`${fmtDate(h.changed_at)} — ${(h.old_status || 'new').toUpperCase()} → ${h.new_status.toUpperCase()} (by ${h.changed_by_role})${h.remarks ? ': ' + h.remarks : ''}`);
        });
      }

      sectionHead(doc, '8. ACTION REQUESTED');
      doc.font('Helvetica').fontSize(10)
         .text(action_requested || 'You are requested to take necessary action as per applicable laws and regulations and inform this office of the action taken at the earliest.', { indent: 10 });

      doc.moveDown(1.5);
      doc.font('Helvetica').fontSize(10)
         .text('Yours faithfully,', { indent: 20 }).moveDown(1.5);
      doc.font('Helvetica-Bold').fontSize(10)
         .text('________________________________', { align: 'right' });
      doc.font('Helvetica').fontSize(9)
         .text('Authorized Signatory', { align: 'right' })
         .text('HYDRAA — Government of Telangana', { align: 'right' })
         .text(`Date: ${fmtDate(new Date())}`, { align: 'right' });
    });

    await sendMail({
      to: recipientEmail,
      subject: `HYDRAA Petition — Complaint ${complaint.complaint_no}`,
      html: `<p>Dear ${recipientName || 'Sir/Madam'},</p><p>Please find the attached petition from HYDRAA regarding complaint <strong>${complaint.complaint_no}</strong> — ${complaint.title}.</p><p>Please take necessary action as requested in the petition and inform this office at the earliest.</p><br/><p>Regards,<br/><strong>HYDRAA — Government of Telangana</strong></p>`,
      attachments: [{ name: `Petition_${complaint.complaint_no}.pdf`, content: pdfBuffer.toString('base64') }],
    });

    await db.query(
      `INSERT INTO petition_notices (complaint_id, doc_type, generated_by_id, generated_by_role, sent_to_name, sent_to_email, sent_to_type, police_station_id, send_status, sent_at)
       VALUES (?, 'petition', ?, ?, ?, ?, 'police_station', ?, 'sent', NOW())`,
      [complaint_id, generated_by_id, generated_by_role, recipientName, recipientEmail, police_station_id || null]
    );

    res.json({ success: true, message: `Petition sent to ${recipientEmail}` });
  } catch (err) {
    console.error('sendPetitionEmail error:', err);
    res.status(500).json({ success: false, message: 'Failed to send petition email. ' + err.message });
  }
};

// ────────────────────────────────────────────────────
//  SEND NOTICE EMAIL
// ────────────────────────────────────────────────────
const sendNoticeEmail = async (req, res) => {
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

    if (!targetAccused?.email) {
      return res.json({ success: false, noEmail: true, message: 'No email address found for the selected accused person. Please download and deliver manually.' });
    }

    const deadline = new Date();
    deadline.setDate(deadline.getDate() + (parseInt(response_days) || 15));
    const noticeNo = `HYD-NOTICE-${complaint.complaint_no}-${Date.now().toString().slice(-5)}`;

    const pdfBuffer = await generatePdfToBuffer((doc) => {
      drawPdfHeader(doc, 'SHOW CAUSE NOTICE');
      doc.moveDown(0.5);
      doc.font('Helvetica').fontSize(10);
      doc.text(`Notice No: ${noticeNo}`, { align: 'right' });
      doc.text(`Date: ${fmtDate(new Date())}`, { align: 'right' });
      doc.moveDown(0.5);

      doc.font('Helvetica-Bold').fontSize(10).text('To,');
      doc.font('Helvetica').fontSize(10)
         .text(targetAccused.name)
         .text(targetAccused.address || 'Address not on record');

      doc.moveDown(0.5);
      doc.font('Helvetica-Bold').text('Sub: ', { continued: true });
      doc.font('Helvetica').text('Show Cause Notice — Action under HYDRAA Act');
      doc.font('Helvetica-Bold').text('Ref: ', { continued: true });
      doc.font('Helvetica').text(`Complaint No. ${complaint.complaint_no} dated ${fmtDate(complaint.created_at)}`);

      doc.moveDown(0.5);
      doc.font('Helvetica').fontSize(10).text('Sir/Madam,', { indent: 20 }).moveDown(0.3);
      doc.text('It has been brought to the notice of this office that you have been involved in the following violation/encroachment within the jurisdiction of HYDRAA. You are hereby called upon to show cause why action should not be initiated against you under the provisions of applicable laws.', { indent: 20 });

      sectionHead(doc, '1. NATURE OF VIOLATION / COMPLAINT');
      kvRow(doc, 'Complaint No', complaint.complaint_no);
      kvRow(doc, 'Date of Complaint', fmtDate(complaint.created_at));
      kvRow(doc, 'Category', complaint.category_name);
      kvRow(doc, 'Location', complaint.address);
      doc.moveDown(0.3);
      doc.font('Helvetica-Bold').fontSize(9).text('Details of Violation:');
      doc.font('Helvetica').fontSize(9).text(complaint.description || '—', { indent: 10 });

      if (complaint.land_survey_no || complaint.khata_no) {
        sectionHead(doc, '2. PROPERTY / LAND DETAILS');
        kvRow(doc, 'Survey No', complaint.land_survey_no);
        kvRow(doc, 'Khata No', complaint.khata_no);
        kvRow(doc, 'Village', complaint.land_village);
        kvRow(doc, 'Mandal', complaint.land_mandal || complaint.mandal_name);
        kvRow(doc, 'District', complaint.land_district || complaint.district_name);
      }

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

      sectionHead(doc, '4. RESPONSE REQUIRED');
      doc.font('Helvetica').fontSize(10).text(
        `You are hereby directed to appear before this office or submit a written explanation within ${response_days || 15} days from the date of this notice (i.e., on or before ${fmtDate(deadline)}).`,
        { indent: 10 }
      ).moveDown(0.3);
      doc.text('Failure to respond within the stipulated time will result in ex-parte action being taken against you as per applicable laws, including but not limited to demolition of unauthorized structures, legal proceedings, and/or penalty under HYDRAA Act.', { indent: 10 });

      sectionHead(doc, '5. CONSEQUENCES OF NON-COMPLIANCE');
      ['Demolition of unauthorized constructions at your cost',
       'Recovery of encroached government/public land',
       'Legal proceedings under applicable acts',
       'Penalty and fine as per HYDRAA regulations'].forEach((c, i) => {
        doc.font('Helvetica').fontSize(9).text(`${i + 1}. ${c}`, { indent: 10 });
      });

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
    });

    await sendMail({
      to: targetAccused.email,
      subject: `Show Cause Notice — HYDRAA Complaint ${complaint.complaint_no}`,
      html: `<p>Dear ${targetAccused.name},</p><p>Please find the attached Show Cause Notice issued by HYDRAA regarding complaint <strong>${complaint.complaint_no}</strong>.</p><p>You are required to respond within <strong>${response_days || 15} days</strong>. Failure to respond will result in ex-parte action as per applicable laws.</p><br/><p>Regards,<br/><strong>HYDRAA — Government of Telangana</strong></p>`,
      attachments: [{ name: `Notice_${complaint.complaint_no}.pdf`, content: pdfBuffer.toString('base64') }],
    });

    await db.query(
      `INSERT INTO petition_notices (complaint_id, doc_type, generated_by_id, generated_by_role, sent_to_name, sent_to_email, sent_to_type, send_status, sent_at)
       VALUES (?, 'notice', ?, ?, ?, ?, 'accused', 'sent', NOW())`,
      [complaint_id, generated_by_id, generated_by_role, targetAccused.name, targetAccused.email]
    );

    res.json({ success: true, message: `Notice sent to ${targetAccused.email}` });
  } catch (err) {
    console.error('sendNoticeEmail error:', err);
    res.status(500).json({ success: false, message: 'Failed to send notice email. ' + err.message });
  }
};

module.exports = {
  getAccused,
  addAccused,
  updateAccused,
  deleteAccused,
  getSiteVisitReport,
  saveSiteVisitReport,
  deleteSiteVisitReport,
  generateSiteVisitPdf,
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
  sendPetitionEmail,
  sendNoticeEmail,
};
