const state = {
  all: [],
  filtered: [],
  sizes: new Map(),
  cart: {},
  filters: {
    size: "",
    minTread: 0,
    q: "",
    sortBy: "size",
  },
};

const els = {
  sizeFilter: document.getElementById("sizeFilter"),
  minTread: document.getElementById("minTread"),
  search: document.getElementById("search"),
  sortBy: document.getElementById("sortBy"),
  grid: document.getElementById("inventoryGrid"),
  sizeList: document.getElementById("sizeList"),
  resultsMeta: document.getElementById("resultsMeta"),
  cardTpl: document.getElementById("tireCardTemplate"),
  viewCartBtn: document.getElementById("viewCartBtn"),
};

async function loadInventory() {
  try {
    const candidates = ["../data/inventory.json", "/data/inventory.json", "data/inventory.json"];
    let data = null;
    let lastErr = null;
    for (const url of candidates) {
      try {
        const resp = await fetch(url, { cache: "no-store" });
        if (resp.ok) { data = await resp.json(); console.log("Loaded inventory from", url); break; }
        lastErr = new Error(`HTTP ${resp.status} for ${url}`);
      } catch (e) { lastErr = e; }
    }
    if (!data) throw lastErr || new Error("inventory.json not found");
    state.all = normalize(data);
    loadCartFromStorage();
    console.log("Loaded items:", state.all.length);
    buildSizeIndex();
    populateSizeControls();
    applyFilters();
  } catch (err) {
    console.error("Failed to load inventory:", err);
    els.grid.innerHTML = `<div class="card">Failed to load inventory. Start a local server in repo root and open /web/.<br/>Error: ${err?.message || err}</div>`;
  }
}

function normalize(items) {
  return (items || []).map((t, i) => ({
    id: t.id ?? i + 1,
    size: String(t.size || "").trim(),
    brand: t.brand || "",
    model: t.model || "",
    tread_32nds: Number(t.tread_32nds ?? 0),
    quantity: Number(t.quantity ?? 1),
    price: Number(t.price ?? 0),
    notes: t.notes || "",
  }));
}

function buildSizeIndex() {
  state.sizes = new Map();
  for (const item of state.all) {
    const key = item.size || "Unknown";
    const bucket = state.sizes.get(key) || [];
    bucket.push(item);
    state.sizes.set(key, bucket);
  }
}

function sumQuantities(items) {
  return items.reduce((acc, it) => acc + (Number(it.quantity) || 0), 0);
}

function getSelectedItems() {
  const out = [];
  for (const [idStr, qty] of Object.entries(state.cart)) {
    const id = Number(idStr);
    const item = state.all.find((x) => Number(x.id) === id);
    if (!item) continue;
    const selected_qty = Math.min(Number(qty) || 0, Number(item.quantity) || 0);
    if (selected_qty <= 0) continue;
    out.push({ ...item, selected_qty });
  }
  return out;
}

const CART_KEY = 'tire_cart';
function loadCartFromStorage() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      state.cart = parsed;
    }
  } catch {}
}
function saveCartToStorage() {
  try { localStorage.setItem(CART_KEY, JSON.stringify(state.cart)); } catch {}
}

function populateSizeControls() {
  const entries = [...state.sizes.entries()].sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }));
  const total = sumQuantities(state.all);
  const listHtml = [
    `<h2>Sizes</h2>`,
    `<ul class="size-list">`,
    `<li class="size-item"><a href="#" data-size=""><span>All sizes</span> <span class="count">${total}</span></a></li>`,
    ...entries.map(([size, arr]) => `<li class="size-item"><a href="#" data-size="${size}"><span>${size}</span> <span class="count">${sumQuantities(arr)}</span></a></li>`),
    `</ul>`
  ].join('');
  els.sizeList.innerHTML = listHtml;
  els.sizeList.onclick = (e) => {
    const a = e.target.closest('a[data-size]');
    if (!a) return;
    e.preventDefault();
    state.filters.size = a.dataset.size;
    els.sizeFilter.value = state.filters.size;
    applyFilters();
  };

  const opts = ["", ...entries.map(([s]) => s)];
  const frag = document.createDocumentFragment();
  for (const s of opts) {
    const opt = document.createElement('option');
    opt.value = s;
    opt.textContent = s || 'All sizes';
    frag.appendChild(opt);
  }
  els.sizeFilter.replaceChildren(frag);
}

function applyFilters() {
  const { size, minTread, q, sortBy } = state.filters;
  const qlower = q.trim().toLowerCase();
  let res = state.all.filter((t) => (
    (!size || t.size === size) &&
    (Number(t.tread_32nds) || 0) >= Number(minTread || 0) &&
    (!qlower || `${t.brand} ${t.model} ${t.size} ${t.notes}`.toLowerCase().includes(qlower))
  ));

  const sorters = {
    size: (a, b) => a.size.localeCompare(b.size, undefined, { numeric: true }) || a.brand.localeCompare(b.brand),
    price: (a, b) => a.price - b.price,
    tread: (a, b) => b.tread_32nds - a.tread_32nds,
    brand: (a, b) => a.brand.localeCompare(b.brand) || a.model.localeCompare(b.model),
  };
  res.sort(sorters[sortBy] || sorters.size);
  state.filtered = res;
  console.log("Filtered results:", state.filtered.length, "filters:", state.filters);
  render();
}

function render() {
  const listings = state.filtered.length;
  const totalTires = sumQuantities(state.filtered);
  const { tires: selTires, cost: selCost } = selectedTotals();
  const sizeHint = state.filters.size ? ` in ${state.filters.size}` : "";
  const selHint = selTires > 0 ? `. Selected: ${selTires} tire(s), $${selCost.toFixed(2)}` : "";
  els.resultsMeta.textContent = `${listings} listing(s), ${totalTires} tire(s)` + sizeHint + selHint;
  updateCartLinkCount();
  const frag = document.createDocumentFragment();
  if (state.filtered.length === 0) {
    const empty = document.createElement("div");
    empty.className = "card";
    empty.textContent = "No results. Try a different size, search, or filters.";
    frag.appendChild(empty);
  }
  for (const item of state.filtered) {
    const node = els.cardTpl.content.cloneNode(true);
    node.querySelector(".title").textContent = `${item.brand} ${item.model}`.trim() || "Tire";
    node.querySelector(".brand").textContent = item.brand || "";
    node.querySelector(".model").textContent = item.model || "";
    node.querySelector(".tread").textContent = (Number(item.tread_32nds) || 0) > 0 ? `${item.tread_32nds}` : "-";
    node.querySelector(".quantity").textContent = `${item.quantity}`;
    node.querySelector(".price").textContent = `${item.price.toFixed(2)}`;
    node.querySelector(".size").textContent = item.size || "Unknown";
    const card = node.querySelector(".card");
    if (card) card.dataset.id = String(item.id);
    const qtyInput = node.querySelector(".select-qty");
    if (qtyInput) {
      qtyInput.max = String(Number(item.quantity) || 0);
      qtyInput.value = String(state.cart[item.id] ?? 0);
    }
    const notesRow = node.querySelector(".notes-row");
    if (notesRow) notesRow.textContent = item.notes || "";
    frag.appendChild(node);
  }
  els.grid.replaceChildren(frag);
  updateCartLinkCount();
}

function selectedTotals() {
  return getSelectedItems().reduce((acc, it) => {
    acc.tires += it.selected_qty;
    acc.cost += it.selected_qty * (Number(it.price) || 0);
    return acc;
  }, { tires: 0, cost: 0 });
}

function onGridInput(e) {
  const input = e.target.closest('.select-qty');
  if (!input) return;
  const card = e.target.closest('.card');
  if (!card) return;
  const id = Number(card.dataset.id);
  const item = state.all.find((x) => Number(x.id) === id);
  if (!item) return;
  const max = Number(item.quantity) || 0;
  let qty = Number(input.value || 0);
  if (!Number.isFinite(qty)) qty = 0;
  qty = Math.max(0, Math.min(max, Math.floor(qty)));
  input.value = String(qty);
  if (qty > 0) state.cart[id] = qty; else delete state.cart[id];
  saveCartToStorage();
  const listings = state.filtered.length;
  const totalTires = sumQuantities(state.filtered);
  const { tires: selTires, cost: selCost } = selectedTotals();
  const sizeHint = state.filters.size ? ` in ${state.filters.size}` : '';
  const selHint = selTires > 0 ? `. Selected: ${selTires} tire(s), $${selCost.toFixed(2)}` : '';
  els.resultsMeta.textContent = `${listings} listing(s), ${totalTires} tire(s)` + sizeHint + selHint;
  updateCartLinkCount();
}

function wireControls() {
  els.sizeFilter.addEventListener("change", (e) => { state.filters.size = e.target.value; applyFilters(); });
  els.minTread.addEventListener("input", (e) => { state.filters.minTread = e.target.value; applyFilters(); });
  els.search.addEventListener("input", (e) => { state.filters.q = e.target.value; applyFilters(); });
  els.sortBy.addEventListener("change", (e) => { state.filters.sortBy = e.target.value; applyFilters(); });
  els.grid.addEventListener('input', onGridInput);
  els.grid.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;

  const input = btn.parentElement.querySelector(".select-qty");
  if (!input) return;

  const step = Number(input.step) || 1;
  const min  = Number(input.min)  || 0;
  const max  = Number(input.max)  || Infinity;
  let val = Number(input.value) || 0;

  if (btn.classList.contains("inc")) val += step;
  if (btn.classList.contains("dec")) val -= step;

  input.value = Math.min(max, Math.max(min, val));
  input.dispatchEvent(new Event("input", { bubbles: true })); // <-- key
});

  // No additional handlers needed; quantity input clamps in onGridInput
  // Cart controls removed from this page; cart is separate.
}
// Update 'View Cart' button with count
function updateCartLinkCount() {
  if (!els.viewCartBtn) return;
  const { tires } = selectedTotals();
  els.viewCartBtn.textContent = tires > 0 ? `View Cart (${tires})` : 'View Cart';
}
wireControls();
loadInventory();

