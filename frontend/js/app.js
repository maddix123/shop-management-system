const API_URL = '';
const token = localStorage.getItem('maddix_token');
const user = JSON.parse(localStorage.getItem('maddix_user') || 'null');
let socket = null;
let cart = [];
let allProducts = [];
let allInventory = [];
let categoriesList = [];
let selectedCustomer = null;

document.addEventListener('DOMContentLoaded', () => {
  const path = window.location.pathname;
  const isAuthPage = path === '/' || path === '/index.html' || path === '/index';

  // 1. Instant POS/Dashboard Redirect if already logged in on login screen
  if (token && isAuthPage) {
    if (user && (user.role === 'admin' || user.role === 'manager')) {
      window.location.href = '/dashboard';
      return;
    } else {
      // Cashiers stay on POS
      const authScreen = document.getElementById('auth-screen');
      if (authScreen) authScreen.style.display = 'none';
      const posScreen = document.getElementById('pos-screen');
      if (posScreen) posScreen.style.display = 'block';
    }
  }

  if (!token && !isAuthPage) {
    window.location.href = '/';
    return;
  }

  if (token) {
    // Populate user profile info
    if (user) {
      const usernameEl = document.getElementById('logged-username');
      if (usernameEl) usernameEl.textContent = user.username;
      
      const roleBadge = document.getElementById('user-role-badge');
      if (roleBadge) {
        roleBadge.textContent = user.role.toUpperCase();
        if (user.role === 'admin') roleBadge.style.background = 'var(--danger)';
        else if (user.role === 'manager') roleBadge.style.background = 'var(--primary)';
        else roleBadge.style.background = 'var(--warning)';
      }

      // Configure RBAC navigation access
      if (user.role === 'admin' || user.role === 'manager') {
        const btnDash = document.getElementById('btn-dash');
        const btnInv = document.getElementById('btn-inv');
        if (btnDash) btnDash.style.display = 'inline-block';
        if (btnInv) btnInv.style.display = 'inline-block';
      }
    }

    // Add Form Submit Listeners strictly via Javascript to block all default browser reloads!
    const productForm = document.getElementById('product-form');
    if (productForm) {
      productForm.addEventListener('submit', saveProduct);
    }

    const categoryForm = document.getElementById('category-form');
    if (categoryForm) {
      categoryForm.addEventListener('submit', submitCustomCategory);
    }

    const createUserForm = document.getElementById('create-user-form');
    if (createUserForm) {
      createUserForm.addEventListener('submit', createCashier);
    }

    setupSocket();

    // Trigger page-specific logic
    if (path.includes('dashboard')) {
      loadDashboard();
    } else if (path.includes('inventory')) {
      loadInventoryPage();
    } else {
      loadPOS();
    }
  } else {
    // Auth page handlers
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', handleLogin);
    }
  }
});

// ==================== AUTHENTICATION ====================
async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  try {
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Authentication failed');

    localStorage.setItem('maddix_token', data.token);
    localStorage.setItem('maddix_user', JSON.stringify(data.user));
    
    showToast('success', 'Terminal Authorized', 'Access granted. Redirecting...');
    
    // Auto-routing based on role on success (instantly navigates!)
    setTimeout(() => {
      if (data.user.role === 'admin' || data.user.role === 'manager') {
        window.location.href = '/dashboard';
      } else {
        window.location.href = '/';
      }
    }, 1000);
  } catch (err) {
    showToast('error', 'Access Denied', err.message);
  }
}

function logout() {
  localStorage.removeItem('maddix_token');
  localStorage.removeItem('maddix_user');
  window.location.href = '/';
}

// ==================== SOCKET.IO REAL-TIME SYNC ====================
function setupSocket() {
  if (typeof io !== 'undefined') {
    socket = io();
    socket.on('sale:created', (data) => {
      showToast('info', 'Sales Alert 📈', `${data.cashier} processed Order #${data.invoiceNumber} for ${data.totalPrice} UGX`);
      const path = window.location.pathname;
      if (path.includes('dashboard')) {
        loadDashboard();
      }
    });
  }
}

// ==================== CATEGORIES LOADING ====================
async function loadCategories(selectId, filterId = null) {
  try {
    const res = await fetch(`${API_URL}/api/products/categories`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    categoriesList = data.categories || [];
    
    // Populate form dropdown
    const select = document.getElementById(selectId);
    if (select) {
      select.innerHTML = categoriesList.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
    }

    // Populate filter dropdown if present
    if (filterId) {
      const filter = document.getElementById(filterId);
      if (filter) {
        filter.innerHTML = '<option value="all">All Categories</option>' + 
          categoriesList.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
      }
    }
  } catch (err) {
    console.error('Failed to load categories:', err);
  }
}

function addCustomCategoryPrompt() {
  document.getElementById('category-form').reset();
  document.getElementById('category-modal').classList.add('active');
}

async function submitCustomCategory(e) {
  e.preventDefault();
  const name = document.getElementById('new-category-name').value.trim();
  if (!name || name === '') return;

  try {
    const res = await fetch(`${API_URL}/api/products/categories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ name: name })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to create category');

    showToast('success', 'Category Created', `"${name}" is now available!`);
    closeModal('category-modal');
    
    // Reload categories dynamically and select the new one (refresh-free update!)
    await loadCategories('prod-category', 'inventory-category-filter');
    
    const select = document.getElementById('prod-category');
    if (select) select.value = name;
    
    filterInventory();
  } catch (err) {
    showToast('error', 'Error', err.message);
  }
}

// ==================== POS BILLING TERMINAL ====================
async function loadPOS() {
  try {
    const res = await fetch(`${API_URL}/api/products`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    allProducts = data.products || [];
    renderPOSCatalog(allProducts);
  } catch (err) {
    showToast('error', 'Load Failed', 'Failed to retrieve products catalog');
  }
}

function renderPOSCatalog(products) {
  const container = document.getElementById('pos-products');
  if (!container) return;

  if (products.length === 0) {
    container.innerHTML = '<div class="empty-state">No products matches filter</div>';
    return;
  }

  container.innerHTML = products.map(p => {
    const isOutOfStock = p.stockQuantity <= 0;
    const isLowStock = p.stockQuantity <= p.lowStockThreshold;
    
    return `
      <div class="pos-product-card" onclick="${isOutOfStock ? '' : `addItemToCart('${p._id}')`}" style="${isOutOfStock ? 'opacity: 0.5; cursor: not-allowed;' : ''}">
        <div style="font-weight: 700; font-size: 14px; margin-bottom: 4px;">${p.name}</div>
        <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 8px;">SKU: ${p.sku}</div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px;">
          <span style="font-weight: 700; color: var(--warning);">${p.sellingPrice} UGX</span>
          <span class="status-badge" style="background: ${isOutOfStock ? 'rgba(239, 68, 68, 0.2)' : (isLowStock ? 'rgba(245, 158, 11, 0.2)' : 'rgba(16, 185, 129, 0.2)')}; color: ${isOutOfStock ? 'var(--danger)' : (isLowStock ? 'var(--warning)' : 'var(--success)')}; font-size: 10px; padding: 2px 6px;">
            ${isOutOfStock ? 'OUT' : `${p.stockQuantity} Left`}
          </span>
        </div>
      </div>
    `;
  }).join('');
}

function filterProducts() {
  const q = document.getElementById('product-search').value.toLowerCase();
  const filtered = allProducts.filter(p => p.name.toLowerCase().includes(q) || p.sku.includes(q) || p.category.toLowerCase().includes(q));
  renderPOSCatalog(filtered);
}

function addItemToCart(productId) {
  const prod = allProducts.find(p => p._id === productId);
  if (!prod) return;

  const existing = cart.find(item => item.product === productId);
  if (existing) {
    if (existing.qty >= prod.stockQuantity) {
      showToast('error', 'Stock Limit', 'Cannot add more. Insufficient stock!');
      return;
    }
    existing.qty++;
  } else {
    cart.push({
      product: productId,
      name: prod.name,
      sellingPrice: prod.sellingPrice,
      qty: 1
    });
  }
  renderCart();
}

function updateCartQty(productId, newQty) {
  const prod = allProducts.find(p => p._id === productId);
  const item = cart.find(i => i.product === productId);
  if (!prod || !item) return;

  if (newQty > prod.stockQuantity) {
    showToast('error', 'Stock Limit', 'Cannot exceed available stock of ' + prod.stockQuantity);
    item.qty = prod.stockQuantity;
  } else if (newQty < 1) {
    cart = cart.filter(i => i.product !== productId);
  } else {
    item.qty = parseInt(newQty);
  }
  renderCart();
}

function removeFromCart(productId) {
  cart = cart.filter(i => i.product !== productId);
  renderCart();
}

function renderCart() {
  const container = document.getElementById('cart-list');
  const countEl = document.getElementById('cart-item-count');
  if (!container) return;

  countEl.textContent = `${cart.reduce((sum, i) => sum + i.qty, 0)} units`;

  if (cart.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding: 20px;">
        <div class="icon" style="font-size: 2rem;">🛒</div>
        <p>Cart is currently empty</p>
      </div>
    `;
    calculateCart();
    return;
  }

  container.innerHTML = cart.map(item => `
    <div class="bot-item" style="padding: 10px; font-size: 13px; margin-bottom: 6px;">
      <div style="flex: 1;">
        <strong style="color: var(--text);">${item.name}</strong>
        <div style="color: var(--text-muted); font-size: 11px; margin-top: 2px;">${item.sellingPrice} UGX</div>
      </div>
      <div style="display: flex; align-items: center; gap: 8px;">
        <input type="number" value="${item.qty}" min="1" onchange="updateCartQty('${item.product}', this.value)" style="width: 55px; padding: 4px; background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px; text-align: center;">
        <button class="btn btn-danger btn-sm" onclick="removeFromCart('${item.product}')" style="padding: 4px 8px; font-size: 11px;">×</button>
      </div>
    </div>
  `).join('');

  calculateCart();
}

// VAT TAX CALCULATIONS REMOVED BY DEFAULT
function calculateCart() {
  const subtotal = cart.reduce((sum, i) => sum + (i.sellingPrice * i.qty), 0);
  
  // Custom discount input
  let discount = parseInt(document.getElementById('summary-discount')?.value || 0);
  if (isNaN(discount)) discount = 0;

  const total = Math.max(0, subtotal - discount);

  const subtotalEl = document.getElementById('summary-subtotal');
  const totalEl = document.getElementById('summary-total');

  if (subtotalEl) subtotalEl.textContent = `${subtotal.toLocaleString()} UGX`;
  if (totalEl) totalEl.textContent = `${total.toLocaleString()} UGX`;

  calculateChange();
}

async function lookupCustomer() {
  const phone = document.getElementById('customer-phone-search').value.trim();
  if (!phone) {
    showToast('error', 'Validation', 'Please enter a customer phone number');
    return;
  }

  try {
    const res = await fetch(`${API_URL}/api/customers/phone/${phone}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (res.status === 404) {
      // Register new customer on the fly
      const name = prompt('New customer detected! Please enter customer name:');
      if (!name) return;
      
      const createRes = await fetch(`${API_URL}/api/customers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name, phone })
      });
      const createData = await createRes.json();
      if (!createRes.ok) throw new Error(createData.error);
      
      selectedCustomer = createData.customer;
      showToast('success', 'Customer Registered', 'New profile created!');
    } else {
      const data = await res.json();
      selectedCustomer = data.customer;
      showToast('success', 'Customer Selected', 'Profile: ' + selectedCustomer.name);
    }

    if (selectedCustomer) {
      document.getElementById('selected-customer-display').style.display = 'block';
      document.getElementById('customer-name-span').textContent = `${selectedCustomer.name} (${selectedCustomer.phone})`;
    }
  } catch (err) {
    showToast('error', 'Error', err.message);
  }
}

function calculateChange() {
  const totalText = document.getElementById('summary-total')?.textContent || '0';
  const total = parseInt(totalText.replace(/[^0-9]/g, '')) || 0;
  
  let paid = parseInt(document.getElementById('checkout-amount-paid')?.value || 0);
  if (isNaN(paid)) paid = 0;

  const change = Math.max(0, paid - total);
  
  const changeEl = document.getElementById('summary-change');
  if (changeEl) changeEl.textContent = `${change.toLocaleString()} UGX`;
}

async function processCheckout() {
  if (cart.length === 0) {
    showToast('error', 'Cart is empty', 'Add products to checkout');
    return;
  }

  const subtotalText = document.getElementById('summary-subtotal').textContent;
  const subtotal = parseInt(subtotalText.replace(/[^0-9]/g, ''));
  
  const discount = parseInt(document.getElementById('summary-discount').value || 0);
  
  const totalText = document.getElementById('summary-total').textContent;
  const total = parseInt(totalText.replace(/[^0-9]/g, ''));
  
  const paid = parseInt(document.getElementById('checkout-amount-paid').value || 0);
  const change = Math.max(0, paid - total);

  if (paid < total) {
    showToast('error', 'Payment Insufficient', 'Amount paid must cover the order grand total of ' + total + ' UGX');
    return;
  }

  const payload = {
    items: cart.map(i => ({ productId: i.product, name: i.name, quantity: i.qty, sellingPrice: i.sellingPrice })),
    subtotal,
    tax: 0, // VAT Tax set to 0
    discount,
    totalPrice: total,
    amountPaid: paid,
    changeDue: change,
    customerId: selectedCustomer ? selectedCustomer._id : null
  };

  try {
    const res = await fetch(`${API_URL}/api/sales/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Checkout failed');

    showToast('success', 'Order Saved', 'Transaction processed successfully!');
    
    // Format invoice receipt modal
    document.getElementById('invoice-num-span').textContent = data.sale.invoiceNumber;
    document.getElementById('invoice-date-span').textContent = new Date(data.sale.createdAt).toLocaleString();
    document.getElementById('invoice-cashier-span').textContent = user ? user.username : 'admin';
    
    const itemsList = document.getElementById('invoice-items-list');
    itemsList.innerHTML = data.sale.items.map(item => `
      <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px;">
        <span>${item.name} x${item.quantity}</span>
        <span>${(item.sellingPrice * item.quantity).toLocaleString()}</span>
      </div>
    `).join('');

    document.getElementById('invoice-subtotal').textContent = `${data.sale.subtotal.toLocaleString()} UGX`;
    document.getElementById('invoice-discount').textContent = `${data.sale.discount.toLocaleString()} UGX`;
    document.getElementById('invoice-total').textContent = `${data.sale.totalPrice.toLocaleString()} UGX`;
    document.getElementById('invoice-paid').textContent = `${data.sale.amountPaid.toLocaleString()} UGX`;
    document.getElementById('invoice-change').textContent = `${data.sale.changeDue.toLocaleString()} UGX`;

    // Reset local POS state
    cart = [];
    selectedCustomer = null;
    document.getElementById('selected-customer-display').style.display = 'none';
    document.getElementById('customer-phone-search').value = '';
    document.getElementById('checkout-amount-paid').value = 0;
    document.getElementById('summary-discount').value = 0;
    renderCart();
    loadPOS(); // reload catalog stock levels

    // Open invoice print modal
    document.getElementById('invoice-modal').classList.add('active');

  } catch (err) {
    showToast('error', 'Transaction Failed', err.message);
  }
}

// ==================== DASHBOARD & ANALYTICS ====================
async function loadDashboard() {
  try {
    // 1. Fetch sales stats
    const statsRes = await fetch(`${API_URL}/api/admin/stats`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const statsData = await statsRes.json();
    
    if (statsRes.ok) {
      document.getElementById('stat-revenue').textContent = `${statsData.stats.todayRevenue.toLocaleString()} UGX`;
      document.getElementById('stat-profit').textContent = `${statsData.stats.totalProfit.toLocaleString()} UGX`;
      document.getElementById('stat-orders').textContent = statsData.stats.totalOrders;
      document.getElementById('stat-low-stock').textContent = statsData.stats.lowStockCount;
    }

    // 2. Fetch sales logs
    const salesRes = await fetch(`${API_URL}/api/sales`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const salesData = await salesRes.json();
    const salesList = document.getElementById('sales-history-list');
    
    if (salesData.sales && salesData.sales.length > 0) {
      salesList.innerHTML = salesData.sales.map(sale => `
        <div class="bot-item">
          <div>
            <strong>Order #${sale.invoiceNumber}</strong>
            <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
              Cashier: ${sale.cashier?.username || 'admin'} | ${new Date(sale.createdAt).toLocaleString()}
            </div>
            <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
              Customer: ${sale.customer ? `${sale.customer.name} (${sale.customer.phone})` : 'Walk-in'}
            </div>
          </div>
          <div style="text-align: right;">
            <strong style="color: var(--success); font-size: 1.1rem;">${sale.totalPrice.toLocaleString()} UGX</strong>
            <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">${sale.items.length} items</div>
          </div>
        </div>
      `).join('');
    } else {
      salesList.innerHTML = '<div class="empty-state">No transaction logs logged yet</div>';
    }

    // 3. Configure Cashier accounts view (Admin Only)
    if (user && user.role === 'admin') {
      document.getElementById('admin-user-section').style.display = 'block';
      document.getElementById('manager-notice-section').style.display = 'none';
      loadStaff();
    }

  } catch (err) {
    showToast('error', 'Load Failed', 'Failed to retrieve stats data');
  }
}

async function loadStaff() {
  try {
    const res = await fetch(`${API_URL}/api/admin/users`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    const container = document.getElementById('staff-list');
    
    if (data.users && data.users.length > 0) {
      container.innerHTML = data.users.map(u => `
        <div class="bot-item" style="padding: 10px; font-size: 13px;">
          <div>
            <strong>${u.username}</strong>
            <div style="font-size: 11px; color: var(--text-muted);">${u.email} | Role: ${u.role.toUpperCase()}</div>
          </div>
          <span class="status-badge status-connected" style="background: ${u.isActive ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}; color: ${u.isActive ? 'var(--success)' : 'var(--danger)'};">
            ${u.isActive ? 'Active' : 'Locked'}
          </span>
        </div>
      `).join('');
    } else {
      container.innerHTML = '<p style="color: var(--text-muted); font-size: 13px;">No other cashier accounts registered</p>';
    }
  } catch (err) {
    console.error(err);
  }
}

async function createCashier(e) {
  e.preventDefault();
  const username = document.getElementById('staff-username').value.trim();
  const email = document.getElementById('staff-email').value.trim();
  const password = document.getElementById('staff-password').value;
  const role = document.getElementById('staff-role').value;

  try {
    const res = await fetch(`${API_URL}/api/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ username, email, password, role })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to create account');

    showToast('success', 'Staff Registered', 'Account created successfully!');
    document.getElementById('create-user-form').reset();
    loadStaff();
  } catch (err) {
    showToast('error', 'Error', err.message);
  }
}

// ==================== INVENTORY STOCK MANAGEMENT ====================
async function loadInventoryPage() {
  await loadCategories('prod-category', 'inventory-category-filter');
  await loadInventory();
}

async function loadInventory() {
  try {
    const res = await fetch(`${API_URL}/api/products`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    allInventory = data.products || [];
    renderInventoryList(allInventory);
  } catch (err) {
    showToast('error', 'Load Failed', 'Failed to retrieve stock list');
  }
}

function renderInventoryList(products) {
  const container = document.getElementById('inventory-products-list');
  if (!container) return;

  if (products.length === 0) {
    container.innerHTML = '<div class="empty-state">No stock matches filter</div>';
    return;
  }

  container.innerHTML = products.map(p => {
    const isLowStock = p.stockQuantity <= p.lowStockThreshold;

    return `
      <div class="bot-item">
        <div style="flex-grow: 1;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <strong style="font-size: 15px;">${p.name}</strong>
            <span class="status-badge" style="background: var(--card-hover); color: var(--text-muted); font-size: 10px;">${p.category}</span>
          </div>
          <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">
            SKU: ${p.sku} | Supplier: ${p.supplier} | Cost: <strong style="color: var(--text);">${p.costPrice.toLocaleString()}</strong> | Selling: <strong style="color: var(--text);">${p.sellingPrice.toLocaleString()}</strong>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 16px;">
          <div style="text-align: right;">
            <span style="font-weight: 700; font-size: 1.1rem; color: ${isLowStock ? 'var(--danger)' : 'var(--success)'};">${p.stockQuantity} Units</span>
            <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">Min Alert: ${p.lowStockThreshold} units</div>
          </div>
          <div style="display: flex; gap: 6px;">
            <button class="btn btn-secondary btn-sm" onclick="openEditProduct('${p._id}')">Edit</button>
            ${user && user.role === 'admin' ? `<button class="btn btn-danger btn-sm" onclick="deleteProduct('${p._id}')" style="background: var(--danger); padding: 6px 12px;">×</button>` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function filterInventory() {
  const q = document.getElementById('inventory-search').value.toLowerCase();
  const cat = document.getElementById('inventory-category-filter').value;
  
  let filtered = allInventory;
  if (cat !== 'all') {
    filtered = filtered.filter(p => p.category === cat);
  }
  if (q) {
    filtered = filtered.filter(p => p.name.toLowerCase().includes(q) || p.sku.includes(q));
  }
  renderInventoryList(filtered);
}

function openAddProductModal() {
  document.getElementById('product-form').reset();
  document.getElementById('product-id').value = '';
  document.getElementById('product-modal-title').textContent = 'Add New Product';
  document.getElementById('product-modal').classList.add('active');
}

function openEditProduct(productId) {
  const p = allInventory.find(item => item._id === productId);
  if (!p) return;
  
  document.getElementById('product-id').value = p._id;
  document.getElementById('prod-name').value = p.name;
  document.getElementById('prod-sku').value = p.sku;
  document.getElementById('prod-category').value = p.category;
  document.getElementById('prod-cost').value = p.costPrice;
  document.getElementById('prod-selling').value = p.sellingPrice;
  document.getElementById('prod-stock').value = p.stockQuantity;
  document.getElementById('prod-low-threshold').value = p.lowStockThreshold;
  document.getElementById('prod-supplier').value = p.supplier;

  document.getElementById('product-modal-title').textContent = 'Edit Product';
  document.getElementById('product-modal').classList.add('active');
}

async function saveProduct(e) {
  e.preventDefault();
  const id = document.getElementById('product-id').value;
  const name = document.getElementById('prod-name').value.trim();
  const sku = document.getElementById('prod-sku').value.trim();
  const category = document.getElementById('prod-category').value;
  const costPrice = parseFloat(document.getElementById('prod-cost').value);
  const sellingPrice = parseFloat(document.getElementById('prod-selling').value);
  const stockQuantity = parseInt(document.getElementById('prod-stock').value);
  const lowStockThreshold = parseInt(document.getElementById('prod-low-threshold').value);
  const supplier = document.getElementById('prod-supplier').value.trim();

  const payload = { name, sku, category, costPrice, sellingPrice, stockQuantity, lowStockThreshold, supplier };
  
  try {
    let res;
    if (id) {
      // Edit mode
      res = await fetch(`${API_URL}/api/products/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
    } else {
      // Create mode
      res = await fetch(`${API_URL}/api/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
    }
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to save product');

    showToast('success', 'Stock Saved', 'Product file saved successfully!');
    closeModal('product-modal');
    
    // Core Fix: Re-fetch all inventory and categories dynamically
    await loadInventoryPage();
  } catch (err) {
    showToast('error', 'Error', err.message);
  }
}

async function deleteProduct(productId) {
  if (!confirm('Are you sure you want to permanently delete this product?')) return;

  try {
    const res = await fetch(`${API_URL}/api/products/${productId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to delete product');

    showToast('success', 'Product Deleted', 'Stock item permanently removed');
    loadInventory();
  } catch (err) {
    showToast('error', 'Error', err.message);
  }
}

function closeModal(id) {
  document.getElementById(id).classList.remove('active');
}
