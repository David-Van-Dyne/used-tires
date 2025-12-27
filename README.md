Used Tire Inventory App

Overview
- Static, client-side app to browse used tire inventory grouped by size.
- No external dependencies; serves as plain HTML/CSS/JS.
- Reads data from `data/inventory.json`.

Run Locally
- From repo root, start a simple static server and open the app:
  - Python 3: `python -m http.server 8000` then open `http://localhost:8000/web/`
  - Node (if you prefer): `npx http-server -p 8000` then open `http://localhost:8000/web/`

Why a server? Browsers block `fetch()` from `file://` for security. Serving files locally is the simplest way to allow the app to load `data/inventory.json`.

Editing Inventory
- Update `data/inventory.json` with your live stock. Each item supports:
  - `id` (number), `size` (string, e.g., `205/55R16`), `brand`, `model`
  - `tread_32nds` (number), `quantity` (number), `price` (number), `notes` (string)
- Changes are picked up on refresh. The app groups by `size` and supports search, min tread filter, and sorting.

Admin Editor (CSV-first, no backend)
- Open `http://localhost:8000/web/admin.html` for a simple client-side editor:
  - Import CSV: upload a `.csv` with headers. Supported headers (case/spacing flexible):
    - `id`, `size`, `brand`, `model`, `tread_32nds` (aka `tread`, `tread (32nds)`), `quantity` (aka `qty`), `price`, `notes`.
  - Export CSV: download your edited inventory as `inventory.csv`.
  - JSON options remain available to interop with the catalog’s `data/inventory.json`.
  - Add items with the form; edit inline in the table; duplicate or delete rows.
  - Tip: After editing, Export JSON and replace `data/inventory.json` to update the catalog.

Next Steps (optional)
- Add a basic backend (Node/Express or Python/Flask) to manage inventory CRUD.
- Add CSV import/export for bulk updates.
- Add per-location inventory and availability badges.
- Deploy via a static host (Netlify, GitHub Pages) with a small API for inventory.
