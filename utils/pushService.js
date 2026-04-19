// =====================================================
//   Push Notification Service — HYDRAA
//   Sends Web Push notifications to subscribed citizens
// =====================================================

const webpush = require('web-push');
const db = require('./db');

// Configure VAPID (keys fall back to generated defaults if not set in .env)
const VAPID_PUBLIC  = process.env.VAPID_PUBLIC_KEY  || 'BAqJOmCqMloqnP0yMmwTMKNINSS5YtEGnBGXFTlRAjqCAmsSZSN4HV6ELXgkZ3dhTHFpiqOMeRrlObqYW_8cr10';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || '2kgP8EXIntc2vwJw-HZpcjtrncopAAHdpn0ERRVLluM';
const VAPID_EMAIL   = process.env.VAPID_EMAIL       || 'mailto:admin@hydraa.telangana';

webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE);

/**
 * Send a push notification to a specific user (by user_id).
 * Silently removes expired/invalid subscriptions.
 */
async function sendPushToUser(user_id, { title, body, url = '/' }) {
  try {
    const [subs] = await db.query(
      `SELECT id, endpoint, p256dh, auth FROM user_push_subscriptions WHERE user_id = ?`,
      [user_id]
    );

    const payload = JSON.stringify({ title, body, url });

    for (const sub of subs) {
      const subscription = {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      };
      try {
        await webpush.sendNotification(subscription, payload);
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          // Subscription expired — remove it
          await db.query(`DELETE FROM user_push_subscriptions WHERE id = ?`, [sub.id]).catch(() => {});
        } else {
          console.warn('[PUSH] Send error for sub', sub.id, ':', err.message);
        }
      }
    }
  } catch (err) {
    console.error('[PUSH] sendPushToUser error:', err.message);
  }
}

module.exports = { sendPushToUser, VAPID_PUBLIC };
