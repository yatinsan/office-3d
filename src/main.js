import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildWorld, zoneAt, SPAWN, setHallDevSigns } from './world/index.js';
import { MEET_Z1 as GR_Z0, GAME_X1 as GR_X1, GAME_Z1 as GR_Z1 } from './world/helpers.js';
import { createPlayer } from './controls.js';
import { mergeStatic } from './merge.js';
import { initSuggestions } from './suggestions.js';
import { initDoors } from './doors.js';
import { initUnlock } from './unlock.js';
import { initLadies } from './ladies.js';
import { initGents } from './gents.js';
import { initAlarm } from './alarm.js';
import { initArcade } from './arcade.js';
import { initGameGuide } from './gameguide.js';
import { initTouch, isTouchDevice } from './touch.js';
import { initModes } from './modes.js';
import { initMenu } from './menu.js';
import { initHunt } from './hunt.js';
import { initOnline } from './online.js';
import { initBalconyJump } from './balconyJump.js';
import { initPool } from './pool.js';
import { initCombat } from './combat.js';
import { initSeat } from './seat.js';
import { initGames } from './games.js';
import { initMinimap } from './minimap.js';
import { initLifts } from './lifts.js';
import { lvl } from './colliders.js';
import { achievements } from './achievements.js';

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.9;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const HAZE = new THREE.Color('#a8aaa4'); // warm evening haze (photo IMG_5660); sky dome lives in world/landscape.js
scene.background = HAZE;
scene.fog = new THREE.Fog(HAZE, 40, 1100);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.45;

const camera = new THREE.PerspectiveCamera(78, innerWidth / innerHeight, 0.05, 1500); // wider, closer to the phone photos

// ---- Lights ----
scene.add(new THREE.HemisphereLight('#f6f7ff', '#7a7066', 0.8));
const sun = new THREE.DirectionalLight('#fff3e2', 1.5);
sun.position.set(-22, 20, 4);
sun.target.position.set(5, 0, 10);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -18, right: 18, top: 18, bottom: -18, near: 1, far: 80 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);
// Soft fill from the lobby so the (window-less) reception isn't flat.
const fill = new THREE.PointLight('#ffe8c8', 6, 12, 1.5);
fill.position.set(8.7, 2.6, 7.8);
scene.add(fill);

// ---- World ----
const world = new THREE.Group();
buildWorld(world);
const drawGroups = mergeStatic(world);
scene.add(world);

// ---- Player ----
const player = createPlayer(camera, renderer.domElement, { spawn: SPAWN, yaw: SPAWN.yaw });
const overlay = document.getElementById('overlay');
const touchUI = isTouchDevice() ? initTouch({ player, camera }) : null;
if (touchUI) touchUI.show(false);
let started = false; // false: start menu (Play / Character / Settings); true: in a game, Esc shows the pause menu
/** Begin (or resume) playing: grab the pointer. Needs a user gesture (Enter / click on a menu line). */
function startPlaying() {
  if (touchUI) { enableDragMode(); touchUI.show(true); return; } // phones: no pointer lock, use the on-screen controls
  try {
    const p = player.controls.domElement.requestPointerLock();
    if (p && p.catch) p.catch(() => enableDragMode());
  } catch { enableDragMode(); }
}
// Embedded browsers (e.g. app preview panes) may block Pointer Lock: fall back to click-and-drag look.
function enableDragMode() {
  player.state.dragMode = true;
  overlay.classList.add('hidden');
  hud.dataset.mode = 'drag';
}
let escTrying = false; // Esc-resume attempt in flight: a refusal arms click-to-resume instead of switching to drag mode
document.addEventListener('pointerlockerror', () => { if (!escTrying) enableDragMode(); });
addEventListener('keydown', (e) => { if (e.code === 'Escape' && player.state.dragMode && !suggest.isOpen()) { player.state.dragMode = false; showMenu(); } });
player.controls.addEventListener('lock', () => { overlay.classList.add('hidden'); if (!touchUI) { player.state.dragMode = false; hud.dataset.mode = ''; } });
// click-to-aim: after an Esc resume the game runs unlocked; the first click on the world locks the mouse for aiming
player.controls.domElement.addEventListener('mousedown', () => {
  if (touchUI || !player.state.dragMode || player.controls.isLocked) return;
  try { const p = player.controls.domElement.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch {}
});
player.controls.addEventListener('unlock', () => { if (!suggest.isOpen() && !seat.isBrowsing()) showMenu(); });

// ---- Suggestions: aim + C to pin a suggestion (text + image), L for the list ----
const doors = initDoors({ scene, player, camera });
const unlock = initUnlock({ scene, player, camera, doors, touch: !!touchUI }); // fingerprint entry lock on the reception entrance door (suggestion 47)
const ladies = initLadies({ scene, player, doors }); // ladies toilet door asks "ARE U GAY?" before it opens
const gents = initGents({ player }); // gents toilet: F to enter -> "Bathroom is being cleaned"
const alarm = initAlarm({ scene, player, camera, onPull: () => online.broadcast({ t: 'alarm' }) }); // fire alarm pull station beside lift 5: hold E; rings for everyone online (suggestion 62)
const arcade = initArcade({ scene, player }); // game room TV: E to play (suggestion 18)
const balconyJump = initBalconyJump({ camera, player, touch: !!touchUI }); // terrace rail: Space to jump -> video cutscene
const pool = initPool({ scene, camera, player, touch: !!touchUI }); // game room pool table: E to play, hold R to re-rack
const suggest = initSuggestions({ scene, camera, player, world, zoneAt, renderer });
suggest.onResumeFailed(() => showMenu());

// ---- Game modes (Esc menu): Free Walk + Scavenger Hunt ----
const modes = initModes({ defaultId: 'online' });
const hunt = initHunt({ scene, camera, player });
// Scavenger Hunt is temporarily hidden (see MULTIPLAYER.md). To bring it back, uncomment the next line.
// modes.register(hunt);
// Open World: other players over WebRTC (Firebase only for the lobby + handshake), hold V to talk
const online = initOnline({ scene, camera, player, panel: overlay, doors, pool, touch: !!touchUI, start: () => launch() });
modes.register(online);
const games = initGames({ online, player, scene, camera }); // G: create / join / start games (Hide and Seek); everybody else can watch
const combat = initCombat({ camera, player, online, pool, games }); // left click: punch the player you face; get hit, black out, wake up
const lifts = initLifts({ scene, camera, player, navigate: (on) => minimap.navigate(on) }); // E at any lift: ride to the ground floor and back (suggestion 54)
online.hookAlarm((name) => alarm.trigger(name)); // someone else pulled the fire alarm
online.hookLifts({ msg: (m) => lifts.apply(m), snap: () => lifts.snapshot() }); // lift calls / rides are sent to the others only when they happen
lifts.onChange((m) => online.broadcast(m));
const minimap = initMinimap({ camera, player, online }); // GTA-style square map at the right edge
const seat = initSeat({ scene, camera, player, online, overlay, touch: !!touchUI }); // desk chairs: E to sit, use the little Mac (others see its screen; a taken seat can't be used)
online.hookScreens(seat.hooks);
if (touchUI) touchUI.onHit = () => combat.attack();

// ---- Start / pause menu (GTA style): Play > Open World / Free Walk, Character, Settings; Esc in game > Resume / Character / Settings / Quit ----
const controlsEl = document.querySelector('.m-controls');
// Browsers refuse Pointer Lock for an Esc keypress (it is not a user gesture), so Esc on the pause menu only
// arms the resume: the next click or non-Esc key takes the pointer back.
let resumeArmed = false;
const menu = initMenu({
  root: document.getElementById('menu'),
  active: () => !overlay.classList.contains('hidden'),
  foot: () => (resumeArmed ? 'Click or press any key to resume' : (modes.running && modes.current.id === 'online' ? online.statusHtml() : '')),
});
/** Pick a mode (or keep the current one) and start playing. Open World asks for a name + colour first. */
function begin(id) {
  if (id) modes.choose(id);
  // Open World: the character screen (name + colour) opens only for a new player; its Done calls launch()
  if (!(modes.current.intro && modes.current.intro())) launch();
}
function launch() {
  started = true;
  modes.play();
  startPlaying();
}
function resume() { resumeArmed = false; startPlaying(); }
function armResume() { resumeArmed = true; menu.refresh(); }
/** Esc on the pause menu: resume straight away; if the browser refuses the pointer (Esc is no gesture there), fall back to click / any key. */
function escResume() {
  if (touchUI) { resume(); return; }
  escTrying = true;
  // browser said no (Esc is no gesture): resume anyway in click-to-aim mode; the first click grabs the mouse
  const arm = () => { escTrying = false; if (!player.controls.isLocked && !player.state.dragMode) { resumeArmed = false; enableDragMode(); } };
  try {
    const p = player.controls.domElement.requestPointerLock();
    resumeArmed = false;
    if (p && p.catch) p.catch(arm);
    setTimeout(arm, 400); // some browsers neither throw nor lock
  } catch { arm(); }
}
// A real gesture (click or any key other than Esc) finishes an armed resume.
addEventListener('pointerdown', () => { if (resumeArmed) resume(); });
addEventListener('keydown', (e) => { if (resumeArmed && e.code !== 'Escape') resume(); });
function quit() {
  modes.quit();
  started = false;
  player.pos.set(SPAWN.x, 0, SPAWN.z);
  camera.position.set(SPAWN.x, 1.65, SPAWN.z);
  camera.rotation.set(0, SPAWN.yaw, 0, 'YXZ');
  touchUI?.show(false);
  showMenu();
}
const micLabel = () => 'Mic: ' + (online.micMode === 'ptt' ? 'Push to talk' : 'Always on');
const settingsPage = () => ({
  title: 'Settings',
  items: [
    { label: micLabel, hint: 'Push to talk (hold V) or always-on mic. Press T in game to switch.', action() { online.setMicMode(online.micMode === 'ptt' ? 'open' : 'ptt'); menu.refresh(); } },
    { label: 'Controls', hint: 'Keys and mouse', action: () => menu.push({ title: 'Controls', extra: controlsEl, items: [{ label: 'Back', action: () => menu.back() }] }) },
    { label: 'Back', action: () => menu.back() },
  ],
});
const achievementsPage = () => ({
  title: 'Achievements',
  extra: (() => { const t = achievements.tiles(); achievements.markSeen(); return t; })(),   // new ones pulse once; the corner badge clears
  items: [{ label: 'Back', action: () => menu.back() }],
});
const playPage = () => ({
  title: 'Play',
  items: [
    ...modes.list.map((m) => ({ label: m.name, hint: m.desc, action: () => begin(m.id) })),
    { label: 'Back', action: () => menu.back() },
  ],
});
const mainPage = () => ({
  title: 'Pixbee',
  items: [
    { label: 'Play', hint: 'Pick your character, then walk the office with other people', action: () => (modes.list.length === 1 ? begin(modes.list[0].id) : menu.push(playPage)) },
    { label: 'Character', hint: 'Your name and dress colour', action: () => online.edit() },
    { label: 'Achievements', hint: 'Everything you can unlock in the office', action: () => menu.push(achievementsPage) },
    { label: 'Settings', hint: 'Mic and controls', action: () => menu.push(settingsPage) },
  ],
});
const pausePage = () => ({
  title: 'Paused',
  back: escResume,
  items: [
    { label: 'Resume', action: resume },
    { label: 'Games', hint: 'Create or join a game (press G in the world)', action: () => { resume(); games.open(); } },
    { label: 'Character', hint: 'Your name and dress colour', action: () => online.edit() },
    { label: 'Achievements', hint: 'Everything you can unlock in the office', action: () => menu.push(achievementsPage) },
    { label: 'Settings', hint: 'Mic and controls', action: () => menu.push(settingsPage) },
    { label: 'Quit', hint: 'Back to the start screen', action: quit },
  ],
});
/** Show the menu: the start menu before playing and after Quit, the pause menu during a game. */
function showMenu() {
  resumeArmed = false;
  overlay.classList.remove('hidden');
  menu.open(started ? pausePage : mainPage);
}
showMenu();

// ---- Dev mode: suggestions (C / X / L, pins) only while on. Toggle with P or in Settings ----
// Only available in the development server (`npm run dev`); production builds never show it.
const DEV_BUILD = import.meta.env.DEV;
document.body.classList.toggle('dev-build', DEV_BUILD);
let dev = false;
try { dev = DEV_BUILD && localStorage.getItem('pixbit-devmode') === '1'; } catch {}
function setDev(on) {
  dev = on;
  document.body.classList.toggle('dev', on);
  if (!on) player.state.god = false; // god mode is a dev-only tool
  suggest.setEnabled(on);
  setHallDevSigns(on);
  try { localStorage.setItem('pixbit-devmode', on ? '1' : '0'); } catch {}
}
addEventListener('keydown', (e) => { if (DEV_BUILD && e.code === 'KeyP' && e.shiftKey && !/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) && !suggest.isOpen()) setDev(!dev); });
setDev(dev);

// Cheat code: type it anywhere in game (not in a text box) to toggle dev mode, also on production builds.
// Only its SHA-256 is stored, so reading the source doesn't reveal it. Obscurity, not security: everything here runs client-side.
const CHEAT_HASH = '8fc93e277e46cb1c0ed372a16e72fa9d79f91862dd67cb9ce5e520180552b591';
const CHEAT_LEN = 8;
let cheatBuf = '';
addEventListener('keydown', async (e) => {
  if (e.repeat || !/^Key[A-Z]$/.test(e.code) || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
  cheatBuf = (cheatBuf + e.code.slice(3).toLowerCase()).slice(-CHEAT_LEN);
  if (cheatBuf.length < CHEAT_LEN || !crypto.subtle) return;
  const h = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(cheatBuf)))].map((b) => b.toString(16).padStart(2, '0')).join('');
  if (h === CHEAT_HASH) {
    cheatBuf = ''; setDev(!dev);
    const t = document.createElement('div'); // its own plain banner, not the "X joined" feed
    t.textContent = dev ? 'Dev mode activated' : 'Dev mode deactivated';
    t.style.cssText = 'position:fixed;top:56px;right:0;z-index:8;padding:12px 24px;background:rgba(0,0,0,.6);color:#fff;font:600 15px sans-serif;border-radius:8px 0 0 8px;pointer-events:none;opacity:0;transform:translateX(30px);transition:opacity .25s,transform .25s';
    document.body.appendChild(t);
    requestAnimationFrame(() => { t.style.opacity = '1'; t.style.transform = 'none'; });
    setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 2500);
  }
});

// ---- Quality toggle ----
let high = true;
addEventListener('keydown', (e) => {
  if (e.code !== 'KeyQ' || player.state.god) return; // Q = fly down in god mode
  high = !high;
  sun.castShadow = high;
  renderer.setPixelRatio(high ? Math.min(devicePixelRatio, 2) : 1);
  renderer.setSize(innerWidth, innerHeight);
});

// ---- HUD ----
const zoneEl = document.getElementById('zone');
const hud = document.getElementById('hud');
const promptEl = document.getElementById('prompt');
let zone = '', zoneTimer = 0, fpsT = 0, frames = 0;
const EXPLORE = ['Reception', 'Workspace', 'Meeting Room', 'Game Room', 'Terrace', 'Window Lounge', 'Cabin Corridor'];   // areas to visit for "Office Explorer"
let visited = new Set();
try { visited = new Set(JSON.parse(localStorage.getItem('pixbit-visited') || '[]')); } catch {}
setInterval(() => { try { localStorage.setItem('pixbit-visited', JSON.stringify([...visited])); } catch {} }, 5000);
function updateZone(dt) {
  const z = lifts.riding() ? 'Lift' : zoneAt(player.pos.x, player.pos.z);
  if (z !== zone) {
    zone = z; zoneEl.textContent = z; zoneEl.classList.add('show'); zoneTimer = 2.2;
    if (started && z !== 'Lift') { visited.add(z); if (EXPLORE.every((a) => visited.has(a))) achievements.unlock('explorer'); }
  }
  // only truly inside the room (just past its entrance door, on the 4th floor, not in a lift): the lifts next to it don't count
  const p = player.pos;
  if (zone === 'Game Room' && !lifts.riding() && lvl.cur === 0 && p.x > 0.4 && p.x < GR_X1 && p.z > GR_Z0 + 0.5 && p.z < GR_Z1) lifts.unlock();
  if (zoneTimer > 0 && (zoneTimer -= dt) <= 0) zoneEl.classList.remove('show');
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

player.state.canCrouch = () => !dev && !games.isProp(); // C = crouch (hold); dev mode uses C for 'suggest', Prop Hunt props use it for clones
// V: switch between first and third person
addEventListener('keydown', (e) => {
  if (e.code !== 'KeyV' || e.repeat || player.state.paused || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || games.isProp()) return;
  online.toggleView();
});

const gameGuide = initGameGuide({ scene, player, inGameRoom: () => zone === 'Game Room' }); // first visit: a glowing marker at the Game Room door

const clock = new THREE.Clock();
// Menu / pause screen: the view behind the overlay sways very slowly so it never looks frozen. The offset is removed before the
// next frame's updates, so it never leaks into the real camera angle.
let swayT = 0, swayY = 0, swayX = 0;
renderer.setAnimationLoop(() => {
  const dt = clock.getDelta();
  camera.rotation.y -= swayY; camera.rotation.x -= swayX; swayY = swayX = 0;
  player.update(dt);
  balconyJump.update(dt); // after player.update: owns the camera tilt during the cutscene
  doors.update(dt);
  lifts.update(dt);
  unlock.update(dt);
  ladies.update(dt);
  gents.update();
  alarm.update(dt);
  arcade.update(dt);
  pool.update(dt); // after player.update: owns the camera while you play
  seat.update(dt); // same while you sit at a desk
  combat.update(dt); // knocked out: owns the camera height / tilt
  games.update(dt);
  modes.update(dt, overlay.classList.contains('hidden'));
  online.updateSelf(dt, unlock.reach()); // your own body; its right hand presses the fingerprint reader
  updateZone(dt);
  gameGuide.update(dt);
  minimap.update(dt, started && overlay.classList.contains('hidden'));
  if (!overlay.classList.contains('hidden')) {
    swayT += dt;
    swayY = Math.sin(swayT * 0.35) * 0.05; swayX = Math.sin(swayT * 0.5) * 0.012;
    camera.rotation.y += swayY; camera.rotation.x += swayX;
  }
  frames++; fpsT += dt;
  if (fpsT > 0.5) {
    const near = lvl.cur ? lifts.prompt() : arcade.prompt() || pool.prompt() || seat.prompt() || (modes.current === hunt && hunt.prompt()) || doors.prompt() || unlock.prompt() || ladies.prompt() || gents.prompt() || alarm.prompt() || lifts.prompt();
    if (touchUI) { touchUI.setAction(near); hud.textContent = ''; promptEl.textContent = ''; }
    else {
      if (promptEl.dataset.t !== (near || '')) { // "F open door" -> [F] | Open door, like the lock box
        promptEl.dataset.t = near || '';
        const m = /^(F \/ click|F|E|V|R|C) (.+)$/.exec(near || '');
        if (m) promptEl.innerHTML = `<span class="pk${m[1].length > 1 ? ' wide' : ''}">${m[1]}</span><span class="pt">${m[2].replace(/\w/g, (c) => c.toUpperCase())}</span>`;
        else promptEl.innerHTML = near ? `<span class="pt">${near}</span>` : '';
      }
      hud.textContent = `${Math.round(frames / fpsT)} fps · ${high ? 'high' : 'low'} (Q)${dev ? ' · DEV · C suggest · X area · L list' : ''}${player.state.dragMode ? ' · drag to look' : ''}`;
    }
    frames = 0; fpsT = 0;
  }
  if (!balconyJump.covered) { // (not drawn while the balcony video covers the screen: it plays smoother)
    if (!games.camBegin()) online.camBegin(); // a hider who is a prop sees from behind; otherwise C = third person
    renderer.render(scene, camera);
    games.camEnd(); online.camEnd();
  }
});

// Handy for debugging from the console.
Object.assign(window, { __office: { scene, camera, player, renderer, doors, pool, lifts } });
