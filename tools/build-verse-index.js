#!/usr/bin/env node
/* Build content/verses/ — one small JSON per verse, for the Sveltia CMS verse
   picker. Zero dependencies. Node 18+.

   Why these files exist: the CMS needs something to point a relation widget at,
   and it cannot read data/verses.json directly — Sveltia fetches repo contents
   through GitHub's GraphQL API (`... on Blob { text }`), which truncates blobs
   over 512,000 bytes, and verses.json is ~732 KB because Devanagari costs 3
   bytes per character. A relation against a folder collection (one entry per
   verse, flat field names) is also far better-trodden ground in Sveltia than a
   nested list inside a single file.

   Each file is content/verses/{c}-{v}.json:
     { "id": "2-47", "ref": "2.47", "en": "<English meaning, ~120 chars>" }

   The id matches the /verse/{c}-{v}/ slug build.js already generates, so a
   theme's verseIds join back with:
     verses.find((v) => `${v.c}-${v.v}` === id)

   These files ARE committed — the CMS reads GitHub, not dist/. Regenerate with
   `node tools/build-verse-index.js` whenever data/verses.json changes. */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'data/verses.json');
const OUT_DIR = path.join(ROOT, 'content/verses');

/* Keep option labels short enough to stay readable in the picker dropdown. */
const EN_MAX = 120;

const truncate = (s, max) => {
  const text = s.replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  /* cut on a word boundary so the snippet doesn't end mid-word */
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
};

const verses = JSON.parse(fs.readFileSync(SRC, 'utf8'));

fs.mkdirSync(OUT_DIR, { recursive: true });

const written = new Set();
let bytes = 0;

for (const v of verses) {
  const id = `${v.c}-${v.v}`;
  const file = `${id}.json`;
  const body = `${JSON.stringify({ id, ref: `${v.c}.${v.v}`, en: truncate(v.en, EN_MAX) }, null, 2)}\n`;

  fs.writeFileSync(path.join(OUT_DIR, file), body);
  written.add(file);
  bytes += Buffer.byteLength(body, 'utf8');
}

/* drop files for verses that no longer exist, so a shrinking verses.json
   doesn't leave orphans behind for the picker to offer */
let removed = 0;
for (const f of fs.readdirSync(OUT_DIR)) {
  if (f.endsWith('.json') && !written.has(f)) {
    fs.unlinkSync(path.join(OUT_DIR, f));
    removed += 1;
  }
}

console.log(
  `Wrote ${written.size} verse files → content/verses/ ` +
    `(${bytes.toLocaleString()} bytes total, ~${Math.round(bytes / written.size)} bytes each)` +
    (removed ? `; removed ${removed} stale file(s)` : '')
);
