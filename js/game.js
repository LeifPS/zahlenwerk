'use strict';
// Zahlenwerk - Spielkern: Daten, Welt, Simulation
const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // 0 oben, 1 rechts, 2 unten, 3 links
const SAVE_KEY = 'zahlenwerk_save_v1';
const BELT_SPEED = 1.8, GAP = 0.46, EXT_CD = 1.1, PROC = 0.45;
let onEvent = () => {};
const isPrime = n => { if (n < 2) return false; for (let i = 2; i * i <= n; i++) if (n % i === 0) return false; return true; };
const isSq = n => n >= 0 && Number.isInteger(Math.sqrt(n));

// Maschinen. bin = zwei Eingaenge (links = a, rechts = b), un = ein Eingang, flt = Filter (passt vorne, sonst rechts)
const MACH = {
  belt: { name: 'Band', info: 'Transportiert Zahlen. Ziehen zum Bauen, die Richtung folgt deiner Bewegung.', free: true },
  extractor: { name: 'Förderer', info: 'Nur auf Zahlenfeldern: erzeugt die Zahl des Feldes.', free: true },
  plus: { name: 'Addieren', sym: '+', bin: true, f: (a, b) => a + b, info: 'Links a, rechts b hineinleiten, vorne kommt a + b heraus.', free: true },
  trash: { name: 'Müll', info: 'Verschluckt alles.', free: true },
  hub: { name: 'Hub' },
  minus: { name: 'Subtrahieren', sym: '−', bin: true, f: (a, b) => a - b, info: 'Links a, rechts b: vorne kommt a − b heraus.', cost: 10 },
  split: { name: 'Weiche', info: 'Verteilt Zahlen reihum nach vorne, links und rechts.', cost: 12 },
  inc: { name: 'Plus 1', sym: '+1', un: true, f: a => a + 1, info: 'Zählt eins dazu.', cost: 15 },
  dbl: { name: 'Verdoppeln', sym: '×2', un: true, f: a => a * 2, info: 'Macht aus a die Zahl 2a.', cost: 25 },
  times: { name: 'Multiplizieren', sym: '×', bin: true, f: (a, b) => a * b, info: 'Links a, rechts b: vorne kommt a × b heraus.', cost: 35 },
  sq: { name: 'Quadrat', sym: 'x²', un: true, f: a => a * a, info: 'Macht aus a die Zahl a × a.', cost: 50 },
  even: { name: 'Gerade-Filter', sym: '2|', flt: true, p: a => a % 2 === 0, info: 'Gerade Zahlen gehen vorne raus, ungerade nach rechts.', cost: 60 },
  div: { name: 'Teilen', sym: '÷', bin: true, f: (a, b) => (b !== 0 && a % b === 0 ? a / b : null), info: 'Links a, rechts b: a ÷ b. Geht es nicht glatt auf, verschwindet das Ergebnis.', cost: 90 },
  root: { name: 'Wurzel', sym: '√', un: true, f: a => (isSq(a) ? Math.sqrt(a) : null), info: 'Nur Quadratzahlen kommen als Wurzel heraus, alles andere verschwindet.', cost: 120 },
  prime: { name: 'Primzahl-Filter', sym: 'P', flt: true, p: isPrime, info: 'Primzahlen gehen vorne raus, alle anderen nach rechts.', cost: 150 },
  mod: { name: 'Rest', sym: 'mod', bin: true, f: (a, b) => (b > 0 ? ((a % b) + b) % b : null), info: 'Links a, rechts b: Rest von a geteilt durch b.', cost: 200 },
};
const TOOL_ORDER = ['belt', 'extractor', 'plus', 'minus', 'inc', 'dbl', 'times', 'div', 'sq', 'root', 'mod', 'split', 'even', 'prime', 'trash'];

const G = { cells: new Map(), list: [], pts: 0, unl: new Set(), orders: [], done: 0, stock: {}, delivered: 0, t: 0 };
const at = (x, y) => G.cells.get(x + ',' + y);
for (const k in MACH) if (MACH[k].free) G.unl.add(k);

// ---- Zahlenfelder (deterministisch pro Chunk) ----
const CH = 12;
const hash = (a, b, c) => { let h = (a * 374761393 + b * 668265263 + c * 1274126177) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return (h ^ (h >>> 16)) >>> 0; };
const FIXED = [[-7, -3, 2.3, 1], [7, 3, 2.3, 2], [-2, 8, 2.3, 3], [3, -8, 2.2, 1], [-9, 6, 2, 2], [10, -4, 2, 3]];
const CHCACHE = new Map();
function chunkPatches(cx, cy) {
  const k = cx + ',' + cy; let p = CHCACHE.get(k); if (p) return p; p = [];
  for (let i = 0; i < 2; i++) {
    const h = hash(cx, cy, i + 7); if (h % 100 > 70) continue;
    const d = Math.hypot(cx, cy);
    const pool = d < 1.6 ? [1, 2, 3] : d < 3 ? [1, 2, 3, 5] : d < 5 ? [2, 3, 5, 7] : [3, 5, 7, 9, 11];
    p.push([cx * CH + 2 + (h >> 3) % 8, cy * CH + 2 + (h >> 7) % 8, 1.5 + ((h >> 11) % 18) / 10, pool[(h >> 15) % pool.length]]);
  }
  CHCACHE.set(k, p); return p;
}
function deposit(x, y) {
  if (Math.abs(x) <= 4 && Math.abs(y) <= 4) return 0;
  for (const [px, py, r, v] of FIXED) if (Math.hypot(x - px, y - py) <= r) return v;
  const cx = Math.floor(x / CH), cy = Math.floor(y / CH);
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const [px, py, r, v] of chunkPatches(cx + i, cy + j)) if (Math.hypot(x - px, y - py) <= r) return v;
  return 0;
}

// ---- Bauen ----
function removeAt(x, y) {
  const b = at(x, y); if (!b || b.type === 'hub') return false;
  G.cells.delete(x + ',' + y); const i = G.list.indexOf(b); if (i >= 0) G.list.splice(i, 1); return true;
}
function place(type, x, y, rot) {
  if (!G.unl.has(type) && type !== 'hub') return 'locked';
  const old = at(x, y);
  if (old && old.type === 'hub') return 'hub';
  if (Math.abs(x) <= 1 && Math.abs(y) <= 1) return 'hub';
  if (type === 'extractor' && !deposit(x, y)) return 'nodep';
  if (old && old.type === type && old.rot === rot) return 'same';
  if (old && old.type === 'belt' && type === 'belt') { old.rot = rot; return 'ok'; }
  if (old) removeAt(x, y);
  const b = { type, x, y, rot, items: [], st: {}, born: G.t };
  onEvent('place', b);
  if (type === 'extractor') b.st.v = deposit(x, y);
  G.cells.set(x + ',' + y, b); G.list.push(b); return 'ok';
}
const hubB = { type: 'hub', x: -1, y: -1, w: 3, h: 3, rot: 0, items: [], st: {} };
function initWorld() {
  G.cells.clear(); G.list.length = 0;
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) G.cells.set(i + ',' + j, hubB);
}

// ---- Weitergeben: von Zelle (fx,fy) in Richtung d ----
function give(fx, fy, d, v) {
  const n = at(fx + DIRS[d][0], fy + DIRS[d][1]); if (!n) return false;
  if (n.type === 'hub') { deliver(v); return true; }
  if (n.type === 'trash') return true;
  if (n.type === 'belt') {
    if (d === (n.rot + 2) % 4) return false;
    for (const m of n.items) if (m.t < GAP) return false;
    const src = at(fx, fy);
    n.items.push({ v, t: 0, ei: (d + 2) % 4, pop: src && src.type !== 'belt' ? 1 : 0 }); n.items.sort((a, b) => b.t - a.t); return true;
  }
  const def = MACH[n.type], rel = (((d + 2) % 4) - n.rot + 4) % 4, s = n.st;
  if (rel === 0 && n.type !== 'extractor') return false;
  if (n.type === 'split') { if (rel !== 2 || s.hold != null) return false; s.hold = v; return true; }
  if (def.bin) { if (rel === 3 && s.a == null) { s.a = v; return true; } if (rel === 1 && s.b == null) { s.b = v; return true; } return false; }
  if (def.un || def.flt) { if (s.a == null) { s.a = v; return true; } return false; }
  return false;
}

function updBelt(b, dt) {
  const it = b.items; let lim = 1;
  for (let i = 0; i < it.length; i++) {
    const m = it[i]; m.t = Math.min(m.t + BELT_SPEED * dt, lim);
    if (i === 0 && m.t >= 1 && give(b.x, b.y, b.rot, m.v)) { it.shift(); i--; lim = 1; continue; }
    lim = m.t - GAP;
  }
}
function updMach(b, dt) {
  const s = b.st, def = MACH[b.type];
  if (b.type === 'extractor') { s.cd = (s.cd || 0) - dt; if (s.cd <= 0) { if (give(b.x, b.y, b.rot, s.v)) { s.cd = EXT_CD; s.pulse = 1; } else s.cd = 0; } return; }
  if (b.type === 'split') {
    if (s.hold == null) return;
    const dirs = [b.rot, (b.rot + 1) % 4, (b.rot + 3) % 4];
    for (let i = 0; i < 3; i++) { const d = dirs[((s.rr || 0) + i) % 3]; if (give(b.x, b.y, d, s.hold)) { s.hold = null; s.rr = ((s.rr || 0) + i + 1) % 3; return; } }
    return;
  }
  if (!def || !(def.bin || def.un || def.flt)) return;
  s.out = s.out || [];
  if (s.out.length) {
    const o = s.out[0], n = at(b.x + DIRS[o.d][0], b.y + DIRS[o.d][1]);
    if (!n && def.flt && o.d !== b.rot) s.out.shift(); // Filter ohne Ausgang rechts: verwerfen
    else if (give(b.x, b.y, o.d, o.v)) s.out.shift();
    return;
  }
  if (s.cd > 0) { s.cd -= dt; return; }
  if (def.bin && s.a != null && s.b != null) { const r = def.f(s.a, s.b); s.a = s.b = null; s.cd = PROC; s.pulse = 1; if (r != null && Math.abs(r) <= 999999) s.out.push({ v: r, d: b.rot }); }
  else if (def.un && s.a != null) { const r = def.f(s.a); s.a = null; s.cd = PROC; s.pulse = 1; if (r != null && Math.abs(r) <= 999999) s.out.push({ v: r, d: b.rot }); }
  else if (def.flt && s.a != null) { const ok = def.p(s.a); s.out.push({ v: s.a, d: ok ? b.rot : (b.rot + 1) % 4 }); s.a = null; s.cd = PROC; s.pulse = 1; }
}
function step(dt) {
  G.t += dt;
  for (const b of G.list) { if (b.type === 'belt') updBelt(b, dt); else { updMach(b, dt); if (b.st.pulse > 0) b.st.pulse = Math.max(0, b.st.pulse - dt * 3.5); } }
  for (const b of G.list) for (const m of b.items) if (m.pop > 0) m.pop = Math.max(0, m.pop - dt * 4);
  if (hubB.st.pulse > 0) hubB.st.pulse = Math.max(0, hubB.st.pulse - dt * 2.5);
}

// ---- Auftraege & Forschung ----
function rnd(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
function genOrder() {
  const L = G.done, active = new Set(G.orders.map(o => o.v));
  for (let tries = 0; tries < 40; tries++) {
    let v = rnd(4, 8 + L * 2);
    if (G.unl.has('times') && Math.random() < 0.4) v = rnd(2, 6 + Math.floor(L / 2)) * rnd(2, 6 + Math.floor(L / 2));
    if (G.unl.has('sq') && Math.random() < 0.25) { const r = rnd(3, 5 + Math.floor(L / 2)); v = r * r; }
    if (G.unl.has('prime') && Math.random() < 0.2) { do { v = rnd(5, 30 + L); } while (!isPrime(v)); }
    if (v > 600 || active.has(v)) continue;
    const need = Math.max(3, Math.min(20, 4 + rnd(0, Math.min(10, L)) - (v > 60 ? 2 : 0)));
    return { v, need, got: 0, reward: Math.max(2, Math.round(need * Math.log2(v + 1) * 0.7)) };
  }
  return { v: 7, need: 4, got: 0, reward: 8 };
}
function ensureOrders() { while (G.orders.length < 3) G.orders.push(genOrder()); }
function deliver(v) {
  G.stock[v] = (G.stock[v] || 0) + 1; G.delivered++; hubB.st.pulse = 1; onEvent('deliver', v);
  const o = G.orders.find(o => o.v === v && o.got < o.need);
  if (o) { o.got++; if (o.got >= o.need) { G.pts += o.reward; G.done++; G.orders[G.orders.indexOf(o)] = genOrder(); onEvent('order', o); } }
}
function buy(type) { const d = MACH[type]; if (!d || G.unl.has(type) || G.pts < d.cost) return false; G.pts -= d.cost; G.unl.add(type); return true; }

// ---- Speichern ----
function saveGame() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ v: 1, pts: G.pts, unl: [...G.unl], orders: G.orders, done: G.done, stock: G.stock, delivered: G.delivered,
      b: G.list.map(b => [b.type, b.x, b.y, b.rot])}));
  } catch (e) {}
}
function loadGame() {
  initWorld();
  let d = null; try { d = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) {}
  if (!d) { ensureOrders(); return false; }
  G.pts = d.pts || 0; G.done = d.done || 0; G.stock = d.stock || {}; G.delivered = d.delivered || 0;
  G.unl = new Set(['belt', 'extractor', 'plus', 'trash', ...(d.unl || [])]);
  for (const [t, x, y, r] of d.b || []) { if (MACH[t]) { G.unl.add(t); place(t, x, y, r); } }
  G.orders = d.orders || []; ensureOrders(); return true;
}
function resetGame() { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} G.pts = 0; G.done = 0; G.stock = {}; G.delivered = 0; G.orders = []; G.unl = new Set(); for (const k in MACH) if (MACH[k].free) G.unl.add(k); initWorld(); ensureOrders(); }
