/* Shloka line splitting.
   ~a third of the verses are stored as a single line; split those on danda
   (।/॥) boundaries so the card, the verse pages and the homepage render the
   same padas. A fused speaker prefix (…उवाच) gets its own line and a trailing
   verse number (e.g. ।।१५.१।।) stays with the pada above it.

   Like hn, sl is GENERATED on every build and never stored on a verse file:
   one splitter feeds every rendering, so they cannot disagree. */
function shlokaLines(sa) {
  const lines = String(sa || '').split('\n').filter(Boolean);
  if (lines.length > 1) return lines;
  const out = [];
  (lines[0] || '').replace(/^(.{0,20}?(?:उवाच|[ुू]वाच))(?=[^\s।॥])/, '$1\n').split('\n').forEach((part) => {
    let buf = '';
    for (let i = 0; i < part.length; i++) {
      buf += part.charAt(i);
      if ((part.charAt(i) === '।' || part.charAt(i) === '॥') &&
          part.charAt(i + 1) !== '।' && part.charAt(i + 1) !== '॥') {
        out.push(buf.trim());
        buf = '';
      }
    }
    if (buf.trim()) out.push(buf.trim());
  });
  /* only a bare verse number rejoins its pada — a short closing pada must not
     be concatenated onto the line above with no separator */
  const last = out[out.length - 1];
  if (out.length > 1 && /^[०-९\d.\s।॥]+$/.test(last)) {
    out[out.length - 2] += last;
    out.pop();
  }
  return out;
}

module.exports = { shlokaLines };
