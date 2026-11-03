'use strict';
// Zahlenwerk - Zeichnen: heller, ruhiger Stil mit weichen Schatten und Farbcodes pro Zahlengroesse
const cv = document.getElementById('game'), ctx = cv.getContext('2d');
const CAM = { x: 0, y: 0, z: 56, tz: 56 };
let W = 0, H = 0, DPR = 1;
const C = { bg: '#f5f4f0', dot: '#d9d6cc', ink: '#23262d', soft: '#9a9ca4', edge: '#d8d5cb', trackO: '#d3cfc3', trackI: '#e9e6de', arrow: '#cdc9bc', white: '#ffffff', bin: '#2f6fe0', un: '#1fa36a', flt: '#f08a24', neutral: '#6b7280' };
const NUMCOL = ['#8a8f99', '#22a565', '#2f6fe0', '#8b5cf6', '#f08a24', '#e5484d'];
const numCol = v => NUMCOL[Math.min(NUMCOL.length, String(Math.abs(v)).length) - 1];
const FONT = 'ui-rounded, "SF Pro Rounded", system-ui, -apple-system, "Segoe UI", sans-serif';
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight;
  cv.width = W * DPR; cv.height = H * DPR; cv.style.width = W + 'px'; cv.style.height = H + 'px';
}
addEventListener('resize', resize); resize();
const w2sx = x => (x - CAM.x) * CAM.z + W / 2, w2sy = y => (y - CAM.y) * CAM.z + H / 2;
const s2wx = x => (x - W / 2) / CAM.z + CAM.x, s2wy = y => (y - H / 2) / CAM.z + CAM.y;
function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
const ease = t => { const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };

// Zahl ohne Kasten: farbig nach Groesse, mit weichem weissen Rand
function num(cx, cy, v, size, alpha) {
  const t = String(v), len = t.length, f = size * (len > 4 ? 0.3 : len > 3 ? 0.36 : len > 2 ? 0.44 : len > 1 ? 0.56 : 0.7);
  ctx.save(); if (alpha != null) ctx.globalAlpha = alpha;
  ctx.font = '800 ' + f + 'px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(2, f * 0.26); ctx.strokeStyle = 'rgba(255,255,255,.92)'; ctx.strokeText(t, cx, cy + f * 0.05);
  ctx.fillStyle = numCol(v); ctx.fillText(t, cx, cy + f * 0.05); ctx.restore();
}
function softShadow(on, z, k) { if (on) { ctx.shadowColor = 'rgba(52,44,24,' + (0.16 * (k || 1)) + ')'; ctx.shadowBlur = z * 0.2; ctx.shadowOffsetY = z * 0.07; } else { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; } }

// ---- Baender: durchgehende Spur ----
function outDirs(n) {
  if (n.type === 'belt' || n.type === 'extractor') return [n.rot];
  if (n.type === 'split') return [n.rot, (n.rot + 1) % 4, (n.rot + 3) % 4];
  const d = MACH[n.type]; if (d.flt) return [n.rot, (n.rot + 1) % 4];
  if (d.bin || d.un) return [n.rot];
  return [];
}
function beltEntries(b) {
  const es = [];
  for (let k = 0; k < 4; k++) {
    if (k === b.rot) continue;
    const n = at(b.x + DIRS[k][0], b.y + DIRS[k][1]); if (!n || n.type === 'hub') continue;
    if (outDirs(n).includes((k + 2) % 4)) es.push(k);
  }
  if (!es.length) es.push((b.rot + 2) % 4);
  return es;
}
function trackPath(b, es, z, px, py) {
  const cx = px + z / 2, cy = py + z / 2, f = DIRS[b.rot];
  for (const e of es) { const d = DIRS[e]; ctx.moveTo(cx + d[0] * z / 2, cy + d[1] * z / 2); ctx.quadraticCurveTo(cx, cy, cx + f[0] * z / 2, cy + f[1] * z / 2); }
}
function beltPt(b, ei, u, z, cx, cy) {
  const e = DIRS[ei], f = DIRS[b.rot], a = (1 - u) * (1 - u), c = 2 * u * (1 - u), d = u * u;
  const x = a * e[0] * 0.5 + d * f[0] * 0.5, y = a * e[1] * 0.5 + d * f[1] * 0.5;
  const tx = 2 * (1 - u) * (0 - e[0] * 0.5) + 2 * u * (f[0] * 0.5), ty = 2 * (1 - u) * (0 - e[1] * 0.5) + 2 * u * (f[1] * 0.5);
  return { x: cx + x * z, y: cy + y * z, ang: Math.atan2(ty, tx) };
}
function drawBelts(vis, z) {
  const items = vis.filter(b => b.type === 'belt'); if (!items.length) return;
  const E = new Map(); for (const b of items) E.set(b, beltEntries(b));
  for (const [col, wd] of [[C.trackO, 0.84], [C.trackI, 0.7]]) {
    ctx.strokeStyle = col; ctx.lineWidth = z * wd; ctx.lineCap = 'butt'; ctx.lineJoin = 'round'; ctx.beginPath();
    for (const b of items) trackPath(b, E.get(b), z, w2sx(b.x), w2sy(b.y)); ctx.stroke();
  }
  if (z < 22) return;
  ctx.fillStyle = C.arrow; const ph = (G.t * BELT_SPEED * 0.5) % 1;
  for (const b of items) {
    const cx = w2sx(b.x) + z / 2, cy = w2sy(b.y) + z / 2, ei = E.get(b)[0];
    for (let j = 0; j < 2; j++) {
      const q = beltPt(b, ei, (ph + j * 0.5) % 1, z, cx, cy);
      ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.ang + Math.PI / 2); ctx.beginPath();
      ctx.moveTo(0, -z * 0.1); ctx.lineTo(z * 0.12, z * 0.06); ctx.lineTo(0, z * 0.02); ctx.lineTo(-z * 0.12, z * 0.06); ctx.closePath(); ctx.fill(); ctx.restore();
    }
  }
}
function drawBeltItems(b, z) {
  if (!b.items.length) return;
  const cx = w2sx(b.x) + z / 2, cy = w2sy(b.y) + z / 2;
  for (const m of b.items) { const q = beltPt(b, m.ei, Math.min(1, m.t), z, cx, cy); num(q.x, q.y, m.v, z * (0.62 + 0.3 * (m.pop || 0))); }
}

// ---- Maschinen ----
function kindCol(b) { const d = MACH[b.type]; return b.type === 'extractor' ? numCol(b.st.v || 1) : d.bin ? C.bin : d.un ? C.un : d.flt ? C.flt : C.neutral; }
function drawMachine(b, ghost) {
  const z = CAM.z, cx = w2sx(b.x) + z / 2, cy = w2sy(b.y) + z / 2, def = MACH[b.type], col = kindCol(b), pulse = b.st.pulse || 0;
  let sc = 1 + 0.07 * pulse; if (b.born != null && !ghost) { const a = (G.t - b.born) / 0.3; if (a < 1) sc *= 0.55 + 0.45 * ease(Math.max(0, a)); }
  ctx.save(); ctx.translate(cx, cy); ctx.scale(sc, sc); if (ghost) ctx.globalAlpha = 0.62;
  const h = z * 0.43;
  softShadow(!ghost, z, 1 + pulse * 0.4);
  rr(-h, -h, 2 * h, 2 * h, z * 0.2);
  const g = ctx.createLinearGradient(0, -h, 0, h); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#f3f1ea'); ctx.fillStyle = g; ctx.fill(); softShadow(false);
  ctx.lineWidth = Math.max(1.2, z * 0.035); ctx.strokeStyle = pulse > 0 ? col : C.edge; ctx.stroke();
  if (ghost && b.valid === false) { ctx.strokeStyle = '#e5484d'; ctx.lineWidth = z * 0.07; ctx.stroke(); }
  ctx.save(); ctx.rotate(b.rot * Math.PI / 2);
  // Anschluesse: Eingaenge als kleine Kerben, Ausgang als Pfeil in Gerätefarbe
  ctx.fillStyle = C.edge;
  const notch = (x, y) => { ctx.beginPath(); ctx.arc(x * z, y * z, z * 0.055, 0, 7); ctx.fill(); };
  if (def.bin) { notch(-0.43, 0); notch(0.43, 0); } else if (b.type !== 'extractor') notch(0, 0.43);
  if (b.type !== 'trash') { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, -z * 0.5); ctx.lineTo(z * 0.1, -z * 0.385); ctx.lineTo(-z * 0.1, -z * 0.385); ctx.closePath(); ctx.fill(); }
  if (def.flt) { ctx.fillStyle = C.neutral; ctx.beginPath(); ctx.moveTo(z * 0.5, 0); ctx.lineTo(z * 0.385, -z * 0.09); ctx.lineTo(z * 0.385, z * 0.09); ctx.closePath(); ctx.fill(); }
  ctx.restore();
  if (b.type === 'extractor') {
    ctx.beginPath(); ctx.arc(0, 0, z * 0.3, 0, 7); ctx.lineWidth = z * 0.045; ctx.strokeStyle = col; ctx.globalAlpha *= 0.35; ctx.stroke(); ctx.globalAlpha = ghost ? 0.62 : 1;
    if (b.st.v != null) num(0, 0, b.st.v, z * 0.78);
  } else if (b.type === 'trash') {
    ctx.strokeStyle = C.soft; ctx.lineWidth = z * 0.06; ctx.lineCap = 'round'; ctx.beginPath(); const k = z * 0.14; ctx.moveTo(-k, -k); ctx.lineTo(k, k); ctx.moveTo(k, -k); ctx.lineTo(-k, k); ctx.stroke();
  } else if (b.type === 'split') {
    ctx.save(); ctx.rotate(b.rot * Math.PI / 2); ctx.strokeStyle = C.neutral; ctx.lineWidth = z * 0.07; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
    ctx.moveTo(0, z * 0.28); ctx.lineTo(0, 0); ctx.lineTo(0, -z * 0.26); ctx.moveTo(0, 0); ctx.lineTo(-z * 0.26, 0); ctx.moveTo(0, 0); ctx.lineTo(z * 0.26, 0); ctx.stroke(); ctx.restore();
  } else if (def.sym) {
    const l = def.sym.length; ctx.fillStyle = col; ctx.font = '800 ' + z * (l > 2 ? 0.27 : l > 1 ? 0.36 : 0.52) + 'px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(def.sym, 0, z * 0.03);
  }
  ctx.restore();
  if (!ghost && z > 30 && (def.bin || def.un || def.flt)) {
    const s = b.st, a = b.rot * Math.PI / 2, ca = Math.cos(a), sa = Math.sin(a);
    const held = (v, dx, dy) => { if (v != null) num(cx + (dx * ca - dy * sa) * z, cy + (dx * sa + dy * ca) * z, v, z * 0.4); };
    if (def.bin) { held(s.a, -0.27, 0.27); held(s.b, 0.27, 0.27); } else held(s.a, 0, 0.27);
  }
}
function drawHub() {
  const z = CAM.z, x = w2sx(-1), y = w2sy(-1), s = z * 3, p = hubB.st.pulse || 0, sc = 1 + 0.025 * p;
  ctx.save(); ctx.translate(x + s / 2, y + s / 2); ctx.scale(sc, sc);
  softShadow(true, z * 2.2, 1.1); rr(-s / 2 + z * 0.05, -s / 2 + z * 0.05, s - z * 0.1, s - z * 0.1, z * 0.38);
  const g = ctx.createLinearGradient(0, -s / 2, 0, s / 2); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#f1efe8'); ctx.fillStyle = g; ctx.fill(); softShadow(false);
  ctx.lineWidth = Math.max(2, z * 0.06); ctx.strokeStyle = C.ink; ctx.stroke();
  rr(-s / 2 + z * 0.3, -s / 2 + z * 0.3, s - z * 0.6, s - z * 0.6, z * 0.22); ctx.lineWidth = Math.max(1, z * 0.025); ctx.strokeStyle = C.edge; ctx.stroke();
  ctx.fillStyle = C.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '800 ' + z * 0.62 + 'px ' + FONT; ctx.fillText('Hub', 0, -z * 0.15);
  ctx.font = '600 ' + z * 0.28 + 'px ' + FONT; ctx.fillStyle = C.soft; ctx.fillText(G.delivered + ' geliefert', 0, z * 0.42);
  ctx.restore();
  if (p > 0) { ctx.save(); ctx.globalAlpha = p * 0.5; ctx.strokeStyle = C.ink; ctx.lineWidth = z * 0.04; rr(x - z * 0.3 * (1 - p), y - z * 0.3 * (1 - p), s + z * 0.6 * (1 - p), s + z * 0.6 * (1 - p), z * 0.5); ctx.stroke(); ctx.restore(); }
}
// ---- Partikel ----
const FX = [];
function fxBurst(col, n, cx, cy, spd) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, s = (0.4 + Math.random()) * spd; FX.push({ x: cx, y: cy, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, col, r: 0.05 + Math.random() * 0.07 }); } }
function fxUpdate(dt) { for (let i = FX.length - 1; i >= 0; i--) { const p = FX[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.96; p.vy = p.vy * 0.96 + 1.2 * dt; p.life -= dt * 1.1; if (p.life <= 0) FX.splice(i, 1); } }
function drawFx() { for (const p of FX) { ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(w2sx(p.x), w2sy(p.y), p.r * CAM.z * p.life, 0, 7); ctx.fill(); } ctx.globalAlpha = 1; }

function render(ghost) {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
  const z = CAM.z, x0 = Math.floor(s2wx(0)) - 1, x1 = Math.ceil(s2wx(W)) + 1, y0 = Math.floor(s2wy(0)) - 1, y1 = Math.ceil(s2wy(H)) + 1;
  // Zahlenfelder als weiche Flaechen
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const v = deposit(x, y); if (!v) continue;
    const ax = Math.round(w2sx(x)), ay = Math.round(w2sy(y)), bx = Math.round(w2sx(x + 1)), by = Math.round(w2sy(y + 1));
    ctx.globalAlpha = 0.14; ctx.fillStyle = numCol(v); ctx.fillRect(ax, ay, bx - ax, by - ay); ctx.globalAlpha = 1;
    if (z > 20) { ctx.globalAlpha = 0.5; ctx.fillStyle = numCol(v); ctx.font = '800 ' + z * 0.42 + 'px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(v, (ax + bx) / 2, (ay + by) / 2 + z * 0.03); ctx.globalAlpha = 1; }
  }
  // Raster als feine Punkte
  if (z > 20) { ctx.fillStyle = C.dot; const r = Math.max(1, z * 0.028); ctx.beginPath(); for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const sx = w2sx(x), sy = w2sy(y); ctx.moveTo(sx + r, sy); ctx.arc(sx, sy, r, 0, 7); } ctx.fill(); }
  const vis = G.list.filter(b => b.x >= x0 && b.x <= x1 && b.y >= y0 && b.y <= y1);
  drawBelts(vis, z);
  for (const b of vis) if (b.type !== 'belt') drawMachine(b);
  drawHub();
  for (const b of vis) if (b.type === 'belt') drawBeltItems(b, z);
  if (ghost) for (const g of ghost) { if (g.type === 'belt') { ctx.globalAlpha = 0.55; ctx.strokeStyle = C.trackO; ctx.lineWidth = z * 0.8; ctx.lineCap = 'butt'; ctx.beginPath(); trackPath(g, [(g.rot + 2) % 4], z, w2sx(g.x), w2sy(g.y)); ctx.stroke(); ctx.strokeStyle = C.trackI; ctx.lineWidth = z * 0.66; ctx.stroke(); ctx.globalAlpha = 1; } else drawMachine(g, true); }
  drawFx();
  // dezente Vignette
  const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.45, W / 2, H / 2, Math.hypot(W, H) * 0.62); vg.addColorStop(0, 'rgba(70,58,30,0)'); vg.addColorStop(1, 'rgba(70,58,30,0.075)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
}
