// =====================================================
//   Land Records Controller — HYDRAA
//   Proxies Bhubharati API when key is available,
//   returns demo data otherwise.
//
//   To activate real API:
//     Add BHUBHARATI_API_KEY=<your_key> to .env
//     Update BHUBHARATI_API_BASE if the base URL differs
// =====================================================

const BHUBHARATI_API_BASE = process.env.BHUBHARATI_API_BASE || 'https://api.bhubharati.telangana.gov.in/v1';

// ── Search land record ──────────────────────────────
const searchLandRecord = async (req, res) => {
  const { district, mandal, village, survey_no, khata_no } = req.query;
  const apiKey = process.env.BHUBHARATI_API_KEY;

  if (!district && !survey_no && !khata_no) {
    return res.status(400).json({ success: false, message: 'Provide at least district and survey number or khata number.' });
  }

  // ── Real API mode ────────────────────────────────
  if (apiKey) {
    try {
      const params = new URLSearchParams();
      if (district)  params.set('district', district);
      if (mandal)    params.set('mandal',   mandal);
      if (village)   params.set('village',  village);
      if (survey_no) params.set('surveyNo', survey_no);
      if (khata_no)  params.set('khataNo',  khata_no);

      const response = await fetch(`${BHUBHARATI_API_BASE}/landRecords?${params}`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json',
        },
        timeout: 10000,
      });

      if (!response.ok) {
        const errText = await response.text();
        return res.status(response.status).json({ success: false, message: `Bhubharati API error: ${errText}` });
      }

      const data = await response.json();
      return res.json({ success: true, demo: false, data });
    } catch (err) {
      console.error('Bhubharati API error:', err);
      return res.status(502).json({ success: false, message: 'Could not reach Bhubharati API. Try again.' });
    }
  }

  // ── Demo mode (no API key configured) ────────────
  // Returns realistic mock data so the UI is fully testable
  const hasData = survey_no || khata_no;
  return res.json({
    success: true,
    demo: true,
    data: hasData ? {
      ownerName:     'Demo Owner — Raju Goud',
      fatherName:    'Raghavaiah Goud',
      district:      district  || '—',
      mandal:        mandal    || '—',
      village:       village   || '—',
      surveyNo:      survey_no || '—',
      khataNo:       khata_no  || '—',
      area:          '2.50 Acres',
      landType:      'Agricultural (Wet)',
      classification:'Ryotwari',
      status:        'Clear Title',
      lastMutation:  '12-Mar-2024',
      passbook:      'PB/2024/TL/00123',
    } : null,
  });
};

module.exports = { searchLandRecord };
