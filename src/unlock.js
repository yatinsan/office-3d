import * as THREE from 'three';
import { READER, LOBBY_E } from './world/helpers.js';

/**
 * Fingerprint entry lock on the reception entrance door (glass door in the hall's west wall, z 7.6–8.65; suggestion 47).
 * From the hall side the door is locked: stand close to the reader or the door and a black box top right says
 * "press and hold F". Holding F for 1 s fills the ring while your own right hand reaches out and presses the reader; the door then
 * swings open for 8 s and locks again. From inside reception F opens it as usual (exit). The reader carries a padlock
 * icon (red = locked, green = open).
 */
const HOLD = 1;        // seconds to hold F
const OPEN_FOR = 8;    // seconds the doors stay unlocked
const DOOR_Z = (7.6 + 8.65) / 2; // entrance door centre (lobby.js glassWall door)

function lockTexture(open) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const col = open ? '#3ddc84' : '#ff3b30';
  g.fillStyle = 'rgba(12,14,18,.85)'; g.strokeStyle = col; g.lineWidth = 7;
  g.beginPath(); g.arc(64, 64, 58, 0, Math.PI * 2); g.fill(); g.stroke();
  g.lineWidth = 9; g.lineCap = 'round';
  g.beginPath();
  if (open) { g.arc(78, 50, 17, Math.PI, 0); g.lineTo(95, 58); } // shackle swung open to the right
  else { g.moveTo(47, 62); g.lineTo(47, 50); g.arc(64, 50, 17, Math.PI, 0); g.lineTo(81, 62); }
  g.stroke();
  g.fillStyle = col;
  g.beginPath(); g.roundRect(36, 60, 56, 40, 7); g.fill();
  g.fillStyle = 'rgba(12,14,18,.9)';
  g.beginPath(); g.arc(64, 76, 6, 0, Math.PI * 2); g.fill(); g.fillRect(61, 78, 6, 12);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const CSS = `
#unlockbox { position: fixed; top: 16px; right: 16px; z-index: 7; display: flex; align-items: stretch; gap: 0; min-width: 270px;
  background: rgba(24,24,26,.92); color: #fff; padding: 0; border-radius: 2px; pointer-events: none; overflow: hidden;
  font: 700 22px/1.2 system-ui, sans-serif; box-shadow: 0 4px 18px rgba(0,0,0,.35), inset 0 -3px 0 var(--uc, #ff3b30);
  opacity: 0; transform: translateY(-6px); transition: opacity .18s, transform .18s; }
#unlockbox.show { opacity: 1; transform: none; }
#unlockbox svg { width: 60px; height: 60px; flex: none; margin: 0; padding: 8px; box-sizing: border-box; background: var(--uc, #ff3b30); }
#unlockbox .ring { transform: rotate(-90deg); transform-origin: 22px 22px; }
#unlockbox .txt { padding: 10px 22px 12px 16px; margin: 8px 0; border-left: 1px solid rgba(255,255,255,.3); }
#unlockbox small { display: block; font-weight: 400; font-size: 15px; color: rgba(255,255,255,.75); margin-top: 2px; }
#unlockbox kbd { display: inline-block; min-width: 18px; padding: 0 5px; border: 1px solid rgba(255,255,255,.7); border-radius: 3px;
  font: 700 13px/19px system-ui, sans-serif; text-align: center; }
`;

export function initUnlock({ scene, player, camera, doors, touch = false }) {
  const KEY = touch ? '👆' : 'F'; // phones never show the letter F: there is a button instead
  const door = doors.byName('entrance door');
  const outside = () => player.pos.x > LOBBY_E;

  // ---- lock icon + status LED on the fingerprint reader ----
  const texLocked = lockTexture(false), texOpen = lockTexture(true);
  const icon = new THREE.Sprite(new THREE.SpriteMaterial({ map: texLocked, transparent: true }));
  icon.scale.set(0.13, 0.13, 1);
  icon.position.set(READER.x + 0.06, READER.y + 0.24, READER.z);
  icon.renderOrder = 20;
  icon.visible = false; // (the lock now lives in the wall panel only)
  const ledMat = new THREE.MeshStandardMaterial({ color: '#ff3b30', emissive: '#ff3b30', emissiveIntensity: 1.6 });
  const led = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.012, 0.03), ledMat);
  led.position.set(READER.x + 0.018, READER.y + 0.055, READER.z);
  scene.add(led);

  // ---- small black box beside the lock icon (same text as the top-right box), only shown when you are near ----
  const lc = document.createElement('canvas'); lc.width = 896; lc.height = 192;
  const lg = lc.getContext('2d');
  const labelTex = new THREE.CanvasTexture(lc); labelTex.colorSpace = THREE.SRGBColorSpace;
  const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex, transparent: true, depthTest: false, depthWrite: false }));
  label.scale.set(0.62, 0.62 * 192 / 896, 1);
  label.center.set(0.5, 0.5);
  label.position.set(READER.x + 0.12, READER.y + 0.4, READER.z);
  label.renderOrder = 20;
  scene.add(label);
  let labelKey = '';
  const drawLabel = (title, sub, frac, color) => {
    const key = `${title}|${sub}|${Math.round(frac * 40)}|${color}`;
    if (key === labelKey) return;
    labelKey = key;
    const unlocking = color === '#fff';
    const c = unlocking ? '#ff3b30' : color;                 // main accent: red locked, green open
    const glyph = c === '#ff3b30' ? '#ff6a5c' : c;
    const W = 896, H = 192;
    lg.clearRect(0, 0, W, H);
    lg.fillStyle = 'rgba(28,28,30,.96)'; lg.fillRect(190, 0, W - 190, H - 6);   // text panel
    lg.fillStyle = c; lg.fillRect(190, H - 6, W - 190, 6);                      // bottom line
    if (unlocking) { lg.fillStyle = '#ecc828'; lg.fillRect(190, H - 6, (W - 190) * Math.max(0, Math.min(1, frac)), 6); }
    else if (frac < 1) { lg.fillStyle = 'rgba(28,28,30,.96)'; lg.fillRect(190 + (W - 190) * Math.max(0, frac), H - 6, W, 6); } // countdown shrinks the line
    // icon tile: dark square, coloured outline, glowing padlock
    lg.fillStyle = 'rgba(28,28,30,.98)'; lg.fillRect(4, 4, 184, 184);
    lg.shadowColor = c; lg.shadowBlur = 14; lg.strokeStyle = c; lg.lineWidth = 7; lg.strokeRect(5, 5, 182, 182); lg.shadowBlur = 0;
    lg.strokeStyle = glyph; lg.fillStyle = glyph; lg.lineWidth = 15; lg.lineCap = 'butt';
    lg.beginPath(); lg.moveTo(70, 98); lg.lineTo(70, 78); lg.arc(96, 78, 26, Math.PI, 0); lg.lineTo(122, 98); lg.stroke();
    lg.beginPath(); lg.roundRect(56, 92, 80, 66, 12); lg.fill();
    lg.fillStyle = 'rgba(28,28,30,1)'; lg.beginPath(); lg.arc(96, 117, 9, 0, Math.PI * 2); lg.fill(); lg.fillRect(92, 120, 8, 20);
    // divider + text
    lg.fillStyle = c; lg.fillRect(222, 46, 4, 100);
    lg.fillStyle = '#fff'; lg.font = '700 64px system-ui, sans-serif'; lg.textBaseline = 'alphabetic';
    lg.fillText(title, 256, 98);
    lg.fillStyle = 'rgba(255,255,255,.8)'; lg.font = '400 40px system-ui, sans-serif';
    lg.fillText(sub, 256, 152);
    labelTex.needsUpdate = true;
  };

  // ---- your own right hand reaches out (the first-person body in src/online.js draws it) ----
  const target = new THREE.Vector3(READER.x + 0.004, READER.y + 0.02, READER.z);
  const aim = new THREE.Vector3(), fwd = new THREE.Vector3();
  let reach = 0; // 0 = hand down, 1 = finger on the reader

  // ---- top-right box ----
  const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
  const box = document.createElement('div');
  box.id = 'unlockbox';
  const C = 2 * Math.PI * 18;
  box.innerHTML = `<svg viewBox="0 0 44 44"><circle cx="22" cy="22" r="18" fill="none" stroke="rgba(255,255,255,.22)" stroke-width="4"/>
    <circle class="ring" cx="22" cy="22" r="18" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C}"/>
    <text x="22" y="27.5" text-anchor="middle" fill="#fff" font-family="system-ui, sans-serif" font-weight="700" font-size="15">${KEY}</text></svg>
    <div class="txt"></div>`;
  document.body.appendChild(box);
  const ring = box.querySelector('.ring'), keyText = box.querySelector('text'), txt = box.querySelector('.txt');
  let shownHtml = '';
  const setBox = (show, html, frac, color, key) => {
    return; // top-right box removed: the single panel above the reader says it all
    box.classList.toggle('show', show);
    if (!show) return;
    box.style.setProperty('--uc', color === '#fff' ? '#ecc828' : color); // red locked, yellow unlocking, green open
    if (html !== shownHtml) { txt.innerHTML = html; shownHtml = html; }
    ring.setAttribute('stroke-dashoffset', String(C * (1 - frac)));
    ring.setAttribute('stroke', '#fff');
    keyText.textContent = key;
  };

  // ---- state ----
  let state = 'locked'; // locked → open → (closing) → locked
  let progress = 0, holding = false, timer = 0;

  // hold F only works right at the reader; standing at the door just tells you to use the fingerprint reader
  const inZone = () => outside() && Math.hypot(player.pos.x - READER.x, player.pos.z - READER.z) < 0.9;
  const atDoor = () => outside() && Math.hypot(player.pos.x - LOBBY_E, player.pos.z - DOOR_Z) < 1.4;
  const inDoorway = () => player.pos.x > LOBBY_E - 0.6 && player.pos.x < LOBBY_E + 0.6 && Math.abs(player.pos.z - DOOR_Z) < 0.75;
  door.locked = () => state !== 'open' && outside(); // F does nothing on it from the hall while locked

  const unlock = () => {
    state = 'open'; timer = OPEN_FOR; holding = false; progress = 0;
    if (!door.target) doors.toggle(door);
    icon.material.map = texOpen; icon.material.needsUpdate = true;
  };

  const typing = (e) => /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName);
  addEventListener('keydown', (e) => {
    if (e.code !== 'KeyF' || e.repeat || player.state.paused || typing(e)) return;
    if (state === 'locked' && inZone()) holding = true;
  });
  addEventListener('keyup', (e) => { if (e.code === 'KeyF') holding = false; });
  addEventListener('blur', () => { holding = false; });

  function update(dt) {
    // Opened by hand from inside (or by another player, via door sync): the door counts as unlocked for the same 8 s,
    // so someone outside can walk in, then it locks again.
    if (state === 'locked' && door.target) unlock();
    const near = inZone();
    if (!near || state !== 'locked') holding = false;

    // hold to unlock
    if (holding) { progress += dt / HOLD; if (progress >= 1) unlock(); }
    else progress = Math.max(0, progress - dt * 2.5);

    // open → wait 8 s → close once nobody stands in the doorway
    if (state === 'open') {
      timer -= dt;
      if (timer <= 0 && !inDoorway()) state = 'closing';
    }
    if (state === 'closing') {
      if (door.target) doors.toggle(door); // doors.js swings it shut and makes it solid again
      if (door.t === 0) { state = 'locked'; icon.material.map = texLocked; icon.material.needsUpdate = true; }
    }

    // hand: reach out while F is held, press the reader, pull back after
    const goalReach = holding ? 1 : 0;
    reach = goalReach ? Math.min(1, reach + dt / 0.3) : Math.max(0, reach - dt / 0.35);
    if (reach > 0) {
      if (camera.position.distanceTo(target) < 2.4 && outside()) aim.copy(target);
      else { camera.getWorldDirection(fwd); aim.copy(camera.position).addScaledVector(fwd, 0.6).y -= 0.15; } // too far / other side: press the air
      const press = holding && reach === 1 ? 0.012 * (0.5 + 0.5 * Math.sin(performance.now() / 120)) : 0; // finger pushes in and out
      if (press) { camera.getWorldDirection(fwd); aim.addScaledVector(fwd, press); }
    }

    // LED: red locked, blinking blue while scanning, green open
    const scanning = holding && reach === 1;
    const ledCol = state === 'open' ? '#34d058' : scanning ? (Math.floor(performance.now() / 150) % 2 ? '#3aa0ff' : '#0b2a55') : '#ff3b30';
    ledMat.color.set(ledCol); ledMat.emissive.set(ledCol);
    // lock icon + its black box: only when you are near the reader or the door (from the hall)
    const dReader = Math.hypot(player.pos.x - READER.x, player.pos.z - READER.z);
    const close = outside() && (dReader < 1.8 || atDoor());
    label.visible = close;
    if (close) {
      if (state === 'open') { const s = Math.max(0, Math.ceil(timer)); drawLabel('Door Unlocked', timer > 0 ? `Locks again in ${s}s` : 'Clear the doorway to lock', Math.max(0, timer) / OPEN_FOR, '#34d058'); }
      else if (state === 'closing') drawLabel('Locking…', 'Door closing', 0, '#ff3b30');
      else if (near) drawLabel(progress > 0 ? 'Unlocking…' : 'Door Locked', progress > 0 ? (touch ? 'Keep holding' : 'Keep holding F') : touch ? 'Hold the button to unlock' : 'Place your finger to unlock', progress, '#fff');
      else drawLabel('Door Locked', 'Place your finger to unlock', 1, '#ff3b30');
    }

    // top-right box
    const hasBox = near || (state !== 'locked' && Math.hypot(player.pos.x - LOBBY_E, player.pos.z - DOOR_Z) < 5);
    if (state === 'locked') {
      if (!near && atDoor()) setBox(true, 'Door Locked<small>Place your finger to unlock</small>', 1, '#ff3b30', '🔒');
      else setBox(near, progress > 0 ? `Unlocking…<small>Keep holding ${touch ? 'the button' : '<kbd>F</kbd>'}</small>` : touch ? 'Door Locked<small>Hold the button to unlock</small>' : 'Door Locked<small>Hold <kbd>F</kbd> to unlock</small>', progress, '#fff', KEY);
    } else if (state === 'open') {
      const s = Math.max(0, Math.ceil(timer));
      setBox(hasBox, timer > 0 ? `Door unlocked<small>Locks again in ${s}s</small>` : 'Door unlocked<small>Clear the doorway to lock</small>', Math.max(0, timer) / OPEN_FOR, '#34d058', String(s));
    } else setBox(hasBox, 'Locking…<small>Door closing</small>', 0, '#ff3b30', '🔒');
  }

  /** HUD / touch-button hint. */
  function prompt() {
    return state === 'locked' && inZone() ? 'F open door' : '';
  }

  /** Where your own right hand should be: k 0 = down at your side, 1 = on the reader. */
  function reachInfo() { return { k: reach * reach * (3 - 2 * reach), aim }; }

  return { update, prompt, reach: reachInfo };
}
