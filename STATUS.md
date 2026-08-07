---
name: GeetaSar
stage: live
updated: 2026-08-07
---

## Now
Daily Bhagavad Gita shloka site live at geetasar.com (static, zero-backend, Cloudflare Pages) with shareable 1080×1080 cards. The `card-motifs` feature set — chapter-themed motifs behind the card, generic Share button, local dist preview — is merged into main, along with single-line-shloka danda-boundary wrapping. GA4 is enabled and firing `card-share` / `card-download` / `link-copy` events, so share traction is now measurable. Sveltia CMS now runs at `/admin/` (CDN script, no build step, no backend) for authoring THEME entries into `content/themes/` — the verse picker reads `data/verses.json` read-only. Nothing consumes those theme files yet.

## Next
- [ ] Author the first THEME entries at `/admin/` and check how the 701-verse picker holds up in a real browser.
- [ ] Watch GA4 card-share data and measure organic card-shares/week against the 50-share gate.
- [ ] Hold the v1.1 backlog until the 50-share/week gate is cleared.

## Blocked
- The v1.1 backlog (per-verse OG images, regional languages, self-hosted fonts, portrait card) is deliberately on hold until the site reaches 50 organic card-shares/week — waiting on real-world traction.
