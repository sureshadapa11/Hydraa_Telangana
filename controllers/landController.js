// =====================================================
//   Land Records Controller — HYDRAA
//   Proxies Dharani (dharani.telangana.gov.in) API
//   when key is available, returns demo data otherwise.
//
//   To activate real API:
//     Add DHARANI_API_KEY=<your_key> to Railway env vars
//     Add DHARANI_API_BASE=<base_url_from_dharani> to Railway env vars
// =====================================================

const DHARANI_API_BASE = process.env.DHARANI_API_BASE || 'https://api.dharani.telangana.gov.in/v1';

// ── Search land record ──────────────────────────────
const searchLandRecord = async (req, res) => {
  const { district, mandal, village, survey_no, khata_no } = req.query;
  const apiKey = process.env.DHARANI_API_KEY;

  if (!district && !survey_no && !khata_no) {
    return res.status(400).json({ success: false, message: 'Provide at least district and survey number or khata number.' });
  }

  // ── Real API mode ────────────────────────────────
  if (apiKey) {
    try {
      const params = new URLSearchParams();
      if (district)  params.set('district',  district);
      if (mandal)    params.set('mandal',    mandal);
      if (village)   params.set('village',   village);
      if (survey_no) params.set('surveyNo',  survey_no);
      if (khata_no)  params.set('khataNo',   khata_no);

      const response = await fetch(`${DHARANI_API_BASE}/landRecords?${params}`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        const errText = await response.text();
        return res.status(response.status).json({ success: false, message: `Dharani API error: ${errText}` });
      }

      const data = await response.json();
      return res.json({ success: true, demo: false, data });
    } catch (err) {
      console.error('Dharani API error:', err);
      return res.status(502).json({ success: false, message: 'Could not reach Dharani API. Try again.' });
    }
  }

  // ── Demo mode (no API key configured) ────────────
  // Realistic Dharani-style data showing all key fields
  // officials need for complaint verification
  const hasData = survey_no || khata_no;
  return res.json({
    success: true,
    demo: true,
    data: hasData ? {
      // Ownership
      pattadarName:     'Demo Pattadar — Raju Goud',
      fatherName:       'Raghavaiah Goud',
      pattadarPhone:    '9876543210',
      passbook:         'PB/2024/TL/00123',

      // Location
      district:         district  || '—',
      mandal:           mandal    || '—',
      village:          village   || '—',
      surveyNo:         survey_no || '—',
      khataNo:          khata_no  || '—',

      // Land classification — KEY for HYDRAA complaints
      landClassification: 'Ryotwari',   // Ryotwari / Poramboke / Assigned / Inam / Endowment
      landType:           'Agricultural (Wet)',
      area:               '2.50 Acres',

      // Legal status — KEY for case verification
      isProhibited:       false,   // true = govt blocked, cannot be transferred
      prohibitionReason:  null,    // reason if prohibited
      courtAttachment:    false,   // true = active court case/injunction
      courtCaseNo:        null,    // case number if attached
      pendingMutation:    false,   // true = disputed ownership transfer pending
      encumbrance:        false,   // true = bank loan/mortgage registered
      encumbranceDetails: null,    // bank name + amount if encumbered

      // Record
      lastMutation:       '12-Mar-2024',
      mutationStatus:     'Completed',
    } : null,
  });
};

module.exports = { searchLandRecord };
