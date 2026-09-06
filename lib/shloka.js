/* Shloka line splitting.
   ~a third of the verses are stored as a single line; split those on danda
   (।/॥) boundaries so the card, the verse pages, the theme pages and the
   homepage render the same padas as the verses that were authored multi-line.

   Like hn, sl is GENERATED on every build and never stored on a verse file:
   one splitter feeds every rendering, so they cannot drift apart. */

/* A speaker attribution fused to the first pada (अर्जुन उवाचएवं…) — it gets
   its own line, the way the multi-line records already have it. */
const SPEAKER = /^.{0,20}?(?:उवाच|[ुू]वाच)(?=[^\s।॥])/;

/* A pada ends after a danda run — unless only the verse number follows it
   (।।१५.१।।), which the corpus fuses onto the closing pada with no space. */
const PADA_END = /(?<=[।॥])(?![।॥])(?=.*[^\s०-९\d.।॥])/;

function shlokaLines(sa) {
  const lines = String(sa || '').split('\n').filter(Boolean);
  if (lines.length > 1) return lines;
  const out = [];
  let rest = lines[0] || '';
  const speaker = rest.match(SPEAKER);
  if (speaker) {
    out.push(speaker[0].trim());
    rest = rest.slice(speaker[0].length);
  }
  for (const pada of rest.split(PADA_END)) {
    if (pada.trim()) out.push(pada.trim());
  }
  return out;
}

module.exports = { shlokaLines };
