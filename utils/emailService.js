// =====================================================
//   HYDRAA — Email Service
//   Provider: Brevo HTTP API (no SMTP, works on Railway)
// =====================================================

require('dotenv').config();
const https = require('https');

const BREVO_API_KEY   = process.env.BREVO_API_KEY;
const RESEND_API_KEY  = process.env.RESEND_API_KEY;

// Sender name + address
const FROM_NAME    = 'HYDRAA Telangana';
const FROM_ADDRESS = process.env.EMAIL_FROM_ADDRESS || process.env.EMAIL_USER || 'noreply@hydraa.gov';

// ── HTTP POST helper (no external deps) ──────────────
const httpPost = (url, headers, body) => new Promise((resolve, reject) => {
  const data  = JSON.stringify(body);
  const parts = new URL(url);
  const opts  = {
    hostname: parts.hostname,
    path:     parts.pathname,
    method:   'POST',
    headers:  { ...headers, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
  };
  const req = https.request(opts, (res) => {
    let raw = '';
    res.on('data', c => raw += c);
    res.on('end', () => {
      if (res.statusCode >= 200 && res.statusCode < 300) resolve(raw);
      else reject(new Error(`HTTP ${res.statusCode}: ${raw}`));
    });
  });
  req.on('error', reject);
  req.write(data);
  req.end();
});

// ── Send via Brevo HTTP API ───────────────────────────
const sendViaBrevo = async ({ to, subject, html, attachments = [] }) => {
  const body = {
    sender:      { name: FROM_NAME, email: FROM_ADDRESS },
    to:          [{ email: to }],
    subject,
    htmlContent: html,
  };
  if (attachments.length > 0) body.attachment = attachments;
  await httpPost('https://api.brevo.com/v3/smtp/email', { 'api-key': BREVO_API_KEY }, body);
};

// ── Send via Resend HTTP API ──────────────────────────
const sendViaResend = async ({ to, subject, html, attachments = [] }) => {
  const body = { from: `${FROM_NAME} <${FROM_ADDRESS}>`, to, subject, html };
  if (attachments.length > 0) body.attachments = attachments.map(a => ({ filename: a.name, content: a.content }));
  await httpPost('https://api.resend.com/emails', { 'Authorization': `Bearer ${RESEND_API_KEY}` }, body);
};

// ── Choose provider ───────────────────────────────────
let sendMail;
if (BREVO_API_KEY) {
  sendMail = sendViaBrevo;
  console.log('✅ Email service: Brevo API —', FROM_ADDRESS);
} else if (RESEND_API_KEY) {
  sendMail = sendViaResend;
  console.log('✅ Email service: Resend API —', FROM_ADDRESS);
} else {
  sendMail = async () => { throw new Error('No email provider configured.'); };
  console.warn('⚠️  Email service not configured — set BREVO_API_KEY or RESEND_API_KEY');
}

// ── Shared Brand Header / Footer ──────────────────────
const brandHeader = (label = 'CITIZEN PORTAL') => `
  <div style="background:linear-gradient(135deg,#0097a7 0%,#006978 60%,#004f5c 100%);padding:22px 28px;border-radius:12px 12px 0 0">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="vertical-align:middle">
        <div style="font-family:Arial,sans-serif;font-size:24px;font-weight:900;color:#ffffff;letter-spacing:3px;line-height:1">💧 HYDRAA</div>
        <div style="font-size:10px;color:#b2ebf2;letter-spacing:2.5px;text-transform:uppercase;margin-top:4px;font-family:Arial,sans-serif">Government of Telangana</div>
      </td>
      <td align="right" style="vertical-align:middle;width:1%;white-space:nowrap">
        <span style="display:inline-block;background:#ffffff;color:#006978;font-family:Arial,sans-serif;font-size:9px;font-weight:900;padding:5px 14px;border-radius:20px;letter-spacing:1.5px;white-space:nowrap;text-transform:uppercase">${label}</span>
      </td>
    </tr></table>
  </div>`;

const brandFooter = `
  <div style="background:#f0f9fa;border-top:3px solid #0097a7;padding:18px 28px;border-radius:0 0 12px 12px;text-align:center">
    <p style="font-size:11px;color:#5a8a95;margin:0 0 5px;font-family:Arial,sans-serif">
      Automated notification from <strong style="color:#006978">HYDRAA</strong> — Hyderabad Disaster Response &amp; Asset Protection Agency
    </p>
    <p style="font-size:11px;color:#7aacb5;margin:0;font-family:Arial,sans-serif">
      📞 1800-599-0099 &nbsp;·&nbsp;
      <a href="https://hydraa.telangana.gov.in" style="color:#0097a7;text-decoration:none;font-weight:700">hydraa.telangana.gov.in</a>
    </p>
    <p style="font-size:10px;color:#a0c4cc;margin:8px 0 0;font-family:Arial,sans-serif">
      © ${new Date().getFullYear()} HYDRAA Telangana. All rights reserved.
    </p>
  </div>`;

const wrap = (content, portalLabel = 'CITIZEN PORTAL') => `
<!DOCTYPE html>
<html><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width"/></head>
<body style="margin:0;padding:20px;background:#eaf4f8;font-family:'Segoe UI',Arial,sans-serif">
  <div style="max-width:600px;margin:0 auto;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,30,60,0.12)">
    ${brandHeader(portalLabel)}
    <div style="background:#ffffff;padding:32px">
      ${content}
    </div>
    ${brandFooter}
  </div>
</body></html>`;

const badge = (text, color, bg) =>
  `<span style="background:${bg};color:${color};padding:4px 14px;border-radius:20px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px">${text}</span>`;

const infoRow = (label, value) =>
  `<tr>
     <td style="padding:10px 0;border-bottom:1px solid #eef3f6;font-size:13px;color:#7a9baf;font-weight:600;width:140px;vertical-align:top">${label}</td>
     <td style="padding:10px 0;border-bottom:1px solid #eef3f6;font-size:13px;color:#0d1e2e;vertical-align:top">${value}</td>
   </tr>`;

const button = (text, url, color = '#0097a7') =>
  `<a href="${url}" style="display:inline-block;background:linear-gradient(135deg,${color},${color}cc);color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:700;margin-top:16px">${text}</a>`;

// ─────────────────────────────────────────────────────
//  1. WELCOME / REGISTRATION EMAIL
// ─────────────────────────────────────────────────────
const sendWelcomeEmail = async ({ to, name }) => {
  const html = wrap(`
    <h2 style="font-size:22px;color:#0b1f3a;margin:0 0 8px">Welcome to HYDRAA, ${name}! 🎉</h2>
    <p style="font-size:14px;color:#3d5a72;margin:0 0 24px;line-height:1.7">
      Your citizen account is all set. HYDRAA — Hyderabad Disaster Response &amp; Asset Protection Agency — is here to act on your complaints swiftly and transparently.
    </p>
    <div style="background:#e0f7fa;border-left:4px solid #0097a7;border-radius:0 8px 8px 0;padding:16px 20px;margin-bottom:24px">
      <p style="font-size:13px;font-weight:700;color:#0097a7;margin:0 0 4px">✅ You're ready to go!</p>
      <p style="font-size:13px;color:#3d5a72;margin:0">Log in anytime to file a complaint, upload evidence, and track real-time updates from our field officials.</p>
    </div>
    ${button('🚀 Go to HYDRAA Portal', `${process.env.APP_URL || 'https://hydraa-telangana.up.railway.app'}/hydraa-login.html`)}
    <hr style="border:none;border-top:1px solid #eef3f6;margin:24px 0"/>
    <table width="100%">
      <tr>
        <td style="text-align:center;padding:12px">
          <div style="font-size:24px">📝</div>
          <div style="font-size:12px;color:#7a9baf;margin-top:4px">Lodge Complaints</div>
        </td>
        <td style="text-align:center;padding:12px">
          <div style="font-size:24px">🔍</div>
          <div style="font-size:12px;color:#7a9baf;margin-top:4px">Track Status</div>
        </td>
        <td style="text-align:center;padding:12px">
          <div style="font-size:24px">🛡️</div>
          <div style="font-size:12px;color:#7a9baf;margin-top:4px">Hold Officials Accountable</div>
        </td>
      </tr>
    </table>`);

  await sendMail({
    to,
    subject: '🎉 Welcome to HYDRAA — Your Account is Ready!',
    html,
  });
};

// ─────────────────────────────────────────────────────
//  2. COMPLAINT LODGED CONFIRMATION
// ─────────────────────────────────────────────────────
const sendComplaintConfirmation = async ({ to, name, complaint_no, title, category, priority, address }) => {
  const priorityColor = { urgent:'#7c3aed', high:'#ef4444', medium:'#f59e0b', low:'#10b981' }[priority] || '#0097a7';
  const priorityBg    = { urgent:'rgba(124,58,237,0.1)', high:'rgba(239,68,68,0.1)', medium:'rgba(245,158,11,0.1)', low:'rgba(16,185,129,0.1)' }[priority] || 'rgba(0,151,167,0.1)';

  const html = wrap(`
    <h2 style="font-size:22px;color:#0b1f3a;margin:0 0 4px">Complaint Received ✅</h2>
    <p style="font-size:14px;color:#3d5a72;margin:0 0 24px">Dear ${name}, your complaint has been successfully filed with HYDRAA.</p>

    <div style="background:#f5fafc;border:1px solid #d0e4ec;border-radius:10px;padding:20px;margin-bottom:24px">
      <div style="font-size:11px;color:#7a9baf;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px">Complaint Number</div>
      <div style="font-size:28px;font-weight:700;color:#0097a7;font-family:monospace;letter-spacing:2px">${complaint_no}</div>
      <div style="font-size:12px;color:#aac4d0;margin-top:4px">Save this number to track your complaint</div>
    </div>

    <table width="100%" cellpadding="0" cellspacing="0">
      ${infoRow('Title', `<strong>${title}</strong>`)}
      ${infoRow('Category', category || 'General')}
      ${infoRow('Priority', badge(priority.toUpperCase(), priorityColor, priorityBg))}
      ${infoRow('Location', address || 'Not specified')}
      ${infoRow('Filed On', new Date().toLocaleDateString('en-IN', {day:'2-digit',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'}))}
      ${infoRow('Status', badge('PENDING REVIEW', '#b45309', 'rgba(245,158,11,0.1)'))}
    </table>

    <div style="background:#e0f7fa;border-left:4px solid #0097a7;border-radius:0 8px 8px 0;padding:16px 20px;margin-top:24px">
      <p style="font-size:13px;color:#0097a7;font-weight:700;margin:0 0 4px">⏱ What happens next?</p>
      <ol style="font-size:13px;color:#3d5a72;margin:0;padding-left:18px;line-height:2">
        <li>HYDRAA admin reviews your complaint within 24 hours</li>
        <li>It gets assigned to a field official</li>
        <li>Official takes action and updates status</li>
        <li>You receive an email when it's resolved</li>
      </ol>
    </div>`);

  await sendMail({
    to,
    subject: `✅ Complaint ${complaint_no} Filed — HYDRAA Telangana`,
    html,
  });
};

// ─────────────────────────────────────────────────────
//  3. COMPLAINT ASSIGNED (to citizen + official)
// ─────────────────────────────────────────────────────
const sendComplaintAssigned = async ({ citizenEmail, citizenName, officialEmail, officialName, complaint_no, title, remarks, department }) => {
  // Email to citizen
  const citizenHtml = wrap(`
    <h2 style="font-size:22px;color:#0b1f3a;margin:0 0 4px">Complaint Assigned 📌</h2>
    <p style="font-size:14px;color:#3d5a72;margin:0 0 24px">Dear ${citizenName}, your complaint <strong style="color:#0097a7">${complaint_no}</strong> has been assigned to a HYDRAA field official.</p>
    <table width="100%" cellpadding="0" cellspacing="0">
      ${infoRow('Complaint No.', `<strong style="color:#0097a7">${complaint_no}</strong>`)}
      ${infoRow('Title', title)}
      ${infoRow('Assigned To', `<strong>${officialName}</strong>`)}
      ${infoRow('Department', department || 'HYDRAA')}
      ${infoRow('Status', badge('ASSIGNED', '#1d4ed8', 'rgba(59,130,246,0.1)'))}
      ${remarks ? infoRow('Admin Note', `<em style="color:#3d5a72">${remarks}</em>`) : ''}
    </table>
    <div style="background:#f0fdf4;border-left:4px solid #10b981;border-radius:0 8px 8px 0;padding:14px 18px;margin-top:20px">
      <p style="font-size:13px;color:#065f46;margin:0">The official will review the complaint and take necessary field action. You will be notified when the status is updated.</p>
    </div>`);

  // Only send citizen email if citizenEmail provided (skipped during reassignment)
  if (citizenEmail) {
    await sendMail({
      to:      citizenEmail,
      subject: `📌 Complaint ${complaint_no} Assigned to Official — HYDRAA`,
      html:    citizenHtml,
    });
  }

  // Email to official
  if (officialEmail) {
    const officialHtml = wrap(`
      <h2 style="font-size:22px;color:#0b1f3a;margin:0 0 4px">New Complaint Assigned to You 👷</h2>
      <p style="font-size:14px;color:#3d5a72;margin:0 0 24px">Dear ${officialName}, a new complaint has been assigned to you. Please review and take action at the earliest.</p>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${infoRow('Complaint No.', `<strong style="color:#0097a7">${complaint_no}</strong>`)}
        ${infoRow('Title', `<strong>${title}</strong>`)}
        ${infoRow('Priority', badge('ACTION REQUIRED', '#b91c1c', 'rgba(239,68,68,0.1)'))}
        ${remarks ? infoRow('Admin Instructions', `<em style="color:#3d5a72">${remarks}</em>`) : ''}
        ${infoRow('Assigned On', new Date().toLocaleDateString('en-IN', {day:'2-digit',month:'long',year:'numeric'}))}
      </table>
      <div style="background:#fef3c7;border-left:4px solid #f59e0b;border-radius:0 8px 8px 0;padding:14px 18px;margin-top:20px">
        <p style="font-size:13px;color:#92400e;font-weight:700;margin:0 0 4px">⚡ Action Required</p>
        <p style="font-size:13px;color:#92400e;margin:0">Please log into the HYDRAA Official Portal to review and update the complaint status.</p>
      </div>`, 'OFFICIAL PORTAL');

    await sendMail({
      to:      officialEmail,
      subject: `⚡ New Complaint Assigned: ${complaint_no} — HYDRAA`,
      html:    officialHtml,
    });
  }
};

// ─────────────────────────────────────────────────────
//  4. COMPLAINT STATUS UPDATED (official update)
// ─────────────────────────────────────────────────────
const sendStatusUpdate = async ({ to, name, complaint_no, title, oldStatus, newStatus, remarks, officialName, photos = [] }) => {
  const isResolved = newStatus === 'resolved';
  const statusColors = {
    in_progress:{ color:'#6d28d9', bg:'rgba(139,92,246,0.1)', label:'IN PROGRESS' },
    resolved:   { color:'#065f46', bg:'rgba(16,185,129,0.1)', label:'RESOLVED' },
    closed:     { color:'#374151', bg:'rgba(107,114,128,0.1)', label:'CLOSED' },
    rejected:   { color:'#b91c1c', bg:'rgba(239,68,68,0.1)',  label:'REJECTED' },
  };
  const sc = statusColors[newStatus] || { color:'#0097a7', bg:'rgba(0,151,167,0.1)', label:newStatus.toUpperCase() };

  // Build photo section HTML and Brevo attachments
  let photoHtml = '';
  const attachments = [];
  if (photos && photos.length > 0) {
    photos.forEach((p, i) => {
      // photo_data is stored as a data URL: "data:image/jpeg;base64,..."
      const dataUrl = p.photo_data || '';
      const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        const contentType = match[1];
        const b64 = match[2];
        const ext = contentType.split('/')[1] || 'jpg';
        attachments.push({ content: b64, name: `field_photo_${i + 1}.${ext}` });
      }
    });
    photoHtml = `
    <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:16px 20px;margin-top:20px">
      <p style="font-size:13px;font-weight:700;color:#0369a1;margin:0 0 6px">📷 Field Evidence Photos</p>
      <p style="font-size:13px;color:#3d5a72;margin:0">
        ${attachments.length} photo${attachments.length > 1 ? 's' : ''} attached by the field official as evidence of action taken.
        Please check the attachment${attachments.length > 1 ? 's' : ''} in this email.
      </p>
    </div>`;
  }

  const html = wrap(`
    <h2 style="font-size:22px;color:#0b1f3a;margin:0 0 4px">
      ${isResolved ? '🎉 Complaint Resolved!' : '🔄 Complaint Status Updated'}
    </h2>
    <p style="font-size:14px;color:#3d5a72;margin:0 0 24px">
      Dear ${name}, ${isResolved
        ? 'your complaint has been <strong>resolved</strong> by the HYDRAA field official.'
        : 'the status of your complaint has been updated.'}
    </p>

    <div style="background:#f5fafc;border:1px solid #d0e4ec;border-radius:10px;padding:20px;margin-bottom:20px;text-align:center">
      <div style="font-size:11px;color:#7a9baf;font-weight:700;letter-spacing:1px;margin-bottom:8px">COMPLAINT ${complaint_no}</div>
      <div style="display:flex;align-items:center;justify-content:center;gap:12px">
        ${badge(oldStatus.replace('_',' ').toUpperCase(), '#7a9baf', 'rgba(120,155,175,0.1)')}
        <span style="color:#0097a7;font-size:18px;font-weight:700">→</span>
        ${badge(sc.label, sc.color, sc.bg)}
      </div>
    </div>

    <table width="100%" cellpadding="0" cellspacing="0">
      ${infoRow('Complaint', `<strong>${title}</strong>`)}
      ${infoRow('Updated By', officialName || 'HYDRAA Official')}
      ${infoRow('New Status', badge(sc.label, sc.color, sc.bg))}
      ${infoRow('Updated On', new Date().toLocaleDateString('en-IN', {day:'2-digit',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'}))}
    </table>

    ${remarks ? `
    <div style="background:#f0f9ff;border-left:4px solid #0097a7;border-radius:0 8px 8px 0;padding:14px 18px;margin-top:20px">
      <p style="font-size:12px;color:#0097a7;font-weight:700;margin:0 0 4px">Official Remarks</p>
      <p style="font-size:13px;color:#0d1e2e;margin:0;font-style:italic">"${remarks}"</p>
    </div>` : ''}

    ${photoHtml}

    ${isResolved ? `
    <div style="background:#f0fdf4;border-left:4px solid #10b981;border-radius:0 8px 8px 0;padding:14px 18px;margin-top:16px">
      <p style="font-size:13px;color:#065f46;margin:0">✅ Your issue has been resolved. You can rate your experience by visiting the HYDRAA Citizen Portal under "My Complaints".</p>
    </div>` : ''}`);

  await sendMail({
    to,
    subject: isResolved
      ? `🎉 Complaint ${complaint_no} Resolved — HYDRAA Telangana`
      : `🔄 Complaint ${complaint_no} Status Updated — HYDRAA`,
    html,
    attachments,
  });
};

// ─────────────────────────────────────────────────────
//  5. FORGOT PASSWORD OTP
// ─────────────────────────────────────────────────────
const sendForgotPasswordOTP = async ({ to, name, otp, role = 'user' }) => {
  const roleLabel = { user:'Citizen', admin:'Administrator', official:'Field Official' }[role] || 'User';

  const html = wrap(`
    <h2 style="font-size:22px;color:#0b1f3a;margin:0 0 4px">Password Reset Request 🔒</h2>
    <p style="font-size:14px;color:#3d5a72;margin:0 0 24px">
      Dear ${name}, we received a request to reset your HYDRAA ${roleLabel} account password. Use the OTP below to reset it.
    </p>

    <div style="background:#f5fafc;border:2px dashed #0097a7;border-radius:12px;padding:28px;text-align:center;margin-bottom:24px">
      <div style="font-size:12px;color:#7a9baf;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:10px">Your One-Time Password</div>
      <div style="font-size:48px;font-weight:700;color:#0097a7;letter-spacing:12px;font-family:monospace">${otp}</div>
      <div style="font-size:12px;color:#f59e0b;font-weight:700;margin-top:10px">⏳ Valid for 10 minutes only</div>
    </div>

    <div style="background:#fef2f2;border-left:4px solid #ef4444;border-radius:0 8px 8px 0;padding:14px 18px;margin-bottom:20px">
      <p style="font-size:13px;color:#b91c1c;font-weight:700;margin:0 0 4px">🚨 Security Alert</p>
      <p style="font-size:13px;color:#b91c1c;margin:0">If you did not request a password reset, please ignore this email and your password will remain unchanged. Do NOT share this OTP with anyone.</p>
    </div>

    <table width="100%" cellpadding="0" cellspacing="0">
      ${infoRow('Account', to)}
      ${infoRow('Role', roleLabel)}
      ${infoRow('OTP Expires', new Date(Date.now() + 10*60*1000).toLocaleTimeString('en-IN'))}
      ${infoRow('Request Time', new Date().toLocaleString('en-IN'))}
    </table>`);

  await sendMail({
    to,
    subject: `🔒 HYDRAA Password Reset OTP: ${otp}`,
    html,
  });
};

// ─────────────────────────────────────────────────────
//  6. PASSWORD CHANGED CONFIRMATION
// ─────────────────────────────────────────────────────
const sendPasswordChangedEmail = async ({ to, name, role = 'user' }) => {
  const roleLabel = { user:'Citizen', admin:'Administrator', official:'Field Official' }[role] || 'User';

  const html = wrap(`
    <h2 style="font-size:22px;color:#0b1f3a;margin:0 0 4px">Password Changed Successfully ✅</h2>
    <p style="font-size:14px;color:#3d5a72;margin:0 0 24px">
      Dear ${name}, your HYDRAA ${roleLabel} account password has been changed successfully.
    </p>

    <div style="background:#f0fdf4;border-left:4px solid #10b981;border-radius:0 8px 8px 0;padding:16px 20px;margin-bottom:24px">
      <p style="font-size:13px;color:#065f46;font-weight:700;margin:0 0 4px">✅ Password Updated</p>
      <p style="font-size:13px;color:#065f46;margin:0">Your account is now secured with your new password. You can login using your new credentials.</p>
    </div>

    <table width="100%" cellpadding="0" cellspacing="0">
      ${infoRow('Account', to)}
      ${infoRow('Role', roleLabel)}
      ${infoRow('Changed On', new Date().toLocaleString('en-IN'))}
    </table>

    <div style="background:#fef2f2;border-left:4px solid #ef4444;border-radius:0 8px 8px 0;padding:14px 18px;margin-top:20px">
      <p style="font-size:13px;color:#b91c1c;font-weight:700;margin:0 0 4px">⚠️ Wasn't you?</p>
      <p style="font-size:13px;color:#b91c1c;margin:0">If you did not change your password, contact HYDRAA immediately at 1800-599-0099 or email us.</p>
    </div>`);

  await sendMail({
    to,
    subject: '✅ HYDRAA Password Changed Successfully',
    html,
  });
};

// ─────────────────────────────────────────────────────
//  7. OFFICIAL ACCOUNT CREATED (by admin)
// ─────────────────────────────────────────────────────
const sendOfficialWelcome = async ({ to, name, email, password, department }) => {
  const html = wrap(`
    <h2 style="font-size:22px;color:#0b1f3a;margin:0 0 4px">Welcome to HYDRAA Official Portal 👷</h2>
    <p style="font-size:14px;color:#3d5a72;margin:0 0 24px">
      Dear ${name}, your HYDRAA Field Official account has been created by the administrator. Below are your login credentials.
    </p>

    <div style="background:#f0fdf4;border:1px solid rgba(16,185,129,0.3);border-radius:10px;padding:20px;margin-bottom:24px">
      <div style="font-size:12px;color:#065f46;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:16px">🔐 Your Login Credentials</div>
      <div style="margin-bottom:14px">
        <div style="font-size:11px;color:#6b7280;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">Email Address</div>
        <div style="font-size:14px;color:#0d1e2e;font-weight:700;word-break:break-all;background:#fff;border:1px solid #d1fae5;border-radius:6px;padding:8px 12px">${email}</div>
      </div>
      <div style="margin-bottom:14px">
        <div style="font-size:11px;color:#6b7280;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">Password</div>
        <div style="font-size:15px;color:#065f46;font-weight:700;word-break:break-all;background:#fff;border:1px solid #d1fae5;border-radius:6px;padding:8px 12px;font-family:monospace">${password}</div>
      </div>
      <div>
        <div style="font-size:11px;color:#6b7280;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">Department</div>
        <div style="font-size:13px;color:#0d1e2e;word-break:break-word;background:#fff;border:1px solid #d1fae5;border-radius:6px;padding:8px 12px">${department || 'HYDRAA'}</div>
      </div>
    </div>

    <div style="background:#fef3c7;border-left:4px solid #f59e0b;border-radius:0 8px 8px 0;padding:14px 18px;margin-bottom:20px">
      <p style="font-size:13px;color:#92400e;font-weight:700;margin:0 0 4px">🔒 Important</p>
      <p style="font-size:13px;color:#92400e;margin:0">Please change your password after your first login for security purposes.</p>
    </div>

    <table width="100%" cellpadding="0" cellspacing="0">
      ${infoRow('Portal', 'HYDRAA Official Portal')}
      ${infoRow('Role', 'Field Official')}
      ${infoRow('Responsibilities', 'Review assigned complaints, take field action, update resolution status')}
    </table>`, 'OFFICIAL PORTAL');

  await sendMail({
    to,
    subject: '👷 Your HYDRAA Official Account is Ready',
    html,
  });
};

// ─────────────────────────────────────────────────────
//  8. ACCOUNT DELETED BY ADMIN
// ─────────────────────────────────────────────────────
//  9. OFFICIAL REMOVED FROM COMPLAINT (old official)
// ─────────────────────────────────────────────────────
const sendOfficialRemoved = async ({ to, name, complaint_no, title }) => {
  const html = wrap(`
    <h2 style="font-size:22px;color:#0b1f3a;margin:0 0 4px">Complaint Reassigned ↩️</h2>
    <p style="font-size:14px;color:#3d5a72;margin:0 0 24px;line-height:1.7">
      Dear ${name}, you have been <strong>removed</strong> from the following complaint by a HYDRAA administrator. Another official has been assigned to handle it.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0">
      ${infoRow('Complaint No.', `<strong style="color:#0097a7">${complaint_no}</strong>`)}
      ${infoRow('Title', title)}
      ${infoRow('Action', `<span style="color:#b45309;font-weight:700">Unassigned — No further action required from you</span>`)}
    </table>
    <div style="background:#fff7ed;border-left:4px solid #f59e0b;border-radius:0 8px 8px 0;padding:14px 18px;margin-top:20px">
      <p style="font-size:13px;color:#92400e;margin:0">If you have any pending field notes for this complaint, please contact your HYDRAA administrator.</p>
    </div>`, 'OFFICIAL PORTAL');

  await sendMail({ to, subject: `↩️ Complaint ${complaint_no} — You Have Been Unassigned`, html });
};

// ─────────────────────────────────────────────────────
//  10. CITIZEN — OFFICIAL REASSIGNED NOTIFICATION
// ─────────────────────────────────────────────────────
const sendComplaintReassigned = async ({ to, name, complaint_no, title, officialName, department }) => {
  const html = wrap(`
    <h2 style="font-size:22px;color:#0b1f3a;margin:0 0 4px">Official Reassigned 🔄</h2>
    <p style="font-size:14px;color:#3d5a72;margin:0 0 24px;line-height:1.7">
      Dear ${name}, the HYDRAA field official handling your complaint <strong style="color:#0097a7">${complaint_no}</strong> has been changed by the administrator.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0">
      ${infoRow('Complaint No.', `<strong style="color:#0097a7">${complaint_no}</strong>`)}
      ${infoRow('Title', title)}
      ${infoRow('New Official', `<strong>${officialName}</strong>`)}
      ${infoRow('Department', department || 'HYDRAA')}
      ${infoRow('Status', badge('ASSIGNED', '#1d4ed8', 'rgba(59,130,246,0.1)'))}
    </table>
    <div style="background:#f0fdf4;border-left:4px solid #10b981;border-radius:0 8px 8px 0;padding:14px 18px;margin-top:20px">
      <p style="font-size:13px;color:#065f46;margin:0">Your complaint is in good hands. The new official will review the case and take necessary field action. You will be notified when the status is updated.</p>
    </div>`);

  await sendMail({ to, subject: `🔄 Complaint ${complaint_no} — New Official Assigned`, html });
};

// ─────────────────────────────────────────────────────
//  8. ACCOUNT DELETED BY ADMIN
// ─────────────────────────────────────────────────────
const sendAccountDeleted = async ({ to, name }) => {
  const html = wrap(`
    <h2 style="font-size:22px;color:#0b1f3a;margin:0 0 8px">Account Removed 🔒</h2>
    <p style="font-size:14px;color:#3d5a72;margin:0 0 24px;line-height:1.7">
      Dear ${name}, your HYDRAA citizen account registered under <strong>${to}</strong> has been removed by a HYDRAA administrator.
    </p>
    <div style="background:#fef2f2;border-left:4px solid #ef4444;border-radius:0 8px 8px 0;padding:16px 20px;margin-bottom:24px">
      <p style="font-size:13px;font-weight:700;color:#b91c1c;margin:0 0 4px">⚠️ What this means</p>
      <p style="font-size:13px;color:#7f1d1d;margin:0;line-height:1.6">
        Your account and all associated complaint records have been removed from the HYDRAA portal.
        You will no longer be able to log in with this account.
      </p>
    </div>
    <div style="background:#f0f9fa;border:1px solid #b2d8df;border-radius:8px;padding:16px 20px;margin-bottom:24px">
      <p style="font-size:13px;color:#006978;font-weight:700;margin:0 0 6px">📞 Have a concern?</p>
      <p style="font-size:13px;color:#3d5a72;margin:0;line-height:1.6">
        If you believe this was done in error, please contact HYDRAA directly:<br/>
        Helpline: <strong>1800-599-0099</strong> &nbsp;|&nbsp; Visit: <strong>hydraa.telangana.gov.in</strong>
      </p>
    </div>
    <p style="font-size:12px;color:#94a3b8;text-align:center;margin:0">
      You may register a new account at any time if needed.
    </p>`);

  await sendMail({
    to,
    subject: '⚠️ Your HYDRAA Account Has Been Removed',
    html,
  });
};

// ─────────────────────────────────────────────────────
//  Helper: send silently (don't crash app on email fail)
// ─────────────────────────────────────────────────────
const sendSafe = async (fn, ...args) => {
  try { await fn(...args); }
  catch (err) { console.error('⚠️ Email send failed (non-critical):', err.message); }
};

module.exports = {
  sendWelcomeEmail,
  sendComplaintConfirmation,
  sendComplaintAssigned,
  sendStatusUpdate,
  sendForgotPasswordOTP,
  sendPasswordChangedEmail,
  sendOfficialWelcome,
  sendAccountDeleted,
  sendOfficialRemoved,
  sendComplaintReassigned,
  sendSafe,
};
