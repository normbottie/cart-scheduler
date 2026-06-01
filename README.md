# Cart Scheduler

A mobile-first Progressive Web App (PWA) for generating cart/sweep schedules at Kroger store 1117. Built by Norm Bottie.

## Live App
**Production (stable):** https://nabotomy.github.io/cart-scheduler/
- Deployed from `main` branch
- Tagged `v1.0-stable`

**Development (v2):** Deploy from `v2-dev` branch via GitHub Pages settings
- 15-minute scheduling, history, PIN gate, date extraction, and more

## Architecture

| Component | Technology | Location |
|-----------|-----------|----------|
| Frontend | Vanilla JS + HTML/CSS PWA | `main` / `v2-dev` branch |
| AI Proxy | Cloudflare Worker | `cart-scheduler-worker/` folder |
| AI Model | Claude claude-sonnet-4-5 via Anthropic API | Via worker |
| Hosting | GitHub Pages (GitHub Actions deploy) | `.github/workflows/deploy.yml` |

**Worker URL:** `https://cart-scheduler-proxy.normbottie.workers.dev`
**Worker secret:** `ANTHROPIC_API_KEY` set via `wrangler secret put`
**Repo:** `https://github.com/nabotomy/cart-scheduler`

## Local Setup (one-time)

### 1. Clone the repo
```bash
mkdir -p ~/Projects
git clone https://github.com/nabotomy/cart-scheduler ~/Projects/cart-scheduler
```

### 2. Add shell aliases
```bash
nano ~/.zshrc
```
Add at the bottom:
```bash
alias cs="cd ~/Projects/cart-scheduler/cart-scheduler"
alias csw="cd ~/Projects/cart-scheduler/cart-scheduler-worker"
```
Then reload:
```bash
source ~/.zshrc
```

### 3. Install Wrangler
```bash
npm install -g wrangler
wrangler login
```

### 4. Set up Cloudflare KV namespace (one-time)
Get your Account ID from the right sidebar at dash.cloudflare.com, then add it to `wrangler.toml`:
```toml
account_id = "YOUR_ACCOUNT_ID_HERE"
```
Create the KV namespace:
```bash
csw
wrangler kv namespace create CART_DATA
```
Paste the returned `id` into `wrangler.toml`:
```toml
[[kv_namespaces]]
binding = "CART_DATA"
id = "YOUR_KV_NAMESPACE_ID"
```

### 5. Set the Anthropic API key
```bash
csw
wrangler secret put ANTHROPIC_API_KEY
```

### 6. Deploy the worker
```bash
csw
wrangler deploy
```

## Daily Deployment

### Frontend (v2-dev)
```bash
cs
cp ~/Downloads/app.js .
git add app.js
git commit -m "your message"
git push origin v2-dev
```

### Frontend (production/main)
```bash
cs
cp ~/Downloads/app.js .
git add app.js
git commit -m "your message"
git push origin main
```

### Worker
```bash
csw
cp ~/Downloads/worker.js .
cp ~/Downloads/wrangler.toml .
wrangler deploy
```

### Multiple files at once
```bash
cs
cp ~/Downloads/app.js .
cp ~/Downloads/index.html .
cp ~/Downloads/style.css .
git add .
git commit -m "your message"
git push origin v2-dev
```

## Key Files
- `app.js` — all application logic (~1300 lines)
- `index.html` — UI structure
- `style.css` — styling with CSS variables
- `sw.js` — service worker (cache name: `cart-scheduler-v9`)
- `manifest.json` — PWA manifest
- `cart-scheduler-worker/worker.js` — Cloudflare Worker proxy
- `cart-scheduler-worker/wrangler.toml` — Worker config (account ID + KV binding)

## Features (v2-dev)

### Step 1 — Upload
- **Scan Daily Overview** — camera scan, multiple pages, auto-compressed (1568px max, 0.85 quality, second pass if still over 1MB)
- **Scan Cart Service Schedule** — optional; auto-fills slot capacities and Lot/Bag types from Parking Lot column
- **15-minute scheduling** — specify a From/To time range; all slots in that range split into 15-min pairs (persisted via KV + localStorage)
- **Page validation** — AI checks each scanned image is the correct document type before parsing

### Step 2 — Associates Found
- Cards show name, job, cart window, meal, auto-FEC segments
- **✏️ pencil edit** — fix names inline; prompts to save as permanent correction (auto-applied on future scans, synced cross-device via KV)
- **No carts / No sweep** toggles per day
- **Permanent no-carts list** — saved to KV (cross-device) and localStorage

### Step 3 — FEC Assignment
- Auto-detected CS-FEC shown
- Day FEC hidden if auto-FEC detected
- Closing FEC auto-suggested (CSS with latest CS-Bag end time), highlighted with confirm button

### Step 4 — Slot Configuration
- 30-min slots 7AM–10PM; 15-min pairs shown when range is set
- Bulk set capacity or type
- Cart Service scan auto-fills this step
- **Lot/Bag** slots have no consecutive limit (Cart type max 1 consecutive)

### Step 5/6 — Results & Preview
- Shift counts table (collapsed by default)
- Schedule preview table
- **Download PDF** + **Print** buttons
- History auto-saves on download

### ☰ Menu
- Permanent no-carts list (KV + localStorage, cross-device)
- Name corrections (KV + localStorage, cross-device) — wrong→correct mappings; menu stays open when deleting

### Security
- 4-digit PIN gate (default: `1117`) on the terms modal
- Once verified, remembered per device via localStorage
- `robots.txt` blocks crawlers
- Terms popup on every page load (after PIN)

### Sync & Reliability
- KV failure toast — red banner shown if cloud sync fails, data still saved locally
- Service worker only intercepts same-origin requests (cross-origin API calls go direct to network)
- Network-first strategy for JS/HTML files so updates propagate immediately

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
- No consecutive slot limit for Lot/Bag type; max 1 consecutive for Cart type
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
- **Lot/Bag** — no consecutive limit, shown in blue in PDF

## localStorage Keys
| Key | Purpose |
|-----|---------|
| `cart-scheduler-permanent-no-carts` | Permanent no-carts list (local cache) |
| `cart-scheduler-name-corrections` | OCR name correction mappings |
| `cart-scheduler-split-range` | 15-min scheduling From/To selection (local cache) |
| `cart-scheduler-history` | Last 7 days of saved PDF schedules |
| `cart-scheduler-pin-ok` | PIN verified flag per device |

## Cloudflare KV Keys
| Key | Purpose |
|-----|---------|
| `no-carts` | Permanent no-carts list (cross-device) |
| `split-range` | 15-min scheduling From/To selection (cross-device) |
| `name-corrections` | OCR name correction mappings (cross-device) |

## Debug Mode
In browser console: `DEBUG_MODE = true`
Loads mock data instantly, skips all AI calls. Mock includes ~11 associates covering most scheduling scenarios.

## Worker API
- `POST /` with standard Anthropic messages body → `{success: true, employees: [...]}`
- Add `_rawParse: true` to body → `{content: [...], raw: "..."}` (used for cart schedule and validation calls); internal field stripped before forwarding to Anthropic
- `GET /kv/:key` → `{value: ...}` — read from KV
- `PUT /kv/:key` with `{value: ...}` body → `{ok: true}` — write to KV

## Known To-Do
- Time window editor for individual associate cart windows
