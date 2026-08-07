# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & deploy

- `node build.js` — the only command. Zero dependencies, no npm install, Node 18+. No tests or lint.
- `node build.js` runs `tools/validate-verses.js` and then `tools/validate-themes.js` before anything else, and **exits 1 without writing anything** if either fails. Run them standalone with `node tools/validate-verses.js` / `node tools/validate-themes.js`.
- Output goes to `dist/` (gitignored). Regenerate after any change to `build.js`, `content/`, `data/`, `src/`, or `static/` — everything in `dist/` is derived.
- Deploy = push to `main`. Cloudflare Pages runs `node build.js` and publishes `dist/` at geetasar.com. There is no staging environment.
- **Cache busting**: `style.css?v=N` and `card.js?v=N` are hardcoded in `build.js`'s templates. Bump the version when editing those files or clients keep the stale copy.

## Architecture

Static site, zero backend. `build.js` is the entire generator: inline template literals produce the page shell, the index, ~700 verse pages (`/verse/{c}-{v}/`), the chapters index (`/gita/`), about, 404, sitemap, one JSON per verse at `/v/{id}.json`, the assembled `/verses.json`, and the thematic layer (`/themes/`, `/theme/{slug}/`).

**Three kinds of code, and they don't mix:** `src/` is browser code that is *copied* into `dist/` (never `require()` it); `lib/` is Node modules that are *required* by `build.js` and `tools/`; `tools/` is standalone runnable scripts. Zero-dependency means no npm packages — local modules are fine.

Data flow: `content/verses/*.json` → `lib/verses.js` (`readVerseDir` + `assembleVerses`) → `tools/validate-verses.js` → build augments each verse with `hn` (Hinglish) and `motif` → pages + per-verse JSON + `dist/verses.json`.

- **`content/verses/` is the verse data — editable source, not generated.** 701 files, `content/verses/{c}-{v}.json`, ~757 KB total, each `{ id: "2-47", ref: "2.47", c, v, sa, tr, hi, en }`. They are authored in the CMS at `/admin/` (`create: false`, `delete: false`) and **there is no `data/verses.json`** — it was deleted, because two copies of the same 701 verses with no sync mechanism is how they drift apart. `build.js` assembles them in memory and also writes `dist/verses.json`; nothing on the site fetches that file, it exists so the whole corpus is inspectable and diffable as one artifact. One file per verse because Sveltia reads the repo through GitHub's GraphQL API, which truncates blobs over 512,000 bytes (the combined verses are ~757 KB — Devanagari is 3 bytes/char — and would arrive cut mid-string), and because a relation widget against a *folder* collection uses flat field names instead of list wildcards. A theme's `verseIds` holds the `{c}-{v}` ids, so the join is ``verses.find((v) => `${v.c}-${v.v}` === id)``.
- **Verse order is load-bearing, and alphabetical order is wrong.** `assembleVerses()` sorts **numerically by chapter then verse** and derives each verse's numeric `id` from its position in the result. `readdirSync` returns byte order — `1-1, 1-10, 1-100, 1-11` — which would renumber almost every verse. That numeric id is the `/v/{id}.json` filename `card.js` fetches, and `todaysId()` is `days-since-epoch mod count`, so a reshuffle silently changes the day's verse for every reader with nothing in the output looking broken. **Never sort verse files by filename.** The count is pinned at `EXPECTED_COUNT = 701` in `lib/verses.js` for the same reason; changing it re-maps every future date.
- **Verse validator (`tools/validate-verses.js`)** — FAILs (exit 1, build blocked) on malformed JSON, an empty `sa` or `en`, `c`/`v` not matching the filename, `id`/`ref` not matching `c`/`v`, a duplicate verse, or a count other than 701. WARNs on an empty `tr`/`hi`/generated-`hn`, a `tr` with no Latin letters (Devanagari in the transliteration column — 11.19), and an `en` that is placeholder text or under 25 characters (1.7 and 16.6 both say "No changes needed."). The summary line prints those counts as a correction worklist.
- **Thematic layer** — `content/themes/{slug}.json`, authored in the CMS at `/admin/`, one page per published theme at `/theme/{slug}/` plus a grouped index at `/themes/`. **`docs/theme-prd.md` is the source of truth** for the schema, the slug rule and the editorial standard — read it before changing anything here. Data flow: `content/themes/*.json` → `lib/themes.js` (`normaliseTheme` + `resolveVerses`, joined against the assembled verses) → `tools/validate-themes.js` → `build.js` renders the records the validator returned. Build and validator read each theme file exactly once through the same code, so they cannot disagree. Verses render in the curator's order — **never re-sort them**. `published: false` is the default and drafts render nothing.
- **Slug rule lives in exactly one place: `canonicalSlug()` in `lib/slug.js`.** `/theme/{slug}/` is a permanent public URL and there is no redirect layer. Lowercase, `a-z0-9-` only, spaces/underscores → hyphen, accented Latin transliterated (é→e), collapsed hyphens, no leading/trailing hyphen, never purely numeric, max 60 chars. **Never re-implement it** — `build.js`, the validator and the migration script all import it. `SLUG_PATTERN` from the same file is copied verbatim into the `id` field's `pattern:` in `static/admin/config.yml` so the CMS rejects bad slugs at authoring time; the validator warns if the two drift apart. A slug that had to be normalised prints a loud build warning naming the raw id and the result.
- **Theme validator (`tools/validate-themes.js`)** — FAILs (exit 1, build blocked) on malformed JSON, duplicate or unusable slugs, an unknown `type`, a `verseId` with no file in `content/verses/`, duplicate `verseIds`, and — for published themes only — a missing `label.en`/`intro.en`, fewer than 3 verses, or a duplicate `label.en` within a cloud. WARNs on a thin explanation, a verse used in >4 themes, >15 verses, a missing banner file, a normalised slug, filename ≠ slug, and legacy flat fields. Structural rules apply to drafts too; quality rules only to `published: true`. Failing the build is safe — Cloudflare Pages keeps the previous deployment serving.
- **Multilingual fields are nested, not suffixed.** `label`, `blurb`, `intro`, `explanation` are `{ en, hi }` objects. **Only `en` is required**; every other language falls back to English at build time via `pick(field, lang)` in `lib/themes.js`, so a section never renders empty. The one exception is `label.hi`, a secondary Devanagari ornament that renders only when authored. **Adding a language = one entry in `LANGS` plus one subfield in `config.yml`** — never new fields on theme files. Flat `label_en`/`label_hi` files still load through a compatibility shim that WARNs; clear them with `node tools/migrate-theme-fields.js`.
- **Theme banners go to `static/theme-images/`, never `static/themes/`** — `static/` is copied to the site root, so `static/themes/` would clobber the generated `/themes/` index page.
- **Hinglish is generated, not stored.** `hinglish()` in `lib/hinglish.js` transliterates the Hindi meaning to casual Roman script using schwa-deletion heuristics (final/medial inherent-a dropping, nasal-coda protection, ज्ञ→gy, fused-postposition splitting). It's imperfect by design; fix bad words by adding them to the `HN_WORDS` exception map in that file, not by complicating the algorithm. There is no `hn` field on a verse file — it is derived from `hi` on every build.
- **`src/card.js`** renders the shareable 1080×1080 card on canvas client-side and handles Web Share / download. Verse pages inline the verse as `window.__VERSE__`; the index fetches today's verse from `/v/{id}.json`.
- **Daily verse**: `todaysId()` in `card.js` = days since 1 Jan 2026 (IST) mod verse count, `+1`, fetched from `/v/{id}.json`. Same verse worldwide, no server. **Never change the epoch** — it resets the sequence for everyone. The verse *order* is the other half of that promise; see the load-bearing note above.
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
