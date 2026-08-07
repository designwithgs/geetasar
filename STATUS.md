---
name: GeetaSar
stage: live
updated: 2026-08-07
---

## Now
Daily Bhagavad Gita shloka site live at geetasar.com (static, zero-backend, Cloudflare Pages) with shareable 1080×1080 cards. The `card-motifs` feature set — chapter-themed motifs behind the card, generic Share button, local dist preview — is merged into main, along with single-line-shloka danda-boundary wrapping. GA4 is enabled and firing `card-share` / `card-download` / `link-copy` events, so share traction is now measurable. Sveltia CMS now runs at `/admin/` (CDN script, no build step, no backend) for authoring THEME entries into `content/themes/`. The verse picker is a relation against `content/verses/` — 701 generated, committed, English-only files (`node tools/build-verse-index.js`), because GitHub's API truncates blobs over 512 KB and `verses.json` is ~732 KB. A first attempt using a nested list inside one index file resolved to zero options in the live CMS, so it was replaced with a folder collection and flat field names. Verified end-to-end in a real browser against the shipped CMS bundle: 701 options, English and reference search, `verseIds` saving as `["2-47", …]`. Nothing consumes those theme files yet.

## Next
- [ ] Confirm the rebuilt verse picker mounts against the live GitHub backend, then author the first THEME entries.
- [ ] Watch GA4 card-share data and measure organic card-shares/week against the 50-share gate.
- [ ] Hold the v1.1 backlog until the 50-share/week gate is cleared.

## Blocked
- The v1.1 backlog (per-verse OG images, regional languages, self-hosted fonts, portrait card) is deliberately on hold until the site reaches 50 organic card-shares/week — waiting on real-world traction.
