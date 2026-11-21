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
  s.connect(f).connect(g).connect(c.destination);
  s.start(t0); s.stop(t0 + len + 0.05);
}
function tone(c, t0, { f0, f1, len, vol, type = 'sine' }) {
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(f1, t0 + len);
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
  o.connect(g).connect(c.destination);
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
/** someone left: a softer two-note falling chime */
export function leave() {
  const c = ctx(); if (!c) return;
  const t = c.currentTime;
  tone(c, t, { f0: 740, f1: 740, len: 0.18, vol: 0.1 });
  tone(c, t + 0.1, { f0: 494, f1: 494, len: 0.3, vol: 0.1 });
}
