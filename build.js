#!/usr/bin/env node
/* GeetaSar — static site builder. Zero dependencies. Node 18+.
   Reads data/verses.json → writes dist/ (index, 700+ verse pages, per-verse JSON, sitemap). */

const fs = require('fs');
const path = require('path');

const SITE = 'https://geetasar.com';
const DIST = path.join(__dirname, 'dist');

const verses = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/verses.json'), 'utf8'));
const chapters = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/chapters.json'), 'utf8'));

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* ---------- Devanagari → Hinglish (casual Roman, card-only) ----------
   Heuristic transliteration with schwa deletion: final inherent 'a' is
   dropped, medial 'a' is dropped between voweled syllables (kahkar, karne),
   and word-final long vowels are shortened (tera, hi, nahin). */
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

for (const v of verses) v.hn = hinglish(v.hi);

/* ---------- shared page shell ---------- */
function shell({ title, desc, url, body, inlineData }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${url}">
<meta property="og:type" content="website">
<meta property="og:image" content="${SITE}/og.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/logo.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Tiro+Devanagari+Sanskrit&family=Mukta:wght@300;400;500;600&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/style.css?v=2">
<!-- Analytics: uncomment ONE of the two blocks below after setup.
<script defer src="https://cloud.umami.is/script.js" data-website-id="YOUR-UMAMI-ID"></script>
-->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-73YRW6E20G"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)};gtag('js',new Date());gtag('config','G-73YRW6E20G');</script>
${inlineData ? `<script>window.__VERSE__=${inlineData};</script>` : ''}
</head>
<body>
<div class="sky" aria-hidden="true"><i></i><i></i><i></i></div>
<header class="top">
  <a class="brand" href="/"><span class="mark" aria-hidden="true"></span>GeetaSar</a>
  <nav>
    <a href="/gita/">All Shlokas</a>
    <a href="/about/">About</a>
  </nav>
</header>
${body}
<footer class="foot">
  <p>GeetaSar — one shloka a day, free forever. No ads, no login, no watermark.</p>
  <p class="fine">Sanskrit text is eternal &amp; public domain. Hindi: Swami Ramsukhdas · English: Shri Purohit Swami.</p>
</footer>
<script src="/reveal.js" defer></script>
</body>
</html>`;
}

/* ---------- verse block (shared by index + verse pages) ---------- */
function verseBlock(v, { isToday }) {
  const saHtml = esc(v.sa).replace(/\n/g, '<br>');
  const trHtml = esc(v.tr).replace(/\n/g, '<br>');
  return `
<main class="wrap">
  <p class="eyebrow">${isToday ? 'Today’s Shloka' : `Chapter ${v.c} · Verse ${v.v}`}</p>

  <section class="card-stage">
    <canvas id="cardCanvas" width="1080" height="1080" aria-label="Shareable verse card preview"></canvas>
  </section>

  <section class="actions" aria-label="Share">
    <div class="lang-toggle" role="group" aria-label="Card language">
      <button class="lt" data-lang="en" aria-pressed="true">English</button>
      <button class="lt" data-lang="hi" aria-pressed="false">हिन्दी</button>
      <button class="lt" data-lang="hn" aria-pressed="false">Hinglish</button>
    </div>
    <div class="btns">
      <button id="shareBtn" class="btn primary">Share on WhatsApp</button>
      <button id="dlBtn" class="btn">Download card</button>
    </div>
  </section>

  <div class="ornament"></div>

  <article class="verse-text reveal">
    <h1 class="sa" lang="sa">${saHtml}</h1>
    <details class="tr-toggle">
      <summary>Transliteration</summary>
      <p class="tr">${trHtml}</p>
    </details>
    <div class="meaning">
      <h2 class="mh">Meaning</h2>
      <p lang="en" class="en">${esc(v.en)}</p>
      <h2 class="mh">Hindi Meaning</h2>
      <p lang="hi" class="hi">${esc(v.hi)}</p>
    </div>
  </article>

  <nav class="pager">
    ${prevNext(v)}
  </nav>

  <div class="ornament"></div>
</main>
<script src="/card.js?v=5" defer></script>`;
}

function prevNext(v) {
  const i = verses.findIndex((x) => x.id === v.id);
  const p = verses[i - 1];
  const n = verses[i + 1];
  return `${p ? `<a href="/verse/${p.c}-${p.v}/">← ${p.c}.${p.v}</a>` : '<span></span>'}
    <a href="/gita/" class="mid">All Chapters</a>
    ${n ? `<a href="/verse/${n.c}-${n.v}/">${n.c}.${n.v} →</a>` : '<span></span>'}`;
}

/* ---------- build ---------- */
fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(path.join(DIST, 'v'), { recursive: true });

/* per-verse JSON (used by index to load today's verse) */
for (const v of verses) {
  fs.writeFileSync(path.join(DIST, 'v', `${v.id}.json`), JSON.stringify(v));
}

/* index — today's verse resolved client-side (IST), data fetched from /v/{id}.json */
const indexBody = `
<main class="wrap">
  <p class="eyebrow">Today’s Shloka</p>
  <section class="card-stage"><canvas id="cardCanvas" width="1080" height="1080" aria-label="Shareable verse card preview"></canvas></section>
  <section class="actions" aria-label="Share">
    <div class="lang-toggle" role="group" aria-label="Card language">
      <button class="lt" data-lang="en" aria-pressed="true">English</button>
      <button class="lt" data-lang="hi" aria-pressed="false">हिन्दी</button>
      <button class="lt" data-lang="hn" aria-pressed="false">Hinglish</button>
    </div>
    <div class="btns">
      <button id="shareBtn" class="btn primary">Share on WhatsApp</button>
      <button id="dlBtn" class="btn">Download card</button>
      <a id="permalink" class="btn ghost" href="/gita/">Open this verse →</a>
    </div>
  </section>
  <div class="ornament"></div>
  <article class="verse-text reveal" id="verseText" hidden>
    <h1 class="sa" lang="sa"></h1>
    <details class="tr-toggle"><summary>Transliteration</summary><p class="tr"></p></details>
    <div class="meaning">
      <h2 class="mh">Meaning</h2><p lang="en" class="en"></p>
      <h2 class="mh">Hindi Meaning</h2><p lang="hi" class="hi"></p>
    </div>
  </article>
  <div class="ornament"></div>
  <section class="pitch reveal">
    <p>One verse from the Bhagavad Gita, every day. Sanskrit, Hindi, English — and a clean card you can send on WhatsApp. ${verses.length} shlokas, a new one each morning (IST).</p>
  </section>
</main>
<script>window.__TODAY__={count:${verses.length}};</script>
<script src="/card.js?v=5" defer></script>`;

fs.writeFileSync(
  path.join(DIST, 'index.html'),
  shell({
    title: 'GeetaSar — Today’s Shloka | Bhagavad Gita, one shloka a day',
    desc: 'A new Bhagavad Gita shloka every day. Sanskrit, Hindi and English meaning, with a beautiful card to share on WhatsApp. Free, no ads, no login.',
    url: SITE + '/',
    body: indexBody,
  })
);

/* verse pages */
for (const v of verses) {
  const dir = path.join(DIST, 'verse', `${v.c}-${v.v}`);
  fs.mkdirSync(dir, { recursive: true });
  const title = `Gita ${v.c}.${v.v} — ${chapters[v.c] ? chapters[v.c].en : ''} | GeetaSar`;
  const desc = v.en.slice(0, 155);
  fs.writeFileSync(
    path.join(dir, 'index.html'),
    shell({
      title,
      desc,
      url: `${SITE}/verse/${v.c}-${v.v}/`,
      body: verseBlock(v, { isToday: false }),
      inlineData: JSON.stringify(v),
    })
  );
}

/* chapters index */
const byCh = {};
for (const v of verses) (byCh[v.c] = byCh[v.c] || []).push(v);
const chBody = `
<main class="wrap">
  <p class="eyebrow">Shrimad Bhagavad Gita</p>
  <h1 class="page-h">All 18 Chapters · ${verses.length} Shlokas</h1>
  <div class="ornament"></div>
  <section class="reveal">
  ${Object.keys(byCh)
    .map((c) => {
      const name = chapters[c] || { hi: '', en: '' };
      return `<details class="chapter" ${c === '1' ? 'open' : ''}>
  <summary><span class="ch-n">Chapter ${c}</span> <span class="ch-name" lang="sa">${esc(name.hi)}</span> <span class="ch-en">${esc(name.en)}</span></summary>
  <div class="verse-grid">${byCh[c].map((v) => `<a href="/verse/${v.c}-${v.v}/">${v.v}</a>`).join('')}</div>
</details>`;
    })
    .join('\n')}
  </section>
</main>`;
fs.mkdirSync(path.join(DIST, 'gita'), { recursive: true });
fs.writeFileSync(
  path.join(DIST, 'gita', 'index.html'),
  shell({ title: 'All Shlokas — Bhagavad Gita chapters | GeetaSar', desc: 'All 18 chapters and 700 shlokas of the Bhagavad Gita with Hindi and English meaning.', url: SITE + '/gita/', body: chBody })
);

/* about */
const aboutBody = `
<main class="wrap prose">
  <p class="eyebrow">About</p>
  <h1 class="page-h">Why GeetaSar exists</h1>
  <p>Every morning, crores of Gita verses travel across WhatsApp as blurry, watermarked images. The wisdom deserves better typography. GeetaSar gives you one shloka a day — original Sanskrit, Hindi and English meaning — and a clean card you can send to anyone. Free, no ads, no login, no watermark. Built in India, for everyone.</p>
  <p>Sanskrit text of the Gita is in the public domain. Hindi meaning: Swami Ramsukhdas. English meaning: Shri Purohit Swami. Verse data from the open <a href="https://github.com/gita/gita">gita/gita</a> project.</p>
</main>`;
fs.mkdirSync(path.join(DIST, 'about'), { recursive: true });
fs.writeFileSync(path.join(DIST, 'about', 'index.html'), shell({ title: 'About — GeetaSar', desc: 'One Bhagavad Gita shloka a day, beautifully typeset, free to share.', url: SITE + '/about/', body: aboutBody }));

/* 404 */
fs.writeFileSync(path.join(DIST, '404.html'), shell({ title: 'Not found — GeetaSar', desc: 'Page not found.', url: SITE + '/404', body: `<main class="wrap prose"><h1 class="page-h">Page not found</h1><p><a href="/">See today’s shloka →</a></p></main>` }));

/* sitemap + robots */
const urls = [`${SITE}/`, `${SITE}/gita/`, `${SITE}/about/`, ...verses.map((v) => `${SITE}/verse/${v.c}-${v.v}/`)];
fs.writeFileSync(path.join(DIST, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `<url><loc>${u}</loc></url>`).join('\n')}\n</urlset>`);
fs.writeFileSync(path.join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml`);

/* static assets */
for (const f of ['style.css', 'card.js', 'reveal.js']) fs.copyFileSync(path.join(__dirname, 'src', f), path.join(DIST, f));
for (const f of fs.readdirSync(path.join(__dirname, 'static'))) fs.copyFileSync(path.join(__dirname, 'static', f), path.join(DIST, f));

console.log(`Built ${urls.length} pages → dist/`);
