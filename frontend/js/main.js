// main.js - Core JavaScript functionality for Scentbysally

// ===== GLOBAL VARIABLES =====
const Scentbysally = {
    user: null,
    cart: [],
    wishlist: [],
    isAuthenticated: false,
    userRole: null // 'buyer', 'admin', 'superadmin'
};

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', async function() {
    console.log('Scentbysally loaded');

    // Ask the server who (if anyone) is logged in for this session
    await checkAuth();

    // Load cart from localStorage
    loadCart();

    // Update cart count in navbar
    updateCartCount();

    // Initialize forms
    initForms();

    // Initialize mobile menu
    initMobileMenu();

    // Check current page and initialize specific functions
    const currentPage = window.location.pathname.split('/').pop();
    initPageSpecific(currentPage);
});

// ===== USER MANAGEMENT =====
// The server session (an httpOnly cookie) is the real source of truth for
// who's logged in - there is no client-readable token to cache, so every
// page asks /api/auth/me once per load. Concurrent callers (this file's own
// DOMContentLoaded handler and any page that calls requireAuth()) share one
// underlying request instead of firing it twice.
let currentUserPromise = null;

function fetchCurrentUser() {
    if (!currentUserPromise) {
        currentUserPromise = fetch('/api/auth/me', { credentials: 'same-origin' })
            .then(res => (res.ok ? res.json() : null))
            .catch(() => null);
    }
    return currentUserPromise;
}

function setCurrentUser(user) {
    Scentbysally.user = user;
    Scentbysally.isAuthenticated = Boolean(user);
    Scentbysally.userRole = user ? user.role : null;
    updateNavForAuth();
}

async function checkAuth() {
    const user = await fetchCurrentUser();
    setCurrentUser(user);
    return user;
}

// For pages that must be gated by role (admin/superadmin sections): awaits
// the real session check and redirects to login if it fails, instead of
// trusting a client-side flag that could be stale or spoofed.
async function requireAuth(allowedRoles) {
    const user = await checkAuth();
    if (!user || (allowedRoles && !allowedRoles.includes(user.role))) {
        window.location.href = '/login.html';
        return null;
    }
    return user;
}

function logout() {
    fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' })
        .finally(() => {
            currentUserPromise = null;
            setCurrentUser(null);
            window.location.href = '/index.html';
        });
}

function updateNavForAuth() {
    const navLinks = document.querySelector('.nav-links');
    if (!navLinks) return;
    
    if (Scentbysally.isAuthenticated) {
        // Remove static Login/Logout links if present - the user menu below
        // provides its own Logout action, so a static one would be a duplicate
        Array.from(navLinks.children)
            .filter(link => ['Login', 'Logout'].includes(link.textContent.trim()))
            .forEach(link => link.remove());

        // Don't add a duplicate menu if one is already in the nav
        if (navLinks.querySelector('.user-menu')) return;

        // Build the user menu with its dropdown
        const userMenu = document.createElement('div');
        userMenu.className = 'user-menu nav-link';
        userMenu.innerHTML = `
            ${Scentbysally.user.name || 'Account'} &#9662;
            <div class="dropdown-menu" style="display: none;">
                ${getDropdownLinks()}
            </div>
        `;

        // Add click handler
        const dropdown = userMenu.querySelector('.dropdown-menu');
        userMenu.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', () => {
            dropdown.style.display = 'none';
        });

        navLinks.appendChild(userMenu);
    } else {
        // Ensure login link exists
        const hasLoginLink = Array.from(navLinks.children).some(link => link.textContent === 'Login');
        if (!hasLoginLink) {
            const loginLink = document.createElement('a');
            loginLink.href = '/login.html';
            loginLink.className = 'nav-link';
            loginLink.textContent = 'Login';
            navLinks.appendChild(loginLink);
        }
    }
}

function getDropdownLinks() {
    if (Scentbysally.userRole === 'superadmin') {
        return `
            <a href="/superadmin/dashboard.html" style="display: block; padding: 0.5rem; color: var(--white); text-decoration: none;">Dashboard</a>
            <a href="/superadmin/products.html" style="display: block; padding: 0.5rem; color: var(--white); text-decoration: none;">Products</a>
            <a href="/superadmin/reports.html" style="display: block; padding: 0.5rem; color: var(--white); text-decoration: none;">Reports</a>
            <a href="#" onclick="logout()" style="display: block; padding: 0.5rem; color: var(--white); text-decoration: none;">Logout</a>
        `;
    } else if (Scentbysally.userRole === 'admin') {
        return `
            <a href="/admin/dashboard.html" style="display: block; padding: 0.5rem; color: var(--white); text-decoration: none;">Dashboard</a>
            <a href="/admin/orders.html" style="display: block; padding: 0.5rem; color: var(--white); text-decoration: none;">Orders</a>
            <a href="/admin/inventory.html" style="display: block; padding: 0.5rem; color: var(--white); text-decoration: none;">Inventory</a>
            <a href="#" onclick="logout()" style="display: block; padding: 0.5rem; color: var(--white); text-decoration: none;">Logout</a>
        `;
    } else {
        return `
            <a href="/buyer/profile.html" style="display: block; padding: 0.5rem; color: var(--white); text-decoration: none;">Profile</a>
            <a href="/buyer/orders.html" style="display: block; padding: 0.5rem; color: var(--white); text-decoration: none;">Orders</a>
            <a href="/buyer/wishlist.html" style="display: block; padding: 0.5rem; color: var(--white); text-decoration: none;">Wishlist</a>
            <a href="#" onclick="logout()" style="display: block; padding: 0.5rem; color: var(--white); text-decoration: none;">Logout</a>
        `;
    }
}

// ===== CART MANAGEMENT =====
function loadCart() {
    const savedCart = localStorage.getItem('scentbysally_cart');
    if (savedCart) {
        Scentbysally.cart = JSON.parse(savedCart);
    } else {
        Scentbysally.cart = [];
    }
}

function saveCart() {
    localStorage.setItem('scentbysally_cart', JSON.stringify(Scentbysally.cart));
    updateCartCount();
}

function addToCart(product, type, quantity = 1) {
    const existingItem = Scentbysally.cart.find(item => 
        item.product.id === product.id && item.type === type
    );
    
    if (existingItem) {
        existingItem.quantity += quantity;
    } else {
        Scentbysally.cart.push({
            product,
            type,
            quantity,
            addedAt: new Date().toISOString()
        });
    }
    
    saveCart();
    showNotification('Product added to cart', 'success');
}

function removeFromCart(index) {
    Scentbysally.cart.splice(index, 1);
    saveCart();
    showNotification('Product removed from cart');
    
    // Refresh cart display if on cart page
    if (window.location.pathname.includes('cart.html')) {
        displayCart();
    }
}

function updateQuantity(index, newQuantity) {
    if (newQuantity < 1) {
        removeFromCart(index);
    } else {
        Scentbysally.cart[index].quantity = newQuantity;
        saveCart();
        
        // Refresh cart display if on cart page
        if (window.location.pathname.includes('cart.html')) {
            displayCart();
        }
    }
}

function updateCartCount() {
    const cartLinks = document.querySelectorAll('.nav-link');
    cartLinks.forEach(link => {
        if (link.textContent.includes('Cart')) {
            const count = Scentbysally.cart.reduce((sum, item) => sum + item.quantity, 0);
            link.textContent = `Cart (${count})`;
        }
    });
}

function getCartTotal() {
    return Scentbysally.cart.reduce((sum, item) => 
        sum + (item.product.price * item.quantity), 0
    );
}

// Display cart on cart page
function displayCart() {
    const cartContainer = document.getElementById('cart-items');
    if (!cartContainer) return;
    
    if (Scentbysally.cart.length === 0) {
        cartContainer.innerHTML = `
            <div class="floating-card" style="text-align: center; padding: 3rem;">
                <h2 style="margin-bottom: 1rem;">Your cart is empty</h2>
                <p style="color: var(--gray-light); margin-bottom: 2rem;">Start shopping to add items to your cart</p>
                <a href="/buyer/products.html" class="btn">Shop Now</a>
            </div>
        `;
        return;
    }
    
    let html = '';
    Scentbysally.cart.forEach((item, index) => {
        html += `
            <div class="cart-item floating-card-light">
                <img src="${item.product.image || 'https://via.placeholder.com/80x80/000000/ffffff?text=Perfume'}" alt="${item.product.name}" class="cart-item-image">
                <div class="cart-item-details">
                    <h3 class="cart-item-title">${item.product.name}</h3>
                    <p class="cart-item-price">Size: ${item.type} | ₦${item.product.price.toLocaleString()}</p>
                </div>
                <div class="cart-quantity">
                    <button class="quantity-btn" onclick="updateQuantity(${index}, ${item.quantity - 1})">-</button>
                    <span style="min-width: 30px; text-align: center;">${item.quantity}</span>
                    <button class="quantity-btn" onclick="updateQuantity(${index}, ${item.quantity + 1})">+</button>
                </div>
                <div style="font-size: 1.2rem; font-weight: 600;">
                    ₦${(item.product.price * item.quantity).toLocaleString()}
                </div>
                <button class="btn btn-outline" onclick="removeFromCart(${index})" style="padding: 0.5rem 1rem;">Remove</button>
            </div>
        `;
    });
    
    html += `
        <div style="margin-top: 2rem; text-align: right;">
            <h2>Total: ₦${getCartTotal().toLocaleString()}</h2>
            <a href="/buyer/checkout.html" class="btn" style="margin-top: 1rem;">Proceed to Checkout</a>
        </div>
    `;
    
    cartContainer.innerHTML = html;
}

// ===== NOTIFICATIONS =====
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `alert alert-${type}`;
    notification.textContent = message;
    notification.style.position = 'fixed';
    notification.style.top = '20px';
    notification.style.right = '20px';
    notification.style.zIndex = '9999';
    notification.style.minWidth = '300px';
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}

// ===== FORM HANDLING =====
function initForms() {
    // Login form
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    // Register form
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
    }
    
    // Reset password form
    const resetForm = document.getElementById('reset-form');
    if (resetForm) {
        resetForm.addEventListener('submit', handleResetPassword);
    }
    
    // Checkout form
    const checkoutForm = document.getElementById('checkout-form');
    if (checkoutForm) {
        checkoutForm.addEventListener('submit', handleCheckout);
    }
}

async function handleLogin(e) {
    e.preventDefault();

    // Scoped to the submitted form - see handleRegister for why (duplicate
    // ids between the login and register forms on login.html).
    const form = e.target;
    const email = form.querySelector('#email')?.value;
    const password = form.querySelector('#password')?.value;

    if (!email || !password) {
        showNotification('Please fill in all fields', 'error');
        return;
    }

    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();

        if (!res.ok) {
            showNotification(data.error || 'Login failed', 'error');
            return;
        }

        currentUserPromise = Promise.resolve(data);
        setCurrentUser(data);
        showNotification('Login successful!', 'success');

        // Redirect based on the role the server assigned, not anything typed client-side
        setTimeout(() => {
            if (data.role === 'superadmin') {
                window.location.href = '/superadmin/dashboard.html';
            } else if (data.role === 'admin') {
                window.location.href = '/admin/dashboard.html';
            } else {
                window.location.href = '/index.html';
            }
        }, 800);
    } catch (err) {
        showNotification('Could not reach the server. Please try again.', 'error');
    }
}

async function handleRegister(e) {
    e.preventDefault();

    // Scoped to the submitted form, not document.getElementById: the login
    // and register forms on login.html share ids ("email", "password"), so
    // a global lookup would silently read the other (hidden, empty) form.
    const form = e.target;
    const name = form.querySelector('#name')?.value;
    const email = form.querySelector('#email')?.value;
    const password = form.querySelector('#password')?.value;
    const confirmPassword = form.querySelector('#confirm-password')?.value;

    if (!name || !email || !password || !confirmPassword) {
        showNotification('Please fill in all fields', 'error');
        return;
    }

    if (password !== confirmPassword) {
        showNotification('Passwords do not match', 'error');
        return;
    }

    try {
        const res = await fetch('/api/auth/register', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password })
        });
        const data = await res.json();

        if (!res.ok) {
            showNotification(data.error || 'Registration failed', 'error');
            return;
        }

        // Registering logs you in immediately (the server already started a session)
        currentUserPromise = Promise.resolve(data);
        setCurrentUser(data);
        showNotification('Welcome to Scentbysally!', 'success');
        setTimeout(() => { window.location.href = '/index.html'; }, 800);
    } catch (err) {
        showNotification('Could not reach the server. Please try again.', 'error');
    }
}

async function handleResetPassword(e) {
    e.preventDefault();

    const email = document.getElementById('reset-email')?.value;

    if (!email) {
        showNotification('Please enter your email', 'error');
        return;
    }

    try {
        const res = await fetch('/api/auth/forgot-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        const data = await res.json();
        showNotification(data.message || 'If that email is registered, a reset link has been sent.', 'success');
        setTimeout(() => {
            showLoginForm();
        }, 2000);
    } catch (err) {
        showNotification('Could not reach the server. Please try again.', 'error');
    }
}

function handleCheckout(e) {
    e.preventDefault();
    
    if (!Scentbysally.isAuthenticated) {
        showNotification('Please login to checkout', 'error');
        window.location.href = '/login.html';
        return;
    }
    
    // Process payment with Paystack
    processPaystackPayment();
}

// ===== PAYSTACK INTEGRATION =====
function processPaystackPayment() {
    // This would be replaced with actual Paystack implementation
    const total = getCartTotal();
    
    showNotification(`Redirecting to Paystack for payment of ₦${total.toLocaleString()}`, 'success');
    
    // Simulate successful payment
    setTimeout(() => {
        // Clear cart
        Scentbysally.cart = [];
        saveCart();
        
        // Redirect to success page
        window.location.href = '/buyer/orders.html?payment=success';
    }, 2000);
}

// ===== MOBILE MENU =====
function initMobileMenu() {
    const menuButton = document.createElement('button');
    menuButton.className = 'mobile-menu-btn';
    menuButton.innerHTML = '☰';
    menuButton.style.cssText = `
        display: none;
        background: none;
        border: none;
        color: white;
        font-size: 1.5rem;
        cursor: pointer;
    `;
    
    const navbar = document.querySelector('.navbar');
    if (navbar) {
        navbar.insertBefore(menuButton, navbar.children[1]);
    }
    
    const navLinks = document.querySelector('.nav-links');
    
    // Show/hide based on screen size
    function checkMobile() {
        if (window.innerWidth <= 768) {
            menuButton.style.display = 'block';
            if (navLinks) navLinks.style.display = 'none';
        } else {
            menuButton.style.display = 'none';
            if (navLinks) navLinks.style.display = 'flex';
        }
    }
    
    window.addEventListener('resize', checkMobile);
    checkMobile();
    
    // Toggle menu on click
    menuButton.addEventListener('click', () => {
        if (navLinks) {
            navLinks.style.display = navLinks.style.display === 'none' ? 'flex' : 'none';
            navLinks.style.flexDirection = 'column';
            navLinks.style.width = '100%';
            navLinks.style.marginTop = '1rem';
        }
    });
}

// ===== FILTER FUNCTIONALITY =====
function initFilters() {
    const filterInputs = document.querySelectorAll('.filter-select, .filter-checkbox, .filter-radio');
    
    filterInputs.forEach(input => {
        input.addEventListener('change', applyFilters);
    });
}

function applyFilters() {
    const filters = {
        category: document.getElementById('filter-category')?.value,
        size: document.getElementById('filter-size')?.value,
        minPrice: document.getElementById('filter-min-price')?.value,
        maxPrice: document.getElementById('filter-max-price')?.value,
        sortBy: document.getElementById('filter-sort')?.value
    };
    
    console.log('Applying filters:', filters);
    
    // This would trigger an API call to get filtered products
    // For now, just show a notification
    showNotification('Filters applied');
}

// ===== WISHLIST =====
function toggleWishlist(productId) {
    if (!Scentbysally.isAuthenticated) {
        showNotification('Please login to add to wishlist', 'error');
        window.location.href = '/login.html';
        return;
    }
    
    const index = Scentbysally.wishlist.indexOf(productId);
    if (index === -1) {
        Scentbysally.wishlist.push(productId);
        showNotification('Added to wishlist', 'success');
    } else {
        Scentbysally.wishlist.splice(index, 1);
        showNotification('Removed from wishlist');
    }
    
    localStorage.setItem('scentbysally_wishlist', JSON.stringify(Scentbysally.wishlist));
}

// ===== PAGE-SPECIFIC INITIALIZATION =====
function initPageSpecific(page) {
    switch(page) {
        case 'cart.html':
            displayCart();
            break;
        case 'products.html':
            initFilters();
            break;
        case 'product.html':
            initProductPage();
            break;
        case 'profile.html':
            loadUserProfile();
            break;
        case 'dashboard.html':
            if (window.location.pathname.includes('superadmin')) {
                loadSuperAdminDashboard();
            } else if (window.location.pathname.includes('admin')) {
                loadAdminDashboard();
            }
            break;
        case 'checkout.html':
            loadCheckoutPage();
            break;
    }
}

function initProductPage() {
    // Get product ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id');
    
    if (productId) {
        console.log('Loading product:', productId);
        // Would fetch product details from API
    }
    
    // Initialize 3D viewer if exists
    if (typeof initProductViewer === 'function') {
        initProductViewer('product-canvas', productId);
    }
}

function loadUserProfile() {
    // Load user addresses
    loadAddresses();
}

function loadAddresses() {
    const addressContainer = document.getElementById('addresses');
    if (!addressContainer) return;
    
    // Mock addresses - would come from API
    const addresses = [
        {
            id: 1,
            type: 'Home',
            name: 'Sally',
            phone: '09169701140',
            address: '123 Main Street',
            city: 'Lagos',
            state: 'Lagos',
            isDefault: true
        },
        {
            id: 2,
            type: 'Work',
            name: 'Sally',
            phone: '09169701140',
            address: '456 Business Avenue',
            city: 'Lagos',
            state: 'Lagos',
            isDefault: false
        }
    ];
    
    let html = '<div class="address-grid">';
    addresses.forEach(addr => {
        html += `
            <div class="address-card ${addr.isDefault ? 'default' : ''} floating-card-light">
                ${addr.isDefault ? '<span class="default-badge">Default</span>' : ''}
                <h3>${addr.type}</h3>
                <p><strong>${addr.name}</strong></p>
                <p>${addr.phone}</p>
                <p>${addr.address}</p>
                <p>${addr.city}, ${addr.state}</p>
                <div style="margin-top: 1rem;">
                    <button class="btn btn-outline" style="padding: 0.3rem 1rem;">Edit</button>
                    ${!addr.isDefault ? '<button class="btn btn-outline" style="padding: 0.3rem 1rem;">Set Default</button>' : ''}
                </div>
            </div>
        `;
    });
    html += '</div>';
    
    addressContainer.innerHTML = html;
}

function loadCheckoutPage() {
    if (Scentbysally.cart.length === 0) {
        window.location.href = '/buyer/cart.html';
        return;
    }
    
    // Display order summary
    const summaryContainer = document.getElementById('order-summary');
    if (summaryContainer) {
        let html = '<h3>Order Summary</h3>';
        Scentbysally.cart.forEach(item => {
            html += `
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                    <span>${item.product.name} (${item.type}) x ${item.quantity}</span>
                    <span>₦${(item.product.price * item.quantity).toLocaleString()}</span>
                </div>
            `;
        });
        html += `
            <hr style="border-color: var(--white-transparent); margin: 1rem 0;">
            <div style="display: flex; justify-content: space-between; font-weight: bold;">
                <span>Total</span>
                <span>₦${getCartTotal().toLocaleString()}</span>
            </div>
        `;
        summaryContainer.innerHTML = html;
    }
}

function loadSuperAdminDashboard() {
    // Mock data for superadmin dashboard
    const welcomeSection = document.querySelector('.welcome-section .welcome-content');
    if (welcomeSection) {
        const userName = Scentbysally.user?.name || 'Sally';
        welcomeSection.innerHTML = `
            <h2 class="welcome-greeting">Welcome back,</h2>
            <h1 class="welcome-name">${userName}</h1>
            <div class="welcome-stats">
                <div class="stat-item">
                    <div class="stat-value">₦458,000</div>
                    <div class="stat-label">Today's Sales</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">24</div>
                    <div class="stat-label">New Orders</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">₦12,500</div>
                    <div class="stat-label">Commission (₦500/item)</div>
                </div>
            </div>
        `;
    }
}

function loadAdminDashboard() {
    // Similar but with limited data
    const welcomeSection = document.querySelector('.welcome-section .welcome-content');
    if (welcomeSection) {
        const userName = Scentbysally.user?.name || 'Admin';
        welcomeSection.innerHTML = `
            <h2 class="welcome-greeting">Welcome back,</h2>
            <h1 class="welcome-name">${userName}</h1>
            <div class="welcome-stats">
                <div class="stat-item">
                    <div class="stat-value">15</div>
                    <div class="stat-label">Orders to Process</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">3</div>
                    <div class="stat-label">Low Stock Items</div>
                </div>
            </div>
        `;
    }
}

// ===== UTILITY FUNCTIONS =====
function formatPrice(price) {
    return `₦${price.toLocaleString()}`;
}

function showLoading(containerId) {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = '<div class="spinner" style="margin: 2rem auto;"></div>';
    }
}

function hideLoading(containerId, content) {
    const container = document.getElementById(containerId);
    if (container && content) {
        container.innerHTML = content;
    }
}

// Export for use in other files
window.Scentbysally = Scentbysally;
window.addToCart = addToCart;
window.removeFromCart = removeFromCart;
window.updateQuantity = updateQuantity;
window.toggleWishlist = toggleWishlist;
window.logout = logout;
window.showNotification = showNotification;