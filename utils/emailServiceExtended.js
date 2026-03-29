// =====================================================
//   Email Service Extensions — HYDRAA
//   Additional complaint and notification emails
//   Append to emailService.js
// =====================================================

// ─────────────────────────────────────────────────────
//  COMPLAINT NOTIFICATION EMAIL
// ─────────────────────────────────────────────────────
const sendComplaintNotification = async ({ to, name, complaintNo, title, priority }) => {
  const priorityBadge = {
    low: { icon: '🟢', bg: 'rgba(16,185,129,0.1)', color: '#10b981' },
    medium: { icon: '🟡', bg: 'rgba(245,158,11,0.1)', color: '#f59e0b' },
    high: { icon: '🔴', bg: 'rgba(239,68,68,0.1)', color: '#ef4444' },
  }[priority] || { icon: '⚪', bg: 'rgba(122,155,175,0.1)', color: '#7a9baf' };

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to,
    subject: `Complaint Filed: ${complaintNo}`,
    html: `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:20px;background:#eaf4f8;font-family:'Segoe UI',Arial">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,30,60,0.12)">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#0b1f3a,#122944);padding:24px 32px">
      <h2 style="color:#fff;margin:0;font-size:20px">📋 Complaint Registered</h2>
    </div>
    <!-- Content -->
    <div style="padding:32px">
      <p style="font-size:14px;color:#3d5a72;margin:0 0 16px">Hi ${name},</p>
      <p style="font-size:14px;color:#3d5a72;margin:0 0 24px;line-height:1.7">
        Your complaint has been successfully registered with our system. Our team will review it and take necessary action.
      </p>
      
      <!-- Details Box -->
      <div style="background:#f5fafc;border:1px solid #d0e4ec;border-radius:8px;padding:20px;margin-bottom:24px">
        <h3 style="margin:0 0 16px;font-size:14px;color:#0d1e2e">Complaint Details:</h3>
        <table width="100%">
          <tr>
            <td style="padding:8px 0;color:#7a9baf;font-size:12px;font-weight:600;width:120px">Ticket No.</td>
            <td style="padding:8px 0;color:#0d1e2e;font-size:13px;font-weight:700">${complaintNo}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#7a9baf;font-size:12px;font-weight:600">Title</td>
            <td style="padding:8px 0;color:#0d1e2e;font-size:13px">${title}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#7a9baf;font-size:12px;font-weight:600">Priority</td>
            <td style="padding:8px 0">
              <span style="background:${priorityBadge.bg};color:${priorityBadge.color};padding:4px 12px;border-radius:20px;font-size:11px;font-weight:700">
                ${priorityBadge.icon} ${priority.toUpperCase()}
              </span>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#7a9baf;font-size:12px;font-weight:600">Status</td>
            <td style="padding:8px 0"><span style="background:rgba(0,151,167,0.1);color:#0097a7;padding:4px 12px;border-radius:20px;font-size:11px;font-weight:700">🔵 OPEN</span></td>
          </tr>
        </table>
      </div>

      <p style="font-size:12px;color:#7a9baf;margin:0">
        📌 <strong>Next Steps:</strong> You can track your complaint status anytime by logging into your account using your ticket number.
      </p>
      
      <hr style="border:none;border-top:1px solid #eef3f6;margin:24px 0"/>
      <p style="font-size:12px;color:#aac4d0;margin:0">
        Reference: ${complaintNo} | Time: ${new Date().toLocaleString('en-IN')}
      </p>
    </div>
    <!-- Footer -->
    <div style="background:#f5fafc;padding:16px 32px;border-top:1px solid #d0e4ec;text-align:center;font-size:11px;color:#7a9baf">
      © HYDRAA Telangana | 1800-599-0099
    </div>
  </div>
</body></html>`,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Complaint notification sent to ${to}`);
  } catch (err) {
    console.error(`❌ Failed to send complaint notification: ${err.message}`);
  }
};

// ─────────────────────────────────────────────────────
//  COMPLAINT STATUS UPDATE EMAIL
// ─────────────────────────────────────────────────────
const sendComplaintStatusUpdate = async ({ to, name, status, remarks }) => {
  const statusInfo = {
    assigned: { icon: '👷', color: '#f59e0b', label: 'Assigned' },
    in_progress: { icon: '⚙️', color: '#3b82f6', label: 'In Progress' },
    resolved: { icon: '✅', color: '#10b981', label: 'Resolved' },
    rejected: { icon: '❌', color: '#ef4444', label: 'Rejected' },
    closed: { icon: '🔒', color: '#6b7280', label: 'Closed' },
  }[status] || { icon: '📋', color: '#0097a7', label: status };

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to,
    subject: `Complaint Status Update: ${statusInfo.label}`,
    html: `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:20px;background:#eaf4f8;font-family:'Segoe UI',Arial">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,30,60,0.12)">
    <div style="background:linear-gradient(135deg,#0b1f3a,#122944);padding:24px 32px">
      <h2 style="color:#fff;margin:0;font-size:20px">${statusInfo.icon} Status Update</h2>
    </div>
    <div style="padding:32px">
      <p style="font-size:14px;color:#3d5a72;margin:0 0 24px">Hi ${name},</p>
      
      <div style="background:${statusInfo.color}15;border:2px solid ${statusInfo.color}40;border-radius:8px;padding:20px;margin-bottom:24px">
        <div style="font-size:28px;margin-bottom:8px">${statusInfo.icon}</div>
        <p style="margin:0;font-size:16px;font-weight:700;color:${statusInfo.color}">Complaint Status: <strong>${statusInfo.label}</strong></p>
      </div>

      ${remarks ? `
      <div style="background:#f5fafc;border-left:4px solid #0097a7;padding:16px;border-radius:0 6px 6px 0;margin-bottom:24px">
        <p style="font-size:11px;color:#7a9baf;margin:0 0 4px;font-weight:600;text-transform:uppercase">Official Remarks:</p>
        <p style="margin:0;font-size:13px;color:#3d5a72;line-height:1.6">${remarks}</p>
      </div>
      ` : ''}

      <p style="font-size:12px;color:#7a9baf;margin:0">
        You can view detailed information about your complaint by logging into your HYDRAA account.
      </p>
      <hr style="border:none;border-top:1px solid #eef3f6;margin:24px 0"/>
      <p style="font-size:11px;color:#aac4d0;margin:0">
        Last Updated: ${new Date().toLocaleString('en-IN')}
      </p>
    </div>
    <div style="background:#f5fafc;padding:16px 32px;border-top:1px solid #d0e4ec;text-align:center;font-size:11px;color:#7a9baf">
      © HYDRAA Telangana | 1800-599-0099
    </div>
  </div>
</body></html>`,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Status update email sent to ${to}`);
  } catch (err) {
    console.error(`❌ Failed to send status update email: ${err.message}`);
  }
};

// ─────────────────────────────────────────────────────
//  SAFE EMAIL SENDER (Non-blocking)
// ─────────────────────────────────────────────────────
const sendSafe = (emailFn, params) => {
  setImmediate(async () => {
    try {
      await emailFn(params);
    } catch (err) {
      console.error('Email error (non-blocking):', err.message);
    }
  });
};

module.exports = {
  sendComplaintNotification,
  sendComplaintStatusUpdate,
  sendSafe,
  transporter,
};
