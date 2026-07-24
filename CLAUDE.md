# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & deploy

- `node build.js` — the only command. Zero dependencies, no npm install, Node 18+. No tests or lint.
- Output goes to `dist/` (gitignored). Regenerate after any change to `build.js`, `data/`, `src/`, or `static/` — everything in `dist/` is derived.
- Deploy = push to `main`. Cloudflare Pages runs `node build.js` and publishes `dist/` at geetasar.com. There is no staging environment.
- **Cache busting**: `style.css?v=N` and `card.js?v=N` are hardcoded in `build.js`'s templates. Bump the version when editing those files or clients keep the stale copy.

## Architecture

Static site, zero backend. `build.js` is the entire generator: inline template literals produce the page shell, the index, ~700 verse pages (`/verse/{c}-{v}/`), the chapters index (`/gita/`), about, 404, sitemap, and one JSON per verse at `/v/{id}.json`.

Data flow: `data/verses.json` (701 verses: `id`, `c` chapter, `v` verse, `sa` Sanskrit, `tr` transliteration, `hi` Hindi, `en` English) → build augments each verse with `hn` (Hinglish) → pages + per-verse JSON.

- **Hinglish is generated, not stored.** `hinglish()` in `build.js` transliterates the Hindi meaning to casual Roman script using schwa-deletion heuristics (final/medial inherent-a dropping, nasal-coda protection, ज्ञ→gy, fused-postposition splitting). It's imperfect by design; fix bad words by adding them to the `HN_WORDS` exception map, not by complicating the algorithm.
- **`src/card.js`** renders the shareable 1080×1080 card on canvas client-side and handles Web Share / download. Verse pages inline the verse as `window.__VERSE__`; the index fetches today's verse from `/v/{id}.json`.
- **Daily verse**: `todaysId()` in `card.js` = days since 1 Jan 2026 (IST) mod verse count. Same verse worldwide, no server. **Never change the epoch** — it resets the sequence for everyone.
- **Language toggle scope**: site chrome is English-only; the English/हिन्दी/Hinglish toggle changes the *card* language only (meaning line + reference line; Sanskrit shloka always stays).
- **Safari canvas quirk**: WebKit mis-centers `textAlign:'center'` for Devanagari, so `card.js` centers manually via `measureText` (`fillCentered`). Keep that pattern for any new canvas text.

## Styling

`src/style.css` has two zones separated by a banner comment (~line 317): above it is the drop-in "night-sky theme v2" design CSS (source of truth is a claude.ai/design project — see project memory); below it are site components adapted to the theme. Add component styles below the marker; avoid editing the theme block ad hoc.

## Content licensing

Sanskrit is public domain; English translation (Shri Purohit Swami) is public domain in India. The Hindi translation (Swami Ramsukhdas) comes from the open [gita/gita](https://github.com/gita/gita) dataset — verify its status independently before ever adding paid features (see README).

## Product guardrail

README gates the v1.1 backlog (per-verse OG images, regional languages, self-hosted fonts, Instagram 4:5 card) behind traction: 50 organic card shares/week. Don't build those unprompted.

## Status file
This repo has a STATUS.md at the root. Update it before every commit:
- Set `updated:` to today's date.
- Rewrite `## Now` if this change moved where the project stands.
- Remove any `## Next` item this commit finishes, add whatever comes after it,
  keep the list at three.
- Add or clear `## Blocked` items.
Keep the frontmatter and the heading names exactly as they are. A parser reads
them.
