import * as THREE from 'three';
import { POOL, ballMats, cueBallMat } from './world/game.js';

/**
 * Playable pool table in the game room (free play, no turns).
 *   Walk up to the table, press E  -> aim mode (camera behind the cue ball).
 *   Mouse / A D / arrows aim (hold Shift for fine aim), hold Space or the mouse button to charge, release to shoot.
 *   Hold R to re-rack the balls. E or Esc leaves.
 * Anyone can step up at any time. In Open World a shot is sent as "balls at rest + cue velocity"; every client then runs
 * the same fixed-step physics, so all tables end up identical. Remote messages go through applyRemote() and never echo.
 */
const { px, pz, pl, pw, r, y: TABLE_Y } = POOL;
const BY = TABLE_Y + r + 0.002;                 // ball centre height
const CUSH = 0.06;                              // cushion thickness (matches the table mesh)
const XMIN = px - pw / 2 + CUSH + r, XMAX = px + pw / 2 - CUSH - r;
const ZMIN = pz - pl / 2 + CUSH + r, ZMAX = pz + pl / 2 - CUSH - r;
const POCKETS = [];
for (const sx of [-1, 1]) for (const sz of [-1, 0, 1]) POCKETS.push([px + sx * (pw / 2 - 0.04), pz + sz * (pl / 2 - 0.04)]);
const POCKET_R2 = 0.085 * 0.085;
const H = 1 / 120;                              // fixed physics step
const DECEL = 1.0, VMAX = 4.2, VSTOP = 0.02, E_CUSH = 0.78, E_BALL = 0.96;
const D2 = 4 * r * r;
const HEAD = [px, pz - 0.6];                    // cue ball start spot
const NEAR = 0.9;                               // how far from the table you can start playing
const EYE = 1.65;                               // same as controls.js
const ROOM ={ x0: 0.4, x1: 6.3, z0: 23.0, z1: 26.9 }; // keep the camera inside the game room

const CSS = `
#pool-hud { position: fixed; left: 50%; bottom: 26px; transform: translateX(-50%); z-index: 8; display: none; flex-direction: column; align-items: center; gap: 8px; pointer-events: none; font: 600 13px system-ui, -apple-system, sans-serif; color: #fff; }
#pool-hud.on { display: flex; }
#pool-hud .hint { padding: 7px 13px; border-radius: 14px; background: rgba(14,14,18,.62); text-shadow: 0 1px 2px #000; }
#pool-hud .bar { width: min(320px, 70vw); height: 10px; border-radius: 6px; background: rgba(14,14,18,.6); overflow: hidden; border: 1px solid rgba(255,255,255,.25); }
#pool-hud .bar i { display: block; height: 100%; width: 0; background: linear-gradient(90deg, #7ee08f, #ecc828 60%, #ff5a4a); }
#pool-hud .rst { width: min(320px, 70vw); height: 4px; border-radius: 3px; background: rgba(255,255,255,.12); overflow: hidden; opacity: 0; transition: opacity .15s; }
#pool-hud .rst.on { opacity: 1; }
#pool-hud .rst i { display: block; height: 100%; width: 0; background: #ecc828; }
#pool-pop { position: fixed; left: 50%; top: 32%; z-index: 9; pointer-events: none; font: 900 clamp(44px, 9vw, 110px) system-ui, -apple-system, sans-serif; letter-spacing: .04em; color: #ecc828; -webkit-text-stroke: 2px #000; text-shadow: 0 6px 24px rgba(0,0,0,.7); opacity: 0; transform: translate(-50%, -50%) scale(.5); }
#pool-pop { text-align: center; white-space: nowrap; line-height: 1.05; }
#pool-pop .s { font-size: .26em; font-weight: 700; letter-spacing: .06em; -webkit-text-stroke: 1px #000; margin-top: 6px; }
#pool-pop.bad { color: #ff5a4a; }
#pool-pop.win { color: #5ee08a; }
#pool-pop.show { animation: poolpop 1.6s ease-out forwards; }
@keyframes poolpop { 0% { opacity: 0; transform: translate(-50%, -50%) scale(.4); } 15% { opacity: 1; transform: translate(-50%, -50%) scale(1.15); } 30% { transform: translate(-50%, -50%) scale(1); } 80% { opacity: 1; } 100% { opacity: 0; transform: translate(-50%, -60%) scale(1); } }
#pool-touch { position: fixed; inset: 0; z-index: 7; display: none; touch-action: none; }
#pool-touch.on { display: block; }
#pool-touch button { position: absolute; border: 0; border-radius: 50%; color: #fff; font: 700 14px system-ui, sans-serif; background: rgba(14,14,18,.5); border: 2px solid rgba(255,255,255,.35); touch-action: none; user-select: none; -webkit-user-select: none; }
#pool-touch .p-shoot { right: 28px; bottom: 28px; width: 92px; height: 92px; }
#pool-touch .p-reset { right: 140px; bottom: 36px; width: 64px; height: 64px; font-size: 12px; }
#pool-touch .p-exit { right: 16px; top: 14px; width: 54px; height: 54px; font-size: 12px; }
`;

export function initPool({ scene, camera, player, touch = false }) {
  const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
  const overlayEl = document.getElementById('overlay');

  // ---------- balls: index 0 = cue ball, 1..15 = object balls ----------
  const N = 16;
  const bx = new Float64Array(N), bz = new Float64Array(N), vx = new Float64Array(N), vz = new Float64Array(N);
  const alive = new Array(N).fill(true);
  const geo = new THREE.SphereGeometry(r, 20, 14);
  const meshes = [];
  for (let i = 0; i < N; i++) {
    const m = new THREE.Mesh(geo, i === 0 ? cueBallMat : ballMats[(i - 1) % ballMats.length]);
    m.castShadow = true; m.userData.label = i === 0 ? 'Cue ball' : 'Pool ball';
    scene.add(m); meshes.push(m);
  }
  function rack() {
    bx[0] = HEAD[0]; bz[0] = HEAD[1];
    let k = 1;
    for (let row = 0; row < 5; row++) for (let i = 0; i <= row; i++, k++) {
      bx[k] = px + (i - row / 2) * r * 2.05;
      bz[k] = pz + 0.45 + row * r * 1.8;
    }
    vx.fill(0); vz.fill(0); alive.fill(true);
    syncMeshes();
  }
  function syncMeshes() {
    for (let i = 0; i < N; i++) { const m = meshes[i]; m.visible = alive[i]; m.position.set(bx[i], BY, bz[i]); }
  }
  rack();

  // ---------- state shared with other players ----------
  const cbs = [];
  const emit = (msg) => { for (const cb of cbs) cb(msg); };
  const state = () => { const s = []; for (let i = 0; i < N; i++) s.push(bx[i], bz[i], alive[i] ? 1 : 0); return s; };
  function setState(s) {
    for (let i = 0; i < N; i++) { bx[i] = s[i * 3]; bz[i] = s[i * 3 + 1]; alive[i] = !!s[i * 3 + 2]; vx[i] = vz[i] = 0; }
    syncMeshes();
  }
  let touched = false;       // someone has played since the last re-rack (a late joiner's snapshot only applies to an untouched table)
  let moving = false, acc = 0, shooterLocal = false;

  // ---------- physics (fixed step, only + - * / sqrt: identical on every client) ----------
  function step() {
    let any = false;
    for (let i = 0; i < N; i++) {
      if (!alive[i]) continue;
      const sp = Math.sqrt(vx[i] * vx[i] + vz[i] * vz[i]);
      if (sp === 0) continue;
      bx[i] += vx[i] * H; bz[i] += vz[i] * H;
      const ns = sp - DECEL * H;
      if (ns <= VSTOP) { vx[i] = 0; vz[i] = 0; } else { const k = ns / sp; vx[i] *= k; vz[i] *= k; }
    }
    for (let i = 0; i < N; i++) {                      // pockets
      if (!alive[i]) continue;
      for (let q = 0; q < POCKETS.length; q++) {
        const dx = bx[i] - POCKETS[q][0], dz = bz[i] - POCKETS[q][1];
        if (dx * dx + dz * dz < POCKET_R2) { alive[i] = false; vx[i] = vz[i] = 0; onPot(i, q); break; }
      }
    }
    for (let i = 0; i < N; i++) {                      // cushions
      if (!alive[i]) continue;
      if (bx[i] < XMIN) { bx[i] = XMIN; if (vx[i] < 0) vx[i] = -vx[i] * E_CUSH; }
      else if (bx[i] > XMAX) { bx[i] = XMAX; if (vx[i] > 0) vx[i] = -vx[i] * E_CUSH; }
      if (bz[i] < ZMIN) { bz[i] = ZMIN; if (vz[i] < 0) vz[i] = -vz[i] * E_CUSH; }
      else if (bz[i] > ZMAX) { bz[i] = ZMAX; if (vz[i] > 0) vz[i] = -vz[i] * E_CUSH; }
    }
    for (let i = 0; i < N; i++) {                      // ball vs ball (equal mass)
      if (!alive[i]) continue;
      for (let j = i + 1; j < N; j++) {
        if (!alive[j]) continue;
        const dx = bx[j] - bx[i], dz = bz[j] - bz[i], d2 = dx * dx + dz * dz;
        if (d2 >= D2 || d2 === 0) continue;
        if (firstHit < 0 && (i === 0 || j === 0)) firstHit = i === 0 ? j : i;      // the first ball the cue ball touches
        const d = Math.sqrt(d2), nx = dx / d, nz = dz / d, push = (2 * r - d) / 2;
        bx[i] -= nx * push; bz[i] -= nz * push; bx[j] += nx * push; bz[j] += nz * push;
        const vn = (vx[j] - vx[i]) * nx + (vz[j] - vz[i]) * nz;
        if (vn < 0) {
          const jn = -(1 + E_BALL) * vn / 2;
          vx[i] -= jn * nx; vz[i] -= jn * nz; vx[j] += jn * nx; vz[j] += jn * nz;
        }
      }
    }
    for (let i = 0; i < N; i++) if (alive[i] && (vx[i] !== 0 || vz[i] !== 0)) { any = true; break; }
    return any;
  }
  // ---------- shot bookkeeping + big messages ----------
  let firstHit = -1, shotPots = 0, shots = 0, streak = 0, misses = 0, shooterWho = null;   // shooterWho: {name,color} of a remote shooter, null = me
  const notifyCbs = [];
  const notify = (text, color) => { for (const cb of notifyCbs) cb(text, color); };
  function onPot(i, q) {
    if (i === 0) { announce('SCRATCH!', 'bad', 'Cue ball potted'); return; }
    shotPots++;
    let left = 0; for (let j = 1; j < N; j++) if (alive[j]) left++;
    const where = q % 3 === 1 ? 'Side pocket' : 'Corner pocket';
    if (left === 0) announce('FINAL BALL!', 'gold', where, true);
    else if (shotPots === 1) announce(i === firstHit ? 'NICE SHOT!' : 'POTTED!', 'gold', where);
    else announce(shotPots === 2 ? 'DOUBLE POT!' : shotPots === 3 ? 'TRIPLE POT!' : 'MEGA POT!', 'gold', shotPots + ' balls in one shot', shotPots >= 3);
  }
  function finishRoll() {
    moving = false;
    const scratched = !alive[0], mine = shooterLocal;
    let left = 0; for (let j = 1; j < N; j++) if (alive[j]) left++;
    if (left === 0) setTimeout(() => announce('TABLE CLEARED!', 'win', `Cleared in ${shots} shot${shots === 1 ? '' : 's'}`, true), 1300);
    else if (shotPots === 0 && !scratched) setTimeout(() => (firstHit < 0 ? announce('AIR SHOT!', 'bad', 'No ball touched') : announce('MISS!', 'bad')), 500);
    if (mine) {
      if (shotPots > 0) { streak++; misses = 0; } else { streak = 0; misses++; }
      if (left > 0 && streak >= 3) setTimeout(() => announce('ON FIRE!  x' + streak, 'win', 'Keep it going', true), 1100);
      else if (left > 0 && misses >= 3 && misses % 3 === 0) setTimeout(() => announce('KEEP TRYING!', 'bad', misses + ' misses in a row'), 1400);
    } else if (shooterWho) {                                  // someone else's shot: a small notice like the "joined" ones
      const n = shooterWho.name || 'Guest';
      if (left === 0) notify(`${n} cleared the table!`, shooterWho.color);
      else if (shotPots > 0) notify(`${n} potted ${shotPots === 1 ? 'a ball' : shotPots + ' balls'}`, shooterWho.color);
      else if (scratched) notify(`${n} scratched`, shooterWho.color);
    }
    if (!alive[0]) {                                  // scratch: cue ball back on the head spot
      bx[0] = HEAD[0]; bz[0] = HEAD[1]; alive[0] = true;
      for (let t = 0; t < 12; t++) {
        let hit = false;
        for (let j = 1; j < N; j++) if (alive[j] && (bx[j] - bx[0]) ** 2 + (bz[j] - bz[0]) ** 2 < D2 * 1.05) { hit = true; break; }
        if (!hit) break;
        bz[0] -= 0.06;
      }
    }
    syncMeshes();
    if (shooterLocal) { emit({ t: 'pool', k: 'rest', s: state() }); shooterLocal = false; }
    if (active) aimAtNearest();
  }
  function launch(cueVx, cueVz) {
    vx[0] = cueVx; vz[0] = cueVz;
    moving = true; acc = 0; touched = true;
    firstHit = -1; shotPots = 0; shots++;
    const ratio = Math.sqrt(cueVx * cueVx + cueVz * cueVz) / VMAX;
    if (ratio >= 0.88) announce('SMASH!', 'gold', 'Full power', true);
    else if (ratio <= 0.11) announce('GENTLE TOUCH', 'gold');
  }
  function newGame() { shots = 0; streak = 0; misses = 0; announce('NEW GAME!', 'win', 'Table re-racked'); }

  // ---------- local play ----------
  let active = false, a = 0, power = 0, charging = false, resetT = 0, resetArmed = true;
  const held = {};
  let savedQuat = null, savedPos = null, tc = null;                    // tc: touch aim bookkeeping

  const near = () => player.pos.x > px - pw / 2 - NEAR && player.pos.x < px + pw / 2 + NEAR && player.pos.z > pz - pl / 2 - NEAR && player.pos.z < pz + pl / 2 + NEAR;

  function aimAtNearest() {
    let best = -1, bd = 1e9;
    for (let i = 1; i < N; i++) if (alive[i]) { const d = (bx[i] - bx[0]) ** 2 + (bz[i] - bz[0]) ** 2; if (d < bd) { bd = d; best = i; } }
    if (best > 0) a = Math.atan2(bx[best] - bx[0], bz[best] - bz[0]);
  }
  function shoot() {
    if (!charging) return;
    charging = false;
    if (moving || !alive[0]) { power = 0; return; }
    const v = VMAX * Math.max(0.06, power) ** 1.2;
    const cvx = Math.sin(a) * v, cvz = Math.cos(a) * v;
    const s = state();
    power = 0; shooterLocal = true; shooterWho = null;
    emit({ t: 'pool', k: 'shot', s, v: [cvx, cvz] });
    launch(cvx, cvz);
  }
  function doReset() {
    rack(); moving = false; touched = false; shooterLocal = false; shooterWho = null; newGame();
    emit({ t: 'pool', k: 'reset' });
    aimAtNearest();
  }

  // aim helpers: where the cue ball would hit first (cushion or another ball)
  function trace(dx, dz) {
    let t = 4, hitBall = -1;
    if (dx > 1e-9) t = Math.min(t, (XMAX - bx[0]) / dx); else if (dx < -1e-9) t = Math.min(t, (XMIN - bx[0]) / dx);
    if (dz > 1e-9) t = Math.min(t, (ZMAX - bz[0]) / dz); else if (dz < -1e-9) t = Math.min(t, (ZMIN - bz[0]) / dz);
    for (let j = 1; j < N; j++) {
      if (!alive[j]) continue;
      const ox = bx[j] - bx[0], oz = bz[j] - bz[0], proj = ox * dx + oz * dz;
      if (proj <= 0) continue;
      const disc = proj * proj - (ox * ox + oz * oz - D2);
      if (disc < 0) continue;
      const th = proj - Math.sqrt(disc);
      if (th > 0 && th < t) { t = th; hitBall = j; }
    }
    return { t: Math.max(0, t), hitBall };
  }

  // visuals
  const lineMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.7, depthWrite: false });
  const line = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.002, 1), lineMat);
  const ghost = new THREE.Mesh(new THREE.RingGeometry(r * 0.8, r, 24).rotateX(-Math.PI / 2), lineMat);
  const cue = new THREE.Group();
  { const len = 1.25;
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.0055, 0.012, len, 10).rotateX(Math.PI / 2).translate(0, 0, -len / 2),
      new THREE.MeshStandardMaterial({ color: '#c79a62', roughness: 0.5 }));
    stick.castShadow = true;
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.0057, 0.0057, 0.012, 10).rotateX(Math.PI / 2).translate(0, 0, -0.004),
      new THREE.MeshStandardMaterial({ color: '#4a8ad6', roughness: 0.8 }));
    cue.add(stick, tip); }
  line.visible = ghost.visible = cue.visible = false;
  scene.add(line, ghost, cue);

  // big pop-up text when a ball drops in a pocket
  const popEl = document.createElement('div');
  popEl.id = 'pool-pop';
  document.body.appendChild(popEl);
  let actx = null;
  function blip(kind) {                                          // short sound: rising for good, falling for bad
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const t0 = actx.currentTime, o = actx.createOscillator(), g = actx.createGain();
      const f = kind === 'bad' ? [330, 180] : kind === 'win' ? [520, 880] : [440, 660];
      o.type = 'triangle'; o.frequency.setValueAtTime(f[0], t0); o.frequency.exponentialRampToValueAtTime(f[1], t0 + 0.18);
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.12, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.25);
      o.connect(g); g.connect(actx.destination); o.start(t0); o.stop(t0 + 0.27);
    } catch {}
  }
  function announce(text, kind = 'gold', sub = '', big = false) {
    if (shooterWho) return;                                      // someone else's shot: only the shooter sees the big text (others get the small notice)
    popEl.innerHTML = '';
    const m = document.createElement('div'); m.textContent = text; popEl.appendChild(m);
    if (sub) { const s = document.createElement('div'); s.className = 's'; s.textContent = sub; popEl.appendChild(s); }
    popEl.classList.toggle('bad', kind === 'bad');
    popEl.classList.toggle('win', kind === 'win');
    popEl.classList.remove('show'); void popEl.offsetWidth; popEl.classList.add('show');
    blip(kind);
    if (big) {                                                   // little screen shake on the big moments
      const cv = document.querySelector('canvas');
      try { cv?.animate([{ transform: 'translate(0,0)' }, { transform: 'translate(-7px,4px)' }, { transform: 'translate(6px,-5px)' }, { transform: 'translate(-4px,3px)' }, { transform: 'translate(0,0)' }], { duration: 320 }); } catch {}
    }
  }

  // HUD
  const hud =document.createElement('div');
  hud.id = 'pool-hud';
  hud.innerHTML = `<div class="hint"></div><div class="bar"><i></i></div><div class="rst"><i></i></div>`;
  document.body.appendChild(hud);
  const hintEl = hud.querySelector('.hint'), barEl = hud.querySelector('.bar i'), rstEl = hud.querySelector('.rst'), rstFill = rstEl.querySelector('i');
  hintEl.textContent = touch ? 'Drag to aim · hold SHOOT to charge · hold RESET to re-rack' : 'Mouse / A D aim (Shift = fine) · click + drag back, release to strike (or hold Space) · hold R to re-rack · E exit';

  let layer = null;
  if (touch) {
    layer = document.createElement('div');
    layer.id = 'pool-touch';
    layer.innerHTML = `<button class="p-shoot" type="button">SHOOT</button><button class="p-reset" type="button">RESET</button><button class="p-exit" type="button">EXIT</button>`;
    document.body.appendChild(layer);
    const hold = (sel, down, up) => {
      const b = layer.querySelector(sel);
      b.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); down(); }, { passive: false });
      for (const ev of ['touchend', 'touchcancel']) b.addEventListener(ev, (e) => { e.preventDefault(); e.stopPropagation(); up(); }, { passive: false });
    };
    hold('.p-shoot', () => { if (!moving) charging = true; }, shoot);
    hold('.p-reset', () => { held.touchReset = true; }, () => { held.touchReset = false; resetArmed = true; });
    hold('.p-exit', exit, () => {});
    layer.addEventListener('touchstart', (e) => { if (e.target === layer && !tc) { const t = e.changedTouches[0]; tc = { id: t.identifier, x: t.clientX }; } }, { passive: true });
    layer.addEventListener('touchmove', (e) => {
      if (!tc) return;
      for (const t of e.changedTouches) if (t.identifier === tc.id) { a -= (t.clientX - tc.x) * 0.006; tc.x = t.clientX; }
      e.preventDefault();
    }, { passive: false });
    const endAim = (e) => { if (tc) for (const t of e.changedTouches) if (t.identifier === tc.id) tc = null; };
    layer.addEventListener('touchend', endAim); layer.addEventListener('touchcancel', endAim);
  }

  function enter() {
    active = true; charging = false; power = 0; resetT = 0; resetArmed = true;
    player.state.paused = true;
    savedQuat = camera.quaternion.clone();
    camPos.copy(camera.position);
    savedPos = player.pos.clone();
    document.body.classList.add('cutscene');
    hud.classList.add('on'); layer?.classList.add('on');
    if (!moving) aimAtNearest();
  }
  function exit() {
    if (!active) return;
    active = false; charging = false; mouseDrag = false; power = 0;
    player.state.paused = false;
    document.body.classList.remove('cutscene');
    hud.classList.remove('on'); layer?.classList.remove('on');
    line.visible = ghost.visible = cue.visible = false;
    if (savedQuat) camera.quaternion.copy(savedQuat);
    if (savedPos) player.pos.copy(savedPos);                      // back to where you stood (the table is a collider)
  }

  // keyboard: E enters / leaves, and while playing the pool keys are ours
  const isField = (e) => /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName || '');
  const OWN = new Set(['KeyE', 'KeyR', 'Space', 'KeyA', 'KeyD', 'ArrowLeft', 'ArrowRight']);
  addEventListener('keydown', (e) => {
    if (isField(e)) return;
    if (!active) {
      if (e.code === 'KeyE' && !e.repeat && near() && !player.state.paused && overlayEl.classList.contains('hidden')) { enter(); e.stopImmediatePropagation(); }
      return;
    }
    if (e.code === 'Escape') { exit(); return; }               // the browser also releases the pointer: the pause menu opens
    if (!OWN.has(e.code)) return;
    e.stopImmediatePropagation(); e.preventDefault();
    if (e.code === 'KeyE') { if (!e.repeat) exit(); return; }
    held[e.code] = true;
    if (e.code === 'Space' && !e.repeat && !moving) charging = true;
  }, true);
  addEventListener('keyup', (e) => {
    if (!OWN.has(e.code)) return;
    held[e.code] = false;
    if (!active) return;
    if (e.code === 'Space') shoot();
    if (e.code === 'KeyR') resetArmed = true;
  }, true);
  // mouse: click, drag back (toward you) to pull the cue and set power, release to strike
  let mouseDrag = false;
  addEventListener('mousedown', (e) => { if (active && e.button === 0 && !moving) { charging = true; mouseDrag = true; power = 0; } });
  addEventListener('mouseup', (e) => { if (active && e.button === 0) { mouseDrag = false; shoot(); } });
  addEventListener('mousemove', (e) => {
    if (!active) return;
    if (mouseDrag) power = Math.min(1, Math.max(0, power + e.movementY * 0.004));
    a -= e.movementX * (held.ShiftLeft || held.ShiftRight ? 0.0006 : 0.0025);
  });
  addEventListener('keydown', (e) => { if (e.code.startsWith('Shift')) held[e.code] = true; });
  addEventListener('keyup', (e) => { if (e.code.startsWith('Shift')) held[e.code] = false; });
  addEventListener('blur', () => { for (const k in held) held[k] = false; charging = false; mouseDrag = false; power = 0; });

  // camera
  const camPos = new THREE.Vector3();
  const tmpObj = new THREE.Camera(); // a camera, so lookAt points -z at the target
  const tq = new THREE.Quaternion(), tp = new THREE.Vector3();
  function driveCamera(dt) {
    // camera stays at eye height so your own body (which follows the camera) looks right to the other players
    if (moving || !alive[0]) tp.set(px, EYE, pz - 1.75);          // balls rolling: look over the whole table
    else {
      const dx = Math.sin(a), dz = Math.cos(a);
      tp.set(bx[0] - dx * 1.0, EYE, bz[0] - dz * 1.0);
    }
    tp.x = Math.min(ROOM.x1, Math.max(ROOM.x0, tp.x));
    tp.z = Math.min(ROOM.z1, Math.max(ROOM.z0, tp.z));
    tmpObj.position.copy(tp);
    if (moving || !alive[0]) tmpObj.lookAt(px, TABLE_Y, pz + 0.1);
    else tmpObj.lookAt(bx[0] + Math.sin(a) * 0.55, TABLE_Y + 0.02, bz[0] + Math.cos(a) * 0.55);
    tq.copy(tmpObj.quaternion);
    const k = 1 - Math.exp(-9 * dt);
    camPos.lerp(tp, k);                 // own smoothed position: player.update resets camera.position every frame
    camera.position.copy(camPos);
    camera.quaternion.slerp(tq, k);
    player.pos.set(camPos.x, 0, camPos.z);                          // your body stands where the camera is
  }

  function update(dt) {
    dt = Math.min(dt, 0.05);
    if (moving) {
      acc += dt;
      while (acc >= H) { acc -= H; if (!step()) { finishRoll(); break; } }
      syncMeshes();
    }
    if (!active) return;
    if (overlayEl && !overlayEl.classList.contains('hidden')) { exit(); return; } // pause menu opened
    // aim with the keyboard
    const sp = (held.ShiftLeft || held.ShiftRight ? 0.35 : 1.3) * dt;
    if (held.KeyA || held.ArrowLeft) a += sp;
    if (held.KeyD || held.ArrowRight) a -= sp;
    // power
    if (charging && !mouseDrag) power = Math.min(1, power + dt / 1.1);
    barEl.style.width = (power * 100) + '%';
    // hold R / RESET to re-rack
    if ((held.KeyR || held.touchReset) && resetArmed) {
      resetT += dt;
      if (resetT >= 1) { doReset(); resetT = 0; resetArmed = false; }
    } else resetT = 0;
    rstEl.classList.toggle('on', resetT > 0.02);
    rstFill.style.width = Math.min(100, resetT * 100) + '%';
    // aim line, ghost ball and cue
    const ready = !moving && alive[0];
    if (ready) {
      const dx = Math.sin(a), dz = Math.cos(a), { t } = trace(dx, dz);
      const len = Math.max(0.02, t - 0.0);
      line.visible = ghost.visible = true;
      line.scale.z = len; line.rotation.y = a;
      line.position.set(bx[0] + dx * len / 2, BY, bz[0] + dz * len / 2);
      ghost.position.set(bx[0] + dx * len, BY, bz[0] + dz * len);
      cue.visible = true;
      const pull = 0.02 + power * 0.22;
      cue.position.set(bx[0] - dx * (r + 0.006 + pull), BY + 0.012, bz[0] - dz * (r + 0.006 + pull));
      cue.rotation.y = a;
    } else line.visible = ghost.visible = cue.visible = false;
    driveCamera(dt);
  }

  // ---------- Open World sync (see online.js) ----------
  function applyRemote(m, who = null) {
    if (!m || m.t !== 'pool') return;
    if (m.k === 'shot' && Array.isArray(m.s) && m.s.length === N * 3 && Array.isArray(m.v)) {
      setState(m.s); shooterLocal = false; charging = false; power = 0; shooterWho = who;
      launch(+m.v[0] || 0, +m.v[1] || 0);
    } else if (m.k === 'rest' && Array.isArray(m.s) && m.s.length === N * 3) {
      setState(m.s); moving = false; touched = true; if (active) aimAtNearest();
    } else if (m.k === 'reset') {
      rack(); moving = false; touched = false; shooterLocal = false; shooterWho = null; streak = 0; misses = 0; shots = 0; if (who) notify(`${who.name || 'Guest'} re-racked the table`, who.color); if (active) aimAtNearest();
    } else if (m.k === 'all' && Array.isArray(m.s) && m.s.length === N * 3 && !touched && !moving) {
      setState(m.s);
    }
  }

  return {
    update,
    prompt: () => (!active && near() && !player.state.paused ? 'E play pool' : ''),
    isActive: () => active,
    onChange: (cb) => cbs.push(cb),
    /** small notices about other players' shots: cb(text, color) */
    onNotify: (cb) => notifyCbs.push(cb),
    applyRemote,
    /** the table for someone who just joined (null while nothing has been played) */
    snapshot: () => (touched && !moving ? { t: 'pool', k: 'all', s: state() } : null),
  };
}
