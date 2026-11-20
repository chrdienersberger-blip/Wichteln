'use strict';
// Wichtelautomat: Die Auslosung läuft komplett im Browser.
// Die Zuordnung steckt verschleiert im #-Teil des Links. Der wird nie an einen Server geschickt.

const $ = (id) => document.getElementById(id);
const STORE = 'wichteln-v1';
const KEY = 'wichtel-automat';

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
  return new Date(+m[1], m[2] - 1, +m[3]).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });
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
    if (seen.has(n.toLowerCase())) throw new Error(`„${n}“ steht doppelt in der Liste.`);
    seen.add(n.toLowerCase());
  }
  const blocked = new Set();
  $('excl').value.split('\n').map((s) => s.trim()).filter(Boolean).forEach((line) => {
    const pair = line.split(/\s+[-–]\s+|\s*[,&/]\s*|\s+und\s+/i).map((s) => s.trim()).filter(Boolean);
    if (pair.length < 2) throw new Error(`Ausnahme „${line}“ bitte so schreiben: „Anna - Ben“.`);
    pair.forEach((p) => { if (!seen.has(p.toLowerCase())) throw new Error(`„${p}“ aus den Ausnahmen steht nicht in der Teilnehmerliste.`); });
    for (const a of pair) for (const b of pair) if (a !== b) blocked.add(a.toLowerCase() + '\n' + b.toLowerCase());
  });
  return { names, blocked };
}

function linkFor(code) { return location.href.split('#')[0] + '#' + code; }

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); }
  catch {
    const ta = document.createElement('textarea');
    ta.value = text; document.body.append(ta); ta.select();
    document.execCommand('copy'); ta.remove();
  }
}

function renderLinks(data) {
  const ul = $('links');
  ul.textContent = '';
  data.links.forEach(({ name, code }) => {
    const li = document.createElement('li');
    const who = document.createElement('span');
    who.className = 'who';
    who.textContent = name;
    const ok = document.createElement('span');
    ok.className = 'ok';
    const copy = document.createElement('button');
    copy.type = 'button';
    copy.className = 'small';
    copy.textContent = 'Link kopieren';
    copy.addEventListener('click', async () => { await copyText(linkFor(code)); ok.textContent = 'kopiert ✓'; });
    li.append(who, ok, copy);
    if (navigator.share) {
      const share = document.createElement('button');
      share.type = 'button';
      share.className = 'small';
      share.textContent = 'Teilen';
      share.addEventListener('click', async () => {
        try { await navigator.share({ title: 'Wichteln', text: `Hallo ${name}, hier ist dein Wichtel-Link:`, url: linkFor(code) }); ok.textContent = 'geteilt ✓'; } catch { /* abgebrochen */ }
      });
      li.append(share);
    }
    ul.append(li);
  });
  $('result').hidden = false;
}

function initSetup() {
  $('setup').hidden = false;
  const saved = load();
  ['names', 'budget', 'date', 'excl'].forEach((id) => { if (saved[id]) $(id).value = saved[id]; });
  if (saved.links) renderLinks(saved);

  $('form').addEventListener('submit', (e) => {
    e.preventDefault();
    const err = $('error');
    err.hidden = true;
    let setup;
    try { setup = parseSetup(); } catch (ex) { err.textContent = ex.message; err.hidden = false; return; }
    if (load().links && !confirm('Neu auslosen? Die bisherigen Links gelten dann nicht mehr.')) return;
    const pairs = draw(setup.names, setup.blocked);
    if (!pairs) {
      err.textContent = 'Mit diesen Ausnahmen geht die Auslosung nicht auf. Bitte Ausnahmen streichen.';
      err.hidden = false;
      return;
    }
    const data = { names: $('names').value, budget: $('budget').value.trim(), date: $('date').value, excl: $('excl').value };
    data.links = pairs.map(([g, r]) => ({ name: g, code: encode({ v: 1, g, r, b: data.budget, d: data.date }) }));
    save(data);
    renderLinks(data);
    $('result').scrollIntoView({ behavior: 'smooth' });
  });

  $('copyAll').addEventListener('click', async (e) => {
    const data = load();
    if (!data.links) return;
    await copyText(data.links.map(({ name, code }) => `${name}: ${linkFor(code)}`).join('\n\n'));
    e.target.textContent = 'Kopiert ✓';
    setTimeout(() => { e.target.textContent = 'Alle Links kopieren'; }, 2000);
  });
}

// ---------- Ergebnis ansehen ----------
function initReveal(p) {
  $('reveal').hidden = false;
  $('giver').textContent = p.g;
  let opened = false;
  const open = () => {
    if (opened) return;
    opened = true;
    $('gift').classList.add('open');
    $('show').hidden = true;
    $('hiddenPart').hidden = true;
    $('receiver').textContent = p.r;
    const date = formatDate(p.d);
    $('details').textContent = [p.b && `Budget: ${p.b}`, date && `Bescherung: ${date}`].filter(Boolean).join(' · ');
    setTimeout(() => { $('shownPart').hidden = false; }, 450);
  };
  $('show').addEventListener('click', open);
  $('gift').addEventListener('click', open);
}

// ---------- Schneefall (nur Deko) ----------
function snow() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const box = $('snow');
  for (let i = 0; i < 40; i++) {
    const f = document.createElement('span');
    f.textContent = Math.random() < 0.3 ? '❄' : '•';
    f.style.left = Math.random() * 100 + '%';
    f.style.fontSize = (6 + Math.random() * 12) + 'px';
    f.style.opacity = (0.35 + Math.random() * 0.6).toFixed(2);
    f.style.animationDuration = (8 + Math.random() * 12) + 's';
    f.style.animationDelay = -(Math.random() * 20) + 's';
    f.style.setProperty('--drift', (Math.random() * 80 - 40) + 'px');
    box.append(f);
  }
}

(function main() {
  snow();
  const code = location.hash.slice(1);
  if (!code) { initSetup(); return; }
  let p;
  try { p = decode(code); } catch { p = null; }
  if (p && p.v === 1 && p.g && p.r) initReveal(p);
  else $('broken').hidden = false;
})();
