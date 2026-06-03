# JWG Back Shop Inventory

A standalone, inventory-only app for Jeff White Group back-shop employees to view
and update inventory. It is **connected to the same Supabase project** as the main
[JWG Staff Scheduler](https://github.com/soramithril/employee), so inventory changes
are shared and live-synced between both apps.

## What it does

- Sign in with the same username/email + password used for the scheduler.
- View all inventory items with search and filters (category / stock status).
- Add, edit, and delete items.
- Adjust stock with +/− buttons; mark items as Ordered / Restocked.
- Manage inventory categories.
- Live updates — changes made here or in the main app appear instantly on all
  open devices.

## Tech

Plain HTML/CSS/JS (no build step). Data lives in Supabase, accessed over the REST
and Realtime APIs.

| File | Purpose |
|------|---------|
| `index.html` | Login screen + inventory page shell |
| `css/styles.css` | Shared styling (matches the main app) |
| `js/config.js` | Supabase URL + anon key |
| `js/utils.js` | `sbF` REST helper, toast, modal |
| `js/auth.js` | Login, session keep-alive, inactivity timeout |
| `js/inventory.js` | Inventory UI + CRUD |
| `js/realtime.js` | Live sync of `inventory_items` / `inventory_categories` |
| `js/app.js` | Boot sequence |

### Shared Supabase tables

- `inventory_items` — `id, item_name, product_number, category_id, current_stock,
  min_threshold, unit, price, purchase_link, image_url, status, notes`
- `inventory_categories` — `id, name, sort_order, is_active`

Auth also relies on the `get_email_by_username` RPC (already defined in the project)
to allow username-based login.

## Running locally

It's a static site — serve the folder with any static server, e.g.:

```powershell
# Python
python -m http.server 5500
# or Node
npx serve .
```

Then open http://localhost:5500. (Opening `index.html` directly via `file://`
works for most things, but a local server avoids browser fetch/CORS quirks.)

## Deploying

Push to GitHub and host on any static host (GitHub Pages, Netlify, Vercel,
Cloudflare Pages). No server or build step required.

> **Note:** The Supabase anon key in `config.js` is a public client key (safe to
> ship in a static site). Access control is enforced by Supabase Row Level
> Security / auth, not by hiding the key.
