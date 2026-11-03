'use strict';
// Zahlenwerk - Bedienung
const UI = { tool: null, rot: 1, last: null, mx: 0, my: 0, pan: null, ptrs: new Map(), pinch: null, painting: false, seen: new Set(JSON.parse(localStorage.getItem('zahlenwerk_seen') || '[]')) };
const $ = id => document.getElementById(id);
const SYM = { belt: '➜', extractor: '◉', trash: '✕', split: '⑂', del: '⌫' };
let toastT = 0;
function toast(t) { const e = $('toast'); e.textContent = t; e.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => e.hidden = true, 2200); }
onEvent = (k, o) => { if (k === 'order') toast('Auftrag ' + o.v + ' erfüllt: +' + o.reward + ' Punkte'); };

function toolList() { const a = TOOL_ORDER.filter(t => G.unl.has(t)); a.push('del'); return a; }
function selectTool(t) { UI.tool = t; UI.last = null; document.body.classList.toggle('tool', !!t); buildBar(); showTip(t); }
function showTip(t) {
  const e = $('tip'); if (!t) { e.hidden = true; return; }
  e.textContent = t === 'del' ? 'Abriss: Tippen oder Ziehen entfernt Bauteile.' : MACH[t].name + ' – ' + (MACH[t].info || ''); e.hidden = false;
  clearTimeout(showTip.t); showTip.t = setTimeout(() => e.hidden = true, 3500);
}
function buildBar() {
  const bar = $('bar'); bar.innerHTML = '';
  const mk = (id, sym, label, key) => {
    const b = document.createElement('button'); b.className = 'tool' + (UI.tool === id ? ' on' : '') + (id && UI.seen.has('new:' + id) ? '' : '');
    b.innerHTML = (key ? '<span class="k">' + key + '</span>' : '') + '<span class="s">' + sym + '</span><span class="l">' + label + '</span>';
    b.onclick = e => { e.stopPropagation(); selectTool(UI.tool === id ? null : id); }; bar.appendChild(b);
  };
  mk(null, '✋', 'Hand', '');
  toolList().forEach((t, i) => {
    const key = i < 9 ? String(i + 1) : i === 9 ? '0' : '';
    mk(t, t === 'del' ? SYM.del : (MACH[t].sym || SYM[t]), t === 'del' ? 'Abriss' : MACH[t].name.length > 9 ? MACH[t].name.slice(0, 8) + '.' : MACH[t].name, key);
  });
}
function buildOrders() {
  const box = $('orders'); const key = JSON.stringify(G.orders.map(o => [o.v, o.got, o.need]));
  if (buildOrders.k === key) return; buildOrders.k = key; box.innerHTML = '';
  for (const o of G.orders) {
    const d = document.createElement('div'); d.className = 'ord';
    d.innerHTML = '<div class="n' + (o.v % 2 ? ' o' : '') + '">' + o.v + '</div><div class="m"><b>' + o.got + ' / ' + o.need + '</b><br>+' + o.reward + ' Punkte<div class="bar"><i style="width:' + Math.round(100 * o.got / o.need) + '%"></i></div></div>';
    box.appendChild(d);
  }
}
function updTop() {
  $('ptsN').textContent = G.pts;
  const aff = Object.keys(MACH).some(k => MACH[k].cost && !G.unl.has(k) && G.pts >= MACH[k].cost);
  $('resDot').style.display = aff ? 'block' : 'none';
}
// ---- Forschung ----
function buildResearch() {
  const l = $('resList'); l.innerHTML = ''; $('resPts').textContent = G.pts + ' Punkte';
  const keys = Object.keys(MACH).filter(k => MACH[k].cost).sort((a, b) => MACH[a].cost - MACH[b].cost);
  for (const k of keys) {
    const d = MACH[k], have = G.unl.has(k), e = document.createElement('div'); e.className = 'ri' + (have ? ' have' : '');
    e.innerHTML = '<div class="s">' + (d.sym || SYM[k] || '?') + '</div><div class="t"><b>' + d.name + '</b><span>' + d.info + '</span></div>' + (have ? '' : '<button' + (G.pts < d.cost ? ' disabled' : '') + '>' + d.cost + '</button>');
    if (!have) e.querySelector('button').onclick = () => { if (buy(k)) { buildResearch(); buildBar(); updTop(); saveGame(); toast(d.name + ' freigeschaltet'); } };
    l.appendChild(e);
  }
}
$('btnRes').onclick = () => { buildResearch(); $('research').hidden = false; $('menu').hidden = true; };
$('resClose').onclick = () => $('research').hidden = true;
$('research').onclick = e => { if (e.target === $('research')) $('research').hidden = true; };
$('btnMenu').onclick = e => { e.stopPropagation(); $('menu').hidden = !$('menu').hidden; };
$('mHome').onclick = () => { CAM.x = 0.5; CAM.y = 0.5; $('menu').hidden = true; };
$('mSave').onclick = () => { saveGame(); toast('Gespeichert'); $('menu').hidden = true; };
$('mReset').onclick = () => { $('menu').hidden = true; if (confirm('Wirklich alles löschen und neu anfangen?')) { resetGame(); selectTool(null); buildOrders.k = ''; } };
$('btnRot').onclick = e => { e.stopPropagation(); UI.rot = (UI.rot + 1) % 4; };

// ---- Eingabe ----
const cellAt = (sx, sy) => [Math.floor(s2wx(sx)), Math.floor(s2wy(sy))];
function act(x, y, from) {
  const t = UI.tool; if (!t) return;
  if (t === 'del') { removeAt(x, y); return; }
  let rot = UI.rot;
  if (t === 'belt' && from && (from[0] !== x || from[1] !== y)) {
    const dx = x - from[0], dy = y - from[1];
    if (Math.abs(dx) + Math.abs(dy) === 1) { rot = DIRS.findIndex(d => d[0] === dx && d[1] === dy); UI.rot = rot; const p = at(from[0], from[1]); if (p && p.type === 'belt') p.rot = rot; }
  }
  const r = place(t, x, y, rot);
  if (r === 'nodep') toast('Förderer gehen nur auf Zahlenfeldern');
  else if (r === 'hub') toast('Der Hub ist im Weg');
}
cv.addEventListener('contextmenu', e => e.preventDefault());
cv.addEventListener('pointerdown', e => {
  $('menu').hidden = true; cv.setPointerCapture(e.pointerId); UI.ptrs.set(e.pointerId, [e.clientX, e.clientY]); UI.mx = e.clientX; UI.my = e.clientY;
  if (e.button === 2) { if (UI.tool) selectTool(null); return; }
  if (UI.ptrs.size === 2) { UI.painting = false; UI.pan = null; const [a, b] = [...UI.ptrs.values()]; UI.pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), z: CAM.z, cx: (a[0] + b[0]) / 2, cy: (a[1] + b[1]) / 2 }; return; }
  if (UI.tool && (e.button === 0)) { UI.painting = true; const [x, y] = cellAt(e.clientX, e.clientY); act(x, y, null); UI.last = [x, y]; }
  else UI.pan = { sx: e.clientX, sy: e.clientY, cx: CAM.x, cy: CAM.y };
});
cv.addEventListener('pointermove', e => {
  UI.mx = e.clientX; UI.my = e.clientY;
  if (UI.ptrs.has(e.pointerId)) UI.ptrs.set(e.pointerId, [e.clientX, e.clientY]);
  if (UI.pinch && UI.ptrs.size >= 2) {
    const [a, b] = [...UI.ptrs.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
    CAM.z = Math.max(14, Math.min(120, UI.pinch.z * d / UI.pinch.d)); return;
  }
  if (UI.painting) {
    const [x, y] = cellAt(e.clientX, e.clientY);
    if (UI.last && (x !== UI.last[0] || y !== UI.last[1])) {
      // Zellen zwischen letzter und aktueller Position nacheinander bearbeiten
      let [lx, ly] = UI.last, n = 0;
      while ((lx !== x || ly !== y) && n++ < 40) { const sx = Math.sign(x - lx), sy = Math.sign(y - ly); const nx = Math.abs(x - lx) >= Math.abs(y - ly) ? lx + sx : lx, ny = Math.abs(x - lx) >= Math.abs(y - ly) ? ly : ly + sy; act(nx, ny, [lx, ly]); lx = nx; ly = ny; }
      UI.last = [x, y];
    }
  } else if (UI.pan) { CAM.x = UI.pan.cx - (e.clientX - UI.pan.sx) / CAM.z; CAM.y = UI.pan.cy - (e.clientY - UI.pan.sy) / CAM.z; }
});
const up = e => { UI.ptrs.delete(e.pointerId); if (UI.ptrs.size < 2) UI.pinch = null; if (!UI.ptrs.size) { UI.painting = false; UI.pan = null; UI.last = null; } };
cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
cv.addEventListener('wheel', e => {
  e.preventDefault(); const wx = s2wx(e.clientX), wy = s2wy(e.clientY);
  CAM.z = Math.max(14, Math.min(120, CAM.z * Math.exp(-e.deltaY * 0.0015)));
  CAM.x = wx - (e.clientX - W / 2) / CAM.z; CAM.y = wy - (e.clientY - H / 2) / CAM.z;
}, { passive: false });
addEventListener('keydown', e => {
  if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
  const k = e.key.toLowerCase();
  if (k === 'escape') { if (!$('research').hidden) $('research').hidden = true; else selectTool(null); }
  else if (k === 'r') { if (UI.tool) UI.rot = (UI.rot + (e.shiftKey ? 3 : 1)) % 4; else { const [x, y] = cellAt(UI.mx, UI.my), b = at(x, y); if (b && b.type !== 'hub') b.rot = (b.rot + 1) % 4; } }
  else if (k === 'f') { $('btnRes').click(); }
  else if (/^[0-9]$/.test(k)) { const i = k === '0' ? 9 : +k - 1, l = toolList(); if (l[i]) selectTool(UI.tool === l[i] ? null : l[i]); }
});

// ---- Hauptschleife ----
function ghostList() {
  if (!UI.tool || UI.tool === 'del' || UI.ptrs.size > 1) return null;
  const [x, y] = cellAt(UI.mx, UI.my); if (Math.abs(x) <= 1 && Math.abs(y) <= 1) return null;
  return [{ type: UI.tool, x, y, rot: UI.rot, items: [], st: { v: deposit(x, y) || null } }];
}
let lastT = performance.now(), acc = 0, saveT = 0;
function loop(now) {
  const dt = Math.min(0.1, (now - lastT) / 1000); lastT = now; acc += dt;
  while (acc >= 1 / 30) { step(1 / 30); acc -= 1 / 30; }
  saveT += dt; if (saveT > 5) { saveT = 0; saveGame(); }
  buildOrders(); updTop(); render(ghostList()); requestAnimationFrame(loop);
}
loadGame(); CAM.x = 0.5; CAM.y = 0.5; buildBar();
addEventListener('beforeunload', saveGame); document.addEventListener('visibilitychange', () => { if (document.hidden) saveGame(); });
requestAnimationFrame(loop);
