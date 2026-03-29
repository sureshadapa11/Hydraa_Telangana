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

    // 401 Unauthorized — redirect to login
    if (res.status === 401) {
      this.clearToken();
      window.location.href = '/login.html';
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
      return { success: false, message: 'Network error' };
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

  logout() {
    localStorage.removeItem('hydraa_user');
    http.clearToken();
    window.location.href = '/login.html';
  },
};
