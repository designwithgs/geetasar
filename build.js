#!/usr/bin/env node
/* GeetaSar — static site builder. Zero dependencies. Node 18+.
   Reads data/verses.json → writes dist/ (index, 700+ verse pages, per-verse JSON, sitemap). */

const fs = require('fs');
const path = require('path');

const SITE = 'https://geetasar.com';
const DIST = path.join(__dirname, 'dist');

const verses = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/verses.json'), 'utf8'));
const chapters = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/chapters.json'), 'utf8'));

const DEV_DIGITS = { '0': '०', '1': '१', '2': '२', '3': '३', '4': '४', '5': '५', '6': '६', '7': '७', '8': '८', '9': '९' };
const dev = (n) => String(n).replace(/\d/g, (d) => DEV_DIGITS[d]);
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* ---------- shared page shell ---------- */
function shell({ title, desc, url, body, inlineData }) {
  return `<!doctype html>
<html lang="hi">
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
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Tiro+Devanagari+Sanskrit&family=Mukta:wght@300;400;500&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/style.css">
<!-- Analytics: uncomment ONE of the two blocks below after setup.
<script defer src="https://cloud.umami.is/script.js" data-website-id="YOUR-UMAMI-ID"></script>
-->
<!--
<script async src="https://www.googletagmanager.com/gtag/js?id=G-73YRW6E20G"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)};gtag('js',new Date());gtag('config','G-73YRW6E20G');</script>
-->
${inlineData ? `<script>window.__VERSE__=${inlineData};</script>` : ''}
</head>
<body>
<header class="top">
  <a class="brand" href="/">गीता<span>सार</span></a>
  <nav>
    <a href="/gita/">सभी श्लोक</a>
    <a href="/about/">About</a>
  </nav>
</header>
${body}
<footer class="foot">
  <p>गीतासार — one shloka a day, free forever. No ads, no login, no watermark.</p>
  <p class="fine">Sanskrit text is eternal &amp; public domain. Hindi: Swami Ramsukhdas · English: Shri Purohit Swami · Data: <a href="https://github.com/gita/gita">gita/gita</a> (Unlicense).</p>
</footer>
</body>
</html>`;
}

/* ---------- verse block (shared by index + verse pages) ---------- */
function verseBlock(v, { isToday }) {
  const saHtml = esc(v.sa).replace(/\n/g, '<br>');
  const trHtml = esc(v.tr).replace(/\n/g, '<br>');
  return `
<main class="wrap">
  <p class="eyebrow">${isToday ? 'आज का श्लोक · Today’s shloka' : `अध्याय ${dev(v.c)} · श्लोक ${dev(v.v)}`}</p>

  <section class="card-stage">
    <canvas id="cardCanvas" width="1080" height="1080" aria-label="Shareable verse card preview"></canvas>
  </section>

  <section class="actions" aria-label="Share">
    <div class="lang-toggle" role="group" aria-label="Card language">
      <button class="lt on" data-lang="hi">हिन्दी</button>
      <button class="lt" data-lang="en">English</button>
    </div>
    <div class="btns">
      <button id="shareBtn" class="btn primary">Share on WhatsApp</button>
      <button id="dlBtn" class="btn">Download card</button>
    </div>
  </section>

  <article class="verse-text">
    <h1 class="sa" lang="sa">${saHtml}</h1>
    <details class="tr-toggle">
      <summary>Transliteration</summary>
      <p class="tr">${trHtml}</p>
    </details>
    <div class="meaning">
      <h2 class="mh">अर्थ</h2>
      <p lang="hi" class="hi">${esc(v.hi)}</p>
      <h2 class="mh">Meaning</h2>
      <p lang="en" class="en">${esc(v.en)}</p>
    </div>
  </article>

  <nav class="pager">
    ${prevNext(v)}
  </nav>
</main>
<script src="/card.js" defer></script>`;
}

function prevNext(v) {
  const i = verses.findIndex((x) => x.id === v.id);
  const p = verses[i - 1];
  const n = verses[i + 1];
  return `${p ? `<a href="/verse/${p.c}-${p.v}/">← ${dev(p.c)}.${dev(p.v)}</a>` : '<span></span>'}
    <a href="/gita/" class="mid">सभी अध्याय</a>
    ${n ? `<a href="/verse/${n.c}-${n.v}/">${dev(n.c)}.${dev(n.v)} →</a>` : '<span></span>'}`;
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
  <p class="eyebrow">आज का श्लोक · Today’s shloka</p>
  <section class="card-stage"><canvas id="cardCanvas" width="1080" height="1080" aria-label="Shareable verse card preview"></canvas></section>
  <section class="actions" aria-label="Share">
    <div class="lang-toggle" role="group" aria-label="Card language">
      <button class="lt on" data-lang="hi">हिन्दी</button>
      <button class="lt" data-lang="en">English</button>
    </div>
    <div class="btns">
      <button id="shareBtn" class="btn primary">Share on WhatsApp</button>
      <button id="dlBtn" class="btn">Download card</button>
      <a id="permalink" class="btn ghost" href="/gita/">Open this verse →</a>
    </div>
  </section>
  <article class="verse-text" id="verseText" hidden>
    <h1 class="sa" lang="sa"></h1>
    <details class="tr-toggle"><summary>Transliteration</summary><p class="tr"></p></details>
    <div class="meaning">
      <h2 class="mh">अर्थ</h2><p lang="hi" class="hi"></p>
      <h2 class="mh">Meaning</h2><p lang="en" class="en"></p>
    </div>
  </article>
  <section class="pitch">
    <p>One verse from the Bhagavad Gita, every day. Sanskrit, Hindi, English — and a clean card you can send on WhatsApp. ${verses.length} shlokas, a new one each morning (IST).</p>
  </section>
</main>
<script>window.__TODAY__={count:${verses.length}};</script>
<script src="/card.js" defer></script>`;

fs.writeFileSync(
  path.join(DIST, 'index.html'),
  shell({
    title: 'गीतासार — आज का श्लोक | Bhagavad Gita, one shloka a day',
    desc: 'A new Bhagavad Gita shloka every day. Sanskrit, Hindi and English meaning, with a beautiful card to share on WhatsApp. Free, no ads, no login.',
    url: SITE + '/',
    body: indexBody,
  })
);

/* verse pages */
for (const v of verses) {
  const dir = path.join(DIST, 'verse', `${v.c}-${v.v}`);
  fs.mkdirSync(dir, { recursive: true });
  const title = `गीता ${v.c}.${v.v} — ${chapters[v.c] ? chapters[v.c].en : ''} | GeetaSar`;
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
  <p class="eyebrow">श्रीमद्भगवद्गीता</p>
  <h1 class="page-h">सभी ${dev(18)} अध्याय · ${verses.length} श्लोक</h1>
  ${Object.keys(byCh)
    .map((c) => {
      const name = chapters[c] || { hi: '', en: '' };
      return `<details class="chapter" ${c === '1' ? 'open' : ''}>
  <summary><span class="ch-n">अध्याय ${dev(c)}</span> <span class="ch-name" lang="sa">${esc(name.hi)}</span> <span class="ch-en">${esc(name.en)}</span></summary>
  <div class="verse-grid">${byCh[c].map((v) => `<a href="/verse/${v.c}-${v.v}/">${dev(v.v)}</a>`).join('')}</div>
</details>`;
    })
    .join('\n')}
</main>`;
fs.mkdirSync(path.join(DIST, 'gita'), { recursive: true });
fs.writeFileSync(
  path.join(DIST, 'gita', 'index.html'),
  shell({ title: 'सभी श्लोक — Bhagavad Gita chapters | GeetaSar', desc: 'All 18 chapters and 700 shlokas of the Bhagavad Gita with Hindi and English meaning.', url: SITE + '/gita/', body: chBody })
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
fs.writeFileSync(path.join(DIST, '404.html'), shell({ title: 'Not found — GeetaSar', desc: 'Page not found.', url: SITE + '/404', body: `<main class="wrap prose"><h1 class="page-h">यह पृष्ठ नहीं मिला</h1><p><a href="/">आज का श्लोक देखें →</a></p></main>` }));

/* sitemap + robots */
const urls = [`${SITE}/`, `${SITE}/gita/`, `${SITE}/about/`, ...verses.map((v) => `${SITE}/verse/${v.c}-${v.v}/`)];
fs.writeFileSync(path.join(DIST, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `<url><loc>${u}</loc></url>`).join('\n')}\n</urlset>`);
fs.writeFileSync(path.join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml`);

/* static assets */
for (const f of ['style.css', 'card.js']) fs.copyFileSync(path.join(__dirname, 'src', f), path.join(DIST, f));
for (const f of fs.readdirSync(path.join(__dirname, 'static'))) fs.copyFileSync(path.join(__dirname, 'static', f), path.join(DIST, f));

console.log(`Built ${urls.length} pages → dist/`);
