/* Reading and shaping content/themes/*.json. Zero dependencies. Node 18+.

   build.js renders themes and tools/validate-themes.js judges them. If they
   disagreed about what a theme file MEANS, the validator would bless pages the
   build renders differently — so both go through this module and neither parses
   a theme file itself.

   MULTILINGUAL SHAPE. Language-bearing fields are nested objects, not suffixed
   siblings:

     "label":       { "en": "Karma", "hi": "कर्म" }
     "blurb":       { "en": "..." }
     "intro":       { "en": "..." }
     "explanation": { "en": "..." }

   Only `en` is required; every other language falls back to it via pick(), so a
   section never renders empty. Adding Tamil later means adding 'ta' to LANGS and
   one subfield in static/admin/config.yml — no new fields on any theme file, no
   change to build.js. That is the whole point of the nesting; the old flat
   label_en / label_hi shape multiplied fields by languages across every file.

   LEGACY SHIM. Files written before the migration used flat `label_en` /
   `label_hi` and bare strings for blurb/intro/explanation. normaliseTheme folds
   those into the nested shape and records what it found in `legacyFields`, so
   the validator can warn without the build breaking. A CMS save mid-migration
   must never block a deploy. Run tools/migrate-theme-fields.js to clear it. */

const fs = require('fs');
const path = require('path');
const { canonicalSlug } = require('./slug');

/* The three clouds on /themes/. Adding one is a product decision, not a config
   tweak — see docs/theme-prd.md section 4 before touching this. */
const THEME_TYPES = ['term', 'modern', 'question'];

/* English first: it is the required language and the fallback for all others. */
const LANGS = ['en', 'hi'];

/* Fields that carry text in every language. The key is also the legacy prefix:
   `label` was once `label_en` / `label_hi`. */
const TEXT_FIELDS = ['label', 'blurb', 'intro', 'explanation'];

/* The one place the English-fallback rule lives. Always returns a string. */
const pick = (field, lang) => {
  if (!field || typeof field !== 'object') return typeof field === 'string' ? field : '';
  const want = field[lang];
  if (typeof want === 'string' && want.trim()) return want;
  return typeof field.en === 'string' ? field.en : '';
};

/* true when the field has real content in the given language (or in English) */
const has = (field, lang) => pick(field, lang).trim() !== '';

/* Read every theme file, capturing parse errors instead of throwing — one
   unparseable file must still let the validator report on all the others. */
function readThemeDir(dir) {
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

/* Fold one text field into { en, hi, ... }, dropping blank languages so an
   empty string is indistinguishable from an absent key. Records any flat
   legacy sibling it had to fall back on. */
function textField(raw, base, legacyFields) {
  const out = {};
  const nested = raw[base];
  if (nested && typeof nested === 'object') {
    for (const lang of LANGS) {
      const v = nested[lang];
      if (typeof v === 'string' && v.trim()) out[lang] = v;
    }
  } else if (typeof nested === 'string' && nested.trim()) {
    out.en = nested; // a bare string is English by convention
    legacyFields.push(base);
  }
  for (const lang of LANGS) {
    const flat = `${base}_${lang}`;
    if (out[lang] === undefined && typeof raw[flat] === 'string' && raw[flat].trim()) {
      out[lang] = raw[flat];
      legacyFields.push(flat);
    }
  }
  return out;
}

/* Everything build.js and the validator need, in one uniform record. Shapes
   only — it makes no judgements and drops nothing on the floor. */
function normaliseTheme(raw, file) {
  const legacyFields = [];
  const fields = {};
  for (const base of TEXT_FIELDS) fields[base] = textField(raw, base, legacyFields);

  /* The filename is a fallback for a MISSING id, never a rescue for a bad one:
     an id of "मोह" must fail loudly, not quietly publish at the filename. That
     silent-substitution path is how a URL nobody chose ends up permanent. */
  const rawId = typeof raw.id === 'string' ? raw.id : '';
  const hasId = rawId.trim() !== '';
  const fromId = canonicalSlug(rawId);
  const basename = path.basename(file, '.json');
  const slug = hasId ? fromId : canonicalSlug(basename);

  const verseIds = Array.isArray(raw.verseIds)
    ? raw.verseIds.filter((v) => typeof v === 'string' && v.trim()).map((v) => v.trim())
    : [];

  return {
    file,
    basename,
    rawId,
    slug,
    /* the id was usable but not already canonical — a silent rewrite worth shouting about */
    slugWasNormalised: Boolean(fromId) && rawId !== fromId,
    /* 'id' ok · 'unusable' id present but normalises to nothing · 'filename' no
       id, slug taken from the file · 'none' neither yields anything */
    idSource: fromId ? 'id' : hasId ? 'unusable' : slug ? 'filename' : 'none',
    ...fields,
    type: typeof raw.type === 'string' ? raw.type : '',
    typeValid: THEME_TYPES.includes(raw.type),
    image: typeof raw.image === 'string' && raw.image.trim() ? raw.image : '',
    imageAlt: typeof raw.image_alt === 'string' ? raw.image_alt : '',
    verseIds,
    published: raw.published === true,
    legacyFields,
  };
}

/* One Map for the whole build, keyed by the same "{c}-{v}" string the CMS
   stores and /verse/{c}-{v}/ uses. Replaces a linear scan of 701 verses per id. */
const buildVerseIndex = (verses) => new Map(verses.map((v) => [`${v.c}-${v.v}`, v]));

/* Resolve in the curator's order — a theme's verse sequence is authored to be
   read top to bottom and must never be re-sorted. */
function resolveVerses(verseIds, verseIndex) {
  const list = [];
  const missing = [];
  const duplicates = [];
  const seen = new Set();
  for (const id of verseIds) {
    if (seen.has(id)) { duplicates.push(id); continue; }
    seen.add(id);
    const v = verseIndex.get(id);
    if (!v) { missing.push(id); continue; }
    list.push(v);
  }
  return { list, missing, duplicates };
}

module.exports = {
  THEME_TYPES, LANGS, TEXT_FIELDS,
  pick, has, readThemeDir, normaliseTheme, buildVerseIndex, resolveVerses,
};
