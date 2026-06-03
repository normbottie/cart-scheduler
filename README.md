# Cart Scheduler

A mobile-first Progressive Web App (PWA) for generating cart/sweep schedules at Kroger store 1117. Built by Norm Bottie.

## Live App
**Live app:** https://normbottie.github.io/cart-scheduler/
- Deployed from `main` branch

## Architecture

| Component | Technology | Location |
|-----------|-----------|----------|
| Frontend | Vanilla JS + HTML/CSS PWA | `main` branch |
| AI Proxy | Cloudflare Worker | `cart-scheduler-worker/` folder |
| AI Model | Claude claude-sonnet-4-5 via Anthropic API | Via worker |
| Hosting | GitHub Pages (GitHub Actions deploy) | `.github/workflows/deploy.yml` |

**Worker URL:** `https://cart-scheduler-proxy.normbottie.workers.dev`  
**Worker secret:** `ANTHROPIC_API_KEY` set via `wrangler secret put`  
**Repo:** `https://github.com/normbottie/cart-scheduler`

## Key Files
- `app.js` — all application logic (~1100 lines)
- `index.html` — UI structure
- `style.css` — styling with CSS variables
- `sw.js` — service worker (cache name: `cart-scheduler-v7`)
- `manifest.json` — PWA manifest
- `cart-scheduler-worker/worker.js` — Cloudflare Worker proxy

## Features (v2-dev)

### Step 1 — Upload
- **Scan Daily Overview** — camera scan, multiple pages, auto-compressed before sending
- **Scan Cart Service Schedule** — optional; auto-fills slot capacities and Lot/Bag types from Parking Lot column
- **15-minute scheduling** — specify a From/To time range; all slots in that range split into 15-min pairs (persisted via KV + localStorage)
- **Page validation** — AI checks each scanned image is the correct document type before parsing

### Step 2 — Associates Found
- Cards show name, job, cart window, meal, auto-FEC segments
- **✏️ pencil edit** — fix names inline; prompts to save as permanent correction (auto-applied on future scans, synced cross-device via KV)
- **No carts / No sweep** toggles per day
- **Permanent no-carts list** — synced cross-device via Cloudflare KV, managed via ☰ menu

### Step 3 — FEC Assignment
- Auto-detected CS-FEC shown
- Day FEC hidden if auto-FEC detected
- Closing FEC auto-suggested (CSS with latest CS-Bag end time), highlighted with confirm button

### Step 4 — Slot Configuration
- 30-min slots 7AM–10PM; 15-min pairs shown when range is set
- Bulk set capacity or type
- Cart Service scan auto-fills this step

### Step 5/6 — Results & Preview
- Shift counts table (collapsed by default)
- Schedule preview table
- **Download PDF** + **Print** buttons
- History auto-saves on download

### ☰ Menu
- Permanent no-carts list (synced via Cloudflare KV — cross-device)
- Name corrections (synced via Cloudflare KV — cross-device) — wrong→correct mappings

### Security
- 4-digit PIN gate (default: `1117`) on the terms modal
- Once verified, remembered per device via localStorage
- `robots.txt` blocks crawlers
- Terms popup on every page load (after PIN)

## PDF Output
- Dark banner title row with date, built into the chart header
- Columns: Time | # | Associate(s) | Store Sweep
- Names: First name + last initial (e.g. "Tony L."), handles suffixes (III, Jr, etc.)
- Lot/Bag slots shown in blue
- Font: 9pt body, 15pt row height
- Footnotes flush to bottom: `*` = FEC on carts, `†` = CSTL/Manager on carts
- Watermark: "Made by Norm Bottie" bottom-right

## Scheduling Rules
- Eligible for carts: fsc, cashier, css (cstl/csm/mgr = last resort, marked †)
- Max 1 consecutive slot per person (Cart type); up to 2 for Lot/Bag
- Meals block scheduling during that window
- Auto-FEC segments block carts during those hours
- Designated FEC excluded from carts during their window; placed on carts with `*` only if slot is short
- CSTL/Manager used only when no other associate available
- Store sweeps: odd hours (9,11,13,15,17,19), floor care pair at 9:30 PM
- AM cleaner **preferred** for sweeps during their CS-Cleaning hours
- PM cleaner excluded from sweeps during their cleaning hours
- FEC and CSTL excluded from sweeps

## Slot Types
- **Cart** — max 1 consecutive slot
- **Lot/Bag** — max 2 consecutive slots, shown in blue in PDF

## localStorage Keys
| Key | Purpose |
|-----|---------|
| `cart-scheduler-permanent-no-carts` | Permanent no-carts list (also synced to KV) |
| `cart-scheduler-name-corrections` | OCR name correction mappings (also synced to KV) |
| `cart-scheduler-split-range` | 15-min scheduling From/To selection |
| `cart-scheduler-history` | Last 7 days of saved PDF schedules |
| `cart-scheduler-pin-ok` | PIN verified flag per device |

## Debug Mode
In browser console: `DEBUG_MODE = true`  
Loads mock data instantly, skips all AI calls. Mock includes ~11 associates covering most scheduling scenarios.

## Deployment
```bash
# Frontend (alias: cs)
cs
git add .
git commit -m "your message"
git push origin main

# Worker (alias: csw)
csw
wrangler deploy
```

## Worker API
- `POST /` with standard Anthropic messages body → `{success: true, employees: [...]}`
- Add `_rawParse: true` to body → `{content: [...], raw: "..."}` (used for cart schedule and validation calls)
- `GET /kv/:key` → `{value: ...}` — read from KV
- `PUT /kv/:key` with `{value: ...}` body → `{ok: true}` — write to KV
- PDF beta header included: `anthropic-beta: pdfs-2024-09-25`

## Known To-Do
- ~~Cloudflare KV sync for permanent no-carts list (cross-device)~~ ✅ Complete
- ~~More robust AM/PM time parsing for edge cases~~ ✅ Complete
- Time window editor for individual associate cart windows

## Recent Changes
- Merged v2-dev into main — single branch going forward
- Username renamed from nabotomy → normbottie
- Rate limiting: 50 AI calls per IP per 24hr via KV
- Feedback system: in-app form (Bug/Suggestion/General) → stored in KV + email via Mailjet (carts@norm.network → normbottie@gmail.com)
- Reload app button in ☰ menu (also triggers SW update check)
- KV sync fixed: load overwrites local instead of merging; add/remove reads KV before writing
