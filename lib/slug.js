/* The canonical theme slug rule. Zero dependencies. Node 18+.

   A theme publishes at /theme/{slug}/. Once that URL is indexed it is a
   permanent public commitment: it can be linked, bookmarked and shared, and
   this site has no redirect layer to rescue a renamed one. So the rule that
   produces a slug must exist EXACTLY ONCE and be shared by everything that
   touches it — build.js, tools/validate-themes.js, tools/migrate-theme-fields.js.
   Never re-implement it, never inline "just a quick lowercase" somewhere else.

   SLUG_PATTERN is the same rule expressed as an anchored regex describing an
   ALREADY-canonical slug. It is copied verbatim into the `pattern:` on the id
   field in static/admin/config.yml so the CMS rejects a bad slug at authoring
   time rather than at build time. validate-themes.js checks the two are still
   identical and warns if they have drifted. */

const SLUG_MAX = 60;

/* lowercase a-z0-9, single hyphens between runs, never all-digits, 1..60 chars */
const SLUG_PATTERN = `^(?=.{1,${SLUG_MAX}}$)(?!\\d+$)[a-z0-9]+(?:-[a-z0-9]+)*$`;
const SLUG_RE = new RegExp(SLUG_PATTERN);

/* Returns the canonical slug, or '' when the input yields nothing usable.
   Silently lowercases rather than rejecting; strips rather than transliterating,
   EXCEPT for accented Latin, which decomposes to its base letter (é → e). */
function canonicalSlug(raw) {
  let s = String(raw == null ? '' : raw)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // drop combining marks left by NFD: é → e
    .toLowerCase()
    .replace(/[\s_]+/g, '-')         // spaces and underscores are word breaks
    .replace(/[^a-z0-9-]+/g, '')     // punctuation, quotes, Devanagari, emoji
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
  if (s.length > SLUG_MAX) s = s.slice(0, SLUG_MAX).replace(/-+$/, '');
  if (!s || /^\d+$/.test(s)) return ''; // a purely numeric slug reads as an id, not a name
  return s;
}

module.exports = { canonicalSlug, SLUG_MAX, SLUG_PATTERN, SLUG_RE };
