# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & deploy

- `node build.js` — the only command. Zero dependencies, no npm install, Node 18+. No tests or lint.
- `node build.js` runs `tools/validate-themes.js` first and **exits 1 without writing anything** if a theme fails validation. Run it standalone with `node tools/validate-themes.js`.
- Output goes to `dist/` (gitignored). Regenerate after any change to `build.js`, `data/`, `src/`, or `static/` — everything in `dist/` is derived.
- Deploy = push to `main`. Cloudflare Pages runs `node build.js` and publishes `dist/` at geetasar.com. There is no staging environment.
- **Cache busting**: `style.css?v=N` and `card.js?v=N` are hardcoded in `build.js`'s templates. Bump the version when editing those files or clients keep the stale copy.

## Architecture

Static site, zero backend. `build.js` is the entire generator: inline template literals produce the page shell, the index, ~700 verse pages (`/verse/{c}-{v}/`), the chapters index (`/gita/`), about, 404, sitemap, one JSON per verse at `/v/{id}.json`, and the thematic layer (`/themes/`, `/theme/{slug}/`).

**Three kinds of code, and they don't mix:** `src/` is browser code that is *copied* into `dist/` (never `require()` it); `lib/` is Node modules that are *required* by `build.js` and `tools/`; `tools/` is standalone runnable scripts. Zero-dependency means no npm packages — local modules are fine.

Data flow: `data/verses.json` (701 verses: `id`, `c` chapter, `v` verse, `sa` Sanskrit, `tr` transliteration, `hi` Hindi, `en` English) → build augments each verse with `hn` (Hinglish) → pages + per-verse JSON.

- **`content/verses/` is generated, and committed.** `node tools/build-verse-index.js` rebuilds all 701 files from `data/verses.json` — **regenerate and commit whenever `verses.json` changes**, or the CMS verse picker at `/admin/` goes stale. Each file is `content/verses/{c}-{v}.json` → `{ id: "2-47", ref: "2.47", en: <120-char English snippet> }`; ~115 KB total. The script also deletes files for verses that no longer exist. Two reasons it's one-file-per-verse rather than one index file: Sveltia reads the repo through GitHub's GraphQL API, which truncates blobs over 512,000 bytes (`verses.json` is ~732 KB — Devanagari is 3 bytes/char — and arrives cut mid-string), and a relation widget against a *folder* collection uses flat field names instead of list wildcards, which is the better-supported path. **Never point the CMS at `verses.json` itself.** A theme's `verseIds` holds these ids, so the join is ``verses.find((v) => `${v.c}-${v.v}` === id)``.
- **Thematic layer** — `content/themes/{slug}.json`, authored in the CMS at `/admin/`, one page per published theme at `/theme/{slug}/` plus a grouped index at `/themes/`. **`docs/theme-prd.md` is the source of truth** for the schema, the slug rule and the editorial standard — read it before changing anything here. Data flow: `content/themes/*.json` → `lib/themes.js` (`normaliseTheme` + `resolveVerses`, joined against `data/verses.json`) → `tools/validate-themes.js` → `build.js` renders the records the validator returned. Build and validator read each theme file exactly once through the same code, so they cannot disagree. Verses render in the curator's order — **never re-sort them**. `published: false` is the default and drafts render nothing.
- **Slug rule lives in exactly one place: `canonicalSlug()` in `lib/slug.js`.** `/theme/{slug}/` is a permanent public URL and there is no redirect layer. Lowercase, `a-z0-9-` only, spaces/underscores → hyphen, accented Latin transliterated (é→e), collapsed hyphens, no leading/trailing hyphen, never purely numeric, max 60 chars. **Never re-implement it** — `build.js`, the validator and the migration script all import it. `SLUG_PATTERN` from the same file is copied verbatim into the `id` field's `pattern:` in `static/admin/config.yml` so the CMS rejects bad slugs at authoring time; the validator warns if the two drift apart. A slug that had to be normalised prints a loud build warning naming the raw id and the result.
- **Validator (`tools/validate-themes.js`)** — FAILs (exit 1, build blocked) on malformed JSON, duplicate or unusable slugs, an unknown `type`, a `verseId` missing from `verses.json`, duplicate `verseIds`, and — for published themes only — a missing `label.en`/`intro.en`, fewer than 3 verses, or a duplicate `label.en` within a cloud. WARNs on a thin explanation, a verse used in >4 themes, >15 verses, a missing banner file, a normalised slug, filename ≠ slug, and legacy flat fields. Structural rules apply to drafts too; quality rules only to `published: true`. Failing the build is safe — Cloudflare Pages keeps the previous deployment serving.
- **Multilingual fields are nested, not suffixed.** `label`, `blurb`, `intro`, `explanation` are `{ en, hi }` objects. **Only `en` is required**; every other language falls back to English at build time via `pick(field, lang)` in `lib/themes.js`, so a section never renders empty. The one exception is `label.hi`, a secondary Devanagari ornament that renders only when authored. **Adding a language = one entry in `LANGS` plus one subfield in `config.yml`** — never new fields on theme files. Flat `label_en`/`label_hi` files still load through a compatibility shim that WARNs; clear them with `node tools/migrate-theme-fields.js`.
- **Theme banners go to `static/theme-images/`, never `static/themes/`** — `static/` is copied to the site root, so `static/themes/` would clobber the generated `/themes/` index page.
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
