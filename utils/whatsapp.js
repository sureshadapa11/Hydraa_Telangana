// =====================================================
//   WhatsApp Notifications — HYDRAA (via Twilio)
//
//   To activate:
//     Add to Railway environment variables:
//       TWILIO_ACCOUNT_SID = ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
//       TWILIO_AUTH_TOKEN  = your_auth_token
//       TWILIO_WHATSAPP_FROM = whatsapp:+14155238886   (sandbox)
//       TWILIO_WHATSAPP_FROM = whatsapp:+91xxxxxxxxxx  (production)
//
//   Twilio WhatsApp sandbox: https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn
// =====================================================

let client = null;
const FROM = process.env.TWILIO_WHATSAPP_FROM;

if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  try {
    const twilio = require('twilio');
    client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    console.log('✅ WhatsApp (Twilio) client ready');
  } catch (e) {
    console.warn('⚠️  Twilio not installed — WhatsApp notifications disabled. Run: npm install twilio');
  }
} else {
  console.log('ℹ️  WhatsApp notifications disabled (TWILIO_ACCOUNT_SID not set)');
}

// Send WhatsApp message — silently skips if Twilio not configured
async function sendWhatsApp(to, message) {
  if (!client || !FROM || !to) return;
  // Normalise phone: add whatsapp: prefix
  const toFormatted = to.startsWith('whatsapp:') ? to : `whatsapp:+${to.replace(/\D/g, '')}`;
  try {
    await client.messages.create({ from: FROM, to: toFormatted, body: message });
  } catch (e) {
    console.warn('WhatsApp send failed:', e.message);
  }
}

// Notify citizen when complaint status changes
async function notifyStatusChange({ phone, complaintNo, oldStatus, newStatus, remarks }) {
  const statusLabel = {
    open: 'Pending', assigned: 'Assigned to Official',
    in_progress: 'In Progress', resolved: 'Resolved ✅',
    closed: 'Closed', rejected: 'Rejected',
  };
  const msg = `*HYDRAA Complaint Update* 🏛️\n\nComplaint No: *${complaintNo}*\nStatus: *${statusLabel[newStatus] || newStatus}*${remarks ? `\nRemarks: ${remarks}` : ''}\n\nTrack your complaint: ${process.env.APP_URL || 'https://your-app.railway.app'}/hydraa-track-complaint.html`;
  await sendWhatsApp(phone, msg);
}

// Notify citizen when complaint is lodged
async function notifyComplaintLodged({ phone, complaintNo, title }) {
  const msg = `*HYDRAA* 🏛️ — Complaint Received\n\nYour complaint has been registered.\nComplaint No: *${complaintNo}*\nTitle: ${title}\n\nWe will assign an official soon. Track at: ${process.env.APP_URL || 'https://your-app.railway.app'}/hydraa-track-complaint.html`;
  await sendWhatsApp(phone, msg);
}

module.exports = { sendWhatsApp, notifyStatusChange, notifyComplaintLodged };
