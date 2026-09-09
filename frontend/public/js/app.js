/**
 * Main Application Logic for LibCloud
 */

document.addEventListener('DOMContentLoaded', () => {
  // State
  let books = [];
  let members = [];
  let borrowings = [];
  let currentBorrowFilter = 'BORROWED';

  // Elements
  const navItems = document.querySelectorAll('.nav-item');
  const tabPanes = document.querySelectorAll('.tab-pane');
  const pageTitle = document.getElementById('page-title');
  const pageSubtitle = document.getElementById('page-subtitle');
  
  // Header Stats
  const statTotalBooks = document.getElementById('stat-total-books');
  const statTotalMembers = document.getElementById('stat-total-members');
  const statActiveLoans = document.getElementById('stat-active-loans');
  
  // Gateway status elements
  const gatewayStatusBadge = document.getElementById('gateway-status-badge');
  const gatewayStatusText = document.getElementById('gateway-status-text');

  // Modals
  const modalAddBook = document.getElementById('modal-add-book');
  const modalAddMember = document.getElementById('modal-add-member');
  const modalConfig = document.getElementById('modal-config');
  const inputGatewayUrl = document.getElementById('input-gateway-url');

  // Tab Titles Map
  const tabHeaders = {
    'catalog-tab': {
      title: 'Digital Book Catalog',
      subtitle: 'Browse books, track inventory, and filter across subjects (PostgreSQL)'
    },
    'members-tab': {
      title: 'Library Member Directory',
      subtitle: 'Manage student and faculty memberships (MySQL)'
    },
    'borrow-tab': {
      title: 'Circulation & Issue Desk',
      subtitle: 'Issue books and process returns across microservices'
    },
    'topology-tab': {
      title: 'Cloud Microservice Topology & Health',
      subtitle: 'Real-time diagnostic probe across distributed VMs & Databases'
    }
  };

  // ==========================================
  // NAVIGATION & TAB SWITCHING
  // ==========================================
  navItems.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.getAttribute('data-tab');
      switchTab(tabId);
    });
  });

  function switchTab(tabId) {
    navItems.forEach(btn => btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId));
    tabPanes.forEach(pane => pane.classList.toggle('active', pane.id === tabId));
    
    if (tabHeaders[tabId]) {
      pageTitle.textContent = tabHeaders[tabId].title;
      pageSubtitle.textContent = tabHeaders[tabId].subtitle;
    }

    // Refresh specific tab data
    if (tabId === 'catalog-tab') loadBooks();
    else if (tabId === 'members-tab') loadMembers();
    else if (tabId === 'borrow-tab') {
      loadBorrowings();
      populateDeskDropdowns();
    } else if (tabId === 'topology-tab') checkHealth();
  }

  // ==========================================
  // TOAST NOTIFICATIONS
  // ==========================================
  function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <span>${type === 'success' ? '✓' : '⚠'}</span>
      <span>${message}</span>
    `;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  // ==========================================
  // BOOK CATALOG (PostgreSQL via Python FastAPI)
  // ==========================================
  const booksGrid = document.getElementById('books-grid');
  const bookSearchInput = document.getElementById('book-search-input');
  const bookCategoryFilter = document.getElementById('book-category-filter');
  const bookAvailableFilter = document.getElementById('book-available-filter');

  async function loadBooks() {
    try {
      const search = bookSearchInput.value.trim();
      const category = bookCategoryFilter.value;
      const availableOnly = bookAvailableFilter.checked;

      booksGrid.innerHTML = `
        <div class="loading-spinner-wrapper">
          <div class="spinner"></div>
          <p>Fetching Books from PostgreSQL...</p>
        </div>
      `;

      books = await api.getBooks({ search, category, available_only: availableOnly });
      renderBooks();
      updateCategoryDropdown();
      updateHeaderStats();
    } catch (err) {
      booksGrid.innerHTML = `
        <div class="loading-spinner-wrapper" style="color: var(--danger)">
          <p>⚠️ Error loading books from Book Microservice.</p>
          <p style="font-size: 0.85rem; margin-top: 6px;">${err.message}</p>
        </div>
      `;
      showToast(err.message, 'error');
    }
  }

  function renderBooks() {
    if (!books || books.length === 0) {
      booksGrid.innerHTML = `
        <div class="loading-spinner-wrapper">
          <p>No books match your criteria. Try adjusting filters or adding a new book.</p>
        </div>
      `;
      return;
    }

    booksGrid.innerHTML = books.map(book => {
      let stockClass = 'in-stock';
      let stockText = `${book.available_copies} of ${book.total_copies} Available`;

      if (book.available_copies === 0) {
        stockClass = 'out-of-stock';
        stockText = 'Out of Stock';
      } else if (book.available_copies === 1) {
        stockClass = 'low-stock';
        stockText = '1 Copy Left';
      }

      return `
        <div class="book-card" data-id="${book.id}">
          <div>
            <div class="book-header">
              <h3 class="book-title">${escapeHtml(book.title)}</h3>
              <span class="badge badge-primary">${escapeHtml(book.category)}</span>
            </div>
            <p class="book-author">by ${escapeHtml(book.author)}</p>
            
            <div class="book-meta">
              <div class="meta-item">
                <span>ISBN:</span>
                <span>${escapeHtml(book.isbn)}</span>
              </div>
              <div class="meta-item">
                <span>Database:</span>
                <span>PostgreSQL #ID ${book.id}</span>
              </div>
            </div>
          </div>

          <div class="book-footer">
            <div class="stock-indicator ${stockClass}">
              <span class="status-dot ${book.available_copies > 0 ? 'online' : 'offline'}"></span>
              <span>${stockText}</span>
            </div>
            <button class="btn-danger-sm" onclick="handleDeleteBook(${book.id}, '${escapeHtml(book.title)}')">Delete</button>
          </div>
        </div>
      `;
    }).join('');
  }

  function updateCategoryDropdown() {
    if (!books) return;
    const categories = Array.from(new Set(books.map(b => b.category))).filter(Boolean);
    const currentVal = bookCategoryFilter.value;
    
    bookCategoryFilter.innerHTML = '<option value="">All Categories</option>' + 
      categories.map(c => `<option value="${escapeHtml(c)}" ${c === currentVal ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('');
  }

  bookSearchInput.addEventListener('input', debounce(loadBooks, 300));
  bookCategoryFilter.addEventListener('change', loadBooks);
  bookAvailableFilter.addEventListener('change', loadBooks);

  // Add Book Modal & Form
  document.getElementById('btn-open-add-book').addEventListener('click', () => {
    modalAddBook.classList.add('open');
  });
  document.getElementById('btn-close-book-modal').addEventListener('click', () => modalAddBook.classList.remove('open'));
  document.getElementById('btn-cancel-book').addEventListener('click', () => modalAddBook.classList.remove('open'));

  document.getElementById('form-add-book').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const bookData = {
        title: document.getElementById('book-title').value.trim(),
        author: document.getElementById('book-author').value.trim(),
        isbn: document.getElementById('book-isbn').value.trim(),
        category: document.getElementById('book-category').value.trim(),
        total_copies: parseInt(document.getElementById('book-copies').value, 10),
        available_copies: parseInt(document.getElementById('book-copies').value, 10)
      };

      await api.createBook(bookData);
      showToast(`Book "${bookData.title}" added to catalog!`);
      modalAddBook.classList.remove('open');
      document.getElementById('form-add-book').reset();
      loadBooks();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  window.handleDeleteBook = async (id, title) => {
    if (!confirm(`Are you sure you want to remove "${title}" from catalog?`)) return;
    try {
      await api.deleteBook(id);
      showToast(`Book "${title}" deleted.`);
      loadBooks();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // ==========================================
  // MEMBERS MANAGEMENT (MySQL via Node.js Express)
  // ==========================================
  const membersGrid = document.getElementById('members-grid');
  const memberSearchInput = document.getElementById('member-search-input');

  async function loadMembers() {
    try {
      const search = memberSearchInput.value.trim();
      members = await api.getMembers(search);
      renderMembers();
      updateHeaderStats();
    } catch (err) {
      membersGrid.innerHTML = `
        <div class="loading-spinner-wrapper" style="color: var(--danger)">
          <p>⚠️ Error loading members from Member Microservice.</p>
          <p style="font-size: 0.85rem; margin-top: 6px;">${err.message}</p>
        </div>
      `;
      showToast(err.message, 'error');
    }
  }

  function renderMembers() {
    if (!members || members.length === 0) {
      membersGrid.innerHTML = `
        <div class="loading-spinner-wrapper">
          <p>No members found. Register a new member to get started.</p>
        </div>
      `;
      return;
    }

    membersGrid.innerHTML = members.map(m => {
      const initials = m.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
      return `
        <div class="member-card">
          <div class="member-card-head">
            <div class="avatar-circle">${initials}</div>
            <div class="member-info">
              <h4>${escapeHtml(m.name)}</h4>
              <span>${escapeHtml(m.email)}</span>
            </div>
          </div>
          <div class="book-meta">
            <div class="meta-item">
              <span>Membership:</span>
              <span class="badge badge-accent">${escapeHtml(m.membership_type || 'STUDENT')}</span>
            </div>
            <div class="meta-item">
              <span>Phone:</span>
              <span>${escapeHtml(m.phone || 'N/A')}</span>
            </div>
            <div class="meta-item">
              <span>Database:</span>
              <span>MySQL #ID ${m.id}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  memberSearchInput.addEventListener('input', debounce(loadMembers, 300));

  // Add Member Modal & Form
  document.getElementById('btn-open-add-member').addEventListener('click', () => {
    modalAddMember.classList.add('open');
  });
  document.getElementById('btn-close-member-modal').addEventListener('click', () => modalAddMember.classList.remove('open'));
  document.getElementById('btn-cancel-member').addEventListener('click', () => modalAddMember.classList.remove('open'));

  document.getElementById('form-add-member').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const memberData = {
        name: document.getElementById('member-name').value.trim(),
        email: document.getElementById('member-email').value.trim(),
        phone: document.getElementById('member-phone').value.trim(),
        membership_type: document.getElementById('member-type').value
      };

      await api.createMember(memberData);
      showToast(`Member "${memberData.name}" registered successfully!`);
      modalAddMember.classList.remove('open');
      document.getElementById('form-add-member').reset();
      loadMembers();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // ==========================================
  // ISSUE & RETURN DESK
  // ==========================================
  const issueMemberSelect = document.getElementById('issue-member-select');
  const issueBookSelect = document.getElementById('issue-book-select');
  const borrowingsTbody = document.getElementById('borrowings-tbody');
  const formIssueBook = document.getElementById('form-issue-book');
  const filterBorrowedBtn = document.getElementById('filter-borrowed');
  const filterAllLoansBtn = document.getElementById('filter-all-loans');

  async function populateDeskDropdowns() {
    try {
      const [allMembers, allBooks] = await Promise.all([
        api.getMembers(),
        api.getBooks()
      ]);

      issueMemberSelect.innerHTML = '<option value="">-- Choose Member --</option>' +
        allMembers.map(m => `<option value="${m.id}">${escapeHtml(m.name)} (${escapeHtml(m.email)})</option>`).join('');

      issueBookSelect.innerHTML = '<option value="">-- Choose Book --</option>' +
        allBooks.map(b => {
          const disabled = b.available_copies <= 0 ? 'disabled' : '';
          const suffix = b.available_copies <= 0 ? ' [OUT OF STOCK]' : ` [${b.available_copies} available]`;
          return `<option value="${b.id}" ${disabled}>${escapeHtml(b.title)}${suffix}</option>`;
        }).join('');
    } catch (err) {
      console.warn('Error populating desk dropdowns:', err);
    }
  }

  async function loadBorrowings() {
    try {
      borrowings = await api.getBorrowings(currentBorrowFilter);
      renderBorrowings();
      updateHeaderStats();
    } catch (err) {
      borrowingsTbody.innerHTML = `
        <tr><td colspan="7" style="text-align:center; color: var(--danger); padding: 24px;">
          Error loading borrowings: ${err.message}
        </td></tr>
      `;
    }
  }

  function renderBorrowings() {
    if (!borrowings || borrowings.length === 0) {
      borrowingsTbody.innerHTML = `
        <tr><td colspan="7" style="text-align:center; color: var(--text-muted); padding: 24px;">
          No borrowing records found.
        </td></tr>
      `;
      return;
    }

    borrowingsTbody.innerHTML = borrowings.map(b => {
      const issueDate = new Date(b.borrow_date).toLocaleDateString();
      const dueDate = new Date(b.due_date).toLocaleDateString();
      const isReturned = b.status === 'RETURNED';
      const isOverdue = !isReturned && new Date() > new Date(b.due_date);

      let statusBadge = isReturned
        ? '<span class="badge badge-success">Returned</span>'
        : (isOverdue ? '<span class="badge badge-danger">Overdue</span>' : '<span class="badge badge-warning">Active Loan</span>');

      return `
        <tr>
          <td>#${b.id}</td>
          <td><strong>${escapeHtml(b.member_name || 'Member #' + b.member_id)}</strong><br><small style="color:var(--text-muted)">${escapeHtml(b.member_email || '')}</small></td>
          <td>Book #${b.book_id}</td>
          <td>${issueDate}</td>
          <td>${dueDate}</td>
          <td>${statusBadge}</td>
          <td>
            ${!isReturned
              ? `<button class="btn btn-sm btn-success" onclick="handleReturnBook(${b.id})">Return Book</button>`
              : '<span style="color:var(--text-muted); font-size:0.8rem;">Completed</span>'
            }
          </td>
        </tr>
      `;
    }).join('');
  }

  filterBorrowedBtn.addEventListener('click', () => {
    currentBorrowFilter = 'BORROWED';
    filterBorrowedBtn.classList.add('active');
    filterAllLoansBtn.classList.remove('active');
    loadBorrowings();
  });

  filterAllLoansBtn.addEventListener('click', () => {
    currentBorrowFilter = 'ALL';
    filterAllLoansBtn.classList.add('active');
    filterBorrowedBtn.classList.remove('active');
    loadBorrowings();
  });

  formIssueBook.addEventListener('submit', async (e) => {
    e.preventDefault();
    const memberId = issueMemberSelect.value;
    const bookId = issueBookSelect.value;
    const notes = document.getElementById('issue-notes').value.trim();

    try {
      await api.borrowBook(memberId, bookId, notes);
      showToast('Book successfully issued to member!');
      formIssueBook.reset();
      loadBorrowings();
      populateDeskDropdowns();
      loadBooks();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  window.handleReturnBook = async (borrowingId) => {
    try {
      await api.returnBook(borrowingId);
      showToast('Book marked as returned. Inventory updated!');
      loadBorrowings();
      populateDeskDropdowns();
      loadBooks();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // ==========================================
  // CLOUD TOPOLOGY & HEALTH PROBING
  // ==========================================
  const rawHealthJson = document.getElementById('raw-health-json');
  const topoStatusGateway = document.getElementById('topo-status-gateway');
  const topoStatusBook = document.getElementById('topo-status-book');
  const topoStatusMember = document.getElementById('topo-status-member');
  const btnRefreshHealth = document.getElementById('btn-refresh-health');

  async function checkHealth() {
    try {
      const healthData = await api.getHealth();
      rawHealthJson.textContent = JSON.stringify(healthData, null, 2);

      // Gateway
      gatewayStatusBadge.querySelector('.status-dot').className = 'status-dot online';
      gatewayStatusText.textContent = 'Gateway Online';
      topoStatusGateway.className = 'badge badge-success';
      topoStatusGateway.textContent = 'ONLINE (Port 8080)';

      // Book Service
      if (healthData.book_service && healthData.book_service.reachable) {
        topoStatusBook.className = 'badge badge-success';
        topoStatusBook.textContent = 'HEALTHY (PostgreSQL Active)';
      } else {
        topoStatusBook.className = 'badge badge-danger';
        topoStatusBook.textContent = 'UNREACHABLE';
      }

      // Member Service
      if (healthData.member_service && healthData.member_service.reachable) {
        topoStatusMember.className = 'badge badge-success';
        topoStatusMember.textContent = 'HEALTHY (MySQL Active)';
      } else {
        topoStatusMember.className = 'badge badge-danger';
        topoStatusMember.textContent = 'UNREACHABLE';
      }
    } catch (err) {
      rawHealthJson.textContent = `Error connecting to API Gateway: ${err.message}\nMake sure containers are running via 'docker compose up'`;
      gatewayStatusBadge.querySelector('.status-dot').className = 'status-dot offline';
      gatewayStatusText.textContent = 'Gateway Offline';
      topoStatusGateway.className = 'badge badge-danger';
      topoStatusGateway.textContent = 'OFFLINE';
      topoStatusBook.className = 'badge badge-danger';
      topoStatusBook.textContent = 'UNKNOWN';
      topoStatusMember.className = 'badge badge-danger';
      topoStatusMember.textContent = 'UNKNOWN';
    }
  }

  if (btnRefreshHealth) {
    btnRefreshHealth.addEventListener('click', () => {
      checkHealth();
      showToast('Health diagnostics refreshed.');
    });
  }

  // ==========================================
  // CONFIG MODAL
  // ==========================================
  const btnOpenConfig = document.getElementById('btn-open-config');
  const btnCloseConfigModal = document.getElementById('btn-close-config-modal');
  const btnSaveGateway = document.getElementById('btn-save-gateway');
  const btnResetGateway = document.getElementById('btn-reset-gateway');

  btnOpenConfig.addEventListener('click', () => {
    inputGatewayUrl.value = api.baseUrl;
    modalConfig.classList.add('open');
  });

  btnCloseConfigModal.addEventListener('click', () => modalConfig.classList.remove('open'));

  btnSaveGateway.addEventListener('click', () => {
    const val = inputGatewayUrl.value.trim();
    if (val) {
      api.setBaseUrl(val);
      modalConfig.classList.remove('open');
      showToast(`Gateway URL updated to ${api.baseUrl}`);
      checkHealth();
      loadBooks();
    }
  });

  btnResetGateway.addEventListener('click', () => {
    api.resetBaseUrl();
    inputGatewayUrl.value = api.baseUrl;
    modalConfig.classList.remove('open');
    showToast('Reset to default Gateway URL');
    checkHealth();
    loadBooks();
  });

  // ==========================================
  // STATS UPDATE HELPER
  // ==========================================
  async function updateHeaderStats() {
    try {
      if (books && books.length > 0) statTotalBooks.textContent = books.length;
      if (members && members.length > 0) statTotalMembers.textContent = members.length;
      
      const activeLoans = await api.getBorrowings('BORROWED').catch(() => []);
      statActiveLoans.textContent = activeLoans ? activeLoans.length : 0;
    } catch (e) {
      // Ignore background stats calculation error
    }
  }

  // Helper: debounce
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // Helper: escape HTML
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Initial Load
  checkHealth();
  loadBooks();
  setInterval(checkHealth, 20000); // Check gateway health every 20s
});
