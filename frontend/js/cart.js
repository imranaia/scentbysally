// cart.js - Shopping cart specific functionality

// Display cart items (more detailed version)
function displayCartDetailed() {
    const cartContainer = document.getElementById('cart-items');
    if (!cartContainer) return;
    
    if (Scentbysally.cart.length === 0) {
        cartContainer.innerHTML = `
            <div class="floating-card" style="text-align: center; padding: 3rem;">
                <h2 style="margin-bottom: 1rem;">Your cart is empty</h2>
                <p style="color: var(--gray-light); margin-bottom: 2rem;">Start shopping to add items to your cart</p>
                <a href="products.html" class="btn">Shop Now</a>
            </div>
        `;
        return;
    }
    
    let html = '';
    let subtotal = 0;
    
    Scentbysally.cart.forEach((item, index) => {
        const itemTotal = item.product.price * item.quantity;
        subtotal += itemTotal;
        
        html += `
            <div class="cart-item floating-card-light" data-index="${index}">
                <img src="${item.product.image || 'https://via.placeholder.com/80x80/000000/ffffff?text=Perfume'}" alt="${item.product.name}" class="cart-item-image">
                <div class="cart-item-details">
                    <h3 class="cart-item-title">${item.product.name}</h3>
                    <p class="cart-item-price">Size: ${item.type}</p>
                    <p class="cart-item-price">Price: ₦${item.product.price.toLocaleString()}</p>
                </div>
                <div class="cart-quantity">
                    <button class="quantity-btn" onclick="updateCartItem(${index}, ${item.quantity - 1})">-</button>
                    <span style="min-width: 30px; text-align: center;">${item.quantity}</span>
                    <button class="quantity-btn" onclick="updateCartItem(${index}, ${item.quantity + 1})">+</button>
                </div>
                <div style="font-size: 1.2rem; font-weight: 600;">
                    ₦${itemTotal.toLocaleString()}
                </div>
                <button class="btn btn-outline" onclick="removeCartItem(${index})" style="padding: 0.5rem 1rem;">Remove</button>
            </div>
        `;
    });
    
    // Calculate delivery (simplified)
    const deliveryFee = subtotal > 50000 ? 0 : 2500;
    const total = subtotal + deliveryFee;
    const commission = Scentbysally.cart.length * 500; // ₦500 per item
    
    html += `
        <div class="floating-card" style="margin-top: 2rem;">
            <h3>Order Summary</h3>
            <div style="margin-top: 1rem;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                    <span>Subtotal</span>
                    <span>₦${subtotal.toLocaleString()}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                    <span>Delivery Fee</span>
                    <span>${deliveryFee === 0 ? 'Free' : '₦' + deliveryFee.toLocaleString()}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; color: var(--gray-light); font-size: 0.9rem;">
                    <span>Commission (₦500/item)</span>
                    <span>₦${commission.toLocaleString()}</span>
                </div>
                <hr style="border-color: var(--white-transparent); margin: 1rem 0;">
                <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 1.2rem;">
                    <span>Total</span>
                    <span>₦${total.toLocaleString()}</span>
                </div>
            </div>
            <div style="display: flex; gap: 1rem; margin-top: 2rem;">
                <a href="products.html" class="btn btn-outline" style="flex: 1;">Continue Shopping</a>
                <a href="checkout.html" class="btn" style="flex: 2;">Proceed to Checkout</a>
            </div>
        </div>
    `;
    
    cartContainer.innerHTML = html;
}

// Update cart item quantity
function updateCartItem(index, newQuantity) {
    if (newQuantity < 1) {
        removeCartItem(index);
    } else {
        Scentbysally.cart[index].quantity = newQuantity;
        saveCart();
        displayCartDetailed();
        showNotification('Cart updated');
    }
}

// Remove cart item
function removeCartItem(index) {
    const itemName = Scentbysally.cart[index].product.name;
    Scentbysally.cart.splice(index, 1);
    saveCart();
    displayCartDetailed();
    showNotification(`${itemName} removed from cart`);
}

// Apply promo code
function applyPromoCode() {
    const code = document.getElementById('promo-code')?.value;
    if (!code) {
        showNotification('Please enter a promo code', 'error');
        return;
    }
    
    // Simulate promo code validation
    if (code.toUpperCase() === 'SALLY10') {
        showNotification('10% discount applied!', 'success');
        // Recalculate with discount
    } else {
        showNotification('Invalid promo code', 'error');
    }
}

// Initialize cart page
document.addEventListener('DOMContentLoaded', function() {
    if (window.location.pathname.includes('cart.html')) {
        displayCartDetailed();
        
        // Add promo code input if not exists
        const cartContainer = document.getElementById('cart-items');
        if (cartContainer && Scentbysally.cart.length > 0) {
            const promoDiv = document.createElement('div');
            promoDiv.className = 'floating-card-light';
            promoDiv.style.marginTop = '1rem';
            promoDiv.innerHTML = `
                <h4>Have a promo code?</h4>
                <div style="display: flex; gap: 1rem; margin-top: 1rem;">
                    <input type="text" id="promo-code" class="form-input" placeholder="Enter code" style="flex: 2;">
                    <button class="btn btn-outline" onclick="applyPromoCode()" style="flex: 1;">Apply</button>
                </div>
            `;
            cartContainer.appendChild(promoDiv);
        }
    }
});