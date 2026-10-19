# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A static, dependency-free site for testing Google Tag Manager (container setup, tags, triggers, `dataLayer` events). Plain HTML/CSS/JS — no build step, no package manager. Deployed via GitHub Pages.

## Commands

```sh
python3 -m http.server 8000   # serve locally, then open http://localhost:8000
```

There is no build, lint, or test tooling. Deployment is automatic: commit and push, and GitHub Pages redeploys.

## Architecture

Three sibling pages (`index.html`, `about.html`, `contact.html`) share `styles.css` and `script.js`. Each page hardcodes the GTM container snippet (currently `GTM-MM4X8CNK`) inline in both `<head>` (the loader) and `<body>` (the `<noscript>` iframe) — so changing the container ID means a find/replace across **all three** HTML files. Note the README still references the placeholder `GTM-XXXXXXX`, but the live ID is `GTM-MM4X8CNK`.

`script.js` is the integration layer between page DOM and GTM. It ensures `window.dataLayer` exists before GTM loads, then on `DOMContentLoaded` wires DOM elements to custom events via `pushEvent()`, which both pushes to `dataLayer` and logs to the console for verification without Tag Assistant. The contract between markup and JS is element IDs and `data-*` attributes:

| Element (by `id`) | Event pushed     | Payload                          |
|-------------------|------------------|----------------------------------|
| `cta-button`      | `cta_click`      | `cta_location` (from `data-cta`) |
| `outbound-link`   | `outbound_click` | `link_url` (the href)            |
| `contact-form`    | `form_submit`    | `form_id`, `form_name`           |

These event names are what you wire up as **Custom Event** triggers in the GTM container. The contact form submits nothing — it calls `preventDefault()`, validates, fires the event, then resets. When adding interactions, follow the same pattern: a stable `id` in the HTML, a guarded listener in `script.js`, and a `pushEvent()` call.

### Mock login + ecommerce flow

`login.html` → `shop.html` → `cart.html` → `checkout.html` are driven by `shop.js` (loaded on every page after `script.js`, reusing `pushEvent()`). Cart and user are stored in `localStorage` (`gtmproto_cart`, `gtmproto_user`); the product catalog is hardcoded in `shop.js` (currency JPY). Checkout redirects to `login.html?next=checkout.html` if not logged in. Every ecommerce push is preceded by `{ecommerce: null}`, per GA4 guidance. On each page load `shop.js` also pushes `login_status` (and `user_id` when logged in) with no event.

| Where              | Event                               | Payload                                      |
|--------------------|-------------------------------------|----------------------------------------------|
| `login-form`       | `login`                             | `method`, `user_id` (navigates via `eventCallback`) |
| `logout-button`    | `logout`                            | `user_id`                                    |
| `shop.html` load   | `view_item_list`                    | `ecommerce.items`, `item_list_id/name`       |
| `.add-to-cart`     | `add_to_cart`                       | `ecommerce.value`, `items`                   |
| `cart.html` load / `.remove-from-cart` | `view_cart` / `remove_from_cart` | `ecommerce.value`, `items`         |
| `checkout.html` load | `begin_checkout`                  | `ecommerce.value`, `items`                   |
| `shipping-form`    | `add_shipping_info`                 | + `shipping_tier`                            |
| `payment-form`     | `add_payment_info`, then `purchase` | + `payment_type`; `transaction_id`, `shipping` |
