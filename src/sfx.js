import * as THREE from 'three';
// Tiny WebAudio sound effects for the fight: no audio files. One shared AudioContext (made on the first click).
let ac = null, noiseBuf = null;
function ctx() {
  try {
    ac ||= new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === 'suspended') ac.resume();
  } catch { ac = null; }
  return ac;
}
export function unlock() { ctx(); }

// ---- spatial sound: sounds made by other players get quieter, duller and panned left / right by where they are relative to me ----
let listenCam = null, dst = null;
const fwd = new THREE.Vector3();
export function setListener(camera) { listenCam = camera; }
const REACH = 22;   // metres: beyond this you hear nothing
/** run fn() with every sound it schedules coming from world position at {x,z}; returns false if too far to be heard (fn not run) */
export function spatial(at, fn) {
  const c = ctx(); if (!c || !listenCam || !at) { fn(); return true; }
  const dx = at.x - listenCam.position.x, dz = at.z - listenCam.position.z, d = Math.hypot(dx, dz);
  if (d > REACH) return false;
  listenCam.getWorldDirection(fwd);
  const rl = Math.hypot(fwd.x, fwd.z) || 1, side = d > 0.01 ? (dx * -fwd.z + dz * fwd.x) / (rl * d) : 0;   // -1 left .. 1 right
  const g = c.createGain(), lp = c.createBiquadFilter(), pan = c.createStereoPanner ? c.createStereoPanner() : null;
  g.gain.value = 1 / (1 + (d / 3) ** 2);                     // inverse-square-ish fade with distance
  lp.type = 'lowpass'; lp.frequency.value = 400 + 15000 / (1 + d * 0.5);   // far sounds lose their treble
  lp.connect(g);
  if (pan) { pan.pan.value = Math.max(-1, Math.min(1, side * Math.min(1, d / 2) * 0.95)); g.connect(pan); pan.connect(c.destination); } else g.connect(c.destination);
  dst = lp;
  try { fn(); } finally { dst = null; }
  return true;
}

function noise(c) {
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate * 0.5, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const s = c.createBufferSource(); s.buffer = noiseBuf; return s;
}
/** a burst of filtered noise: f0 -> f1 (Hz) over `len` seconds */
function burst(c, t0, { f0, f1, len, vol, type = 'bandpass', q = 1 }) {
  const s = noise(c), f = c.createBiquadFilter(), g = c.createGain();
  f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(f0, t0); f.frequency.exponentialRampToValueAtTime(f1, t0 + len);
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + len * 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
  s.connect(f).connect(g).connect(dst || c.destination);
  s.start(t0); s.stop(t0 + len + 0.05);
}
function tone(c, t0, { f0, f1, len, vol, type = 'sine' }) {
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(f1, t0 + len);
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
  o.connect(g).connect(dst || c.destination);
  o.start(t0); o.stop(t0 + len + 0.05);
}

/** arm swinging through the air */
export function whoosh(v = 1) {
  const c = ctx(); if (!c) return;
  burst(c, c.currentTime, { f0: 500, f1: 2400, len: 0.16, vol: 0.18 * v, q: 0.8 });
}
/** a punch landing (heard by the puncher and by anyone close) */
export function impact(v = 1) {
  const c = ctx(); if (!c) return;
  const t = c.currentTime;
  tone(c, t, { f0: 150, f1: 45, len: 0.18, vol: 0.5 * v });
  burst(c, t, { f0: 1800, f1: 200, len: 0.1, vol: 0.35 * v, type: 'lowpass' });
}
/** you got hit: thump + a short pained "ugh" */
export function hurt() {
  const c = ctx(); if (!c) return;
  const t = c.currentTime;
  impact(1.1);
  tone(c, t + 0.04, { f0: 260, f1: 130, len: 0.28, vol: 0.14, type: 'sawtooth' });
}
/** body hits the floor */
export function thud() {
  const c = ctx(); if (!c) return;
  const t = c.currentTime;
  tone(c, t, { f0: 90, f1: 28, len: 0.5, vol: 0.7 });
  burst(c, t, { f0: 600, f1: 80, len: 0.3, vol: 0.4, type: 'lowpass' });
}
/** someone joined: a bright two-note rising chime */
export function join() {
  const c = ctx(); if (!c) return;
  const t = c.currentTime;
  tone(c, t, { f0: 660, f1: 660, len: 0.18, vol: 0.12 });
  tone(c, t + 0.1, { f0: 990, f1: 990, len: 0.3, vol: 0.12 });
}
/** achievement earned: a rising three-note chime */
export function achievementChime() {
  const c = ctx(); if (!c) return;
  const t = c.currentTime;
  [660, 880, 1320].forEach((f, i) => tone(c, t + i * 0.12, { f0: f, f1: f, len: 0.35, vol: 0.12, type: 'triangle' }));
}
/** someone left: a softer two-note falling chime */
export function leave() {
  const c = ctx(); if (!c) return;
  const t = c.currentTime;
  tone(c, t, { f0: 740, f1: 740, len: 0.18, vol: 0.1 });
  tone(c, t + 0.1, { f0: 494, f1: 494, len: 0.3, vol: 0.1 });
}
/** lift doors: real metro door recordings (cut from one clip); falls back to a synthesized hiss if the file can't play */
const doorAudio = {};
function door(name, vol, fallback) {
  try {
    const a = (doorAudio[name] ||= new Audio(`sounds/${name}.mp3`));
    a.volume = vol; a.currentTime = 0;
    const p = a.play();
    if (p && p.catch) p.catch(fallback);
  } catch { fallback(); }
}
function synthDoor() {
  const c = ctx(); if (!c) return;
  const t = c.currentTime;
  burst(c, t, { f0: 6000, f1: 3500, len: 0.45, vol: 0.22, type: 'highpass', q: 0.5 });
  burst(c, t + 0.15, { f0: 180, f1: 320, len: 1.0, vol: 0.2, type: 'lowpass', q: 0.7 });
  tone(c, t + 1.1, { f0: 120, f1: 50, len: 0.2, vol: 0.4 });
}
export function liftOpen() { door('lift-open', 0.8, synthDoor); }
export function liftClose() { door('lift-close', 0.8, synthDoor); }

/** play a recorded clip (decoded once); `at` = world {x,z} makes it positional */
const clips = {};
export function clip(url, vol = 1, rate = 1, at = null) {
  const c = ctx(); if (!c) return;
  const run = (buf) => spatial(at, () => {
    const s = c.createBufferSource(), g = c.createGain();
    s.buffer = buf; s.playbackRate.value = rate; g.gain.value = vol;
    s.connect(g).connect(dst || c.destination); s.start();
  });
  if (clips[url] instanceof AudioBuffer) return run(clips[url]);
  if (clips[url]) return;                                 // still loading
  clips[url] = 1;
  fetch(url).then((r) => r.arrayBuffer()).then((b) => c.decodeAudioData(b)).then((buf) => { clips[url] = buf; }).catch(() => { delete clips[url]; });
}
