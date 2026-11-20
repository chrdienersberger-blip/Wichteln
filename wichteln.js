'use strict';
// Wichtel-Rap: Auslosung und Enthüllung laufen komplett im Browser.
// Die Zuordnung steckt verschleiert im #-Teil des Links. Der wird nie an einen Server geschickt.

const $ = (id) => document.getElementById(id);
const STORE = 'wichtel-rap-v1';
const KEY = 'nordpol-elfen-crew';

// ---------- Link-Kodierung ----------
function encode(obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  const k = new TextEncoder().encode(KEY);
  let bin = '';
  bytes.forEach((b, i) => { bin += String.fromCharCode(b ^ k[i % k.length] ^ (i * 7 & 255)); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function decode(str) {
  const bin = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
  const k = new TextEncoder().encode(KEY);
  const bytes = Uint8Array.from(bin, (c, i) => c.charCodeAt(0) ^ k[i % k.length] ^ (i * 7 & 255));
  return JSON.parse(new TextDecoder().decode(bytes));
}

function load() { try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch { return {}; } }
function save(data) { try { localStorage.setItem(STORE, JSON.stringify(data)); } catch { /* egal */ } }

function formatDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!m) return '';
  return new Date(+m[1], m[2] - 1, +m[3]).toLocaleDateString('de-DE', { day: 'numeric', month: 'long' });
}

// ---------- Auslosung ----------
function shuffle(a) {
  const r = new Uint32Array(a.length);
  crypto.getRandomValues(r);
  for (let i = a.length - 1; i > 0; i--) { const j = r[i] % (i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

function draw(names, blocked) {
  for (let attempt = 0; attempt < 20000; attempt++) {
    const recv = shuffle(names.slice());
    if (names.every((g, i) => g !== recv[i] && !blocked.has(g.toLowerCase() + '\n' + recv[i].toLowerCase()))) {
      return names.map((g, i) => [g, recv[i]]);
    }
  }
  return null;
}

function parseSetup() {
  const names = $('names').value.split('\n').map((s) => s.trim()).filter(Boolean);
  if (names.length < 3) throw new Error('Bitte mindestens 3 Namen eintragen.');
  const seen = new Set();
  for (const n of names) {
    if (seen.has(n.toLowerCase())) throw new Error(`„${n}“ steht doppelt in der Liste. Bitte Namen unterscheidbar machen, z. B. „${n} M.“.`);
    seen.add(n.toLowerCase());
  }
  const blocked = new Set();
  $('excl').value.split('\n').map((s) => s.trim()).filter(Boolean).forEach((line) => {
    const pair = line.split(/\s+[-–]\s+|\s*[,&/]\s*|\s+und\s+/i).map((s) => s.trim()).filter(Boolean);
    if (pair.length < 2) throw new Error(`Ausnahme „${line}“ verstehe ich nicht. Schreib sie z. B. als „Anna - Ben“.`);
    pair.forEach((p) => { if (!seen.has(p.toLowerCase())) throw new Error(`„${p}“ aus den Ausnahmen steht nicht in der Teilnehmerliste.`); });
    for (const a of pair) for (const b of pair) if (a !== b) blocked.add(a.toLowerCase() + '\n' + b.toLowerCase());
  });
  return { names, blocked };
}

function linkFor(code) { return location.href.split('#')[0] + '#' + code; }

function renderLinks(data) {
  const ul = $('links');
  ul.textContent = '';
  data.links.forEach(({ name, code }) => {
    const li = document.createElement('li');
    const who = document.createElement('span');
    who.className = 'who';
    who.textContent = name;
    const status = document.createElement('span');
    status.className = 'done';
    const copy = document.createElement('button');
    copy.type = 'button';
    copy.className = 'small';
    copy.textContent = 'Kopieren';
    copy.addEventListener('click', async () => {
      await copyText(linkFor(code));
      status.textContent = 'kopiert ✓';
    });
    const share = document.createElement('button');
    share.type = 'button';
    share.className = 'small secondary';
    share.textContent = 'Senden';
    share.addEventListener('click', async () => {
      const text = `Yo ${name}! 🎤🎁 Dein geheimer Wichtel-Link${data.title ? ' für „' + data.title + '“' : ''} – nur für dich, nicht weitergeben:`;
      if (navigator.share) {
        try { await navigator.share({ title: 'Wichtel-Rap', text, url: linkFor(code) }); status.textContent = 'gesendet ✓'; } catch { /* abgebrochen */ }
      } else {
        window.open('https://wa.me/?text=' + encodeURIComponent(text + ' ' + linkFor(code)), '_blank', 'noopener');
        status.textContent = 'gesendet ✓';
      }
    });
    li.append(who, status, copy, share);
    ul.append(li);
  });
  $('result').hidden = false;
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); }
  catch {
    const ta = document.createElement('textarea');
    ta.value = text; document.body.append(ta); ta.select();
    document.execCommand('copy'); ta.remove();
  }
}

function initSetup() {
  $('setup').hidden = false;
  const saved = load();
  ['title', 'names', 'budget', 'date', 'excl'].forEach((id) => { if (saved[id]) $(id).value = saved[id]; });
  if (saved.links) renderLinks(saved);

  $('form').addEventListener('submit', (e) => {
    e.preventDefault();
    const err = $('error');
    err.hidden = true;
    let setup;
    try { setup = parseSetup(); } catch (ex) { err.textContent = ex.message; err.hidden = false; return; }
    const pairs = draw(setup.names, setup.blocked);
    if (!pairs) {
      err.textContent = 'Mit diesen Ausnahmen geht die Auslosung nicht auf. Bitte ein paar Ausnahmen streichen.';
      err.hidden = false;
      return;
    }
    const data = {
      title: $('title').value.trim(), names: $('names').value, budget: $('budget').value.trim(),
      date: $('date').value, excl: $('excl').value,
    };
    data.links = pairs.map(([g, r]) => ({
      name: g,
      code: encode({ v: 1, t: data.title, g, r, b: data.budget, d: data.date }),
    }));
    save(data);
    renderLinks(data);
    $('result').scrollIntoView({ behavior: 'smooth' });
  });

  $('copyAll').addEventListener('click', async (e) => {
    const data = load();
    if (!data.links) return;
    const text = data.links.map(({ name, code }) => `${name}: ${linkFor(code)}`).join('\n\n');
    await copyText(text);
    e.target.textContent = 'Kopiert ✓';
    setTimeout(() => { e.target.textContent = 'Alle Links als Text kopieren'; }, 2000);
  });
  $('redraw').addEventListener('click', () => {
    if (confirm('Wirklich neu auslosen? Dann gelten die bisherigen Links nicht mehr – schick allen die neuen.')) {
      $('form').requestSubmit();
    }
  });
}

// ---------- Rap-Story ----------
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function buildStory(p) {
  const date = formatDate(p.d);
  const story = [];
  const verse = (title, ...couplets) => { story.push({ verse: title }); couplets.forEach((c) => c.forEach((l) => story.push({ text: l }))); };

  verse('Strophe 1 – Nordpol',
    pick([
      ['Yo {g}, Mic-Check, eins, zwei – hör gut zu,', 'am Nordpol ist Alarm, und keiner hat mehr Ruh’.'],
      ['{g}, pass auf, der Track kommt direkt aus dem Schnee,', 'vom Nordpol, live und ungeschnitten – minus zwanzig Grad, juchhe!'],
      ['Yo {g}, dreh mal lauter, das hier ist exklusiv,', 'der Nordpol ruft dich an, und der Bass geht richtig tief.'],
    ]),
    pick([
      ['Die Elfen-Crew am Fließband, Bass im Werkstatt-Raum,', 'Rentier Rudi an den Decks – so was glaubst du kaum.'],
      ['Die Elfen packen Päckchen im Akkord und ohne Pause,', 'Rudolph scratcht die Platten – das ist Weihnachten zu Hause.'],
      ['Lebkuchen im Studio, Glühwein auf dem Pult,', 'die Elfen droppen Beats, und an allem ist Santa schuld.'],
    ]));

  verse('Strophe 2 – Die Ziehung',
    pick([
      ['Da ruft der Weihnachtsmann: „Wir brauchen Wichtel, und zwar fix!“', 'Er greift tief in die Lostrommel – kein Schummeln, kein Trick.'],
      ['Santa stampft herein, die Mütze schief, die Stiefel voller Schnee:', '„Zeit für die Ziehung, Leute – Lostrommel, olé!“'],
    ]),
    pick([
      ['Der Zettel glänzt wie Gold, die Elfen halten still,', 'denn darauf steht dein Name: {g} – genau den er will.'],
      ['Ein Zettel fliegt nach oben, alle halten den Atem an,', 'drauf steht: {g} – Agent Wichtel, du bist dran!'],
    ]));

  verse('Strophe 3 – Die Mission',
    p.b
      ? ['Die Regeln sind simpel, merk sie dir genau:', 'Budget {b}, kein Cent mehr – sei clever, sei schlau.']
      : ['Die Regeln sind simpel, merk sie dir genau:', 'kein Protzen, sondern Herz – sei clever, sei schlau.'],
    date
      ? ['Am {d} ist Showtime, dann wird ausgepackt,', 'also lass dir was einfallen, das alle umhaut – Fakt.']
      : ['Und kommt die Bescherung, dann wird ausgepackt,', 'also lass dir was einfallen, das alle umhaut – Fakt.'],
    pick([
      ['Kein Wort zu niemandem, das bleibt unter uns zwei’n,', 'ein echter Wichtel schweigt – so muss das sein.'],
      ['Pssst – nichts verraten, nicht mal deiner Oma,', 'Wichtel bleiben anonym, das steht im Wichtel-Diploma.'],
    ]));

  verse('Strophe 4 – Die Enthüllung',
    ['Jetzt Trommelwirbel, Elfen – dreht das Licht mal runter,', 'die Spannung steigt, der Bass wird tief, das Herz schlägt immer munter …'],
    ['Santa dreht den Zettel um und flüstert dir ins Ohr', 'den Namen, den du brauchst – Elfen, Trommeln, Chor …']);

  const vars = { g: p.g, b: p.b, d: date };
  return story.map((s) => (s.text ? { text: s.text, vars } : s));
}

function lineEl(item) {
  const div = document.createElement('div');
  if (item.verse) { div.className = 'line verse'; div.textContent = item.verse; return div; }
  div.className = 'line';
  item.text.split(/(\{[gbd]\})/).forEach((part) => {
    const m = /^\{([gbd])\}$/.exec(part);
    if (m) {
      const s = document.createElement('span');
      s.className = 'n';
      s.textContent = item.vars[m[1]];
      div.append(s);
    } else if (part) div.append(part);
  });
  return div;
}

// ---------- Beat (WebAudio, alles synthetisch) ----------
const BPM = 90;
const BAR = (60 / BPM) * 4;

function makeBeat(bars) {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  const ctx = new Ctx();
  const master = ctx.createGain();
  master.gain.value = 0.8;
  master.connect(ctx.destination);

  const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const nd = noise.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

  const env = (g, t, peak, decay) => {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  };
  const kick = (t) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.18);
    env(g, t, 1, 0.45);
    o.connect(g).connect(master); o.start(t); o.stop(t + 0.5);
  };
  const hiss = (t, freq, peak, decay) => {
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noise; f.type = 'highpass'; f.frequency.value = freq;
    env(g, t, peak, decay);
    s.connect(f).connect(g).connect(master); s.start(t); s.stop(t + decay + 0.05);
  };
  const snare = (t, v = 0.6) => {
    hiss(t, 1500, v, 0.2);
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'triangle'; o.frequency.value = 190;
    env(g, t, v * 0.5, 0.12);
    o.connect(g).connect(master); o.start(t); o.stop(t + 0.15);
  };
  const tone = (t, freq, type, peak, decay) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    env(g, t, peak, decay);
    o.connect(g).connect(master); o.start(t); o.stop(t + decay + 0.05);
  };

  // Am – F – C – G, dazu Schellen-Glöckchen
  const roots = [55, 43.65, 65.41, 49];
  const bells = [[880, 1046.5, 1318.5], [698.5, 880, 1046.5], [784, 1046.5, 1318.5], [784, 987.8, 1174.7]];
  const s16 = BAR / 16;
  const t0 = ctx.currentTime + 0.15;

  for (let bar = 0; bar < bars; bar++) {
    const b = t0 + bar * BAR, ch = bar % 4;
    [0, 7, 10].forEach((st) => kick(b + st * s16));
    [4, 12].forEach((st) => snare(b + st * s16));
    for (let st = 0; st < 16; st += 2) hiss(b + st * s16, 7000, st % 4 ? 0.12 : 0.2, 0.05);
    [0, 6, 10].forEach((st) => tone(b + st * s16, roots[ch], 'sine', 0.55, 0.5));
    if (bar > 0) [0, 3, 6, 8, 11, 14].forEach((st, i) => tone(b + st * s16, bells[ch][i % 3], 'triangle', 0.07, 0.35));
  }
  // Trommelwirbel und Crash vor der Enthüllung
  const roll = t0 + bars * BAR;
  for (let i = 0; i < 16; i++) snare(roll + i * s16, 0.15 + i * 0.04);
  const end = roll + BAR;
  kick(end);
  hiss(end, 3000, 0.7, 1.8);
  [440, 554.4, 659.3, 880].forEach((f) => tone(end, f, 'triangle', 0.12, 2.2));

  return { ctx, master, t0 };
}

// ---------- Enthüllung ----------
function initReveal(p) {
  $('reveal').hidden = false;
  $('giverName').textContent = p.g;
  $('roundTitle').textContent = p.t || 'Wichteln';
  document.title = `Yo ${p.g}! – Wichtel-Rap`;

  let run = null;

  const finish = () => {
    if (run) { run.stop(); run = null; }
    $('lyrics').hidden = true;
    $('controls').hidden = true;
    $('finale').hidden = false;
    $('receiverName').textContent = p.r;
    const date = formatDate(p.d);
    $('details').textContent = [p.b && `Budget: ${p.b}`, date && `Bescherung: ${date}`].filter(Boolean).join(' · ') + (p.b || date ? ' — ' : '') + 'Pssst, nicht verraten! ✌️';
    confetti();
  };

  const start = (withSound) => {
    const story = buildStory(p);
    const lines = story.filter((s) => s.text).length;
    $('intro').hidden = true;
    $('finale').hidden = true;
    $('controls').hidden = false;
    const lyr = $('lyrics');
    lyr.textContent = '';
    lyr.hidden = false;

    // 1 Takt Intro, dann eine Zeile pro Takt, dann 1 Takt Trommelwirbel
    const bars = 1 + lines;
    let beat = null;
    if (withSound) { try { beat = makeBeat(bars); } catch { beat = null; } }
    const startMs = performance.now() + (beat ? 150 : 0);
    const now = () => (beat ? beat.ctx.currentTime - beat.t0 : (performance.now() - startMs) / 1000);
    const barLen = beat ? BAR : BAR * 1.1;
    $('mute').textContent = beat ? '🔇 Ton aus' : '🔈 Ohne Ton';
    $('mute').disabled = !beat;

    let shown = 0, lastBeat = -1, raf = 0;
    const items = story.slice();
    const tick = () => {
      const t = now();
      const due = Math.floor(t / barLen); // Zeile n erscheint zu Beginn von Takt n
      while (shown < due && items.length) {
        let item = items.shift();
        lyr.querySelectorAll('.now').forEach((el) => el.classList.remove('now'));
        if (item.verse) { lyr.append(lineEl(item)); item = items.shift(); }
        const el = lineEl(item);
        el.classList.add('now');
        lyr.append(el);
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        shown++;
      }
      const beatNo = Math.floor(t / (barLen / 4));
      if (beatNo !== lastBeat && t >= 0) {
        lastBeat = beatNo;
        const st = $('stage');
        st.classList.remove('pulse'); void st.offsetWidth; st.classList.add('pulse');
      }
      if (t >= (bars + 1) * barLen) { finish(); return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    run = {
      stop() { cancelAnimationFrame(raf); if (beat) beat.ctx.close().catch(() => {}); },
      toggleMute() {
        if (!beat) return;
        const on = beat.master.gain.value > 0;
        beat.master.gain.value = on ? 0 : 0.8;
        $('mute').textContent = on ? '🔊 Ton an' : '🔇 Ton aus';
      },
    };
  };

  $('play').addEventListener('click', () => start(true));
  $('silent').addEventListener('click', () => start(false));
  $('skip').addEventListener('click', finish);
  $('mute').addEventListener('click', () => run && run.toggleMute());
  $('again').addEventListener('click', () => start(true));
}

// ---------- Konfetti ----------
function confetti() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const c = $('confetti'), x = c.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  c.width = innerWidth * dpr; c.height = innerHeight * dpr;
  x.scale(dpr, dpr);
  const colors = ['#e63946', '#ffcf5c', '#3ddc97', '#ffffff', '#ff8fab'];
  const parts = Array.from({ length: 160 }, () => ({
    x: innerWidth / 2, y: innerHeight * 0.4,
    vx: (Math.random() - 0.5) * 14, vy: -Math.random() * 14 - 4,
    s: 5 + Math.random() * 6, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4,
    c: colors[Math.floor(Math.random() * colors.length)],
  }));
  const startT = performance.now();
  const frame = (now) => {
    x.clearRect(0, 0, innerWidth, innerHeight);
    parts.forEach((p) => {
      p.vy += 0.35; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.fillStyle = p.c;
      x.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); x.restore();
    });
    if (now - startT < 4500) requestAnimationFrame(frame);
    else x.clearRect(0, 0, innerWidth, innerHeight);
  };
  requestAnimationFrame(frame);
}

// ---------- Start ----------
(function main() {
  const code = location.hash.slice(1);
  if (!code) { initSetup(); return; }
  let p;
  try { p = decode(code); } catch { p = null; }
  if (p && p.v === 1 && p.g && p.r) initReveal(p);
  else $('broken').hidden = false;
})();
