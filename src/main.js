import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildWorld, zoneAt, SPAWN, setHallDevSigns } from './world/index.js';
import { createPlayer } from './controls.js';
import { mergeStatic } from './merge.js';
import { initSuggestions } from './suggestions.js';
import { initDoors } from './doors.js';
import { initUnlock } from './unlock.js';
import { initLadies } from './ladies.js';
import { initArcade } from './arcade.js';
import { initTouch, isTouchDevice } from './touch.js';
import { initModes } from './modes.js';
import { initMenu } from './menu.js';
import { initHunt } from './hunt.js';
import { initOnline } from './online.js';
import { initBalconyJump } from './balconyJump.js';
import { initPool } from './pool.js';
import { initCombat } from './combat.js';
import { initSeat } from './seat.js';

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
document.addEventListener('pointerlockerror', enableDragMode);
addEventListener('keydown', (e) => { if (e.code === 'Escape' && player.state.dragMode && !suggest.isOpen()) { player.state.dragMode = false; showMenu(); } });
player.controls.addEventListener('lock', () => overlay.classList.add('hidden'));
player.controls.addEventListener('unlock', () => { if (!suggest.isOpen()) showMenu(); });

// ---- Suggestions: aim + C to pin a suggestion (text + image), L for the list ----
const doors = initDoors({ scene, player, camera });
const unlock = initUnlock({ scene, player, camera, doors, touch: !!touchUI }); // fingerprint entry lock on the reception entrance door (suggestion 47)
const ladies = initLadies({ scene, player, doors }); // ladies toilet door asks "ARE U GAY?" before it opens
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
const combat = initCombat({ camera, player, online, pool }); // left click: punch the player you face; get hit, black out, wake up
const seat = initSeat({ scene, camera, player, online, overlay, touch: !!touchUI }); // desk chairs: E to sit, use the little Mac (local only)
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
    ...(DEV_BUILD ? [{ label: () => 'Dev mode: ' + (dev ? 'On' : 'Off'), hint: 'Suggestions tools (C / X / L). Press P in game to switch.', action() { setDev(!dev); menu.refresh(); } }] : []),
    { label: 'Controls', hint: 'Keys and mouse', action: () => menu.push({ title: 'Controls', extra: controlsEl, items: [{ label: 'Back', action: () => menu.back() }] }) },
    { label: 'Back', action: () => menu.back() },
  ],
});
const playPage = () => ({
  title: 'Play',
  items: [
    ...modes.list.map((m) => ({ label: m.name, hint: m.desc, action: () => begin(m.id) })),
    { label: 'Back', action: () => menu.back() },
  ],
});
const mainPage = () => ({
  title: 'Pixbit Office',
  items: [
    { label: 'Play', hint: 'Pick your character, then walk the office with other people', action: () => (modes.list.length === 1 ? begin(modes.list[0].id) : menu.push(playPage)) },
    { label: 'Character', hint: 'Your name and dress colour', action: () => online.edit() },
    { label: 'Settings', hint: 'Mic, dev mode and controls', action: () => menu.push(settingsPage) },
  ],
});
const pausePage = () => ({
  title: 'Paused',
  back: armResume,
  items: [
    { label: 'Resume', action: resume },
    { label: 'Character', hint: 'Your name and dress colour', action: () => online.edit() },
    { label: 'Settings', hint: 'Mic, dev mode and controls', action: () => menu.push(settingsPage) },
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
  on = DEV_BUILD && on;
  dev = on;
  document.body.classList.toggle('dev', on);
  suggest.setEnabled(on);
  setHallDevSigns(on);
  try { localStorage.setItem('pixbit-devmode', on ? '1' : '0'); } catch {}
}
addEventListener('keydown', (e) => { if (DEV_BUILD && e.code === 'KeyP' &&!/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) && !suggest.isOpen()) setDev(!dev); });
setDev(dev);

// ---- Quality toggle ----
let high = true;
addEventListener('keydown', (e) => {
  if (e.code !== 'KeyQ') return;
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
function updateZone(dt) {
  const z = zoneAt(player.pos.x, player.pos.z);
  if (z !== zone) {
    zone = z; zoneEl.textContent = z; zoneEl.classList.add('show'); zoneTimer = 2.2;
  }
  if (zoneTimer > 0 && (zoneTimer -= dt) <= 0) zoneEl.classList.remove('show');
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = clock.getDelta();
  player.update(dt);
  balconyJump.update(dt); // after player.update: owns the camera tilt during the cutscene
  doors.update(dt);
  unlock.update(dt);
  ladies.update(dt);
  arcade.update(dt);
  pool.update(dt); // after player.update: owns the camera while you play
  seat.update(dt); // same while you sit at a desk
  combat.update(dt); // knocked out: owns the camera height / tilt
  modes.update(dt, overlay.classList.contains('hidden'));
  online.updateSelf(dt, unlock.reach()); // your own body; its right hand presses the fingerprint reader
  updateZone(dt);
  frames++; fpsT += dt;
  if (fpsT > 0.5) {
    const near = arcade.prompt() || pool.prompt() || seat.prompt() || (modes.current === hunt && hunt.prompt()) || doors.prompt() || unlock.prompt() || ladies.prompt();
    if (touchUI) { touchUI.setAction(near); hud.textContent = ''; promptEl.textContent = ''; }
    else {
      promptEl.textContent = near || '';
      hud.textContent = `${Math.round(frames / fpsT)} fps · ${high ? 'high' : 'low'} (Q)${dev ? ' · DEV · C suggest · X area · L list' : ''}${player.state.dragMode ? ' · drag to look' : ''}`;
    }
    frames = 0; fpsT = 0;
  }
  renderer.render(scene, camera);
});

// Handy for debugging from the console.
Object.assign(window, { __office: { scene, camera, player, renderer, doors, pool } });
