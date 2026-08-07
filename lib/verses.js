/* Reading and assembling content/verses/*.json. Zero dependencies. Node 18+.

   content/verses/ IS the verse data — one file per verse, editable in the CMS
   at /admin/. There is no data/verses.json any more; two copies of the same
   701 verses with no sync mechanism is how they drift apart.

   One file per verse rather than one big file because Sveltia CMS reads the
   repo through GitHub's GraphQL API, which truncates blobs over 512,000 bytes.
   The combined verses are ~757 KB (Devanagari costs 3 bytes/char) and would
   arrive cut mid-string; the largest single verse file is under 2 KB. A
   relation widget against a folder collection also uses flat field names
   instead of list wildcards, which is far better-trodden ground in Sveltia.

   ORDER IS LOAD-BEARING — read this before touching assembleVerses().

   build.js writes one JSON per verse to dist/v/{id}.json, where {id} is the
   NUMERIC id assigned here from the verse's position in the assembled array.
   src/card.js picks the day's verse with `days-since-2026-01-01 (IST) mod
   count + 1` and fetches that path. So a verse's position in this array IS
   its slot in the daily sequence, for every reader, worldwide.

   fs.readdirSync returns filenames in byte order: 1-1, 1-10, 1-100, 1-11, …
   Sorting on that would renumber almost every verse and silently reshuffle
   the daily rotation with nothing in the output looking wrong. We therefore
   sort NUMERICALLY by chapter then verse, which reproduces the historical
   order of data/verses.json exactly (verified against it at migration).

   build.js and tools/validate-verses.js both go through this module, so they
   cannot disagree about what the verse set is. */

const fs = require('fs');
const path = require('path');

const VERSES_DIR = path.join(__dirname, '..', 'content', 'verses');

/* The Gita has 701 verses and the count is pinned deliberately. todaysId() in
   src/card.js is `day mod count`, so a different count re-maps every future
   date to a different verse — a silent, site-wide content change. Adding or
   removing a verse is a decision to make on purpose, here, in one commit with
   the file. */
const EXPECTED_COUNT = 701;

/* The fields a verse file carries. `hn` is NOT among them: Hinglish is
   generated from `hi` at build time (see lib/hinglish.js), never stored. */
const VERSE_FIELDS = ['sa', 'tr', 'hi', 'en'];

/* Read every verse file, capturing parse errors instead of throwing — one
   unparseable file must still let the validator report on all the others. */
function readVerseDir(dir = VERSES_DIR) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((file) => {
      try {
        return { file, raw: JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')), parseError: null };
      } catch (e) {
        return { file, raw: null, parseError: e.message };
      }
    });
}

/* Sort numerically by chapter then verse — see the ORDER IS LOAD-BEARING note
   above — and project onto exactly the fields the rest of the build consumes.

   The projection is explicit, not a spread, for two reasons: the numeric `id`
   is derived from position and must never come from the file (an editor
   mistyping it would move a verse in the daily rotation), and a stray key left
   behind by a CMS save must not leak into dist/verses.json. */
function assembleVerses(records) {
  return records
    .slice()
    .sort((a, b) => a.c - b.c || a.v - b.v)
    .map((r, i) => ({ id: i + 1, c: r.c, v: r.v, sa: r.sa, tr: r.tr, hi: r.hi, en: r.en }));
}

module.exports = { VERSES_DIR, EXPECTED_COUNT, VERSE_FIELDS, readVerseDir, assembleVerses };
