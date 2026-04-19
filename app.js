// =====================================================
//   App Utilities — HYDRAA
//   Global helper functions for all pages
//   Include: <script src="app.js"></script> before page-specific scripts
// =====================================================

/**
 * Set loading state on a button
 */
function setLoading(btn, loading) {
  if (loading) {
    btn.disabled = true;
    btn.dataset.originalText = btn.textContent;
    btn.innerHTML = '<span style="display:inline-flex;align-items:center;gap:0.35rem"><span style="width:14px;height:14px;border:2px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:spin 0.6s linear infinite"></span>Loading...</span>';
  } else {
    btn.disabled = false;
    btn.textContent = btn.dataset.originalText || 'Submit';
  }
}

/**
 * Generic alert display (for pages using alert boxes)
 */
function showAlert(id, type, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.className = 'alert-box show ' + type;
  setTimeout(() => {
    if (el.className.includes('show')) el.classList.remove('show');
  }, 5000);
}

/**
 * Format date to readable format
 */
function formatDate(dateStr) {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return dateStr;
  }
}

/**
 * Format complaint status with color
 */
function getStatusBadge(status) {
  const colors = {
    'open': '#0097a7',
    'assigned': '#3b82f6',
    'in_progress': '#f59e0b',
    'in-progress': '#f59e0b',
    'resolved': '#10b981',
    'rejected': '#ef4444',
    'closed': '#6b7280'
  };
  const color = colors[status] || '#7a9baf';
  return `<span style="background:${color}20;color:${color};padding:0.3rem 0.8rem;border-radius:6px;font-size:0.75rem;font-weight:600;text-transform:capitalize;border:1px solid ${color}40">${status}</span>`;
}

/**
 * Format priority with icon
 */
function getPriorityBadge(priority) {
  const icons = {
    'low': '🟢',
    'medium': '🟡',
    'high': '🔴',
    'urgent': '🚨'
  };
  return `${icons[priority] || '⚪'} ${priority?.toUpperCase() || 'N/A'}`;
}

/**
 * Debounce function for search inputs
 */
function debounce(func, delay) {
  let timeoutId;
  return function(...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}

/**
 * Logout — clears session and redirects to login
 */
function logout() {
  Auth.logout();
}

/**
 * Copy to clipboard
 */
function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    showAlert('copyAlert', 'success', 'Copied to clipboard!');
  });
}

/**
 * Auto-reload when a new service worker activates so latest deployment loads immediately
 * without requiring Ctrl+Shift+R from the user
 */
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'SW_UPDATED') {
      window.location.reload();
    }
  });
}

/**
 * Add CSS animation for loading spinner
 */
const style = document.createElement('style');
style.textContent = `
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;
document.head.appendChild(style);
