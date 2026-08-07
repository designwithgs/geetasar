/* Devanagari → Hinglish (casual Roman). Zero dependencies. Node 18+.

   Hinglish is GENERATED, never stored. build.js derives every verse's `hn`
   from its `hi` at build time, and tools/validate-verses.js calls the same
   function to warn when a verse's Hinglish comes out empty. Both go through
   this module so they cannot disagree.

   Heuristic transliteration with schwa deletion: final inherent 'a' is
   dropped, medial 'a' is dropped between voweled syllables (kahkar, karne),
   and word-final long vowels are shortened (tera, hi, nahin). It is imperfect
   by design — fix a bad word by adding it to HN_WORDS below, not by
   complicating the algorithm. */

const HN_C = { क:'k',ख:'kh',ग:'g',घ:'gh',ङ:'n',च:'ch',छ:'chh',ज:'j',झ:'jh',ञ:'n',ट:'t',ठ:'th',ड:'d',ढ:'dh',ण:'n',त:'t',थ:'th',द:'d',ध:'dh',न:'n',प:'p',फ:'ph',ब:'b',भ:'bh',म:'m',य:'y',र:'r',ल:'l',व:'v',श:'sh',ष:'sh',स:'s',ह:'h' };
const HN_NUKTA = { क:'q',ख:'kh',ग:'g',ज:'z',ड:'d',ढ:'rh',फ:'f' };
const HN_V = { अ:'a',आ:'aa',इ:'i',ई:'ee',उ:'u',ऊ:'oo',ऋ:'ri',ए:'e',ऐ:'ai',ओ:'o',औ:'au',ऍ:'e',ऑ:'o' };
const HN_M = { 'ा':'aa','ि':'i','ी':'ee','ु':'u','ू':'oo','ृ':'ri','े':'e','ै':'ai','ो':'o','ौ':'au','ॉ':'o','ॅ':'e' };
const HN_SHORT = { aa:'a', ee:'i', oo:'u' };
const HN_WORDS = {
  'में':'mein', 'कृष्ण':'krishna', 'श्रीभगवान्':'shri bhagvaan', 'श्रीभगवान':'shri bhagvaan',
  'हमें':'hamein', 'उन्हें':'unhein', 'इन्हें':'inhein', 'तुम्हें':'tumhein',
};
const HN_LABIAL = 'पफबभम';

function hnWord(word) {
  if (HN_WORDS[word]) return HN_WORDS[word];
  /* fused postpositions: split word-final में always, को after anusvara
     (karmommen → karmon mein) — both are unambiguous in Hindi prose */
  if (word.length > 3 && word.endsWith('में')) return hnWord(word.slice(0, -3)) + ' mein';
  if (word.length > 3 && word.endsWith('ंको')) return hnWord(word.slice(0, -2)) + ' ko';
  const units = []; // {c, v, coda} — v null means undecided inherent 'a'
  const last = () => units[units.length - 1];
  for (let i = 0; i < word.length; i++) {
    const ch = word[i];
    if (HN_C[ch]) {
      let c = HN_C[ch];
      if (ch === 'ज' && word[i + 1] === '्' && word[i + 2] === 'ञ') { c = 'gy'; i += 2; } // ज्ञ → gy
      else if (word[i + 1] === '़') { c = HN_NUKTA[ch] || c; i++; }
      units.push({ c, v: null, coda: '' });
    } else if (HN_M[ch]) { if (units.length) last().v = HN_M[ch]; }
    else if (ch === '्') { if (units.length) last().v = ''; }
    else if (HN_V[ch]) units.push({ c: '', v: HN_V[ch], coda: '' });
    else if (ch === 'ं' || ch === 'ँ') { if (units.length) last().coda += HN_LABIAL.includes(word[i + 1]) ? 'm' : 'n'; }
    else if (ch === 'ः') { if (units.length) last().coda += 'h'; }
    else if (ch !== 'ऽ') units.push({ c: ch, v: '', coda: '' }); // pass through unknowns
  }
  if (!units.length) return '';
  if (units.length > 1 && last().v === null) last().v = ''; // word-final schwa
  for (let i = 1; i < units.length - 1; i++) { // medial schwa, left to right
    if (units[i].v !== null || units[i].coda) continue; // nasal coda keeps its vowel (ahankaar)
    const prevV = units[i - 1].v === null ? 'a' : units[i - 1].v;
    const nextV = units[i + 1].v === null ? 'a' : units[i + 1].v;
    if (prevV && nextV) units[i].v = '';
  }
  for (const u of units) if (u.v === null) u.v = 'a';
  if (last().v in HN_SHORT) last().v = HN_SHORT[last().v];
  return units.map((u) => u.c + u.v + u.coda).join('');
}

const hinglish = (s) => s
  .replace(/[।॥]+/g, '.')
  .replace(/ॐ/g, 'Om')
  .replace(/[०-९]/g, (d) => String(d.charCodeAt(0) - 0x0966))
  .replace(/[ऀ-ॿ]+/g, hnWord);

module.exports = { hinglish, HN_WORDS };
