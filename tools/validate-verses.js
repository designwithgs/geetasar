#!/usr/bin/env node
/* Validate content/verses/*.json. Zero dependencies. Node 18+.

   Run standalone:   node tools/validate-verses.js
   Runs automatically as the FIRST step of `node build.js`, before the theme
   validator (which needs the verse set) and before dist/ is removed.

   Why this exists: the 701 verse files ARE the site's content and they are
   editable at /admin/, where a save is a commit to main and a commit to main
   is a deploy. There is no CI, no tests and no staging. Without a gate, a
   verse saved with an emptied field, a renamed file or a mistyped chapter
   number ships to geetasar.com unnoticed — and a changed verse COUNT silently
   reshuffles the daily verse for every reader (see EXPECTED_COUNT in
   lib/verses.js).

   Two severities, same contract as tools/validate-themes.js:
     FAIL  non-zero exit, blocks the build. Cloudflare Pages keeps the previous
           deployment serving when a build fails, so blocking is the SAFE
           direction: the site stays up, it just doesn't take the bad change.
     WARN  prints, build continues. This is the correction worklist — the
           dataset is public-domain and has known editorial junk in it. */

const fs = require('fs');
const path = require('path');
const { VERSES_DIR, EXPECTED_COUNT, readVerseDir, assembleVerses } = require('../lib/verses');
const { hinglish } = require('../lib/hinglish');

/* An English meaning shorter than this is not a translation of a Sanskrit
   shloka. It is what "No changes needed." looks like — the placeholder the
   upstream dataset left in 1.7 and 16.6. */
const MIN_EN = 25;

/* Junk the upstream dataset is known to carry in a translation field. */
const PLACEHOLDER = /^\s*(no changes needed|n\/?a|tbd|todo|-+)\.?\s*$/i;

/* The transliteration column is Roman script. When it has no Latin letter at
   all it is Devanagari that was pasted into the wrong column (11.19), and the
   Transliteration block on the verse page renders Sanskrit twice. */
const HAS_LATIN = /[A-Za-z]/;

const str = (x) => (typeof x === 'string' ? x : '');
const blank = (x) => str(x).trim() === '';

function validate({ versesDir = VERSES_DIR } = {}) {
  const issues = []; // { group, severity, message }
  const fail = (group, message) => issues.push({ group, severity: 'FAIL', message });
  const warn = (group, message) => issues.push({ group, severity: 'warn', message });

  const records = [];
  const byKey = new Map();
  const empty = { tr: 0, hi: 0, hn: 0 };
  const suspect = { tr: 0, en: 0 };
  let files = 0;

  for (const { file, raw, parseError } of readVerseDir(versesDir)) {
    files += 1;
    const group = `content/verses/${file}`;

    if (parseError) {
      fail(group, `not valid JSON — ${parseError}. Nothing else could be checked in this file.`);
      continue;
    }
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      fail(group, 'is not a JSON object.');
      continue;
    }

    /* ---- identity: the filename is the URL and the relation key ----
       /verse/{c}-{v}/ comes from the fields, the CMS picker and every theme's
       verseIds come from the filename. If they disagree, a theme silently
       points at a different verse than the one the file is named for. */
    const basename = path.basename(file, '.json');
    const m = /^(\d+)-(\d+)$/.exec(basename);
    if (!m) {
      fail(group, `filename is not {chapter}-{verse}.json (e.g. 2-47.json). Rename it.`);
      continue;
    }
    const [fc, fv] = [Number(m[1]), Number(m[2])];

    const okNum = (n) => Number.isInteger(n) && n > 0;
    if (!okNum(raw.c) || !okNum(raw.v)) {
      fail(group, `c and v must be positive whole numbers, got c=${JSON.stringify(raw.c)} v=${JSON.stringify(raw.v)}. `
        + 'They decide where this verse sits in the daily sequence.');
      continue;
    }
    if (raw.c !== fc || raw.v !== fv) {
      fail(group, `says chapter ${raw.c} verse ${raw.v} but the filename says ${fc}.${fv}. `
        + 'The filename is the permanent /verse/{c}-{v}/ URL — fix the fields, not the filename.');
      continue;
    }

    const key = `${raw.c}-${raw.v}`;
    const clash = byKey.get(key);
    if (clash) {
      fail(group, `verse ${raw.c}.${raw.v} is already defined by ${clash} — two files, one verse.`);
      continue;
    }
    byKey.set(key, file);

    /* id and ref are derived from c/v and exist only so the CMS relation
       widget has a flat value to store and a readable label to show. */
    if (str(raw.id) !== key) {
      fail(group, `id is ${JSON.stringify(raw.id)} but must be "${key}" — themes store this string in verseIds.`);
    }
    if (str(raw.ref) !== `${raw.c}.${raw.v}`) {
      fail(group, `ref is ${JSON.stringify(raw.ref)} but must be "${raw.c}.${raw.v}".`);
    }

    /* ---- content the page cannot render without ---- */
    if (blank(raw.sa)) fail(group, 'sa (Sanskrit) is empty — the verse page and the card have nothing to show.');
    if (blank(raw.en)) fail(group, 'en (English meaning) is empty — it is the page description and the card text.');

    /* ---- the correction worklist ---- */
    const hn = hinglish(str(raw.hi));
    if (blank(raw.tr)) { empty.tr += 1; warn(group, 'tr (transliteration) is empty.'); }
    else if (!HAS_LATIN.test(raw.tr)) {
      suspect.tr += 1;
      warn(group, `tr has no Latin letters — ${JSON.stringify(str(raw.tr).slice(0, 60))}. `
        + 'That is Devanagari in the transliteration column; the Transliteration block shows Sanskrit twice.');
    }
    if (blank(raw.hi)) { empty.hi += 1; warn(group, 'hi (Hindi meaning) is empty.'); }
    if (blank(hn)) {
      empty.hn += 1;
      warn(group, 'hn (Hinglish) comes out empty — it is generated from hi by lib/hinglish.js, '
        + 'so hi is empty or carries no Devanagari.');
    }
    if (!blank(raw.en)) {
      const en = str(raw.en).trim();
      if (PLACEHOLDER.test(en)) {
        suspect.en += 1;
        warn(group, `en is placeholder text — ${JSON.stringify(en)}. Editorial junk from the source dataset; needs a real translation.`);
      } else if (en.length < MIN_EN) {
        suspect.en += 1;
        warn(group, `en is only ${en.length} characters — ${JSON.stringify(en)}. Too short to be a translation of a shloka.`);
      }
    }

    records.push(raw);
  }

  /* ---- the set as a whole ---- */
  if (records.length !== EXPECTED_COUNT) {
    fail('(all verses)', `${records.length} usable verse files, expected ${EXPECTED_COUNT}. `
      + 'The daily verse is `day mod count`, so a different count re-maps every future date to a '
      + 'different verse. If the change is deliberate, update EXPECTED_COUNT in lib/verses.js in the same commit.');
  }

  const failures = issues.filter((i) => i.severity === 'FAIL');

  return {
    /* Assembled only when the set is sound: numbering a broken set would hand
       build.js an array whose positions mean nothing. */
    verses: failures.length ? [] : assembleVerses(records),
    checked: files,
    empty,
    suspect,
    failures,
    warnings: issues.filter((i) => i.severity === 'warn'),
    issues,
  };
}

/* Grouped by file, each line saying what to fix, then a one-line worklist. */
function report(result, log = console) {
  const groups = [];
  for (const i of result.issues) {
    let g = groups.find((x) => x.name === i.group);
    if (!g) groups.push((g = { name: i.group, lines: [] }));
    g.lines.push(i);
  }
  if (groups.length) {
    log.log('');
    for (const g of groups) {
      log.log(`  ${g.name}`);
      for (const i of g.lines) log.log(`    ${i.severity}  ${i.message}`);
      log.log('');
    }
  }
  const f = result.failures.length;
  const w = result.warnings.length;
  const { empty, suspect } = result;
  log.log(
    `Verses: ${result.checked} checked · ${f} failure${f === 1 ? '' : 's'} · ${w} warning${w === 1 ? '' : 's'}` +
      ` · empty: tr ${empty.tr}, hi ${empty.hi}, hn ${empty.hn}` +
      ` · suspect: tr ${suspect.tr}, en ${suspect.en}`
  );
  if (f) log.log('Build blocked. Fix the FAIL lines above, then rebuild.');
  if (groups.length) log.log('');
}

module.exports = { validate, report, MIN_EN, PLACEHOLDER };

if (require.main === module) {
  const result = validate();
  report(result);
  process.exit(result.failures.length ? 1 : 0);
}
