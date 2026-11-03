'use strict';
// Zahlenwerk - Zeichnen (heller, minimalistischer Stil)
const cv = document.getElementById('game'), ctx = cv.getContext('2d');
const CAM = { x: 0, y: 0, z: 56 };
let W = 0, H = 0, DPR = 1;
const C = { bg: '#f6f6f3', grid: '#e9e9e4', ink: '#22252b', soft: '#9a9da5', line: '#d3d4cf', belt: '#ebebe6', arrow: '#cfcfc8', even: '#2f6fe0', odd: '#e8833a', acc: '#2f6fe0', white: '#ffffff' };
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight;
  cv.width = W * DPR; cv.height = H * DPR; cv.style.width = W + 'px'; cv.style.height = H + 'px';
}
addEventListener('resize', resize); resize();
const w2sx = x => (x - CAM.x) * CAM.z + W / 2, w2sy = y => (y - CAM.y) * CAM.z + H / 2;
const s2wx = x => (x - W / 2) / CAM.z + CAM.x, s2wy = y => (y - H / 2) / CAM.z + CAM.y;
function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
const FONT = 'ui-rounded, "SF Pro Rounded", system-ui, -apple-system, "Segoe UI", sans-serif';
function chip(cx, cy, v, sz) {
  const s = sz * CAM.z, x = cx - s / 2, y = cy - s / 2, col = v % 2 === 0 ? C.even : C.odd;
  rr(x, y, s, s, s * 0.28); ctx.fillStyle = C.white; ctx.fill();
  ctx.lineWidth = Math.max(1.5, s * 0.07); ctx.strokeStyle = col; ctx.stroke();
  const t = String(v), len = t.length;
  ctx.fillStyle = C.ink; ctx.font = '700 ' + (s * (len > 3 ? 0.36 : len > 2 ? 0.44 : len > 1 ? 0.54 : 0.64)) + 'px ' + FONT;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, cx, cy + s * 0.04);
}
function tri(cx, cy, rot, size, col) {
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot * Math.PI / 2); ctx.fillStyle = col;
  ctx.beginPath(); ctx.moveTo(0, -size); ctx.lineTo(size * 0.9, size * 0.6); ctx.lineTo(-size * 0.9, size * 0.6); ctx.closePath(); ctx.fill(); ctx.restore();
}
function drawBuilding(b, ghost) {
  const z = CAM.z, px = w2sx(b.x), py = w2sy(b.y), cx = px + z / 2, cy = py + z / 2, ins = z * 0.06;
  if (b.type === 'belt') {
    rr(px + ins, py + ins, z - 2 * ins, z - 2 * ins, z * 0.14); ctx.fillStyle = C.belt; ctx.fill();
    if (z > 14) {
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(b.rot * Math.PI / 2);
      ctx.strokeStyle = C.arrow; ctx.lineWidth = Math.max(1.2, z * 0.06); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const off = ((G.t * BELT_SPEED) % 1) * 0.5;
      for (let k = 0; k < 2; k++) { const y = (-0.28 + k * 0.5 + off) % 0.5 - 0.1; ctx.beginPath(); ctx.moveTo(-z * 0.14, z * (y + 0.07)); ctx.lineTo(0, z * (y - 0.06)); ctx.lineTo(z * 0.14, z * (y + 0.07)); ctx.stroke(); }
      ctx.restore();
    }
    return;
  }
  if (b.type === 'hub') {
    const x = w2sx(-1), y = w2sy(-1), s = z * 3;
    rr(x + ins, y + ins, s - 2 * ins, s - 2 * ins, z * 0.3); ctx.fillStyle = C.white; ctx.fill(); ctx.lineWidth = Math.max(2, z * 0.07); ctx.strokeStyle = C.ink; ctx.stroke();
    ctx.fillStyle = C.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '700 ' + z * 0.62 + 'px ' + FONT; ctx.fillText('Hub', x + s / 2, y + s / 2 - z * 0.18);
    ctx.font = '500 ' + z * 0.3 + 'px ' + FONT; ctx.fillStyle = C.soft; ctx.fillText(G.delivered + ' geliefert', x + s / 2, y + s / 2 + z * 0.42);
    return;
  }
  const def = MACH[b.type];
  ctx.save(); if (ghost) ctx.globalAlpha = 0.55;
  if (b.type === 'extractor') {
    rr(px + ins, py + ins, z - 2 * ins, z - 2 * ins, z * 0.2); ctx.fillStyle = C.white; ctx.fill(); ctx.lineWidth = Math.max(1.5, z * 0.05); ctx.strokeStyle = C.ink; ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, z * 0.26, 0, 7); ctx.strokeStyle = C.line; ctx.stroke();
    ctx.fillStyle = C.ink; ctx.font = '700 ' + z * 0.4 + 'px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(b.st.v != null ? b.st.v : '?', cx, cy + z * 0.03);
    const d = DIRS[b.rot]; tri(cx + d[0] * z * 0.4, cy + d[1] * z * 0.4, b.rot, z * 0.1, C.ink);
  } else if (b.type === 'trash') {
    rr(px + ins, py + ins, z - 2 * ins, z - 2 * ins, z * 0.2); ctx.fillStyle = C.white; ctx.fill(); ctx.lineWidth = Math.max(1.5, z * 0.05); ctx.strokeStyle = C.soft; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - z * 0.17, cy - z * 0.17); ctx.lineTo(cx + z * 0.17, cy + z * 0.17); ctx.moveTo(cx + z * 0.17, cy - z * 0.17); ctx.lineTo(cx - z * 0.17, cy + z * 0.17); ctx.stroke();
  } else {
    rr(px + ins, py + ins, z - 2 * ins, z - 2 * ins, z * 0.2); ctx.fillStyle = C.white; ctx.fill(); ctx.lineWidth = Math.max(1.5, z * 0.05); ctx.strokeStyle = C.ink; ctx.stroke();
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(b.rot * Math.PI / 2);
    const dot = (x, y) => { ctx.beginPath(); ctx.arc(x * z, y * z, z * 0.06, 0, 7); ctx.fillStyle = C.soft; ctx.fill(); };
    if (def.bin) { dot(-0.43, 0); dot(0.43, 0); } else if (b.type === 'split') dot(0, 0.43); else dot(0, 0.43);
    ctx.fillStyle = C.acc; ctx.beginPath(); ctx.moveTo(0, -z * 0.5 + ins * 0.5); ctx.lineTo(z * 0.12, -z * 0.35); ctx.lineTo(-z * 0.12, -z * 0.35); ctx.closePath(); ctx.fill();
    if (def.flt) { ctx.fillStyle = C.odd; ctx.beginPath(); ctx.moveTo(z * 0.5 - ins * 0.5, 0); ctx.lineTo(z * 0.35, -z * 0.12); ctx.lineTo(z * 0.35, z * 0.12); ctx.closePath(); ctx.fill(); }
    if (b.type === 'split') {
      ctx.strokeStyle = C.ink; ctx.lineWidth = Math.max(1.5, z * 0.07); ctx.lineCap = 'round'; ctx.beginPath();
      ctx.moveTo(0, z * 0.3); ctx.lineTo(0, -z * 0.28); ctx.moveTo(0, 0.02 * z); ctx.lineTo(-z * 0.28, 0.02 * z); ctx.moveTo(0, 0.02 * z); ctx.lineTo(z * 0.28, 0.02 * z); ctx.stroke();
    }
    ctx.restore();
    if (def.sym) { ctx.fillStyle = C.ink; const l = def.sym.length; ctx.font = '700 ' + z * (l > 2 ? 0.26 : l > 1 ? 0.34 : 0.5) + 'px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(def.sym, cx, cy + z * 0.03); }
    if (!ghost) {
      const s = b.st, r = z * 0.2;
      const mini = (v, dx, dy) => { if (v != null) { const a = b.rot * Math.PI / 2, c = Math.cos(a), sn = Math.sin(a); chip(cx + (dx * c - dy * sn) * z, cy + (dx * sn + dy * c) * z, v, 0.3); } };
      if (def.bin) { mini(s.a, -0.3, 0.3); mini(s.b, 0.3, 0.3); } else if (def.un || def.flt) mini(s.a, 0, 0.3);
    }
  }
  ctx.restore();
}
function drawItems(b) {
  if (b.type === 'belt') {
    const z = CAM.z, cx = w2sx(b.x) + z / 2, cy = w2sy(b.y) + z / 2, d = DIRS[b.rot];
    for (const m of b.items) {
      let ox = d[0] * (m.t - 0.5), oy = d[1] * (m.t - 0.5);
      if (m.sd >= 0 && m.t < 0.75) { const k = 0.5 * (1 - (m.t - 0.5) / 0.25) * (m.t < 0.5 ? 1 : 1); ox += DIRS[m.sd][0] * Math.max(0, k); oy += DIRS[m.sd][1] * Math.max(0, k); }
      chip(cx + ox * z, cy + oy * z, m.v, 0.44);
    }
  }
}
function render(ghost) {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
  const z = CAM.z, x0 = Math.floor(s2wx(0)) - 1, x1 = Math.ceil(s2wx(W)) + 1, y0 = Math.floor(s2wy(0)) - 1, y1 = Math.ceil(s2wy(H)) + 1;
  // Zahlenfelder
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const v = deposit(x, y); if (!v) continue;
    const px = w2sx(x), py = w2sy(y), col = v % 2 === 0 ? C.even : C.odd;
    rr(px + 1, py + 1, z - 2, z - 2, z * 0.12); ctx.globalAlpha = 0.1; ctx.fillStyle = col; ctx.fill(); ctx.globalAlpha = 1;
    if (z > 16) { ctx.fillStyle = col; ctx.globalAlpha = 0.5; ctx.font = '600 ' + z * 0.4 + 'px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(v, px + z / 2, py + z / 2 + z * 0.03); ctx.globalAlpha = 1; }
  }
  // Gitter
  ctx.strokeStyle = C.grid; ctx.lineWidth = 1; ctx.beginPath();
  for (let x = x0; x <= x1; x++) { const sx = Math.round(w2sx(x)) + 0.5; ctx.moveTo(sx, 0); ctx.lineTo(sx, H); }
  for (let y = y0; y <= y1; y++) { const sy = Math.round(w2sy(y)) + 0.5; ctx.moveTo(0, sy); ctx.lineTo(W, sy); }
  ctx.globalAlpha = 0.7; ctx.stroke(); ctx.globalAlpha = 1;
  const vis = G.list.filter(b => b.x >= x0 && b.x <= x1 && b.y >= y0 && b.y <= y1);
  for (const b of vis) if (b.type === 'belt') drawBuilding(b);
  for (const b of vis) if (b.type !== 'belt') drawBuilding(b);
  drawBuilding(hubB);
  for (const b of vis) drawItems(b);
  if (ghost) for (const g of ghost) { if (g.type === 'belt') { ctx.globalAlpha = 0.5; drawBuilding(g); ctx.globalAlpha = 1; } else drawBuilding(g, true); }
}
