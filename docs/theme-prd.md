# PRD & Implementation Doc — Thematic Layer

**Feature:** Curated theme pages — `/theme/{slug}/` — the reason to come back between daily cards.
**Status:** Shipped (v1), hardened. This doc is the source of truth for the theme schema, the slug rule and the editorial standard.
**Surfaces:** The themes index (`/themes/`), one page per published theme (`/theme/{slug}/`), and the CMS at `/admin/`.
**Code:** `lib/slug.js` (the slug rule), `lib/themes.js` (schema + fallback), `tools/validate-themes.js` (the gate), `build.js` (rendering), `static/admin/config.yml` (authoring).

---

## 1. Background & problem

The shareable card is the *acquisition* loop: a verse travels on WhatsApp and brings someone
to geetasar.com. It gives them exactly one verse, chosen by the calendar, and no reason to
return before tomorrow.

People do not arrive at the Gita wanting verse 2.47. They arrive carrying something — a
death, a decision they cannot make, a job they hate, a word they half-remember from a
discourse. What they type is "gita on anger", "what does karma actually mean", "how to stop
worrying about results". A chapter index cannot answer any of those.

The thematic layer is the answer surface: a human-curated sequence of verses on one idea,
framed by an intro and closed by an essay. It is the half of the site that can be found by
search rather than by forward, and the half that gives a returning visitor somewhere to go.

It is deliberately **additive**. Theme pages carry no card canvas; each verse links out to its
existing `/verse/{c}-{v}/` page, where the card and the share buttons already live. The
thematic layer feeds the card loop rather than competing with it.

## 2. Goals & non-goals

**Goals**

1. A reader with a real problem lands on a page that speaks to it, and reads the sequence
   top to bottom because it was ordered by a person.
2. Every theme page is a plausible search destination — a page worth indexing, not a
   keyword-matched list of verses.
3. Authoring happens in the CMS at `/admin/` with no code change and no deploy step.
4. The layer scales to hundreds of themes and several languages without the schema changing
   shape.
5. A bad theme cannot reach production silently.

**Non-goals**

- No card canvas on theme pages. Sharing happens on the verse page.
- No search, no filtering, no tag UI in v1. `/themes/` is a plain grouped list.
- No automated theme generation. A theme is an editorial artifact; keyword matching is
  precisely what this layer exists to beat.
- No backend, no runtime dependencies. Themes are JSON files rendered at build time.
- No redirects. There is no redirect layer, which is why the slug rule is strict.

## 3. Success metric

There is **no numeric gate on this layer yet**, and inventing one before there are enough
pages to measure would be noise. The honest v1 metric is **themes published to the editorial
standard in section 10** — a small number of pages that genuinely answer their question.

Leading indicator once ~10 themes exist: **organic search entrances to `/theme/*`**, and the
`/theme/` → `/verse/` click-through that hands a reader to the card loop.

The card's 50-organic-shares/week gate on the v1.1 backlog (see README) is unaffected by this
layer and still governs that backlog.

## 4. The three clouds

Every theme has a `type`, which files it into one of three groups on `/themes/`. The clouds
are not tags — they are three different *reasons a person arrives*, and a theme belongs to
exactly one.

| `type` | Label on `/themes/` | What belongs in it | Examples |
|---|---|---|---|
| `term` | Terms | A word from the Gita's own vocabulary that a reader has met and wants defined **as the text uses it** | karma, dharma, moha, sthitaprajna, yoga |
| `modern` | Modern life | A contemporary situation the Gita is not phrased in terms of, where the connection is the curator's argument | burnout, comparison, social media, parenting, money anxiety |
| `question` | Questions | Something a person would actually type or say, answered in the reader's words | "why do bad things happen to good people", "does the Gita permit anger" |

The distinction matters editorially. A `term` page owes the reader **fidelity** — it must not
drift from what the text means. A `modern` page owes the reader **honesty about the leap** —
say plainly that the Gita does not discuss burnout, then show what it does say about action
and attachment. A `question` page owes the reader **an actual answer**, in the first paragraph,
not a preamble.

`other` exists in `build.js` as a defensive bucket only. The validator FAILs on any type
outside the three, so it should always be empty.

## 5. Field schema

One JSON file per theme in `content/themes/{slug}.json`, authored in the CMS at `/admin/`.

| Field | Type | Required | Role |
|---|---|---|---|
| `id` | string | yes | The permanent slug. Becomes `/theme/{id}/`. See section 6. |
| `label` | `{en, hi}` | `en` yes | The theme's name. `label.en` is the page `<h1>` and the `/themes/` link text; `label.hi` renders as a secondary Devanagari span beside it. |
| `type` | `term` \| `modern` \| `question` | yes | Which cloud. See section 4. |
| `blurb` | `{en, hi}` | to publish well | **One line.** Becomes the page's `<meta name="description">` and the hover title on the `/themes/` index. Keep under ~155 characters or search engines truncate it. |
| `intro` | `{en, hi}` | `en` to publish | **Frames the verse sequence.** Renders directly ABOVE the verses. A short paragraph telling the reader what they are about to read and why these verses, in this order. Plain text, no markdown. |
| `image` | string | no | Optional banner under the title. Uploads to `static/theme-images/`, public path `/theme-images/…`. |
| `image_alt` | string | no | Alt text for the banner. |
| `explanation` | `{en, hi}` | to publish | **The long-form essay.** Renders LAST, BELOW the verses. Markdown; may carry links and embeds. This is the part that makes the page worth indexing. |
| `verseIds` | `["2-47", …]` | 3+ to publish | The curated verses, as `{chapter}-{verse}` — the same ids as `/verse/{c}-{v}/`. **Rendered in the authored order and never re-sorted.** |
| `published` | boolean | defaults `false` | Only `true` renders a page. Publishing is a deliberate act. |

### 5.1 Multilingual shape and the English fallback

Language-bearing fields are **nested objects**, never suffixed siblings:

```json
"label": { "en": "Karma", "hi": "कर्म" },
"blurb": { "en": "What the Gita actually means by karma." }
```

The old flat shape (`label_en`, `label_hi`) multiplied fields by languages across every file.
Nesting means **adding Tamil later is one entry in `LANGS` in `lib/themes.js` and one subfield
in `config.yml`** — no new fields on any theme file, no change to `build.js`.

- **Only `en` is required.** Every other language falls back to English at build time through
  `pick(field, lang)` in `lib/themes.js`. A section is never rendered empty.
- **`label.hi` is the one deliberate exception.** It is a secondary Devanagari ornament beside
  the English title, so it renders only when genuinely authored — falling back would print the
  English label twice.
- Site chrome is English-only today (same rule as the card: the language toggle affects the
  card, not the page), so `en` is what renders. The `hi` values are stored now so a Hindi site
  is a rendering change rather than a content migration.

**Legacy shim.** Files written before the migration used flat `label_en` / `label_hi` and bare
strings for `blurb`/`intro`/`explanation`. `normaliseTheme()` folds those into the nested shape
and the validator WARNs. This is compatibility only, so a mid-flight CMS save cannot block a
deploy — it is not a supported shape. Clear it with `node tools/migrate-theme-fields.js`.

### 5.2 Three text fields, three jobs

The most common authoring mistake is writing the same thing three times. They are different:

- **`blurb`** — one line, for someone who has *not* opened the page. It appears in search
  results and on hover. It should make the page's promise concrete.
- **`intro`** — for someone who has just opened it and is about to read verses. It frames the
  sequence: what these verses are, why this order, what to watch for.
- **`explanation`** — for someone who has *finished* the verses. It is the argument, the
  context, the "so what". It carries the page's SEO weight and is the difference between a
  verse list and a page worth existing.

## 6. Slug rules — the permanent commitment

A theme publishes at `/theme/{slug}/`. Once indexed that URL can be linked, bookmarked and
shared, **and this site has no redirect layer**. A renamed slug is a dead link forever.

The rule therefore exists **exactly once**, as `canonicalSlug()` in `lib/slug.js`, and is used
by `build.js`, `tools/validate-themes.js` and `tools/migrate-theme-fields.js`. Never
re-implement it.

Given raw input, in order:

1. Decompose (NFD) and drop combining marks, so **accented Latin transliterates rather than
   being stripped**: `é` → `e`, `Ānanda` → `ananda`.
2. **Lowercase always.** Uppercase input is silently lowercased, not rejected.
3. **Spaces and underscores become hyphens.**
4. **Strip everything else** — punctuation, quotes, Devanagari, emoji.
5. **Collapse consecutive hyphens** into one.
6. **Never start or end with a hyphen.**
7. **Max 60 characters** (then re-trim any trailing hyphen).
8. **Never purely numeric** — a numeric slug reads as an id, not a name. Returns empty.

Allowed characters in the result: `a-z`, `0-9`, `-`.

Applied in two places, on purpose:

**a) `build.js`** normalises when generating the page path, so a bad slug in a theme file can
never produce a bad URL. **If the normalised slug differs from the raw `id`, the build prints a
loud warning naming both** — silent normalisation is exactly how `"Affection"` became
`/theme/affection/` without anyone deciding it should.

**b) The CMS.** `static/admin/config.yml` puts a `pattern:` on the `id` field that rejects
anything not *already* canonical, with the rule spelled out in the error message. Catching it
at authoring time is better than catching it at build time. The pattern is copied verbatim from
`SLUG_PATTERN` in `lib/slug.js`; **`validate-themes.js` compares the two and warns if they have
drifted**, because a CMS that accepts what the build rewrites is the whole failure mode.

One narrow fallback: if a file has **no** `id`, the slug comes from the filename. If a file has
an `id` that normalises to nothing (`"मोह"`, `"404"`), that is a **FAIL**, not a fallback — a
URL nobody chose must never become permanent.

## 7. Page structure and section order

`/theme/{slug}/`, top to bottom. Order is fixed; it is the reading experience.

1. **Eyebrow** — the cloud name (`Term` / `Modern` / `Question`).
2. **`<h1>`** — `label.en`, with `label.hi` as a secondary Devanagari span when present.
3. **Banner** — `image` with `image_alt`, when set.
4. **Blurb** — one line, `.theme-blurb`.
5. **Ornament** — the site's gold divider.
6. **Intro** — `.theme-intro`, plain text, frames what follows.
7. **The verses** — in the curator's order. Each is reference · Sanskrit · a
   Transliteration & Hinglish `<details>` · English meaning · Hindi meaning · an
   **Open & share this shloka →** link to `/verse/{c}-{v}/`.
8. **Ornament.**
9. **Explanation** — `.theme-essay`, rendered markdown.
10. **Pager** — ← All themes · All Chapters.

`/themes/` is a plain list grouped by cloud, in the order Terms → Modern life → Questions,
alphabetical by `label.en` within each group. Each entry shows the label, the Hindi label when
present, and the verse count. There is no tag-cloud UI yet.

`<meta name="description">` is `blurb.en`, falling back to `intro.en`, falling back to a
generated "N Bhagavad Gita shlokas on {label}" line — truncated to 155 characters.

## 8. Technical implementation

### 8.1 Data flow

```
content/themes/*.json ──┐
                        ├─▶ lib/themes.js  normaliseTheme() ──▶ { slug, label{}, …, verseIds }
data/verses.json     ───┘                  resolveVerses()  ──▶ verses in curator order
                                                    │
                              tools/validate-themes.js ──FAIL──▶ exit 1, nothing written
                                                    │ pass
                                     build.js ──▶ dist/theme/{slug}/index.html
                                              └─▶ dist/themes/index.html + sitemap.xml
```

`build.js` calls `validate({ verses })` as its first step, **before `dist/` is removed**, and
renders from `themeReport.themes` — the same normalised records the validator judged. Build and
validator read every theme file exactly once, through the same code, so they cannot disagree
about what a theme means.

### 8.2 Module boundaries

The repo has three kinds of code and they do not mix:

- **`src/`** — browser code, **copied** into `dist/` (`style.css`, `card.js`, `reveal.js`).
  Never `require()` anything from here.
- **`lib/`** — Node modules, **required** by `build.js` and `tools/`. Local files only; the
  zero-dependency rule means no npm, not no modules.
- **`tools/`** — runnable scripts, each standalone via `node tools/x.js`.

### 8.3 Markdown subset

`explanation` renders through `mdToHtml()` in `build.js` — a deliberately small function, not a
library, because the repo stays zero-dependency. It supports headings (`#` becomes `<h2>`; the
page `<h1>` is the theme label), paragraphs, `-`/`*` lists, bold, italic, inline code and links.
Raw HTML blocks pass through **only** when they open with an allow-listed embed tag
(`iframe`, `img`, `blockquote`, `figure`, `video`, `audio`, `div`, `p`, `br`, `hr`, `table`);
anything else is escaped and renders as literal text. Link hrefs must match
`https?:` / `mailto:` / `/` / `#`, so a `javascript:` href degrades to plain text.

`blurb` and `intro` are plain text — escaped, paragraph breaks preserved, no markdown.

## 9. Validation — what is enforced, and why

`node tools/validate-themes.js` standalone; runs automatically as the first step of
`node build.js`.

**Why a hard gate exists:** there is no CI, no test suite and no staging environment. Deploy is
a push to `main` — *including the pushes Sveltia CMS makes when someone hits Save*. Without a
gate, a duplicate slug or a dangling verseId reaches geetasar.com unnoticed. When a build fails,
Cloudflare Pages keeps the previous deployment serving, so blocking is the safe direction: the
site stays up, it just does not take the bad change.

### 9.1 FAIL — non-zero exit, blocks the build

| Rule | Scope | Why |
|---|---|---|
| Malformed JSON | all | Nothing else can be trusted in that file. |
| Duplicate slug after normalisation | all | Two files, one URL. One would silently win. |
| Slug normalises to nothing usable | all | A URL nobody chose must not become permanent. |
| `type` not `term`/`modern`/`question` | all | The cloud grouping is the index's only structure. |
| A `verseId` absent from `data/verses.json` | all | A verse the reader was promised, silently dropped. |
| Duplicate `verseIds` within a theme | all | The same verse twice in a curated sequence is an authoring slip. |
| `published` with no `label.en` | published | Every theme needs an English name. |
| `published` with no `intro.en` | published | An unframed verse list is not a page. |
| `published` with fewer than 3 verses | published | Fewer than three is a quote, not a sequence. |
| Duplicate `label.en` in the same cloud | published | Two entries the reader cannot tell apart. |

**Structural rules apply to drafts too.** A slug collision is a permanent-URL problem whether
or not the theme is live, and discovering it after publication is too late. **Quality rules
gate on `published: true` only**, because half-finished drafts are the normal working state.

### 9.2 WARN — prints, build continues

| Rule | Why |
|---|---|
| `published` with `explanation.en` under 200 characters | A page this thin does not justify existing. |
| The same verse in more than 4 themes | Dilution: a verse that is everywhere means nothing anywhere. |
| More than 15 verses in one theme | The page stops being readable top to bottom. |
| `image` set but the file is missing under `static/theme-images/` | The banner would 404. |
| A slug that had to be normalised | Silent normalisation hides mistakes. Prints raw id and result. |
| Filename basename ≠ slug | `sorrow.json` publishing at `/theme/affection/` is how confusion starts. |
| Legacy flat fields present | Re-save in `/admin/`, or run the migration script. |
| `config.yml` slug pattern no longer matches `lib/slug.js` | The CMS and the build would disagree about a valid id. |

**A note on `static/theme-images/`, not `static/themes/`.** `build.js` copies `static/` verbatim
to the site root, so `static/themes/` would land on `dist/themes/` and clobber the generated
themes index page. Banners are namespaced to `theme-images` for exactly that reason.

## 10. Editorial standard — what makes a theme publishable

The validator checks that a theme is *well-formed*. Nothing automatic can check that it is
*good*. This section is the standard; `published: true` is a claim that the page meets it.

**A coherent verse sequence, readable top to bottom.** The verses are in an order because a
person chose that order. There should be a reason the second verse follows the first — an
escalation, a turn, an answer to what the first raised. If the order could be shuffled without
loss, it is a list, not a sequence, and it is not ready.

**A label that honestly matches the verses.** If the page is called "anger" and the verses are
mostly about desire, either the verses are wrong or the label is. Do not stretch a label to
cover what you happened to find.

**An explanation that justifies the page existing.** Ask: if someone read only the verses,
what would they still be missing? Write that. If the answer is "nothing", the page does not
need to exist. Under 200 characters the validator warns, but 200 characters is a floor for a
warning, not a target — a real explanation is several paragraphs.

**Every verse verified against its full text.** This is the rule that matters most, and the
easiest to violate:

> **Keyword search finds where a WORD appears, not where an IDEA is taught.**

Searching `verses.json` for "anger" returns verses that contain the English translator's word
"anger". It misses 2.62–2.63, where the mechanism of anger is actually explained, if the
translator chose "wrath". It returns verses where anger appears in a list of things being
dismissed, teaching nothing about it. And translation choices vary — the word you searched is
Shri Purohit Swami's, not the Sanskrit.

So: **read each candidate verse in full — Sanskrit, Hindi and English — before it enters a
theme.** Ask whether this verse *teaches* the idea or merely *mentions* it. A five-verse theme
where every verse teaches beats a fifteen-verse theme where four do. This is also why the
validator warns above 15 verses and why a verse in more than 4 themes is a smell: both are
usually symptoms of search-and-paste.

**`published: false` is the default, and publishing is a deliberate act.** Draft freely; the
build silently ignores drafts. Flip `published` only when the page would survive a stranger
arriving on it from Google with a real problem.

## 11. Out of scope / future

- **Tag-cloud UI on `/themes/`.** The index is a plain grouped list. A cloud needs enough
  themes to be worth looking at.
- **Per-theme OG images.** Same blocker as the card's: pre-rendering would end the
  zero-dependency claim. Decide deliberately.
- **Hindi (and regional) rendering of theme pages.** The schema already holds the content; what
  is missing is a language-switched site chrome, which is a separate decision from the card's
  language toggle.
- **Cross-linking between themes**, and theme links on verse pages ("this verse appears in…").
- **Search or filtering.** Not until there are enough themes for it to beat scrolling.

## 12. Acceptance checklist for theme-layer changes

- [ ] `node tools/validate-themes.js` exits 0; every warning is understood and accepted.
- [ ] `node build.js` runs the validator first and prints its report.
- [ ] Slug logic still lives **only** in `lib/slug.js` — no second implementation anywhere.
- [ ] The `pattern:` in `static/admin/config.yml` still matches `SLUG_PATTERN` (the validator
      warns if not).
- [ ] No published URL changed. `/theme/{slug}/` paths in `dist/` and `sitemap.xml` are the
      same as before, or the change was an explicit decision.
- [ ] Existing pages are byte-identical: `diff -r` the old and new `dist/` for the 701 verse
      pages, `/`, `/gita/`, `/about/`.
- [ ] A new language means one entry in `LANGS` plus one subfield in `config.yml` — nothing else.
- [ ] `card.js`, `data/verses.json` and the daily-verse epoch are untouched.
- [ ] `docs/content-log.md` reflects any theme added, drafted or published.
