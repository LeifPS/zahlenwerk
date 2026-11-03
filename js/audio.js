'use strict';
// Zahlenwerk - leise, weiche Klaenge (WebAudio)
const SND = { ctx: null, on: localStorage.getItem('zahlenwerk_mute') !== '1', last: {} };
function sndInit() { if (SND.ctx) { if (SND.ctx.state === 'suspended') SND.ctx.resume(); return; } try { SND.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
function tone(f, d, vol, type, when, slide) {
  if (!SND.on || !SND.ctx) return; const c = SND.ctx, t = c.currentTime + (when || 0), o = c.createOscillator(), g = c.createGain();
  o.type = type || 'sine'; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + d);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + d + 0.02);
}
function snd(k, v) {
  const now = performance.now(); if (SND.last[k] && now - SND.last[k] < (k === 'deliver' ? 70 : 30)) return; SND.last[k] = now;
  if (k === 'place') tone(420, 0.09, 0.05, 'sine', 0, 300);
  else if (k === 'deliver') tone(520 + Math.min(500, Math.log2(Math.abs(v) + 1) * 70), 0.12, 0.035, 'sine');
  else if (k === 'order') [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.28, 0.06, 'sine', i * 0.07));
  else if (k === 'unlock') [392, 523, 659].forEach((f, i) => tone(f, 0.4, 0.05, 'triangle', i * 0.09));
  else if (k === 'err') tone(180, 0.14, 0.06, 'triangle', 0, 130);
  else if (k === 'del') tone(300, 0.08, 0.04, 'sine', 0, 180);
}
