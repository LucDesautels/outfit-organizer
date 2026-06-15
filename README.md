# Wardrobe

A minimalist, art-gallery-style wardrobe organizer. Catalog the pieces you own
(and wishlist finds), group them into **ecosystems**, combine them into **fits**,
rate them out of 10, and explore everything as a floating **web**.

- **No account, no server.** Everything is stored locally on your device (IndexedDB).
- **Installable** to your phone's home screen (PWA) and works fully offline.
- **Camera + screenshots.** Take a photo or import a screenshot, then crop it.

## Features

- **Pieces** — name, type, photo, colour(s), style(s), formality, owned/wishlist, notes.
- **Ecosystems** — groups of pieces that all work together; a piece can be in many.
- **Fits** — outfits built from your pieces (or wishlist items). Auto-collage preview,
  optional worn photo, 0–10 rating.
- **Filter & sort** by type, colour, style, formality, rating.
- **Web view** — force-directed graph of your wardrobe grouped by ecosystem or fit.
- **Everything is editable** — add/rename/reorder/delete types, colours, styles and
  formality levels in Settings.
- **Backup** — export/import all your data as a single `.json` file.

## Install on your phone

1. Open the published URL in **Chrome** on your phone.
2. Tap the **⋮** menu → **Add to Home screen** (or **Install app**).
3. Launch it from the new icon — it runs full-screen and offline.

> Published with GitHub Pages. See repo **Settings → Pages**.

## Run locally

No build step. Serve the folder over http (modules need an http origin):

```bash
node tools/serve.mjs      # then open http://localhost:5050
```

## Project layout

```
index.html              app shell
css/styles.css          design system
js/app.js               bootstrap + routing (hardware back-button aware)
js/views.js             all screens + editors
js/store.js             state + IndexedDB persistence + editable taxonomies
js/db.js                IndexedDB wrapper
js/image.js             import/resize/crop pipeline
js/ui.js                sheets, toasts, image picker, cropper
js/web.js               force-directed web graph (canvas)
js/util.js              helpers + icon set
manifest.webmanifest    PWA manifest
sw.js                   service worker (offline)
icons/                  app icons
tools/                  local dev helpers (static server, icon generator)
```
