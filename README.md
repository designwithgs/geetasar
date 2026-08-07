# GeetaSar — geetasar.com

One Bhagavad Gita shloka a day. Sanskrit + Hindi + English, with a clean 1080×1080 card anyone can share on WhatsApp. Static site, zero backend, zero running cost.

## Structure

```
site/
  build.js          # zero-dependency Node build script
  content/verses/   # 701 verses, one JSON each — sanskrit, transliteration,
                    #   hindi, english. The source of truth, editable at /admin/
  content/themes/   # curated theme pages, authored in the CMS at /admin/
  data/chapters.json
  lib/              # shared Node modules (verse set, hinglish, slug, themes)
  src/style.css     # site styles
  src/card.js       # canvas card renderer + Web Share
  tools/            # standalone scripts (verse validator, theme validator)
  static/           # favicon, og.png, /admin/ CMS
  dist/             # generated output (~706 pages + 701 verse JSONs)
```

## Build

```
node build.js
```

Output goes to `dist/`. No npm install needed. Node 18+.

The build validates `content/verses/` and then `content/themes/` before anything else, and
**exits without writing anything** if either is broken — an emptied Sanskrit or English field, a
verse file whose chapter no longer matches its filename, a duplicate theme slug, a verse id that
doesn't exist, a published theme with no label. Run the checks on their own with
`node tools/validate-verses.js` and `node tools/validate-themes.js`.

The verse validator also prints a correction worklist: the public-domain source dataset has real
errors in it (1.7 and 16.6 both read "No changes needed."; 11.19 has Devanagari in the
transliteration field), and those are fixed by editing the verse in the CMS.

## Themes and the CMS

Beyond the daily card, the site has a thematic layer: curated collections of verses on one
idea, at `/theme/{slug}/`, listed at `/themes/`. Each is a JSON file in `content/themes/`,
authored through [Sveltia CMS](https://github.com/sveltia/sveltia-cms) at
[geetasar.com/admin/](https://geetasar.com/admin/) — no build step, no backend; saving commits
to `main` and Cloudflare rebuilds.

Theme URLs are permanent and there is no redirect layer, so slugs are validated in two places
(the CMS field and the build) from one shared rule in `lib/slug.js`.

**Read [`docs/theme-prd.md`](docs/theme-prd.md) before authoring or changing a theme** — it
carries the field schema, the slug rules and the editorial standard for what is publishable.
[`docs/content-log.md`](docs/content-log.md) tracks which themes exist and what state they're in.

## Deploy (Cloudflare Pages, free)

1. Push this folder to a GitHub repo (public fits the non-profit framing).
2. Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git.
3. Build command: `node build.js` · Build output directory: `dist`.
4. Deploy. You get `*.pages.dev` immediately.

## Point geetasar.com at it

Option A (recommended): move DNS to Cloudflare.
1. Cloudflare → Add site → geetasar.com → free plan. Note the 2 nameservers.
2. GoDaddy → geetasar.com → Nameservers → change to Cloudflare's.
3. In the Pages project → Custom domains → add geetasar.com and www.

Option B (keep GoDaddy DNS): add a CNAME for `www` → `<project>.pages.dev` and follow Cloudflare's instructions for the apex. Option A is less fiddly.

## Analytics

In `build.js`, the `shell()` function has two commented snippets (Umami and GA4).
Uncomment ONE, paste your ID, rebuild. Card shares and downloads are tracked as
`card-share` / `card-download` events for both.

The only number that matters for validation: card shares per week. Target: 50
organic before building anything else.

## How the daily verse works

`card.js` computes days since 1 Jan 2026 in IST, mod 701. Same verse for the
whole world each day ("today's verse from India"). No cron, no server. Don't
change the epoch or the sequence resets for everyone.

## Content licensing — read before ever charging money

- Sanskrit text: public domain, eternal, no issue.
- Dataset: [gita/gita](https://github.com/gita/gita), published under The
  Unlicense (public domain dedication).
- English translation: Shri Purohit Swami (1935; author d. 1946 — public domain
  in India since 2007).
- Hindi translation: Swami Ramsukhdas. Included in the open dataset, but if you
  ever add paid features, verify this translation's status independently or swap
  in a commissioned/verified-open Hindi rendering first.

## v1.1 backlog (do NOT build until 50 shares/week)

- Per-verse OG images (pre-render at build with node-canvas or satori)
- Regional languages (Tamil, Telugu, Gujarati — dataset needs sourcing)
- Self-hosted fonts (drop Google Fonts CDN)
- 4:5 portrait card variant for Instagram
