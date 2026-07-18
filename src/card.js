/* GeetaSar card renderer. Draws a 1080×1080 verse card on canvas,
   shares it as a PNG via the Web Share API (WhatsApp on mobile). */
(function () {
  'use strict';

  var canvas = document.getElementById('cardCanvas');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var W = 1080, H = 1080;

  var DEV = { 0: '०', 1: '१', 2: '२', 3: '३', 4: '४', 5: '५', 6: '६', 7: '७', 8: '८', 9: '९' };
  function dev(n) { return String(n).replace(/\d/g, function (d) { return DEV[d]; }); }

  var state = { verse: null, lang: 'en' };

  /* ---------- daily verse (IST for everyone — the day's verse from India) ---------- */
  function todaysId(count) {
    var istNow = new Date(Date.now() + 5.5 * 3600e3);
    var epoch = Date.UTC(2026, 0, 1); // fixed epoch; do not change or the sequence resets
    var day = Math.floor((Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), istNow.getUTCDate()) - epoch) / 86400e3);
    return ((day % count) + count) % count + 1; // verse ids are 1..count
  }

  /* ---------- text helpers ---------- */
  function wrap(ctx, text, maxW) {
    var words = text.split(/\s+/), lines = [], line = '';
    for (var i = 0; i < words.length; i++) {
      var test = line ? line + ' ' + words[i] : words[i];
      if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = words[i]; }
      else line = test;
    }
    if (line) lines.push(line);
    return lines;
  }

  /* Safari mis-anchors textAlign:'center' for Devanagari glyph runs
     (WebKit computes the centre offset without complex shaping), so
     centre manually: measureText shapes correctly in all engines. */
  function fillCentered(text, y) {
    ctx.fillText(text, (W - ctx.measureText(text).width) / 2, y);
  }

  function fitLines(ctx, rawLines, font, maxW, startSize, minSize) {
    var size = startSize;
    while (size > minSize) {
      ctx.font = size + 'px ' + font;
      var tooWide = rawLines.some(function (l) { return ctx.measureText(l).width > maxW; });
      if (!tooWide) break;
      size -= 2;
    }
    ctx.font = size + 'px ' + font;
    return size;
  }

  /* ---------- draw ---------- */
  function draw() {
    var v = state.verse;
    if (!v) return;
    var DEVA = '"Tiro Devanagari Sanskrit", serif';
    var SERIF = '"Source Serif 4", Georgia, serif';
    var MUKTA = '"Mukta", sans-serif';

    /* night background with a soft gold glow */
    ctx.clearRect(0, 0, W, H);
    var bg = ctx.createRadialGradient(W / 2, -100, 100, W / 2, H / 2, 1000);
    bg.addColorStop(0, '#202a55');
    bg.addColorStop(0.55, '#141a33');
    bg.addColorStop(1, '#10152a');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    /* double manuscript border */
    ctx.strokeStyle = 'rgba(201,162,39,0.9)';
    ctx.lineWidth = 3;
    ctx.strokeRect(36, 36, W - 72, H - 72);
    ctx.strokeStyle = 'rgba(201,162,39,0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(50, 50, W - 100, H - 100);

    ctx.textAlign = 'left';

    /* eyebrow */
    ctx.fillStyle = '#c9a227';
    ctx.font = '400 34px ' + DEVA;
    fillCentered('॥ श्रीमद्भगवद्गीता ॥', 130);

    /* shloka */
    var saLines = v.sa.split('\n').filter(Boolean);
    ctx.fillStyle = '#efe9da';
    var saSize = fitLines(ctx, saLines, DEVA, W - 200, saLines.length > 3 ? 46 : 54, 34);
    var saLH = saSize * 1.75;
    var meaning = (state.lang === 'hi' ? v.hi : v.en) || '';

    /* meaning sizing first so we can centre the whole composition */
    var mSize = meaning.length > 260 ? 30 : meaning.length > 170 ? 34 : 38;
    ctx.font = (state.lang === 'hi' ? '300 ' : '400 ') + mSize + 'px ' + (state.lang === 'hi' ? MUKTA : SERIF);
    var mLines = wrap(ctx, meaning, W - 220);
    if (mLines.length > 7) { mLines = mLines.slice(0, 7); mLines[6] += ' …'; }
    var mLH = mSize * 1.6;

    var blockH = saLines.length * saLH + 70 /*rule gap*/ + mLines.length * mLH;
    var y = Math.max(230, (H - 140 - blockH) / 2 + 60);

    ctx.font = saSize + 'px ' + DEVA;
    ctx.fillStyle = '#efe9da';
    saLines.forEach(function (l) { fillCentered(l, y); y += saLH; });

    /* gold rule with diamond */
    y += 10;
    ctx.strokeStyle = 'rgba(201,162,39,0.8)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(W / 2 - 140, y); ctx.lineTo(W / 2 - 16, y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(W / 2 + 16, y); ctx.lineTo(W / 2 + 140, y); ctx.stroke();
    ctx.save();
    ctx.translate(W / 2, y); ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#c9a227'; ctx.fillRect(-5, -5, 10, 10);
    ctx.restore();
    y += 56;

    /* meaning */
    ctx.fillStyle = '#d8d2c2';
    ctx.font = (state.lang === 'hi' ? '300 ' : '400 ') + mSize + 'px ' + (state.lang === 'hi' ? MUKTA : SERIF);
    mLines.forEach(function (l) { fillCentered(l, y); y += mLH; });

    /* footer: reference + site */
    ctx.fillStyle = '#c9a227';
    ctx.font = '400 32px ' + DEVA;
    var ref = state.lang === 'hi'
      ? 'अध्याय ' + dev(state.verse.c) + ' · श्लोक ' + dev(state.verse.v)
      : 'Chapter ' + state.verse.c + ' · Verse ' + state.verse.v;
    if (state.lang === 'en') ctx.font = '600 28px ' + SERIF;
    fillCentered(ref, H - 118);
    ctx.fillStyle = 'rgba(139,147,176,0.9)';
    ctx.font = '300 24px ' + MUKTA;
    fillCentered('geetasar.com', H - 72);
  }

  /* ---------- share / download ---------- */
  function toBlob() {
    return new Promise(function (res) { canvas.toBlob(res, 'image/png'); });
  }

  function track(name) {
    if (window.umami) umami.track(name);
    if (window.gtag) gtag('event', name);
  }

  function fileName() {
    return 'geetasar-' + state.verse.c + '-' + state.verse.v + '.png';
  }

  function share() {
    toBlob().then(function (blob) {
      var file = new File([blob], fileName(), { type: 'image/png' });
      var pageUrl = 'https://geetasar.com/verse/' + state.verse.c + '-' + state.verse.v + '/';
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], title: 'GeetaSar', text: 'Today’s shloka · ' + pageUrl })
          .then(function () { track('card-share'); })
          .catch(function () {});
      } else {
        download();
        window.open('https://wa.me/?text=' + encodeURIComponent('Today’s shloka · ' + pageUrl), '_blank');
      }
    });
  }

  function download() {
    toBlob().then(function (blob) {
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = fileName();
      a.click();
      URL.revokeObjectURL(a.href);
      track('card-download');
    });
  }

  /* ---------- wire up ---------- */
  function fillVerseText(v) {
    var root = document.getElementById('verseText');
    if (!root) return;
    root.hidden = false;
    root.querySelector('.sa').innerHTML = v.sa.replace(/\n/g, '<br>');
    root.querySelector('.tr').innerHTML = v.tr.replace(/\n/g, '<br>');
    root.querySelector('.hi').textContent = v.hi;
    root.querySelector('.en').textContent = v.en;
    var link = document.getElementById('permalink');
    if (link) link.href = '/verse/' + v.c + '-' + v.v + '/';
  }

  function ready(v) {
    state.verse = v;
    fillVerseText(v);
    var fonts = ['400 54px "Tiro Devanagari Sanskrit"', '300 38px "Mukta"', '400 38px "Source Serif 4"'];
    Promise.all(fonts.map(function (f) { return document.fonts.load(f, 'अ'); }))
      .then(draw)
      .catch(draw);
    setTimeout(draw, 1200); // safety redraw once fonts settle
  }

  document.querySelectorAll('.lt').forEach(function (b) {
    b.addEventListener('click', function () {
      document.querySelectorAll('.lt').forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
      b.setAttribute('aria-pressed', 'true');
      state.lang = b.dataset.lang;
      draw();
    });
  });
  var sb = document.getElementById('shareBtn');
  var db = document.getElementById('dlBtn');
  if (sb) sb.addEventListener('click', share);
  if (db) db.addEventListener('click', download);

  if (window.__VERSE__) {
    ready(window.__VERSE__);
  } else if (window.__TODAY__) {
    fetch('/v/' + todaysId(window.__TODAY__.count) + '.json')
      .then(function (r) { return r.json(); })
      .then(ready);
  }
})();
