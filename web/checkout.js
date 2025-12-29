const CART_KEY = 'tire_cart';

const state = {
  all: [],
  cart: {},
  orderItems: [],
};

const els = {
  orderSummary: document.getElementById('orderSummary'),
  checkoutForm: document.getElementById('checkoutForm'),
  orderType: document.getElementById('orderType'),
  addressFields: document.getElementById('addressFields'),
};

function loadCartFromStorage() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (raw) state.cart = JSON.parse(raw) || {};
  } catch {}
}

async function loadInventory() {
  const urls = ["../data/inventory.json", "/data/inventory.json", "data/inventory.json"];
  for (const url of urls) {
    try {
      const r = await fetch(url, { cache: 'no-store' });
      if (r.ok) {
        state.all = await r.json();
        return;
      }
    } catch {}
  }
  state.all = [];
}

function getSelectedItems() {
  const items = [];
  for (const [idStr, qty] of Object.entries(state.cart)) {
    const id = Number(idStr);
    const it = state.all.find(x => Number(x.id) === id);
    if (!it) continue;
    const q = Math.max(0, Math.min(Number(qty)||0, Number(it.quantity)||0));
    if (q <= 0) continue;
    items.push({ ...it, selected_qty: q });
  }
  return items;
}

function selectedTotals(items) {
  return items.reduce((acc, it) => {
    acc.tires += it.selected_qty;
    acc.cost += it.selected_qty * (Number(it.price)||0);
    return acc;
  }, { tires: 0, cost: 0 });
}

function escapeHtml(s) {
  return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
}

function renderOrderSummary() {
  state.orderItems = getSelectedItems();
  
  if (state.orderItems.length === 0) {
    els.orderSummary.innerHTML = '<div class="results-meta">Your cart is empty. <a href="index.html" class="btn" style="display: inline-block; margin-top: 12px;">Go Shopping</a></div>';
    els.checkoutForm.querySelector('button[type="submit"]').disabled = true;
    return;
  }

  const { tires, cost } = selectedTotals(state.orderItems);
  
  const rows = state.orderItems.map(it => {
    const lineTotal = it.selected_qty * (Number(it.price)||0);
    return `
      <tr>
        <td>${it.selected_qty}</td>
        <td>${escapeHtml(it.size)}</td>
        <td>${escapeHtml(`${it.brand} ${it.model}`.trim())}</td>
        <td>$${(Number(it.price)||0).toFixed(2)}</td>
        <td>$${lineTotal.toFixed(2)}</td>
      </tr>
    `;
  }).join('');

  els.orderSummary.innerHTML = `
    <table class="order-summary-table">
      <thead>
        <tr>
          <th>Qty</th>
          <th>Size</th>
          <th>Item</th>
          <th>Price</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
    <div class="order-total">
      <span>${tires} tire(s)</span>
      <span>$${cost.toFixed(2)}</span>
    </div>
  `;
}

function toggleAddressFields() {
  const orderType = els.orderType.value;
  const addressFields = els.addressFields;
  const addressInputs = addressFields.querySelectorAll('input');
  
  if (orderType === 'delivery') {
    addressFields.style.display = 'block';
    addressInputs.forEach(input => input.required = true);
  } else {
    addressFields.style.display = 'none';
    addressInputs.forEach(input => input.required = false);
  }
}

async function handleSubmit(e) {
  e.preventDefault();
  
  if (state.orderItems.length === 0) {
    alert('Your cart is empty!');
    return;
  }

  const formData = new FormData(els.checkoutForm);
  const orderData = {
    id: Date.now(),
    timestamp: new Date().toISOString(),
    customer: {
      firstName: formData.get('firstName'),
      lastName: formData.get('lastName'),
      email: formData.get('email'),
      phone: formData.get('phone'),
    },
    orderType: formData.get('orderType'),
    items: state.orderItems,
    total: selectedTotals(state.orderItems).cost,
    notes: formData.get('notes') || '',
    status: 'pending',
  };

  if (orderData.orderType === 'delivery') {
    orderData.address = {
      street: formData.get('address'),
      city: formData.get('city'),
      state: formData.get('state'),
      zipCode: formData.get('zipCode'),
    };
  }

  try {
    // Disable submit button
    const submitBtn = els.checkoutForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Placing Order...';
    
    // Submit order to server
    const response = await fetch('/api/submit-order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderData),
    });

    const result = await response.json();

    if (result.success) {
      // Clear the cart
      localStorage.removeItem(CART_KEY);
      
      // Show confirmation
      alert(`Order #${orderData.id} placed successfully!\n\nTotal: $${orderData.total.toFixed(2)}\n\nWe'll contact you shortly at ${orderData.customer.email}`);
      
      // Redirect to home
      window.location.href = 'index.html';
    } else {
      throw new Error(result.message || 'Order submission failed');
    }
  } catch (error) {
    console.error('Order submission error:', error);
    alert('Failed to submit order. Please try again or contact us directly.');
    
    // Re-enable submit button
    const submitBtn = els.checkoutForm.querySelector('button[type="submit"]');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Place Order';
  }
}

// Event listeners
els.orderType.addEventListener('change', toggleAddressFields);
els.checkoutForm.addEventListener('submit', handleSubmit);

// Initialize
(async function init() {
  loadCartFromStorage();
  await loadInventory();
  renderOrderSummary();
})();
