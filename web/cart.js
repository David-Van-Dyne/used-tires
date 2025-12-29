const CART_KEY = 'tire_cart';
const els = {
  cartTableBody: document.getElementById('cartTableBody'),
  cartMeta: document.getElementById('cartMeta'),
  cartClear: document.getElementById('cartClear'),
  cartPrint: document.getElementById('cartPrint'),
  cartExportJson: document.getElementById('cartExportJson'),
  cartExportCsv: document.getElementById('cartExportCsv'),
};

const state = {
  all: [],
  cart: {}, // { id: qty }
};

function loadCartFromStorage() {
  try { const raw = localStorage.getItem(CART_KEY); if (raw) state.cart = JSON.parse(raw) || {}; } catch {}
}
function saveCartToStorage() {
  try { localStorage.setItem(CART_KEY, JSON.stringify(state.cart)); } catch {}
}

async function loadInventory() {
  const urls = ["../data/inventory.json", "/data/inventory.json", "data/inventory.json"];
  for (const url of urls) {
    try { const r = await fetch(url, { cache: 'no-store' }); if (r.ok) { state.all = await r.json(); return; } } catch {}
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
    acc.tires += it.selected_qty; acc.cost += it.selected_qty * (Number(it.price)||0); return acc;
  }, { tires: 0, cost: 0 });
}

function escapeHtml(s) { return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'); }

function render() {
  const items = getSelectedItems();
  const frag = document.createDocumentFragment();
  for (const it of items) {
    const tr = document.createElement('tr');
    tr.dataset.id = String(it.id);
    const line = (Number(it.price)||0) * it.selected_qty;
    tr.innerHTML = `
      <td>
        <div class="qty-controls">
          <button type="button" class="dec">-</button>
          <input type="number" class="cart-qty" min="0" max="${it.quantity}" step="1" value="${it.selected_qty}" />
          <button type="button" class="inc">+</button>
        </div>
      </td>
      <td>${escapeHtml(it.size)}</td>
      <td>${escapeHtml(`${it.brand} ${it.model}`.trim())}</td>
      <td>$${(Number(it.price)||0).toFixed(2)}</td>
      <td>$${line.toFixed(2)}</td>
      <td><button class="btn danger cart-del" type="button">Remove</button></td>`;
    frag.appendChild(tr);
  }
  els.cartTableBody.replaceChildren(frag);
  const { tires, cost } = selectedTotals(items);
  els.cartMeta.innerHTML = tires > 0 ? `${tires} tire(s), <span class="selCost">$${cost.toFixed(2)}</span>` : 'No items selected';
}

function onTableInput(e) {
  const tr = e.target.closest('tr'); if (!tr) return;
  if (!e.target.closest('.cart-qty')) return;
  const id = Number(tr.dataset.id);
  const it = state.all.find(x => Number(x.id) === id); if (!it) return;
  const max = Number(it.quantity)||0;
  let qty = Number(e.target.value||0); if (!Number.isFinite(qty)) qty = 0; qty = Math.max(0, Math.min(max, Math.floor(qty)));
  e.target.value = String(qty);
  if (qty > 0) state.cart[id] = qty; else delete state.cart[id];
  saveCartToStorage();
  render();
}

function onTableClick(e) {
  const tr = e.target.closest('tr'); if (!tr) return;
  const id = Number(tr.dataset.id);
  
  // Handle remove button
  if (e.target.closest('.cart-del')) {
    delete state.cart[id]; saveCartToStorage(); render();
    return;
  }
  
  // Handle inc/dec buttons
  const isInc = e.target.closest('.inc');
  const isDec = e.target.closest('.dec');
  if (!isInc && !isDec) return;
  
  const it = state.all.find(x => Number(x.id) === id); if (!it) return;
  const input = tr.querySelector('.cart-qty');
  const max = Number(it.quantity)||0;
  let qty = Number(input.value||0);
  
  if (isInc) qty = Math.min(max, qty + 1);
  if (isDec) qty = Math.max(0, qty - 1);
  
  input.value = String(qty);
  if (qty > 0) state.cart[id] = qty; else delete state.cart[id];
  saveCartToStorage();
  render();
}

function clearCart() { state.cart = {}; saveCartToStorage(); render(); }

function exportJSON() {
  const items = getSelectedItems().map(({ selected_qty, ...it }) => ({ ...it, quantity: selected_qty }));
  const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'cart.json'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

function exportCSV() {
  const items = getSelectedItems();
  const headers = ['id','size','brand','model','quantity','price','line_total','notes'];
  const escape = (v) => { const s = String(v ?? ''); return /[",\n\r]/.test(s) ? '"' + s.replaceAll('"','""') + '"' : s; };
  const rows = [headers.join(',')];
  for (const it of items) {
    rows.push([
      it.id, it.size, it.brand, it.model, it.selected_qty,
      (Number(it.price)||0).toFixed(2), (it.selected_qty*(Number(it.price)||0)).toFixed(2), it.notes
    ].map(escape).join(','));
  }
  const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'cart.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

function printCart() {
  const items = getSelectedItems();
  const { cost } = selectedTotals(items);
  const w = window.open('', '_blank'); if (!w) return;
  const rows = items.map(it => `<tr><td>${it.selected_qty}</td><td>${escapeHtml(it.size)}</td><td>${escapeHtml(`${it.brand} ${it.model}`.trim())}</td><td>$${(Number(it.price)||0).toFixed(2)}</td><td>$${(it.selected_qty*(Number(it.price)||0)).toFixed(2)}</td></tr>`).join('');
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Cart</title><style>
    body{font-family:system-ui,Segoe UI,Roboto,Helvetica,Arial;margin:20px;color:#111}
    h1{font-size:18px;margin:0 0 10px}
    table{border-collapse:collapse;width:100%;font-size:13px}
    th,td{border:1px solid #999;padding:6px 8px;text-align:left}
    tfoot td{font-weight:bold}
  </style></head><body>
  <h1>Selected Tires</h1>
  <table><thead><tr><th>Qty</th><th>Size</th><th>Item</th><th>Price</th><th>Total</th></tr></thead>
  <tbody>${rows || '<tr><td colspan="5">No items selected</td></tr>'}</tbody>
  <tfoot><tr><td colspan="4">Total</td><td>$${cost.toFixed(2)}</td></tr></tfoot>
  </table>
  <script>window.onload=()=>window.print();</script>
  </body></html>`);
  w.document.close();
}

function wire() {
  els.cartTableBody.addEventListener('input', onTableInput);
  els.cartTableBody.addEventListener('click', onTableClick);
  els.cartClear.addEventListener('click', clearCart);
  els.cartExportJson.addEventListener('click', exportJSON);
  els.cartExportCsv.addEventListener('click', exportCSV);
  els.cartPrint.addEventListener('click', printCart);
}

(async function init(){
  loadCartFromStorage();
  await loadInventory();
  wire();
  render();
})();

