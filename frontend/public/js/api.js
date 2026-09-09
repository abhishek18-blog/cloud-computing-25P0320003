/**
 * API Client for LibCloud Microservice Gateway
 */

class ApiClient {
  constructor() {
    let savedGateway = localStorage.getItem('libcloud_gateway_url');
    // If stale localhost is saved in localStorage while on cloud, clear it
    if (savedGateway && savedGateway.includes('localhost') && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      localStorage.removeItem('libcloud_gateway_url');
      savedGateway = null;
    }
    // Default to relative '/api' proxy so it works on any Cloud IP or local port automatically
    this.baseUrl = savedGateway || '/api';
    this.gatewayRoot = this.baseUrl.replace(/\/api$/, '');
  }

  setBaseUrl(url) {
    let cleanUrl = url.trim().replace(/\/+$/, '');
    if (!cleanUrl.endsWith('/api') && !cleanUrl.includes('/api')) {
      cleanUrl += '/api';
    }
    this.baseUrl = cleanUrl;
    this.gatewayRoot = this.baseUrl.replace(/\/api$/, '');
    localStorage.setItem('libcloud_gateway_url', this.baseUrl);
  }

  resetBaseUrl() {
    localStorage.removeItem('libcloud_gateway_url');
    this.baseUrl = '/api';
    this.gatewayRoot = '';
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const defaultHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...defaultHeaders,
          ...(options.headers || {})
        }
      });

      if (response.status === 204) {
        return null;
      }

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const errorMsg = data?.detail || data?.message || `HTTP Error ${response.status}: ${response.statusText}`;
        throw new Error(errorMsg);
      }

      return data;
    } catch (err) {
      console.error(`API Request Failed [${options.method || 'GET'} ${url}]:`, err);
      throw err;
    }
  }

  // Health check on Gateway
  async getHealth() {
    const healthUrl = (this.gatewayRoot && this.gatewayRoot !== '') ? `${this.gatewayRoot}/health` : '/gateway/health';
    const response = await fetch(healthUrl);
    return await response.json();
  }

  // Book Endpoints (Python FastAPI + PostgreSQL)
  async getBooks(params = {}) {
    const query = new URLSearchParams();
    if (params.search) query.append('search', params.search);
    if (params.category) query.append('category', params.category);
    if (params.available_only) query.append('available_only', 'true');
    const queryString = query.toString() ? `?${query.toString()}` : '';
    return this.request(`/books${queryString}`);
  }

  async getBookById(id) {
    return this.request(`/books/${id}`);
  }

  async createBook(bookData) {
    return this.request('/books', {
      method: 'POST',
      body: JSON.stringify(bookData)
    });
  }

  async deleteBook(id) {
    return this.request(`/books/${id}`, {
      method: 'DELETE'
    });
  }

  // Member Endpoints (Node.js Express + MySQL)
  async getMembers(search = '') {
    const query = search ? `?search=${encodeURIComponent(search)}` : '';
    return this.request(`/members${query}`);
  }

  async getMemberById(id) {
    return this.request(`/members/${id}`);
  }

  async createMember(memberData) {
    return this.request('/members', {
      method: 'POST',
      body: JSON.stringify(memberData)
    });
  }

  // Borrowing Endpoints (Node.js Express + MySQL + Inter-Service Stock Sync)
  async getBorrowings(status = '') {
    const query = status && status !== 'ALL' ? `?status=${encodeURIComponent(status)}` : '';
    return this.request(`/borrowings${query}`);
  }

  async borrowBook(memberId, bookId, notes = '') {
    return this.request('/borrowings/borrow', {
      method: 'POST',
      body: JSON.stringify({
        member_id: parseInt(memberId, 10),
        book_id: parseInt(bookId, 10),
        notes
      })
    });
  }

  async returnBook(borrowingId) {
    return this.request(`/borrowings/return/${borrowingId}`, {
      method: 'POST'
    });
  }
}

const api = new ApiClient();
