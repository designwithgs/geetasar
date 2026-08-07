---
name: GeetaSar
stage: live
updated: 2026-08-07
---

## Now
Daily Bhagavad Gita shloka site live at geetasar.com (static, zero-backend, Cloudflare Pages) with shareable 1080×1080 cards. The `card-motifs` feature set — chapter-themed motifs behind the card, generic Share button, local dist preview — is merged into main, along with single-line-shloka danda-boundary wrapping. GA4 is enabled and firing `card-share` / `card-download` / `link-copy` events, so share traction is now measurable. Sveltia CMS runs at `/admin/` (CDN script, no build step, no backend), authoring THEME entries into `content/themes/`; the verse picker is a relation against `content/verses/` — 701 generated, committed, English-only files (`node tools/build-verse-index.js`) — because GitHub's API truncates blobs over 512 KB and `verses.json` is ~732 KB. **`build.js` now consumes those theme files**: every entry with `published: true` becomes a `/theme/{slug}/` page (label, optional banner, blurb, intro, the curated verses in the authored order, then the essay) plus a plain grouped index at `/themes/`, linked from the header nav and listed in the sitemap. Explanations render through a ~40-line markdown function written into `build.js` — headings, lists, bold, italic, links, and an allow-listed raw-HTML passthrough for embeds — so the repo stays zero-dependency. Theme pages carry no card canvas; each verse links out to its existing `/verse/{c}-{v}/` page to be shared, and `card.js` is untouched. Nothing is published yet, so `/themes/` currently ships its empty state.

## Next
- [ ] Author and publish the first themes in `/admin/` (intro, banner, essay), then check the live `/theme/{slug}/` pages and the grouped index.
- [ ] Watch GA4 card-share data and measure organic card-shares/week against the 50-share gate.
- [ ] Hold the v1.1 backlog until the 50-share/week gate is cleared.

## Blocked
- The v1.1 backlog (per-verse OG images, regional languages, self-hosted fonts, portrait card) is deliberately on hold until the site reaches 50 organic card-shares/week — waiting on real-world traction.
