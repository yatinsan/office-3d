import * as THREE from 'three';
import * as sfx from './sfx.js';
import { LOBBY_E } from './world/helpers.js';

const MAX_HP = 5;
const TERM_HITS = 2, TERM_WINDOW = 120; // falling (knocked out) 2 times within 2 min = terminated (thrown out of the building)
const DOOR_Z = (7.6 + 8.65) / 2;      // entrance door centre (see unlock.js / lobby.js); the hall is the east side (x > LOBBY_E)
const TERM_HOLD = 2.3, TERM_END = 3.0; // terminated timeline (s): screen black + text, teleport while black, fade back in
const REACH = 1.35;           // metres: you have to be right up close
const CONE = Math.cos(0.5);   // ~29 degrees
const COOLDOWN = 0.45;        // seconds between punches
const REGEN = 6;              // seconds without a hit to heal 1 HP
const FALL = 0.45, DOWN = 2.2, WAKE = 2.4, IMMUNE = 2.5; // knockout timeline (s)
const EYE = 1.65;

/**
 * Fighting in Open World: left click throws a punch (GTA style: left fist first, then random), a hit player gets a red
 * pain flash and a sound; after MAX_HP hits they black out, fall, stay down a few seconds and slowly wake up.
 * Hits are counted on the victim's side; everybody sees the punch, the flinch and the fall through the avatars.
 */
export function initCombat({ camera, player, online, pool = null }) {
  const pain = document.createElement('div'); pain.id = 'pain';
  const black = document.createElement('div'); black.id = 'blackout';
  // GTA-style "WASTED" card, here "YOU ARE TERMINATED": big red slab text over the black screen
  const term = document.createElement('div'); term.id = 'terminated';
  term.textContent = 'You are terminated';
  Object.assign(term.style, {
    position: 'fixed', inset: '0', zIndex: '11', pointerEvents: 'none', opacity: '0',
    display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 16px', boxSizing: 'border-box',
    font: '900 clamp(38px, 9vw, 104px) Impact, "Arial Narrow", "Arial Black", sans-serif', textTransform: 'uppercase',
    letterSpacing: '3px', color: '#e0241b', textShadow: '4px 4px 0 #000, -2px -2px 0 #000, 0 0 28px rgba(220,0,0,.6)',
    transform: 'scale(1.6)',
  });
  document.body.append(pain, black, term);

  let hp = MAX_HP, regenT = 0, cooldown = 0, lastSide = null, lastPunchAt = -9, now = 0;
  let painK = 0, kick = 0, awayX = 0, awayZ = 0, hitLog = [], teleported = false;
  let phase = 'ok', phaseT = 0, immune = 0, koDown = 0, roll = 0, rollDir = 1;
  const v = new THREE.Vector3(), dir = new THREE.Vector3(), eul = new THREE.Euler(0, 0, 0, 'YXZ');

  const canFight = () => online.running() && !player.state.paused && phase === 'ok' && !pool?.isActive?.() && (player.controls.isLocked || player.state.dragMode);

  /** left fist first (and after a pause), then random with a lean towards swapping arms */
  function pickSide() {
    let s;
    if (!lastSide || now - lastPunchAt > 1.5) s = 'L';
    else s = Math.random() < 0.7 ? (lastSide === 'L' ? 'R' : 'L') : lastSide;
    lastSide = s; lastPunchAt = now;
    return s;
  }
  /** the peer you are facing: inside REACH and the aim cone, best alignment wins */
  function target() {
    camera.getWorldDirection(dir);
    let best = null, bestScore = 0;
    for (const p of online.peers()) {
      if (!p.avatar.visible || p.avatar.knocked) continue;
      v.copy(p.avatar.group.position); v.y += 1.1; v.sub(camera.position);
      const d = v.length();
      if (d > REACH || d < 0.01) continue;
      const dot = v.divideScalar(d).dot(dir);
      if (dot < CONE) continue;
      const score = dot - d * 0.05;
      if (score > bestScore) { bestScore = score; best = p; }
    }
    return best;
  }
  function attack() {
    if (cooldown > 0 || !canFight()) return;
    cooldown = COOLDOWN;
    sfx.unlock();
    const side = pickSide();
    const t = target();
    online.me.punch(side);
    sfx.whoosh();
    if (t) { t.avatar.hurt(camera.position.x, camera.position.z); setTimeout(() => sfx.impact(), 90); }
    online.broadcast({ t: 'hit', side, to: t ? t.id : null, from: online.uid() });
  }

  /** someone hit me */
  function receive(from) {
    if (phase !== 'ok' || immune > 0) return;
    hp--; regenT = 0;
    // where did it come from? angle on screen: 0 = in front, 90 = from the right, 180 = behind
    let deg = 0; awayX = 0; awayZ = 0;
    if (from) {
      camera.getWorldDirection(dir);
      const ax = from.avatar.group.position.x - camera.position.x, az = from.avatar.group.position.z - camera.position.z;
      const len = Math.hypot(ax, az) || 1, fl = Math.hypot(dir.x, dir.z) || 1;
      const fx = dir.x / fl, fz = dir.z / fl;
      deg = Math.atan2((ax * -fz + az * fx) / len, (ax * fx + az * fz) / len) * 180 / Math.PI;
      awayX = -ax / len; awayZ = -az / len;
    }
    pain.style.background = `linear-gradient(${deg.toFixed(0)}deg, rgba(200,0,0,0) 25%, rgba(215,0,0,.9) 100%), radial-gradient(ellipse at center, rgba(200,0,0,0) 50%, rgba(200,0,0,.35) 100%)`;
    painK = 1; kick = 1; rollDir = Math.sin(deg * Math.PI / 180) >= 0 ? 1 : -1; // head snaps away from the side it came from
    sfx.hurt();
    // knocked down a 2nd time within TERM_WINDOW: terminated, thrown out to the front door (anywhere in the building)
    if (hp <= 0) {
      hitLog = hitLog.filter((t) => now - t <= TERM_WINDOW);
      hitLog.push(now);
      if (hitLog.length >= TERM_HITS) { terminate(); return; }
    }
    if (hp <= 0) { phase = 'fall'; phaseT = 0; hp = MAX_HP; player.state.stunned = true; online.setKnocked(true); setTimeout(sfx.thud, 450); }
  }
  online.onHit(receive);

  /** terminated: freeze, black out with the text, then teleport to the hall outside the front door facing it */
  function terminate() {
    phase = 'term'; phaseT = 0; teleported = false; hitLog = []; hp = MAX_HP;
    koDown = 0; kick = 0; painK = 0;
    player.state.stunned = true;
    sfx.thud();
  }
  /** outside the entrance door: 1.6 m east of it, looking west at it. Re-entering uses the door / fingerprint reader as usual. */
  function toDoorway() {
    player.pos.set(LOBBY_E + 1.6, 0, DOOR_Z);
    camera.rotation.set(0, Math.PI / 2, 0, 'YXZ'); // yaw 90 deg: facing -x, the office door
    roll = 0;
  }

  // left mouse: locked pointer = click right away; drag-look mode = a click that did not drag (like doors.js)
  let downX = 0, downY = 0;
  addEventListener('mousedown', (e) => {
    downX = e.clientX; downY = e.clientY;
    if (e.button === 0 && player.controls.isLocked) attack();
  });
  addEventListener('click', (e) => {
    if (e.button !== 0 || player.controls.isLocked || !player.state.dragMode) return;
    if (Math.hypot(e.clientX - downX, e.clientY - downY) > 5) return;
    attack();
  });

  const setRoll = (r) => {
    eul.setFromQuaternion(camera.quaternion, 'YXZ'); eul.z = r; camera.quaternion.setFromEuler(eul);
  };
  const ease = (x) => x * x * (3 - 2 * x);

  /** call after player.update: owns the camera height / tilt while you are down */
  function update(dt) {
    now += dt;
    if (cooldown > 0) cooldown -= dt;
    if (immune > 0) immune -= dt;
    if (phase === 'ok') {
      if (hp < MAX_HP && (regenT += dt) > REGEN) { hp++; regenT = 0; }
    } else {
      phaseT += dt;
      if (phase === 'term') {
        black.style.opacity = String(ease(Math.min(1, phaseT / 0.35)));
        const pop = Math.min(1, phaseT / 0.3); // slam the text in
        term.style.opacity = phaseT < TERM_HOLD ? String(ease(pop)) : String(Math.max(0, 1 - (phaseT - TERM_HOLD) / 0.35));
        term.style.transform = `scale(${(1.6 - 0.6 * ease(pop)).toFixed(3)})`;
        if (!teleported && phaseT >= TERM_HOLD) { teleported = true; toDoorway(); }
        if (phaseT >= TERM_HOLD) black.style.opacity = String(Math.max(0, 1 - (phaseT - TERM_HOLD) / 0.6));
        if (phaseT >= TERM_END) {
          phase = 'ok'; phaseT = 0; hp = MAX_HP;
          black.style.opacity = '0'; term.style.opacity = '0';
          player.state.stunned = false; immune = IMMUNE;
        }
      } else if (phase === 'fall') {
        const k = Math.min(1, phaseT / FALL);
        koDown = ease(k); black.style.opacity = String(ease(k));
        if (k >= 1) { phase = 'down'; phaseT = 0; }
      } else if (phase === 'down') {
        koDown = 1; black.style.opacity = '1';
        if (phaseT >= DOWN) { phase = 'wake'; phaseT = 0; }
      } else if (phase === 'wake') {
        const k = Math.min(1, phaseT / WAKE);
        black.style.opacity = String(1 - ease(Math.min(1, k * 1.15)));
        koDown = 1 - ease(Math.max(0, (k - 0.25) / 0.75));
        if (phaseT > 1.0) online.setKnocked(false); // body gets up while you are still groggy
        if (k >= 1) { phase = 'ok'; phaseT = 0; koDown = 0; immune = IMMUNE; player.state.stunned = false; black.style.opacity = '0'; hp = MAX_HP; }
      }
    }
    // pain flash + a little camera kick on every hit
    if (painK > 0) painK = Math.max(0, painK - dt * 2.2);
    if (kick > 0) kick = Math.max(0, kick - dt * 5);
    pain.style.opacity = String(Math.min(1, painK + (phase === 'ok' && hp <= 1 ? 0.18 : 0)));
    const wob = kick * 0.09 * rollDir;
    const r = koDown * 1.25 * rollDir + wob;
    if (koDown > 0 || kick > 0 || roll !== 0) { setRoll(r); roll = r; }
    if (koDown > 0) camera.position.y -= (camera.position.y - 0.28) * koDown;
    else if (kick > 0) { camera.position.y -= kick * 0.05; camera.position.x += awayX * kick * 0.1; camera.position.z += awayZ * kick * 0.1; } // pushed away from the puncher
  }

  return { update, attack, receive, get hp() { return hp; }, get down() { return phase !== 'ok'; } };
}
