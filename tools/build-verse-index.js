#!/usr/bin/env node
/* Build data/verse-index.json — a small, English-only index of data/verses.json
   for the Sveltia CMS verse picker. Zero dependencies. Node 18+.

   Why this file exists: Sveltia fetches repo contents through GitHub's GraphQL
   API (`... on Blob { text }`), which truncates any blob over 512,000 bytes.
   data/verses.json is ~732 KB — the Devanagari costs 3 bytes per character —
   so the CMS receives it cut off mid-string and fails to parse it. This index
   carries only what the picker needs to display and search, which keeps it an
   order of magnitude under that limit.

   Regenerate with `node tools/build-verse-index.js` whenever data/verses.json
   changes, and commit the result — the CMS reads GitHub, not dist/. */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'data/verses.json');
const OUT = path.join(ROOT, 'data/verse-index.json');

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

/* Root is an object with a named list, not a bare array, so the CMS file
   collection can declare fields on it. */
const index = {
  verses: verses.map((v) => ({
    id: v.id,
    ref: `${v.c}.${v.v}`,
    en: truncate(v.en, EN_MAX),
  })),
};

fs.writeFileSync(OUT, `${JSON.stringify(index, null, 2)}\n`);

const bytes = fs.statSync(OUT).size;
const limit = 512000;
console.log(
  `Wrote ${index.verses.length} verses → data/verse-index.json ` +
    `(${bytes.toLocaleString()} bytes, ${((bytes / limit) * 100).toFixed(1)}% of GitHub's ${limit.toLocaleString()}-byte blob limit)`
);
