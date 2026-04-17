// =====================================================
//   HTTP Client Utility — HYDRAA
//   Provides fetch-based HTTP methods with auth token
//   Include in all pages: <script src="http-client.js"></script>
// =====================================================

const http = {
  // Get token from localStorage
  getToken() {
    return localStorage.getItem('hydraa_token') || null;
  },

  // Set token
  setToken(token) {
    if (token) localStorage.setItem('hydraa_token', token);
    else localStorage.removeItem('hydraa_token');
  },

  // Clear token
  clearToken() {
    localStorage.removeItem('hydraa_token');
  },

  // Build headers with auth
  getHeaders() {
    const headers = {
      'Content-Type': 'application/json',
    };
    const token = this.getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  },

  // Handle response
  async handleResponse(res) {
    let data;
    try {
      data = await res.json();
    } catch {
      data = { success: false, message: res.statusText };
    }

    // 401 Unauthorized — account deleted/deactivated mid-session, force logout
    if (res.status === 401) {
      const path = window.location.pathname;
      const onLoginPage = path.includes('login') || path.includes('forgot-password');
      if (!onLoginPage) {
        this.clearToken();
        localStorage.removeItem('hydraa_user');
        if (path.includes('official')) {
          window.location.href = '/hydraa-official-portal.html';
        } else if (path.includes('admin')) {
          window.location.href = '/hydraa-admin-login.html';
        } else {
          window.location.href = '/hydraa-login.html';
        }
      }
      return data;
    }

    return data;
  },

  // GET
  async get(endpoint) {
    try {
      const res = await fetch(endpoint, {
        method: 'GET',
        headers: this.getHeaders(),
      });
      return this.handleResponse(res);
    } catch (err) {
      console.error('HTTP GET error:', err);
      return { success: false, message: 'Network error' };
    }
  },

  // POST
  async post(endpoint, body = {}) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(body),
      });
      return this.handleResponse(res);
    } catch (err) {
      console.error('HTTP POST error:', err);
      return { success: false, message: 'Network error: ' + (err && err.message ? err.message : String(err)) };
    }
  },

  // PUT
  async put(endpoint, body = {}) {
    try {
      const res = await fetch(endpoint, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify(body),
      });
      return this.handleResponse(res);
    } catch (err) {
      console.error('HTTP PUT error:', err);
      return { success: false, message: 'Network error' };
    }
  },

  // DELETE
  async delete(endpoint) {
    try {
      const res = await fetch(endpoint, {
        method: 'DELETE',
        headers: this.getHeaders(),
      });
      return this.handleResponse(res);
    } catch (err) {
      console.error('HTTP DELETE error:', err);
      return { success: false, message: 'Network error' };
    }
  },

  // POST Form Data (for file uploads)
  async postForm(endpoint, formData) {
    try {
      const headers = {};
      const token = this.getToken();
      if (token) headers['Authorization'] = `Bearer ${token}`;
      
      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: formData,
      });
      return this.handleResponse(res);
    } catch (err) {
      console.error('HTTP POST Form error:', err);
      return { success: false, message: 'Network error' };
    }
  },
};

// Auth utility for local state
const Auth = {
  setUser(user, token) {
    localStorage.setItem('hydraa_user', JSON.stringify(user));
    http.setToken(token);
  },

  getUser() {
    try {
      return JSON.parse(localStorage.getItem('hydraa_user')) || null;
    } catch {
      return null;
    }
  },

  isLoggedIn() {
    return !!http.getToken();
  },

  requireLogin(role) {
    if (!http.getToken()) {
      window.location.href = role === 'admin' ? '/hydraa-admin-login.html' : '/hydraa-login.html';
    }
  },

  logout() {
    localStorage.removeItem('hydraa_user');
    http.clearToken();
    const isAdmin = window.location.pathname.includes('admin');
    window.location.href = isAdmin ? '/hydraa-admin-login.html' : '/hydraa-login.html';
  },

  // Poll the server every intervalMs to detect if this account has been deleted/deactivated.
  // If the server returns 401, http.handleResponse() automatically clears the token and redirects.
  startSessionCheck(intervalMs = 30000) {
    if (this._sessionTimer) return; // already running
    this._sessionTimer = setInterval(async () => {
      if (!http.getToken()) return;
      try { await http.get('/api/auth/verify-session'); } catch(e) {}
    }, intervalMs);
  },

  stopSessionCheck() {
    clearInterval(this._sessionTimer);
    this._sessionTimer = null;
  },
};
