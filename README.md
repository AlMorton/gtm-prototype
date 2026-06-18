# GTM Prototype

A minimal, static website for testing **Google Tag Manager** — container setup, tags, triggers, and `dataLayer` events. No build step, no dependencies; just HTML, CSS, and a little JavaScript.

## Pages

- `index.html` — Home, with a CTA button and an outbound link.
- `about.html` — Notes on how to verify GTM is working.
- `contact.html` — A contact form (submits nothing; just fires an event).

## Custom dataLayer events

`script.js` pushes these events you can wire up as **Custom Event** triggers in GTM:

| Event            | Fires when…                          | Extra data                         |
|------------------|--------------------------------------|------------------------------------|
| `cta_click`      | The "Track This Click" button is hit | `cta_location`                     |
| `outbound_click` | The external link is clicked         | `link_url`                         |
| `form_submit`    | The contact form is submitted        | `form_id`, `form_name`             |

Every push is also logged to the browser console, so you can verify without opening Tag Assistant.

## Wiring in your GTM container

1. Create a container at [tagmanager.google.com](https://tagmanager.google.com) and copy its ID (`GTM-XXXXXXX`).
2. Find/replace `GTM-XXXXXXX` with your real ID across **all three** `.html` files. For example:
   ```sh
   # macOS
   sed -i '' 's/GTM-XXXXXXX/GTM-YOURID/g' *.html
   ```
3. Commit and push. GitHub Pages will redeploy automatically.

## Run locally

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

## Verify it works

- In GTM, click **Preview**, enter your site URL, and watch tags fire in Tag Assistant.
- Or open DevTools → Console and type `dataLayer` to inspect pushed events.
