# Cart Scheduler

A PWA for generating daily cart and store sweep schedules from Daily Overview PDFs.

## Setup (GitHub Pages)

1. Create a new GitHub repo (e.g. `cart-scheduler`)
2. Upload all files from this folder to the repo
3. Go to **Settings → Pages → Source** → select **GitHub Actions**
4. Push to `main` — the app will deploy automatically
5. Your URL will be `https://yourusername.github.io/cart-scheduler/`

## Usage

1. Open the app and upload the Daily Overview PDF
2. AI parses the PDF and extracts all CS-Bag associates
3. Toggle per-day exclusions (no carts / no sweep) per associate
4. Set FEC assignments and time windows
5. Configure slot capacities and types (Cart vs Lot/Bag)
6. Generate schedule and download PDF

## Notes
- Requires an Anthropic API key to be configured (see app.js)
- Works offline after first load (PWA)
- Installable on iOS and Android

Made by Norm Bottie
