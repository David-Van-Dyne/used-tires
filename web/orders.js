const state = {
  orders: [],
  filter: 'all',
  lastOrderCount: 0,
};

const els = {
  ordersContainer: document.getElementById('ordersContainer'),
  ordersCount: document.getElementById('ordersCount'),
  newOrdersBadge: document.getElementById('newOrdersBadge'),
  statusFilter: document.getElementById('statusFilter'),
  refreshBtn: document.getElementById('refreshBtn'),
  logoutBtn: document.getElementById('logoutBtn'),
};

async function loadOrders() {
  try {
    const response = await fetch('/api/orders', { cache: 'no-store' });
    if (!response.ok) {
      if (response.status === 401) {
        window.location.href = 'login.html';
        return;
      }
      throw new Error('Failed to load orders');
    }
    state.orders = await response.json();
    
    // Sort by timestamp (newest first)
    state.orders.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // Check for new orders
    checkNewOrders();
    
    render();
  } catch (error) {
    console.error('Error loading orders:', error);
    els.ordersContainer.innerHTML = '<div class="empty-state">Failed to load orders. Please refresh.</div>';
  }
}

function checkNewOrders() {
  const pendingOrders = state.orders.filter(o => o.status === 'pending').length;
  
  if (pendingOrders > state.lastOrderCount && state.lastOrderCount > 0) {
    // Show notification
    const newCount = pendingOrders - state.lastOrderCount;
    if (Notification.permission === 'granted') {
      new Notification('New Order!', {
        body: `You have ${newCount} new order${newCount > 1 ? 's' : ''}`,
        icon: '/favicon.ico',
      });
    }
  }
  
  state.lastOrderCount = pendingOrders;
  
  if (pendingOrders > 0) {
    els.newOrdersBadge.textContent = pendingOrders;
    els.newOrdersBadge.style.display = 'inline-block';
  } else {
    els.newOrdersBadge.style.display = 'none';
  }
}

function escapeHtml(s) {
  return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
}

function formatDate(isoString) {
  const date = new Date(isoString);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getStatusClass(status) {
  return `status-${status}`;
}

function render() {
  const filtered = state.filter === 'all' 
    ? state.orders 
    : state.orders.filter(o => o.status === state.filter);
  
  els.ordersCount.textContent = `${filtered.length} order${filtered.length !== 1 ? 's' : ''}`;
  
  if (filtered.length === 0) {
    els.ordersContainer.innerHTML = '<div class="empty-state">No orders found.</div>';
    return;
  }
  
  const html = filtered.map(order => {
    const itemsHtml = order.items.map(item => `
      <tr>
        <td>${item.selected_qty}</td>
        <td>${escapeHtml(item.size)}</td>
        <td>${escapeHtml(`${item.brand} ${item.model}`.trim())}</td>
        <td>$${(Number(item.price)||0).toFixed(2)}</td>
        <td>$${(item.selected_qty * (Number(item.price)||0)).toFixed(2)}</td>
      </tr>
    `).join('');
    
    const addressHtml = order.address ? `
      <div><strong>Delivery Address:</strong> ${escapeHtml(order.address.street)}, ${escapeHtml(order.address.city)}, ${escapeHtml(order.address.state)} ${escapeHtml(order.address.zipCode)}</div>
    ` : '';
    
    const notesHtml = order.notes ? `<div><strong>Notes:</strong> ${escapeHtml(order.notes)}</div>` : '';
    
    return `
      <div class="order-card">
        <div class="order-header">
          <div>
            <div class="order-id">Order #${order.id}</div>
            <div class="order-timestamp">${formatDate(order.timestamp)}</div>
          </div>
          <span class="order-status ${getStatusClass(order.status)}">${order.status.toUpperCase()}</span>
        </div>
        
        <div class="order-meta">
          <div><strong>Customer:</strong> ${escapeHtml(order.customer.firstName)} ${escapeHtml(order.customer.lastName)}</div>
          <div><strong>Email:</strong> ${escapeHtml(order.customer.email)}</div>
          <div><strong>Phone:</strong> ${escapeHtml(order.customer.phone)}</div>
          <div><strong>Type:</strong> ${order.orderType === 'pickup' ? 'Pickup' : 'Delivery'}</div>
          ${addressHtml}
          ${notesHtml}
        </div>
        
        <div class="order-items">
          <table>
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
              ${itemsHtml}
            </tbody>
          </table>
        </div>
        
        <div class="order-total">
          <span>Total</span>
          <span>$${order.total.toFixed(2)}</span>
        </div>
        
        <div class="order-actions">
          ${order.status === 'pending' ? '<button class="btn btn-nav" onclick="updateOrderStatus(' + order.id + ', \'confirmed\')">Confirm Order</button>' : ''}
          ${order.status === 'confirmed' ? '<button class="btn btn-nav" onclick="updateOrderStatus(' + order.id + ', \'ready\')">Mark Ready</button>' : ''}
          ${order.status === 'ready' ? '<button class="btn btn-nav" onclick="updateOrderStatus(' + order.id + ', \'completed\')">Mark Completed</button>' : ''}
          ${order.status !== 'completed' && order.status !== 'cancelled' ? '<button class="btn secondary" onclick="updateOrderStatus(' + order.id + ', \'pending\')">Reset to Pending</button>' : ''}
          ${order.status !== 'completed' && order.status !== 'cancelled' ? '<button class="btn" style="background: #7c2d12; border-color: #991b1b;" onclick="cancelOrder(' + order.id + ')">Cancel Order</button>' : ''}
        </div>
      </div>
    `;
  }).join('');
  
  els.ordersContainer.innerHTML = html;
}

async function updateOrderStatus(orderId, newStatus) {
  const order = state.orders.find(o => o.id === orderId);
  if (!order) return;
  
  order.status = newStatus;
  
  try {
    // TODO: Send update to server
    // For now, we'll update locally and notify to save
    console.log(`Order #${orderId} status updated to: ${newStatus}`);
    render();
    alert(`Order #${orderId} marked as ${newStatus}`);
  } catch (error) {
    console.error('Error updating order:', error);
    alert('Failed to update order status');
  }
}

async function cancelOrder(orderId) {
  if (!confirm('Are you sure you want to cancel this order? This will restore the inventory quantities.')) {
    return;
  }
  
  try {
    const response = await fetch('/api/cancel-order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ orderId }),
    });

    const result = await response.json();

    if (result.success) {
      alert(`Order #${orderId} cancelled successfully. Inventory has been restored.`);
      await loadOrders(); // Reload orders
    } else {
      throw new Error(result.message || 'Failed to cancel order');
    }
  } catch (error) {
    console.error('Error cancelling order:', error);
    alert('Failed to cancel order: ' + error.message);
  }
}

async function logout() {
  try {
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/web/login.html';
  } catch (e) {
    console.error('Logout failed:', e);
    window.location.href = '/web/login.html';
  }
}

// Request notification permission
if (Notification.permission === 'default') {
  Notification.requestPermission();
}

// Event listeners
els.statusFilter.addEventListener('change', (e) => {
  state.filter = e.target.value;
  render();
});

els.refreshBtn.addEventListener('click', loadOrders);
els.logoutBtn.addEventListener('click', logout);

// Auto-refresh every 30 seconds
setInterval(loadOrders, 30000);

// Initialize
loadOrders();
