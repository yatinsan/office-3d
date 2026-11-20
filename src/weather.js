import * as THREE from 'three';
import { LAND } from './world/landscape.js';

/**
 * Time of day (Day / Sunset / Night) + weather (Clear / Rain / Storm / Winter), picked in the Esc menu.
 * Drives the sky, fog, lights, landscape snow cover, rain / snow particles, lightning, and a procedural
 * WebAudio soundscape (rain, wind, thunder, night crickets, daytime birds) that is muffled indoors.
 */
const KEY = 'pixbit-env';
const TIMES = [
  { id: 'day', name: 'Day', icon: '☀' },
  { id: 'sunset', name: 'Sunset', icon: '◒' },
  { id: 'night', name: 'Night', icon: '☾' },
];
const WEATHERS = [
  { id: 'clear', name: 'Clear', icon: '✦' },
  { id: 'rain', name: 'Rain', icon: '☂' },
  { id: 'storm', name: 'Storm', icon: 'ϟ' },
  { id: 'snow', name: 'Winter', icon: '❄' },
];

const C = (h) => new THREE.Color(h);
const TIME = {
  day:    { haze: C('#a8aaa4'), sky: C('#ffffff'), sun: C('#fff3e2'), sunI: 1.5, hemiS: C('#f6f7ff'), hemiG: C('#7a7066'), hemiI: 0.8, env: 0.45, exp: 0.9, fogN: 40, fogF: 1100, fill: 6 },
  sunset: { haze: C('#b8907a'), sky: C('#ffb98c'), sun: C('#ffa860'), sunI: 1.25, hemiS: C('#ffd8bd'), hemiG: C('#6e5a4a'), hemiI: 0.7, env: 0.4, exp: 0.9, fogN: 30, fogF: 900, fill: 7 },
  night:  { haze: C('#0b1019'), sky: C('#141b2e'), sun: C('#9db2ff'), sunI: 0.22, hemiS: C('#c9d2ff'), hemiG: C('#2a2620'), hemiI: 0.42, env: 0.34, exp: 1.0, fogN: 15, fogF: 520, fill: 9 },
};
const GREY = C('#7b8188'), SNOWHAZE = C('#d4d9de'), WHITE = C('#ffffff'), SNOW = C('#eef2f5');

// Indoors (no rain falls here): office floor plate + hall, and the building body below the floor.
function sheltered(x, y, z) {
  if (z < -0.3 || z > 28.5) return false;
  if (y < -0.2) return x > -3.7 && x < 20;
  return x > -0.15 && x < 17.5 && y < 4.6;
}

export function initWeather({ scene, renderer, camera, hemi, sun, fill, panel }) {
  const state = { time: 'day', weather: 'clear', sound: true };
  try { Object.assign(state, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch {}
  for (const m of LAND.snow) m.userData.base = m.color.clone();

  // ---------- Stars + far town lights (night) ----------
  const starGeo = new THREE.BufferGeometry();
  const sp = [];
  for (let i = 0; i < 1400; i++) {
    const a = Math.random() * Math.PI * 2, el = Math.asin(0.08 + Math.random() * 0.92);
    sp.push(Math.cos(a) * Math.cos(el) * 1150, Math.sin(el) * 1150, Math.sin(a) * Math.cos(el) * 1150);
  }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: '#dfe6ff', size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85, depthWrite: false }));
  stars.renderOrder = 0;
  scene.add(stars);
  const townGeo = new THREE.BufferGeometry();
  const tp = [];
  for (let i = 0; i < 900; i++) {
    const a = Math.PI * 0.4 + Math.random() * Math.PI * 1.25, d = 40 + Math.pow(Math.random(), 0.7) * 700;
    const x = 9 + Math.cos(a) * d, z = 12 + Math.sin(a) * d;
    if (!(x < -7 || (z < -8 && x < 40) || (z > 30 && x < 20))) continue;
    tp.push(x, -38 + Math.random() * 10, z);
  }
  townGeo.setAttribute('position', new THREE.Float32BufferAttribute(tp, 3));
  const town = new THREE.Points(townGeo, new THREE.PointsMaterial({ color: '#ffc77a', size: 2.2, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.9, depthWrite: false }));
  scene.add(town);

  // ---------- Rain (line streaks) + snow (soft dots), kept in a box around the camera ----------
  const N = 9000, R = 22, UP = 18, DOWN = 16;
  const P = new Float32Array(N * 3), V = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    P[i * 3] = (Math.random() * 2 - 1) * R; P[i * 3 + 1] = Math.random() * (UP + DOWN) - DOWN; P[i * 3 + 2] = (Math.random() * 2 - 1) * R;
    V[i] = 0.8 + Math.random() * 0.4;
  }
  const rainPos = new Float32Array(N * 6);
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3).setUsage(THREE.DynamicDrawUsage));
  const rainMat = new THREE.LineBasicMaterial({ color: '#b8c4d2', transparent: true, opacity: 0.35, depthWrite: false });
  const rain = new THREE.LineSegments(rainGeo, rainMat);
  rain.frustumCulled = false;
  scene.add(rain);
  const snowPos = new Float32Array(N * 3);
  const snowGeo = new THREE.BufferGeometry();
  snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3).setUsage(THREE.DynamicDrawUsage));
  const dot = document.createElement('canvas'); dot.width = dot.height = 32;
  const dg = dot.getContext('2d'), grad = dg.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.5, 'rgba(255,255,255,.7)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
  dg.fillStyle = grad; dg.fillRect(0, 0, 32, 32);
  const snowMat = new THREE.PointsMaterial({ map: new THREE.CanvasTexture(dot), size: 0.14, transparent: true, depthWrite: false, color: '#ffffff' });
  const snow = new THREE.Points(snowGeo, snowMat);
  snow.frustumCulled = false;
  scene.add(snow);

  // ---------- Lightning bolt ----------
  const boltGeo = new THREE.BufferGeometry();
  boltGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(40 * 3), 3));
  const bolt = new THREE.Line(boltGeo, new THREE.LineBasicMaterial({ color: '#eef3ff', fog: false, transparent: true, depthWrite: false }));
  bolt.frustumCulled = false; bolt.visible = false;
  scene.add(bolt);
  let flash = 0, nextStrike = 4, strikeQueue = [];
  function strike() {
    const ang = Math.PI * 0.55 + Math.random() * Math.PI * 0.9, d = 250 + Math.random() * 500;
    let x = 9 + Math.cos(ang) * d, z = 12 + Math.sin(ang) * d, y = 260;
    const arr = boltGeo.attributes.position.array;
    for (let i = 0; i < 40; i++) {
      arr[i * 3] = x; arr[i * 3 + 1] = y; arr[i * 3 + 2] = z;
      x += (Math.random() - 0.5) * 18; z += (Math.random() - 0.5) * 18; y -= 7.5;
    }
    boltGeo.attributes.position.needsUpdate = true;
    flash = 1; bolt.visible = true;
    strikeQueue = [0.12 + Math.random() * 0.1]; // a quick re-flicker
    audio.thunder(0.4 + d / 340 * 0.6, d < 450 ? 1 : 0.6);
  }

  // ---------- Look: computed from time + weather ----------
  const base = { haze: new THREE.Color(), sky: new THREE.Color(), matte: new THREE.Color(), hemiI: 0 };

  // ---------- Skyline photo variants, crossfaded: a copy of the matte on top shows the old photo and fades out ----------
  const loader = new THREE.TextureLoader();
  const photos = { day: LAND.matte?.material.map }; // grab the original photo before anything swaps it
  const photo = (k) => {
    if (!photos[k]) {
      const tx = loader.load(`textures/skyline_${k}.png`);
      tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 4;
      photos[k] = tx;
    }
    return photos[k];
  };
  let fadeMatte = null, fadeT = 0, matteKey = null;
  let live = null; // the world is merged at startup (src/merge.js): find the mesh that now carries the matte material
  if (LAND.matte) scene.traverse((o) => { if (o.isMesh && o.material === LAND.matte.material) live = o; });
  if (live) {
    fadeMatte = new THREE.Mesh(live.geometry, live.material.clone());
    fadeMatte.renderOrder = live.renderOrder + 1;
    fadeMatte.visible = false;
    live.parent.add(fadeMatte);
    for (const k of ['sunset', 'night', 'rain', 'storm', 'snow', 'night_snow']) photo(k); // preload so switching is instant
  }
  function setMatte(key, tint) {
    const m = live;
    if (!m) return;
    if (matteKey && key !== matteKey) {
      fadeMatte.material.map = m.material.map;
      fadeMatte.material.color.copy(m.material.color);
      fadeMatte.material.opacity = 1; fadeMatte.visible = true; fadeT = 1;
    }
    matteKey = key;
    m.material.map = photo(key);
    m.material.color.copy(tint);
    m.material.needsUpdate = true;
  }
  function apply() {
    const t = TIME[state.time], w = state.weather;
    const haze = t.haze.clone(), sky = t.sky.clone();
    let sunI = t.sunI, hemiI = t.hemiI, fogN = t.fogN, fogF = t.fogF;
    const lum = state.time === 'night' ? 0.18 : state.time === 'sunset' ? 0.75 : 1;
    if (w === 'rain' || w === 'storm') {
      const k = w === 'storm' ? 0.75 : 0.6;
      haze.lerp(GREY.clone().multiplyScalar(lum * (w === 'storm' ? 0.75 : 1)), k);
      sky.lerp(GREY.clone().multiplyScalar(lum * 1.2), k).multiplyScalar(w === 'storm' ? 0.55 : 0.75);
      sunI *= w === 'storm' ? 0.12 : 0.3; hemiI *= w === 'storm' ? 0.75 : 0.85;
      fogN = 8; fogF = w === 'storm' ? 230 : 380;
    } else if (w === 'snow') {
      haze.lerp(SNOWHAZE.clone().multiplyScalar(lum), 0.7);
      sky.lerp(SNOWHAZE.clone().multiplyScalar(lum * 1.1), 0.8);
      sunI *= 0.45; hemiI *= 1.05; fogN = 10; fogF = 320;
    }
    scene.background = haze;
    scene.fog.color.copy(haze); scene.fog.near = fogN; scene.fog.far = fogF;
    LAND.sky.material.color.copy(sky);
    // the tower photo matte ignores lights + fog: swap in a repainted photo per look (skyline-variants/), and only
    // tint by hand where no painted version exists (rain / storm at night reuse the night photo, darkened into the haze)
    const night = state.time === 'night';
    const key = w === 'clear' ? (state.time === 'day' ? 'day' : state.time) : w === 'snow' ? (night ? 'night_snow' : 'snow') : night ? 'night' : w;
    const mt = WHITE.clone();
    if (night && (w === 'rain' || w === 'storm')) mt.lerp(haze, w === 'storm' ? 0.55 : 0.4).multiplyScalar(0.85);
    else if (w === 'storm') mt.lerp(haze, 0.35); // the painted storm is darker than our mist: pull it into the fog
    base.matte.copy(mt);
    setMatte(key, mt);
    sun.color.copy(t.sun); sun.intensity = sunI;
    hemi.color.copy(t.hemiS); hemi.groundColor.copy(t.hemiG); hemi.intensity = hemiI;
    fill.intensity = t.fill;
    scene.environmentIntensity = t.env;
    renderer.toneMappingExposure = t.exp;
    for (const m of LAND.snow) m.color.copy(m.userData.base).lerp(SNOW, w === 'snow' ? 0.82 : 0);
    stars.visible = state.time === 'night' && w === 'clear';
    town.visible = state.time === 'night';
    town.material.opacity = w === 'clear' ? 0.9 : 0.45;
    rain.visible = w === 'rain' || w === 'storm';
    snow.visible = w === 'snow';
    rainMat.opacity = (state.time === 'night' ? 0.22 : 0.35) * (w === 'storm' ? 1.2 : 1);
    rainMat.color.set(state.time === 'night' ? '#8592a6' : '#b8c4d2');
    rainGeo.setDrawRange(0, (w === 'storm' ? N : 5500) * 2);
    snowGeo.setDrawRange(0, 6500);
    base.haze.copy(haze); base.sky.copy(sky); base.hemiI = hemiI;
    flash = 0; bolt.visible = false; nextStrike = 3 + Math.random() * 5;
    audio.setScene(state);
  }

  // ---------- Menu: two chip rows + sound toggle ----------
  const style = document.createElement('style');
  style.textContent = `
    .env { width: 100%; margin-top: 18px; display: flex; flex-direction: column; gap: 9px; cursor: default; }
    .env-row { display: flex; align-items: center; gap: 10px; }
    .env-lbl { width: 66px; flex: none; font: 700 12px system-ui, sans-serif; text-transform: uppercase; letter-spacing: 1px; color: #ecc828; }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; flex: 1; }
    .chip { flex: 1; min-width: 0; padding: 7px 8px; border-radius: 10px; cursor: pointer; white-space: nowrap;
      background: rgba(30,30,34,.6); border: 1.5px solid rgba(255,255,255,.2); color: #fff; font: 700 13px system-ui, sans-serif;
      transition: background .15s, border-color .15s; }
    .chip:hover { border-color: rgba(255,255,255,.5); }
    .chip.on { background: linear-gradient(180deg, #ffd52e, #e9b800); border-color: #ffe36b; color: #111; }
    .chip i { font-style: normal; margin-right: 5px; }
    @media (max-width: 860px), (max-height: 560px) { .env { margin-top: 10px; gap: 6px; } .chip { padding: 5px 6px; font-size: 12px; } }
  `;
  document.head.appendChild(style);
  const el = document.createElement('div');
  el.className = 'env';
  panel.insertBefore(el, panel.querySelector('.m-hint'));
  function render() {
    const row = (lbl, key, items) => `<div class="env-row"><span class="env-lbl">${lbl}</span><div class="chips">${items.map((it) =>
      `<button type="button" class="chip${state[key] === it.id ? ' on' : ''}" data-k="${key}" data-v="${it.id}"><i>${it.icon}</i>${it.name}</button>`).join('')}</div></div>`;
    el.innerHTML = row('Time', 'time', TIMES) + row('Weather', 'weather', WEATHERS) +
      row('Sound', 'sound', [{ id: true, name: 'On', icon: '♪' }, { id: false, name: 'Off', icon: '✕' }]);
  }
  el.addEventListener('click', (e) => {
    e.stopPropagation(); // don't start the game: let the player set several options
    const b = e.target.closest('.chip');
    if (!b) return;
    const k = b.dataset.k;
    state[k] = k === 'sound' ? b.dataset.v === 'true' : b.dataset.v;
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
    audio.unlock();
    render(); apply();
  });

  // ---------- Procedural soundscape ----------
  const audio = makeAudio(state);
  addEventListener('pointerdown', () => audio.unlock());
  addEventListener('keydown', () => audio.unlock());

  render(); apply();

  // ---------- Per frame ----------
  let tAcc = 0;
  function update(dt, { outdoor = false, active = true } = {}) {
    dt = Math.min(dt, 0.05);
    tAcc += dt;
    const w = state.weather;
    const cx = camera.position.x, cy = camera.position.y, cz = camera.position.z;
    if (rain.visible) {
      const n = w === 'storm' ? N : 5500, sp = w === 'storm' ? 26 : 19, wx = w === 'storm' ? 4.5 : 1.2, len = w === 'storm' ? 0.75 : 0.55;
      for (let i = 0; i < n; i++) {
        const j = i * 3;
        let y = P[j + 1] - sp * V[i] * dt;
        let x = P[j] + wx * dt;
        if (y < -DOWN) y += UP + DOWN;
        P[j] = x; P[j + 1] = y;
        const X = cx + wrap(x - cx, R), Z = cz + wrap(P[j + 2] - cz, R), Y = cy + y;
        const k = i * 6;
        if (sheltered(X, Y, Z)) { rainPos[k] = rainPos[k + 3] = 0; rainPos[k + 1] = rainPos[k + 4] = -999; rainPos[k + 2] = rainPos[k + 5] = 0; continue; }
        rainPos[k] = X; rainPos[k + 1] = Y; rainPos[k + 2] = Z;
        rainPos[k + 3] = X - wx * 0.03; rainPos[k + 4] = Y + len; rainPos[k + 5] = Z;
      }
      rainGeo.attributes.position.needsUpdate = true;
    }
    if (snow.visible) {
      for (let i = 0; i < 6500; i++) {
        const j = i * 3;
        let y = P[j + 1] - 1.1 * V[i] * dt;
        if (y < -DOWN) y += UP + DOWN;
        P[j + 1] = y;
        const sway = Math.sin(tAcc * 0.9 + i) * 0.6;
        const X = cx + wrap(P[j] + sway + 0.5 * tAcc * V[i] - cx, R), Z = cz + wrap(P[j + 2] + Math.cos(tAcc * 0.7 + i * 1.3) * 0.5 - cz, R), Y = cy + y;
        if (sheltered(X, Y, Z)) { snowPos[j + 1] = -999; continue; }
        snowPos[j] = X; snowPos[j + 1] = Y; snowPos[j + 2] = Z;
      }
      snowGeo.attributes.position.needsUpdate = true;
    }
    // Lightning: random strikes, a bright flash that fades, flickers once, then thunder.
    if (w === 'storm' && active && (nextStrike -= dt) <= 0) { strike(); nextStrike = 6 + Math.random() * 12; }
    if (strikeQueue.length && (strikeQueue[0] -= dt) <= 0) { strikeQueue.shift(); flash = 0.85; }
    if (flash > 0 || bolt.visible) {
      flash = Math.max(0, flash - dt * 4.5);
      bolt.visible = flash > 0.15;
      hemi.intensity = base.hemiI + flash * 2.2;
      LAND.sky.material.color.copy(base.sky).lerp(WHITE, flash * 0.6);
      if (LAND.matte) LAND.matte.material.color.copy(base.matte).lerp(WHITE, flash * 0.5);
      scene.fog.color.copy(base.haze).lerp(WHITE, flash * 0.35);
      scene.background = scene.fog.color;
    }
    if (fadeT > 0) {
      fadeT = Math.max(0, fadeT - dt / 0.8);
      fadeMatte.material.opacity = fadeT;
      fadeMatte.visible = fadeT > 0;
    }
    audio.update(dt, outdoor, active);
  }
  return { update, state };
}

/** Wrap a coordinate offset into [-R, R) relative to 0 (positions are relative to the camera). */
function wrap(v, R) { return ((((v + R) % (2 * R)) + 2 * R) % (2 * R)) - R; }

function makeAudio(state) {
  let ac = null, master, rainG, rainLP, windG, windBP, outdoorLP, noise;
  let nextBird = 2, nextCricket = 0.5, windT = 0, ready = false;

  function unlock() {
    if (!ac) {
      try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
      // 3 s of noise, shared by every voice
      noise = ac.createBuffer(1, ac.sampleRate * 3, ac.sampleRate);
      const d = noise.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < d.length; i++) { // roughly pink
        const w = Math.random() * 2 - 1;
        b0 = 0.99765 * b0 + w * 0.099; b1 = 0.963 * b1 + w * 0.2965; b2 = 0.57 * b2 + w * 1.0527;
        d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2;
      }
      master = ac.createGain(); master.gain.value = 0; master.connect(ac.destination);
      outdoorLP = ac.createBiquadFilter(); outdoorLP.type = 'lowpass'; outdoorLP.frequency.value = 900; outdoorLP.connect(master);
      // rain: noise through a soft high-shelf hiss
      const rs = loopNoise();
      const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 350;
      rainLP = ac.createBiquadFilter(); rainLP.type = 'lowpass'; rainLP.frequency.value = 7000;
      rainG = ac.createGain(); rainG.gain.value = 0;
      rs.connect(hp).connect(rainLP).connect(rainG).connect(outdoorLP);
      // wind: band-passed noise with a wandering centre
      const ws = loopNoise(1.3);
      windBP = ac.createBiquadFilter(); windBP.type = 'bandpass'; windBP.frequency.value = 500; windBP.Q.value = 2.5;
      windG = ac.createGain(); windG.gain.value = 0;
      ws.connect(windBP).connect(windG).connect(outdoorLP);
      ready = true;
      setScene(state);
    }
    if (ac.state === 'suspended') ac.resume();
  }
  function loopNoise(rate = 1) {
    const s = ac.createBufferSource(); s.buffer = noise; s.loop = true; s.playbackRate.value = rate; s.start(ac.currentTime, Math.random() * 2); return s;
  }
  function setScene(s) {
    if (!ready) return;
    const t = ac.currentTime;
    master.gain.setTargetAtTime(s.sound ? 1 : 0, t, 0.3);
    const rain = s.weather === 'storm' ? 0.55 : s.weather === 'rain' ? 0.38 : 0;
    rainG.gain.setTargetAtTime(rain, t, 0.8);
    windG.gain.setTargetAtTime(s.weather === 'storm' ? 0.5 : s.weather === 'snow' ? 0.32 : 0, t, 1);
  }
  function update(dt, outdoor, active) {
    if (!ready || !state.sound) return;
    const t = ac.currentTime;
    // muffle everything when inside the office; the menu pauses the ambience down too
    outdoorLP.frequency.setTargetAtTime(outdoor ? 12000 : 1100, t, 0.25);
    master.gain.setTargetAtTime(active ? 1 : 0.35, t, 0.4);
    windT += dt;
    windBP.frequency.setTargetAtTime(380 + Math.sin(windT * 0.31) * 160 + Math.sin(windT * 0.77) * 90, t, 0.5);
    if (state.weather === 'clear' && state.time !== 'night' && (nextBird -= dt) <= 0) { bird(outdoor); nextBird = 2.5 + Math.random() * 6; }
    if (state.weather === 'clear' && state.time === 'night' && (nextCricket -= dt) <= 0) { cricket(outdoor); nextCricket = 0.55 + Math.random() * 0.5; }
  }
  function bird(outdoor) {
    const t0 = ac.currentTime + 0.02, notes = 2 + Math.floor(Math.random() * 4), f = 2400 + Math.random() * 1600;
    for (let i = 0; i < notes; i++) {
      const o = ac.createOscillator(), g = ac.createGain(), at = t0 + i * (0.09 + Math.random() * 0.05);
      o.type = 'sine';
      o.frequency.setValueAtTime(f * (0.9 + Math.random() * 0.2), at);
      o.frequency.exponentialRampToValueAtTime(f * (1.3 + Math.random() * 0.4), at + 0.06);
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(outdoor ? 0.05 : 0.025, at + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.08);
      o.connect(g).connect(outdoorLP); o.start(at); o.stop(at + 0.1);
    }
  }
  function cricket(outdoor) {
    const t0 = ac.currentTime + 0.02, f = 4300 + Math.random() * 500;
    for (let i = 0; i < 3; i++) {
      const o = ac.createOscillator(), g = ac.createGain(), at = t0 + i * 0.045;
      o.type = 'triangle'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(outdoor ? 0.03 : 0.015, at + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.03);
      o.connect(g).connect(outdoorLP); o.start(at); o.stop(at + 0.04);
    }
  }
  /** Thunder after `delay` s: a sharp crack (close strikes) then a long low rumble. */
  function thunder(delay, power) {
    if (!ready || !state.sound) return;
    const t0 = ac.currentTime + delay;
    const s = ac.createBufferSource(); s.buffer = noise; s.loop = true; s.playbackRate.value = 0.5;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(power > 0.8 ? 2200 : 900, t0);
    lp.frequency.exponentialRampToValueAtTime(110, t0 + 1.2);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(1.6 * power, t0 + 0.06);
    g.gain.exponentialRampToValueAtTime(0.7 * power, t0 + 0.5);
    g.gain.setValueAtTime(0.7 * power, t0 + 0.9);
    g.gain.exponentialRampToValueAtTime(0.9 * power, t0 + 1.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 5.5);
    s.connect(lp).connect(g).connect(master); // thunder carries indoors, so skip the outdoor filter
    s.start(t0, Math.random() * 2); s.stop(t0 + 5.6);
  }
  return { unlock, setScene, update, thunder };
}
