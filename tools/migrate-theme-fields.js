#!/usr/bin/env node
/* Migrate content/themes/*.json to the nested multilingual shape.
   Zero dependencies. Node 18+.  Run:  node tools/migrate-theme-fields.js

   Before                          After
     "label_en": "Karma"             "label": { "en": "Karma", "hi": "कर्म" }
     "label_hi": "कर्म"
     "blurb": "one line"             "blurb": { "en": "one line" }

   Why now: flat language suffixes multiply fields by languages across every
   file, and Tamil/Telugu/Gujarati are on the roadmap. At one theme this is a
   minute's work; at forty it is a weekend. build.js still reads the old shape
   through a compatibility shim in lib/themes.js, so nothing breaks either way —
   this just clears the warning and stops new files inheriting the old habit.

   It also writes the canonical slug back into `id` when the id was only ever
   being normalised on the way to the URL ("Affection" -> "affection"). That
   changes NO published URL — canonicalSlug() is what build.js already applied —
   it just makes the file state the URL it actually publishes.

   Idempotent: running it twice changes nothing the second time. */

const fs = require('fs');
const path = require('path');
const { readThemeDir, normaliseTheme, LANGS } = require('../lib/themes');
const { canonicalSlug } = require('../lib/slug');

const ROOT = path.join(__dirname, '..');
const THEMES_DIR = path.join(ROOT, 'content/themes');

/* Same order as the fields in static/admin/config.yml, so a hand-read file and
   the CMS form tell the same story. Unknown keys are preserved after these. */
const KEY_ORDER = ['id', 'label', 'type', 'blurb', 'intro', 'image', 'image_alt', 'explanation', 'verseIds', 'published'];
const LEGACY_KEYS = new Set(['label', 'label_en', 'label_hi', 'blurb', 'blurb_en', 'blurb_hi',
  'intro', 'intro_en', 'intro_hi', 'explanation', 'explanation_en', 'explanation_hi']);

/* Drop a language object entirely when it has no content, so an absent field is
   an absent key rather than an empty husk. */
const langObj = (obj) => {
  const out = {};
  for (const lang of LANGS) if (obj[lang]) out[lang] = obj[lang];
  return Object.keys(out).length ? out : undefined;
};

function migrate(raw, file) {
  const t = normaliseTheme(raw, file);
  const next = {};

  next.id = t.slug || t.rawId;
  const label = langObj(t.label);
  const blurb = langObj(t.blurb);
  const intro = langObj(t.intro);
  const explanation = langObj(t.explanation);

  if (label) next.label = label;
  next.type = raw.type;
  if (blurb) next.blurb = blurb;
  if (intro) next.intro = intro;
  if ('image' in raw) next.image = raw.image;
  if ('image_alt' in raw) next.image_alt = raw.image_alt;
  if (explanation) next.explanation = explanation;
  next.verseIds = t.verseIds;
  next.published = t.published;

  /* anything authored by hand that this script doesn't know about survives */
  for (const k of Object.keys(raw)) {
    if (KEY_ORDER.includes(k) || LEGACY_KEYS.has(k)) continue;
    next[k] = raw[k];
  }
  return next;
}

const files = readThemeDir(THEMES_DIR);
let changed = 0;

for (const { file, raw, parseError } of files) {
  const abs = path.join(THEMES_DIR, file);
  if (parseError) {
    console.error(`  !!  ${file}: not valid JSON (${parseError}) — skipped, fix it by hand.`);
    continue;
  }

  const before = fs.readFileSync(abs, 'utf8');
  const after = `${JSON.stringify(migrate(raw, file), null, 2)}\n`;
  if (before === after) continue;

  fs.writeFileSync(abs, after);
  changed += 1;

  const notes = [];
  const canonical = canonicalSlug(raw.id);
  if (canonical && canonical !== raw.id) notes.push(`id ${JSON.stringify(raw.id)} -> "${canonical}" (URL unchanged: /theme/${canonical}/)`);
  const flat = Object.keys(raw).filter((k) => LEGACY_KEYS.has(k) && (typeof raw[k] === 'string' || k.includes('_')));
  if (flat.length) notes.push(`nested ${flat.join(', ')}`);
  console.log(`  ${file}${notes.length ? ` — ${notes.join('; ')}` : ''}`);
}

console.log(
  `Migrated ${changed} of ${files.length} theme file${files.length === 1 ? '' : 's'} in content/themes/`
  + (changed ? '. Run node tools/validate-themes.js to confirm.' : ' — already up to date.')
);
