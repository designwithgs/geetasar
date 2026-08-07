#!/usr/bin/env node
/* Validate content/themes/*.json. Zero dependencies. Node 18+.

   Run standalone:   node tools/validate-themes.js
   Runs automatically as the FIRST step of `node build.js`.

   Why this exists: a theme page is a permanent public URL, and this repo has no
   CI, no tests and no staging. Deploy is `git push origin main` — including the
   pushes Sveltia CMS makes when someone hits Save. Without a gate, a duplicate
   slug or a dangling verseId ships to geetasar.com unnoticed.

   Two severities:
     FAIL  non-zero exit, blocks the build. Cloudflare Pages keeps the previous
           deployment serving when a build fails, so blocking is the SAFE
           direction: the site stays up, it just doesn't take the bad change.
     WARN  prints, build continues. Editorial smells, not broken output.

   FAIL rules split by scope on purpose. Structural rules (slug, type, verse
   ids, JSON) apply to DRAFTS TOO — a slug collision is a permanent-URL problem
   whether or not the theme is live yet, and finding it after publication is too
   late. Quality rules (has a label, has an intro, has 3+ verses) only bite on
   `published: true`, because half-finished drafts are the normal state.

   See docs/theme-prd.md for what each rule is protecting and why. */

const fs = require('fs');
const path = require('path');
const { readThemeDir, normaliseTheme, buildVerseIndex, resolveVerses, pick, has, THEME_TYPES } = require('../lib/themes');
const { validate: validateVerses } = require('./validate-verses');
const { SLUG_PATTERN } = require('../lib/slug');

const ROOT = path.join(__dirname, '..');
const THEMES_DIR = path.join(ROOT, 'content/themes');
const CONFIG_YML = path.join(ROOT, 'static/admin/config.yml');
/* static/ is copied to the site root, so a banner at public path /theme-images/x.jpg
   lives on disk at static/theme-images/x.jpg. NOT static/themes/ — that path would
   collide with the generated /themes/ index page. */
const STATIC_DIR = path.join(ROOT, 'static');

/* Editorial thresholds. Changing one is a content-standard decision — update
   docs/theme-prd.md in the same commit. */
const MIN_EXPLANATION = 200; // chars; below this the page isn't worth indexing
const MIN_VERSES = 3;        // fewer than this isn't a sequence, it's a quote
const MAX_VERSES = 15;       // beyond this the page stops being readable
const MAX_THEMES_PER_VERSE = 4; // a verse in everything means nothing anywhere

/* `verses` is passed in by build.js, which has already validated and assembled
   content/verses/. A standalone run has to do that itself — the verse set is
   what verseIds are checked against, so there is nothing to validate without
   it. Verse-level problems are that validator's to report, not this one's. */
function validate({ verses, themesDir = THEMES_DIR } = {}) {
  const all = verses || validateVerses().verses;
  const verseIndex = buildVerseIndex(all);

  const issues = []; // { group, severity, message }
  const fail = (group, message) => issues.push({ group, severity: 'FAIL', message });
  const warn = (group, message) => issues.push({ group, severity: 'warn', message });

  const themes = [];
  const bySlug = new Map();
  const byLabel = new Map();   // `${type} ${label.en.toLowerCase()}` -> theme
  const verseUse = new Map();  // verse id -> [slug, ...]

  for (const { file, raw, parseError } of readThemeDir(themesDir)) {
    if (parseError) {
      fail(file, `not valid JSON — ${parseError}. Nothing else could be checked in this file.`);
      continue;
    }

    const t = normaliseTheme(raw, file);
    const group = t.slug ? `${file}  ->  /theme/${t.slug}/` : file;
    t.group = group;

    /* ---- slug: the permanent commitment ---- */
    if (!t.slug) {
      fail(group, t.idSource === 'unusable'
        ? `id ${JSON.stringify(t.rawId)} normalises to nothing usable — it is empty, purely numeric, or has no `
          + 'Latin letters at all (Devanagari and emoji are stripped). Give it a lowercase-with-hyphens id, e.g. "karma-yoga".'
        : 'no id field, and the filename yields no usable slug either. '
          + 'Add a lowercase-with-hyphens id, e.g. "karma-yoga".');
    } else {
      const clash = bySlug.get(t.slug);
      if (clash) {
        fail(group, `slug "${t.slug}" is already produced by ${clash.file} — two files, one URL. Rename one id.`);
      } else {
        bySlug.set(t.slug, t);
      }
      if (t.slugWasNormalised) {
        warn(group, `id ${JSON.stringify(t.rawId)} was silently normalised to "${t.slug}". `
          + `The URL is /theme/${t.slug}/. Write the canonical form into the id so the file says what it publishes.`);
      }
      if (t.idSource === 'filename') {
        warn(group, `no usable id field — the slug fell back to the filename ("${t.basename}"). Set id explicitly.`);
      }
      if (t.slug !== t.basename) {
        warn(group, `filename is ${file} but the URL is /theme/${t.slug}/. Rename the file to ${t.slug}.json so they agree.`);
      }
    }

    /* ---- shape ---- */
    if (!t.typeValid) {
      fail(group, `type ${JSON.stringify(t.type)} is not one of ${THEME_TYPES.join(' | ')}.`);
    }
    if (t.legacyFields.length) {
      warn(group, `legacy flat field${t.legacyFields.length === 1 ? '' : 's'} ${t.legacyFields.join(', ')} — `
        + 'read via the compatibility shim. Run node tools/migrate-theme-fields.js, or re-save the entry in /admin/.');
    }

    /* ---- verses ---- */
    const { list, missing, duplicates } = resolveVerses(t.verseIds, verseIndex);
    t.list = list;
    for (const id of missing) fail(group, `verseId "${id}" matches no verse in content/verses/ — there is no ${id}.json.`);
    for (const id of duplicates) fail(group, `verseId "${id}" is listed more than once in this theme.`);
    if (list.length > MAX_VERSES) {
      warn(group, `${list.length} verses — over ${MAX_VERSES}, the page stops being readable top to bottom. Split it.`);
    }
    for (const v of list) {
      const key = `${v.c}-${v.v}`;
      if (!verseUse.has(key)) verseUse.set(key, []);
      verseUse.get(key).push(t.slug || file);
    }

    /* ---- banner ---- */
    if (t.image) {
      const onDisk = path.join(STATIC_DIR, t.image.replace(/^\/+/, ''));
      if (!fs.existsSync(onDisk)) {
        warn(group, `image "${t.image}" is referenced but ${path.relative(ROOT, onDisk)} does not exist — the banner will 404.`);
      }
    }

    /* ---- publishable standard (published entries only) ---- */
    if (t.published) {
      if (!has(t.label, 'en')) fail(group, 'published with no label.en — every theme needs an English label.');
      if (!has(t.intro, 'en')) fail(group, 'published with no intro.en — the verse sequence needs framing.');
      if (list.length < MIN_VERSES) {
        fail(group, `published with ${list.length} resolvable verse${list.length === 1 ? '' : 's'} — `
          + `${MIN_VERSES} is the minimum for a sequence worth a page.`);
      }
      const labelEn = pick(t.label, 'en').trim();
      if (labelEn) {
        const key = `${t.type} ${labelEn.toLowerCase()}`;
        const twin = byLabel.get(key);
        if (twin) {
          fail(group, `label.en "${labelEn}" is already used by ${twin.file} in the same "${t.type}" cloud — `
            + 'two entries the reader cannot tell apart.');
        } else {
          byLabel.set(key, t);
        }
      }
      const essay = pick(t.explanation, 'en').trim();
      if (essay.length < MIN_EXPLANATION) {
        warn(group, `explanation.en is ${essay.length} chars — under the ${MIN_EXPLANATION}-char minimum. `
          + "A page this thin doesn't justify existing.");
      }
    }

    themes.push(t);
  }

  /* ---- cross-theme: dilution. Counts drafts too, since a draft is a theme
     that intends to publish and the overlap is worth seeing before it does. ---- */
  for (const [id, users] of verseUse) {
    if (users.length > MAX_THEMES_PER_VERSE) {
      warn('(across themes)', `verse ${id.replace('-', '.')} appears in ${users.length} themes (${users.join(', ')}) — `
        + `over ${MAX_THEMES_PER_VERSE}. A verse that is everywhere means nothing anywhere.`);
    }
  }

  /* ---- the CMS must reject exactly what the build rejects ---- */
  if (fs.existsSync(CONFIG_YML) && !fs.readFileSync(CONFIG_YML, 'utf8').includes(SLUG_PATTERN)) {
    warn('(across themes)', 'static/admin/config.yml no longer contains the slug pattern from lib/slug.js — '
      + `the CMS and the build disagree about what a valid id is. Expected: ${SLUG_PATTERN}`);
  }

  return {
    themes,
    checked: themes.length,
    failures: issues.filter((i) => i.severity === 'FAIL'),
    warnings: issues.filter((i) => i.severity === 'warn'),
    issues,
  };
}

/* Grouped by theme, file named, each line saying what to fix. */
function report(result, log = console) {
  const groups = [];
  for (const i of result.issues) {
    let g = groups.find((x) => x.name === i.group);
    if (!g) groups.push((g = { name: i.group, lines: [] }));
    g.lines.push(i);
  }
  const n = result.checked;
  if (!groups.length) {
    log.log(`Themes: ${n} checked · all clean`);
    return;
  }
  log.log('');
  for (const g of groups) {
    log.log(`  ${g.name}`);
    for (const i of g.lines) log.log(`    ${i.severity}  ${i.message}`);
    log.log('');
  }
  const f = result.failures.length;
  const w = result.warnings.length;
  log.log(`Themes: ${n} checked · ${f} failure${f === 1 ? '' : 's'} · ${w} warning${w === 1 ? '' : 's'}`);
  if (f) log.log('Build blocked. Fix the FAIL lines above (see docs/theme-prd.md), then rebuild.');
  log.log('');
}

module.exports = { validate, report, MIN_EXPLANATION, MIN_VERSES, MAX_VERSES, MAX_THEMES_PER_VERSE };

if (require.main === module) {
  const result = validate();
  report(result);
  process.exit(result.failures.length ? 1 : 0);
}
