const state = {
  items: [],
};

const els = {
  importFile: document.getElementById("importFile"),
  importCsv: document.getElementById("importCsv"),
  exportBtn: document.getElementById("exportBtn"),
  exportCsvBtn: document.getElementById("exportCsvBtn"),
  copyBtn: document.getElementById("copyBtn"),
  clearBtn: document.getElementById("clearBtn"),
  templateCsvBtn: document.getElementById("templateCsvBtn"),
  saveBtn: document.getElementById("saveBtn"),
  tableBody: document.getElementById("tableBody"),
  countMeta: document.getElementById("countMeta"),
  addForm: document.getElementById("addForm"),
  fSize: document.getElementById("fSize"),
  fBrand: document.getElementById("fBrand"),
  fModel: document.getElementById("fModel"),
  fTread: document.getElementById("fTread"),
  fQty: document.getElementById("fQty"),
  fPrice: document.getElementById("fPrice"),
  fNotes: document.getElementById("fNotes"),
};

async function init() {
  try {
    const resp = await fetch("../data/inventory.json", { cache: "no-store" });
    if (resp.ok) {
      const data = await resp.json();
      state.items = normalize(data);
    }
  } catch (e) {
    console.warn("Loading default inventory failed (likely file://)", e);
  }
  render();
}

function normalize(items) {
  return (items || []).map((t, i) => ({
    id: Number(t.id ?? i + 1),
    size: String(t.size || "").trim(),
    brand: t.brand || "",
    model: t.model || "",
    tread_32nds: Number(t.tread_32nds ?? 0) || 0,
    quantity: Number(t.quantity ?? 1) || 1,
    price: Number(t.price ?? 0) || 0,
    notes: t.notes || "",
  }));
}

async function saveToServer() {
  try {
    els.saveBtn.disabled = true;
    els.saveBtn.textContent = "Saving...";

    const response = await fetch('/api/save-inventory', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(state.items),
    });

    const result = await response.json();

    if (result.success) {
      alert(' ${result.message}\n\nInventory saved successfully to the server.');
    } else {
      throw new Error(result.message);
    }
  } catch (err) {
    alert(' Failed to save: ${err.message}\n\mMake sure the server is running.');
    console.error('Save error:', err);
  } finally {
    els.saveBtn.disabled = false;
    els.saveBtn.textContent = "Save to Server";
  }
}

function render() {
  els.countMeta.textContent = `${state.items.length} item(s)`;
  const frag = document.createDocumentFragment();
  const sorted = [...state.items].sort((a, b) => a.size.localeCompare(b.size, undefined, { numeric: true }) || a.brand.localeCompare(b.brand));
  for (const item of sorted) {
    const tr = document.createElement("tr");
    tr.dataset.id = item.id;
    tr.innerHTML = `
      <td><input type="number" class="cell-id" value="${item.id}" min="1" step="1" /></td>
      <td><input class="cell-size" value="${escapeAttr(item.size)}" /></td>
      <td><input class="cell-brand" value="${escapeAttr(item.brand)}" /></td>
      <td><input class="cell-model" value="${escapeAttr(item.model)}" /></td>
      <td><input type="number" class="cell-tread" value="${item.tread_32nds}" min="0" step="1" /></td>
      <td><input type="number" class="cell-qty" value="${item.quantity}" min="0" step="1" /></td>
      <td><input type="number" class="cell-price" value="${item.price}" min="0" step="1" /></td>
      <td><input class="cell-notes" value="${escapeAttr(item.notes)}" /></td>
      <td class="actions">
        <button class="btn secondary btn-dup" type="button">Duplicate</button>
        <button class="btn danger btn-del" type="button">Delete</button>
      </td>
    `;
    frag.appendChild(tr);
  }
  els.tableBody.replaceChildren(frag);
}

function escapeAttr(v) {
  return String(v).replaceAll("\"", "&quot;");
}

function nextId() {
  return (state.items.reduce((m, it) => Math.max(m, Number(it.id) || 0), 0) || 0) + 1;
}

function upsertFromForm() {
  const item = {
    id: nextId(),
    size: els.fSize.value.trim(),
    brand: els.fBrand.value.trim(),
    model: els.fModel.value.trim(),
    tread_32nds: Number(els.fTread.value || 0),
    quantity: Number(els.fQty.value || 1),
    price: Number(els.fPrice.value || 0),
    notes: els.fNotes.value.trim(),
  };
  if (!item.size) {
    alert("Size is required (e.g., 205/55R16)");
    return;
  }
  state.items.push(item);
  els.addForm.reset();
  render();
}

function syncRowToState(tr) {
  const id = Number(tr.querySelector(".cell-id").value || 0);
  const item = state.items.find((x) => x.id === Number(tr.dataset.id));
  if (!item) return;
  item.id = id > 0 ? id : item.id;
  item.size = tr.querySelector(".cell-size").value.trim();
  item.brand = tr.querySelector(".cell-brand").value.trim();
  item.model = tr.querySelector(".cell-model").value.trim();
  item.tread_32nds = Number(tr.querySelector(".cell-tread").value || 0);
  item.quantity = Number(tr.querySelector(".cell-qty").value || 0);
  item.price = Number(tr.querySelector(".cell-price").value || 0);
  item.notes = tr.querySelector(".cell-notes").value.trim();
  tr.dataset.id = String(item.id);
}

function onTableInput(e) {
  const tr = e.target.closest("tr");
  if (!tr) return;
  syncRowToState(tr);
}

function onTableClick(e) {
  const tr = e.target.closest("tr");
  if (!tr) return;
  const id = Number(tr.dataset.id);
  if (e.target.closest(".btn-del")) {
    state.items = state.items.filter((x) => x.id !== id);
    render();
  } else if (e.target.closest(".btn-dup")) {
    const orig = state.items.find((x) => x.id === id);
    if (!orig) return;
    const copy = { ...orig, id: nextId() };
    state.items.push(copy);
    render();
  }
}

function onImportFile(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const json = JSON.parse(String(reader.result || "[]"));
      state.items = normalize(json);
      render();
    } catch (err) {
      alert("Invalid JSON file.");
    }
  };
  reader.readAsText(file);
}

function onImportCsv(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const text = String(reader.result || "");
      const objs = parseCSV(text);
      if (!objs.length) {
        alert("No rows found in CSV.");
        return;
      }
      state.items = normalize(objs);
      render();
    } catch (err) {
      console.error(err);
      alert("Invalid CSV file.");
    }
  };
  reader.readAsText(file);
}

function exportJSON() {
  const json = JSON.stringify(state.items, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "inventory.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function copyJSON() {
  const json = JSON.stringify(state.items, null, 2);
  try {
    await navigator.clipboard.writeText(json);
    alert("Copied to clipboard.");
  } catch (e) {
    alert("Copy failed. Use Export to download a file instead.");
  }
}

function clearAll() {
  if (!confirm("Clear all items?")) return;
  state.items = [];
  render();
}

function exportCSV() {
  const headers = ["id","size","brand","model","tread_32nds","quantity","price","notes"];
  const escape = (v) => {
    const s = String(v ?? "");
    if (/[",\n\r]/.test(s)) return '"' + s.replaceAll('"', '""') + '"';
    return s;
  };
  const rows = [headers.join(",")];
  for (const it of state.items) {
    rows.push([
      it.id,
      it.size,
      it.brand,
      it.model,
      it.tread_32nds,
      it.quantity,
      it.price,
      it.notes,
    ].map(escape).join(","));
  }
  const blob = new Blob([rows.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "inventory.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function downloadCsvTemplate() {
  const csv = "id,size,brand,model,tread_32nds,quantity,price,notes\n" +
              "1,205/55R16,Michelin,Defender,8,2,45,Even wear";
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "inventory_template.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function parseCSV(text) {
  const rows = [];
  let cur = [];
  let field = '';
  let i = 0;
  let inQuotes = false;
  const pushField = () => { cur.push(field); field = ''; };
  const pushRow = () => { rows.push(cur); cur = []; };
  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      } else { field += c; i++; continue; }
    } else {
      if (c === '"') { inQuotes = true; i++; continue; }
      if (c === ',') { pushField(); i++; continue; }
      if (c === '\n') { pushField(); pushRow(); i++; continue; }
      if (c === '\r') { // handle CRLF or lone CR
        if (text[i + 1] === '\n') { pushField(); pushRow(); i += 2; continue; }
        pushField(); pushRow(); i++; continue;
      }
      field += c; i++; continue;
    }
  }
  // flush last field/row if any content
  if (inQuotes) {
    // Unbalanced quotes; best-effort finalize
    inQuotes = false;
  }
  if (field.length > 0 || cur.length > 0) { pushField(); pushRow(); }
  if (!rows.length) return [];
  const headers = rows[0].map(h => simplify(h));
  const objs = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (row.every(v => String(v).trim() === '')) continue; // skip empty rows
    const o = {};
    for (let cidx = 0; cidx < headers.length; cidx++) {
      const key = headers[cidx];
      const val = row[cidx] ?? '';
      const mapped = mapHeader(key);
      if (!mapped) continue;
      o[mapped] = val;
    }
    objs.push(o);
  }
  return objs;
}

function simplify(h) {
  return String(h || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function mapHeader(k) {
  // Map various header spellings to our schema
  if (k === 'id') return 'id';
  if (k === 'size') return 'size';
  if (k === 'brand') return 'brand';
  if (k === 'model') return 'model';
  if (k === 'tread' || k === 'tread32nds' || k === '32nds' || k === 'treaddepth') return 'tread_32nds';
  if (k === 'quantity' || k === 'qty' || k === 'count') return 'quantity';
  if (k === 'price' || k === 'cost') return 'price';
  if (k === 'notes' || k === 'note' || k === 'comment') return 'notes';
  return null;
}

// Wire UI
els.addForm.addEventListener("submit", (e) => { e.preventDefault(); upsertFromForm(); });
els.tableBody.addEventListener("input", onTableInput);
els.tableBody.addEventListener("change", onTableInput);
els.tableBody.addEventListener("click", onTableClick);
els.importFile.addEventListener("change", onImportFile);
els.importCsv.addEventListener("change", onImportCsv);
els.exportBtn.addEventListener("click", exportJSON);
els.exportCsvBtn.addEventListener("click", exportCSV);
els.copyBtn.addEventListener("click", copyJSON);
els.clearBtn.addEventListener("click", clearAll);
els.templateCsvBtn.addEventListener("click", downloadCsvTemplate);
els.saveBtn.addEventListener("click", saveToServer);

init();
