# PRD & Implementation Doc — Shareable Verse Card

**Feature:** The 1080×1080 shareable shloka card — GeetaSar's core feature and growth loop.
**Status:** Shipped (v1). This doc describes current behavior and the spec any change must preserve.
**Surfaces:** Home page (`/`, today's verse) and every verse page (`/verse/{c}-{v}/`).
**Code:** `src/card.js` (renderer + share), `build.js` (markup, data, Hinglish generation).

---

## 1. Background & problem

Every morning, crores of Gita verses travel across WhatsApp as blurry, watermarked,
badly typeset images. People clearly *want* to share a daily shloka; the artifact
they share is ugly. GeetaSar's bet: give the same ritual a beautiful, watermark-free
card and the card itself becomes the distribution channel — every share is an ad
with `geetasar.com` printed at the bottom.

The card is not a screenshot of the page. It is purpose-rendered at 1080×1080
(WhatsApp/Instagram-native square) so it looks intentional in a chat thread.

## 2. Goals & non-goals

**Goals**

1. A card beautiful enough that people prefer it to the images they currently forward.
2. Zero-friction sharing: one tap to the WhatsApp share sheet on mobile.
3. The reader of a shared card can find the site (footer URL) — that's the whole
   acquisition funnel.
4. Meaning readable in the recipient's language: English, Hindi, or Hinglish.

**Non-goals**

- No user accounts, favorites, or customization (colors, fonts) in v1.
- No server-side rendering. The card is drawn client-side on canvas; there is no
  backend and there must not be one.
- No watermark beyond the small `geetasar.com` footer — "no watermark" is a
  product promise stated in the site footer.
- The page below the card is *not* language-toggled; the toggle affects the card only.

## 3. Success metric

**Card shares per week** (tracked as `card-share`, with `card-download` as a
secondary signal). Target: 50 organic shares/week before any v1.1 work begins
(see README backlog gate). Nothing else matters for validation.

## 4. User experience

### 4.1 Flow

1. User lands on `/` (today's verse) or a `/verse/{c}-{v}/` permalink.
2. The card renders immediately above the fold with the Sanskrit shloka, the
   meaning in the selected language, the reference, and `geetasar.com`.
3. A pill toggle under the card selects the card's meaning language:
   **English** (default) · **हिन्दी** · **Hinglish**. Switching redraws the card
   in place; nothing else on the page changes.
4. **Share on WhatsApp** (primary button): opens the native share sheet with the
   card attached as a PNG file. **Share** (secondary): same share sheet for any
   app, with graceful fallbacks (see 4.2). **Download card**: saves the PNG.
5. On the home page only, an **Open this verse →** ghost link goes to the
   verse's permalink.

### 4.2 States

- **Loading:** canvas is blank until fonts load (typically <1s; a safety redraw
  fires at 1.2s). No spinner — the page around it is already meaningful.
- **No Web Share support (desktop):** the WhatsApp button falls back to
  downloading the PNG *and* opening `wa.me` prefilled with the verse's
  permalink, so the user can attach the downloaded image manually. The generic
  Share button degrades in steps: file share → link share (`navigator.share`
  without files) → copy permalink to clipboard with a transient
  "Link copied ✓" label.
- **Share cancelled:** silently ignored (no error UI).

## 5. Functional spec

| # | Requirement | Implementation |
|---|---|---|
| FR1 | Card is a 1080×1080 PNG rendered client-side | `<canvas>` drawn by `draw()` in `src/card.js`; exported via `canvas.toBlob` |
| FR2 | Sanskrit shloka always shown, regardless of language | `v.sa` drawn in all three modes |
| FR3 | Meaning language: `en` (default), `hi`, `hn` | `state.lang`; toggle buttons carry `data-lang` |
| FR4 | Reference line localizes with the language | hi: `अध्याय २ · श्लोक ४७` (Devanagari digits) · hn: `Adhyay 2 · Shlok 47` · en: `Chapter 2 · Verse 47` |
| FR5 | Same daily verse for everyone, worldwide | `todaysId()`: days since 1 Jan 2026 **in IST**, mod verse count → verse id. No server, no cron |
| FR6 | Share attaches the PNG file, not a link | `navigator.share({ files: [File] })` when `canShare` passes |
| FR7 | Filename is meaningful | `geetasar-{c}-{v}.png` |
| FR8 | Analytics on share/download | `card-share` / `card-download` fired to GA4 (and Umami if enabled); clipboard fallback fires `link-copy` |
| FR10 | Generic share alongside WhatsApp | `shareAny()`: file share → link share → clipboard copy |
| FR9 | Works with no build-time rendering deps | Everything is vanilla canvas; the repo stays zero-dependency |

### 5.1 Language data

- `en` and `hi` come straight from `data/verses.json`.
- `hn` (Hinglish) **does not exist in the source data**. `build.js` generates it
  at build time by transliterating `v.hi` (Devanagari → casual Roman) with
  schwa-deletion heuristics. Bad words are fixed via the `HN_WORDS` exception
  map — never by hand-editing output or over-fitting the algorithm.
- All three fields ship in `window.__VERSE__` (verse pages) and `/v/{id}.json`
  (fetched by the home page), so the toggle needs no network round-trip.

### 5.2 Daily verse invariant

The epoch (`Date.UTC(2026, 0, 1)`) is a **frozen constant**. Changing it resets
the sequence for every user and breaks "we all saw the same verse today."
Any change to `todaysId()` must be sequence-preserving.

## 6. Visual spec (the card)

Layout is vertically centered as one composition (shloka + rule + meaning),
clamped so it never collides with the fixed header/footer.

| Element | Spec |
|---|---|
| Canvas | 1080×1080 |
| Background | Radial gradient, top-center glow: `#202a55 → #141a33 → #10152a` (night sky, matches site theme) |
| Border | Double manuscript frame in gold: 3px `rgba(201,162,39,.9)` at 36px inset, 1px `rgba(201,162,39,.35)` at 50px inset |
| Header | `॥ श्रीमद्भगवद्गीता ॥` — Tiro Devanagari Sanskrit 34px, gold `#c9a227`, y=130 |
| Shloka | Tiro Devanagari Sanskrit, ivory `#efe9da`. Auto-sized: starts 54px (46px if >3 lines), shrinks by 2px steps to fit 880px width, floor 34px. Line height 1.75× |
| Divider | Gold rule with a rotated-square diamond at center (the site's signature ornament) |
| Meaning | `#d8d2c2`. Size by length: ≤170 chars → 38px, ≤260 → 34px, else 30px. Wrapped to 860px, max 7 lines, ellipsized with ` …`. Line height 1.6×. Font by language: hi → Mukta 300 · hn → Mukta 400 · en → Source Serif 4 400 |
| Reference | Gold. hi → Tiro 32px · hn → Mukta 500 28px · en → Source Serif 600 28px. y = H−118 |
| URL | `geetasar.com`, Mukta 300 24px, muted blue-grey `rgba(139,147,176,.9)`, y = H−72 |

**Design rationale:** the card is a miniature of the site's "temple at evening
aarti" theme — same night palette, gold, and diamond ornament — so a shared card
and the site it links to feel like one object.

## 7. Technical implementation

### 7.1 Data flow

```
data/verses.json ──build.js──▶ +hn field ──▶ /v/{id}.json          (home fetches today's)
                                        └─▶ window.__VERSE__       (inlined on verse pages)
verse ──▶ card.js state ──▶ draw() on canvas ──▶ toBlob() ──▶ share/download
```

### 7.2 Rendering pipeline (`draw()`)

1. Paint background gradient + double border.
2. Fit the shloka: `fitLines()` shrinks font until the widest line fits.
3. Pre-measure the meaning (`wrap()` + size buckets) *before* drawing anything,
   so total block height is known and the composition can be vertically centered
   (`y = max(230, (H − 140 − blockH)/2 + 60)`).
4. Draw shloka → ornament rule → meaning → reference → URL.

### 7.3 Critical quirks (do not regress)

- **Safari Devanagari centering:** WebKit computes `textAlign:'center'` offsets
  without complex-script shaping, mis-centering Devanagari runs. All canvas text
  is therefore drawn with `textAlign:'left'` and centered manually via
  `fillCentered()` (`(W − measureText(text).width)/2`). Every new canvas string
  must use `fillCentered`, never `textAlign:'center'`.
- **Font readiness:** `draw()` runs after `document.fonts.load()` for each
  face/weight used, with a 1.2s safety redraw. If you add a new font weight to
  the card, add it to the preload list in `ready()` or first paint uses a
  fallback font.
- **Cache busting:** `card.js` is referenced as `/card.js?v=N` in `build.js`
  templates. Bump `N` with any card.js change or users get the stale renderer.

### 7.4 Share implementation

- Mobile (Web Share Level 2): `new File([blob], 'geetasar-c-v.png')` →
  `navigator.share({ files, title, text: 'Today's shloka · <permalink>' })`.
  The text carries the permalink so even a text-only share target gets a link.
- Desktop fallback (WhatsApp button): `download()` + open `wa.me/?text=<permalink>`
  in a new tab.
- Generic Share button (`shareAny()`): identical file share on mobile; on
  browsers without file share it tries a link-only `navigator.share`, then falls
  back to copying the permalink (`link-copy` event, transient button label).
- Tracking fires only on confirmed share (`.then`), not on cancel.

## 8. Edge cases handled

- Shlokas with 2–6 lines (speaker lines like `सञ्जय उवाच` included) — auto-shrink.
- Very long meanings (Ramsukhdas Hindi runs long) — size buckets + 7-line clamp.
- Verse pages work offline-after-load: data is inlined, no fetch needed.
- `verses.json` count changing (701 today) — `todaysId` takes the count as input;
  the mod just wraps. (Appending verses is safe; reordering is not.)

## 9. Out of scope / future (gated on 50 shares/week)

- **4:5 portrait variant** for Instagram — needs a second layout pass, not a scale.
- **Per-verse OG images** — pre-rendered at build (node-canvas/satori); would end
  the zero-dependency claim, decide deliberately.
- Regional languages on the card (Tamil, Telugu, Gujarati) — blocked on sourcing
  translation datasets, not on rendering.
- Card style presets / user customization.

## 10. Acceptance checklist for card changes

- [ ] Renders correctly for a 2-line and a 4+-line shloka (e.g. 2.47 and 1.47).
- [ ] All three languages render; toggle redraws without layout jumps.
- [ ] Devanagari is optically centered **in Safari**, not just Chrome.
- [ ] Share sheet on iOS/Android attaches a PNG named `geetasar-{c}-{v}.png`.
- [ ] Desktop share falls back to download + wa.me.
- [ ] `?v=` bumped in `build.js`; `node build.js` run; `dist/` output spot-checked.
- [ ] Daily verse sequence unchanged (epoch untouched).
