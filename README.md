# Formularhilfe Aufenthaltstitel Hamburg · Oturum İzni Form Yardımcısı · Residence Permit Form Helper

A mobile-first Progressive Web App that helps people fill in the official Hamburg form
**“Antrag auf Erteilung/Verlängerung eines Aufenthaltstitels” (German/Turkish, form E / Z - 008.40/180 - 12.08)**
step by step in Turkish, German or English. It produces a completed, signed copy of the **original PDF**, entirely on the device.

> Independent helper – not an official service of the Free and Hanseatic City of Hamburg. No legal advice.

## What it does

1. Language choice (Türkçe / Deutsch / English) on first start; switchable at any time.
2. A 12–13 step wizard (the spouse step appears only when it applies), with validation, help texts and the original form label (DE / TR) under every question.
3. Automatic local saving (IndexedDB) of answers, current step and signature; resume after reload.
4. Review screen with edit links, warnings (e.g. expired passport) and a check that every answer **fits into its box on the form**.
5. Declaration (verbatim DE/TR text from the form), date, finger signature – or “I will sign on paper”.
6. Generation of the completed original PDF in the browser, preview (PDF.js), download, share (Web Share API) or open.
7. “Delete all my data” with confirmation – removes the database, the signature and the app’s preferences.

## Privacy model

- No accounts, no backend, no analytics, no cookies, no third-party requests.
- All processing (validation, PDF generation, signature) happens in the browser.
- A build-time **Content-Security-Policy** (`connect-src 'self'`, `script-src 'self'`, …) prevents any connection to another origin.
  The end-to-end test asserts that no request leaves the origin.
- Answers are stored only in IndexedDB on the device (can be turned off: “Save my progress on this device”).
  Language and that switch are kept in `localStorage`. Nothing personal goes into URLs (navigation uses `history.state`).
- Completed PDFs exist only as in-memory Blobs; they are never written to storage or the service-worker cache.
  The service worker precaches only the app shell, the blank form and the font.
- The privacy screen explains that local storage may be visible to others on shared devices, can be cleared by the browser and is no backup.

## The PDF

The template is the user-supplied original, stored byte-identical in `public/form/` and verified at run time by SHA-256.
Full analysis and the field-by-field table: **[docs/FIELD-MAPPING.md](docs/FIELD-MAPPING.md)** (generated from code).

Summary:

- 2 A4 pages, AcroForm with 89 widgets (67 text, 22 check boxes); printed text is stored as images (no text layer).
- Every widget was matched to its printed label visually; **all 89 are mapped**. Positions are read from the widget rectangles at run time.
- The **signature has no field**: it is placed by coordinates measured from the rendered page (the only coordinate-based placement).
- Values are drawn with an embedded Noto Sans subset (Latin incl. all German and Turkish letters), shrunk and – in narrow cells – wrapped
  to fit; if something still does not fit, generation is refused and the user is told which answer to shorten. Nothing is ever clipped.
- Check boxes get the same cross as the template’s own “checked” appearance.
- Afterwards the form widgets are removed (flattened): page content, page size and all printed text stay untouched – the tests verify
  that the original content streams are still present byte-for-byte.
- The flagged decisions (Turkish duplicate rows ticked too, “in Deutschland geboren”, German wording of choice answers, …) are listed
  at the end of the mapping document.

## Tech stack

React 19, TypeScript, Vite 8, Tailwind CSS 4, React Hook Form + Zod 4, pdf-lib (+ fontkit), PDF.js (legacy build for older iOS Safari),
signature_pad, idb (IndexedDB), vite-plugin-pwa (Workbox), lucide-react. pdf-lib and PDF.js are lazy-loaded.

## Project structure

```
public/form/antrag-aufenthaltstitel-d-tr.pdf   original blank form (unmodified)
public/fonts/NotoSans-Regular-latin.ttf        embedded PDF font (OFL), built by scripts/subset-font.sh
src/form/types.ts        answer model, defaults, draft migration
src/form/steps.ts        declarative wizard: steps, fields, conditions, formats, original labels
src/form/schema.ts       Zod schema / validation rules (required, conditional, cross-field)
src/form/effective.ts    blanks answers to hidden questions before printing
src/form/options.ts      choice lists (UI label + German text for the form)
src/pdf/fieldMap.ts      central typed mapping answer → PDF field (+ signature area, flagged items)
src/pdf/layout.ts        text fitting (shrink / wrap / overflow)
src/pdf/engine.ts        template reading, fill planning, PDF generation, fit checker
src/pdf/assets.ts        template + font loading with checksum check
src/pdf/preview.ts       PDF.js rendering
src/storage/db.ts        IndexedDB persistence and “delete all data”
src/i18n/{tr,de,en}.ts   translations (typed against en.ts – missing keys fail the build)
src/app/AppContext.tsx   form state, autosave, navigation (history API), deletion
src/screens/*            language, welcome, wizard, review, signature, result, privacy
tests/*                  Vitest unit/integration tests (real template)
scripts/e2e-smoke.mjs    Playwright end-to-end run (mobile viewport)
scripts/field-report.ts  generates docs/FIELD-MAPPING.md
```

## Development

```bash
npm install
npm run dev            # http://localhost:5173
npm test               # unit + PDF integration tests
npm run typecheck
npm run build          # production build into dist/
npm run preview        # serve dist/ on http://localhost:4173
npm run e2e            # needs `playwright` with Chromium; run against `npm run preview`
npm run sample:pdf     # writes out/sample-filled.pdf from sample data
npm run report:fields  # regenerates docs/FIELD-MAPPING.md
```

Node ≥ 22.13. To rebuild the font subset: `pip install fonttools` and `scripts/subset-font.sh NotoSans-Regular.ttf`.

## Deployment

`dist/` is a static site – any static host works (Netlify, Cloudflare Pages, GitHub Pages, nginx …).

- Serve over **HTTPS** (required for the service worker and for the template checksum via `crypto.subtle`).
- For a sub-path deployment build with `VITE_BASE=/sub/path/ npm run build`.
- Recommended response headers in addition to the built-in CSP meta tag: `Content-Security-Policy` (same value plus
  `frame-ancestors 'none'`), `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`,
  `Permissions-Policy: camera=(), microphone=(), geolocation=()`, and `Cache-Control: no-cache` for `index.html` and `sw.js`.
- Do not add analytics or error monitoring that could capture form values.

## Publishing and QR code

The app must be reachable at a public **HTTPS** address; people then open it by scanning a QR code.

- **GitHub Pages (recommended, automatic):** push this repository to GitHub, then *Settings → Pages → Source: GitHub Actions*.
  `.github/workflows/deploy-pages.yml` tests, builds (with the right sub-path) and publishes on every push to `main`.
  Address: `https://<user>.github.io/<repository>/`.
- **Netlify / Cloudflare Pages:** upload `dist/` (e.g. Netlify Drop – sign in, otherwise anonymous sites expire).
  `public/_headers` sets the security headers there.

Then create the QR code and a printable trilingual A4 poster:

```bash
npm run qr -- https://<user>.github.io/<repository>/
# → out/qr/app-qr.png, out/qr/app-qr.svg, out/qr/poster-A4.pdf
```

Inside the app, *Menu → Share this app* shows the same QR code (the app’s own address only, never any answers),
so every user can pass the app on.

## Browser support

iOS Safari 15.4+ (native `<dialog>`), Android Chrome, current desktop Chrome/Edge/Firefox/Safari. Layout target 320–430 px.
Web Share with files is used where available; otherwise “Open PDF”.

## Known limitations

- A finger-drawn signature is not a qualified electronic signature; the app says so and offers signing on paper.
- Free-text answers are printed as typed (no translation). Only Latin script is accepted, as in passports.
- The form has room for 3 earlier stays and 6 children; the app limits the lists accordingly.
- If Hamburg publishes a new form version, the template, checksum and mapping must be re-analysed.

## Licences

- Noto Sans: SIL Open Font License 1.1 (`public/fonts/OFL-NotoSans.txt`).
- The blank form is an official document of the Freie und Hansestadt Hamburg, included unmodified.
