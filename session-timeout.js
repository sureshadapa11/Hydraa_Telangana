// =====================================================
//   Session Timeout — HYDRAA Telangana
//   Auto-logout after inactivity with warning popup
//   Usage: SessionTimeout.init({ timeout: ms, warning: ms })
//   Defaults: timeout=30min, warning=60sec
// =====================================================

const SessionTimeout = (() => {
  let _timeoutId   = null;
  let _warnId      = null;
  let _countdownId = null;
  let _opts        = {};
  let _overlay     = null;
  let _countdownEl = null;
  let _initialized = false;

  // ── Create the warning overlay once ──
  function _createOverlay() {
    if (document.getElementById('stOverlay')) return;
    const el = document.createElement('div');
    el.id = 'stOverlay';
    el.style.cssText = [
      'display:none',
      'position:fixed',
      'inset:0',
      'background:rgba(0,0,0,0.65)',
      'z-index:999999',
      'align-items:center',
      'justify-content:center',
      'backdrop-filter:blur(6px)',
      '-webkit-backdrop-filter:blur(6px)',
    ].join(';');
    el.innerHTML = `
      <div style="background:#fff;border-radius:14px;padding:2.2rem 2rem;max-width:360px;width:90%;text-align:center;box-shadow:0 24px 80px rgba(0,0,0,0.35);animation:stIn 0.22s ease;">
        <style>@keyframes stIn{from{opacity:0;transform:scale(0.94) translateY(12px)}to{opacity:1;transform:scale(1) translateY(0)}}</style>
        <div style="font-size:2.8rem;margin-bottom:0.8rem;">⏱️</div>
        <div style="font-family:'Rajdhani',sans-serif;font-size:1.35rem;font-weight:700;color:#0b1f3a;margin-bottom:0.5rem;">Session Expiring Soon</div>
        <div style="font-size:0.86rem;color:#7a9baf;line-height:1.7;margin-bottom:1.4rem;">
          You've been inactive. You will be automatically<br/>logged out in
          <strong id="stCountdown" style="font-size:1.6rem;color:#ef4444;font-family:'Rajdhani',sans-serif;display:inline-block;min-width:2ch;">60</strong>
          seconds.
        </div>
        <div style="display:flex;gap:0.7rem;">
          <button onclick="SessionTimeout.stay()" style="flex:1;padding:0.78rem;background:linear-gradient(135deg,#0097a7,#00bcd4);color:#fff;border:none;border-radius:9px;font-size:0.92rem;font-weight:700;cursor:pointer;font-family:inherit;box-shadow:0 4px 14px rgba(0,151,167,0.35);transition:opacity 0.15s;" onmouseover="this.style.opacity=0.88" onmouseout="this.style.opacity=1">
            ✅ Stay Logged In
          </button>
          <button onclick="Auth.logout()" style="padding:0.78rem 1.1rem;background:none;border:1.5px solid #d0e4ec;border-radius:9px;font-size:0.88rem;font-weight:600;color:#7a9baf;cursor:pointer;font-family:inherit;transition:all 0.15s;" onmouseover="this.style.borderColor='#ef4444';this.style.color='#ef4444'" onmouseout="this.style.borderColor='#d0e4ec';this.style.color='#7a9baf'">
            Logout
          </button>
        </div>
      </div>`;
    document.body.appendChild(el);
    _overlay     = el;
    _countdownEl = document.getElementById('stCountdown');
  }

  // ── Show warning countdown ──
  function _showWarning() {
    if (!_overlay) return;
    let secs = Math.ceil(_opts.warning / 1000);
    _countdownEl.textContent = secs;
    _overlay.style.display = 'flex';

    clearInterval(_countdownId);
    _countdownId = setInterval(() => {
      secs -= 1;
      if (_countdownEl) _countdownEl.textContent = Math.max(secs, 0);
      if (secs <= 0) clearInterval(_countdownId);
    }, 1000);
  }

  // ── Hide warning ──
  function _hideWarning() {
    if (_overlay) _overlay.style.display = 'none';
    clearInterval(_countdownId);
  }

  // ── Reset all timers (called on any user activity) ──
  function _reset() {
    clearTimeout(_timeoutId);
    clearTimeout(_warnId);
    _hideWarning();

    // Show warning `warning` ms before actual logout
    _warnId = setTimeout(_showWarning, _opts.timeout - _opts.warning);

    // Auto-logout after full timeout
    _timeoutId = setTimeout(() => {
      if (typeof Auth !== 'undefined') Auth.logout();
    }, _opts.timeout);
  }

  // ── Activity events that reset the timer ──
  const _EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click', 'wheel'];

  function init(opts) {
    if (_initialized) return;
    _initialized = true;

    _opts = {
      timeout: 30 * 60 * 1000,  // 30 minutes
      warning: 60 * 1000,        // 60 second warning
      ...opts
    };

    // Clamp: warning must be less than timeout
    if (_opts.warning >= _opts.timeout) _opts.warning = Math.floor(_opts.timeout / 2);

    // Build overlay after DOM ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', _createOverlay);
    } else {
      _createOverlay();
    }

    // Listen for activity
    _EVENTS.forEach(evt =>
      document.addEventListener(evt, _reset, { passive: true, capture: true })
    );

    // Sync across tabs — if another tab logs out, this tab logs out too
    window.addEventListener('storage', e => {
      if (e.key === 'hydraa_token' && !e.newValue) {
        if (typeof Auth !== 'undefined') Auth.logout();
      }
    });

    _reset();
  }

  // ── Called by "Stay Logged In" button ──
  function stay() {
    _reset();
  }

  return { init, stay };
})();
