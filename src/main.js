import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildWorld, zoneAt, SPAWN } from './world/index.js';
import { createPlayer } from './controls.js';
import { mergeStatic } from './merge.js';
import { initSuggestions } from './suggestions.js';
import { initDoors } from './doors.js';
import { initArcade } from './arcade.js';
import { initTouch, isTouchDevice } from './touch.js';

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
overlay.addEventListener('click', () => {
  if (touchUI) { enableDragMode(); touchUI.show(true); return; } // phones: no pointer lock, use the on-screen controls
  try {
    const p = player.controls.domElement.requestPointerLock();
    if (p && p.catch) p.catch(() => enableDragMode());
  } catch { enableDragMode(); }
});
// Embedded browsers (e.g. app preview panes) may block Pointer Lock: fall back to click-and-drag look.
function enableDragMode() {
  player.state.dragMode = true;
  overlay.classList.add('hidden');
  hud.dataset.mode = 'drag';
}
document.addEventListener('pointerlockerror', enableDragMode);
addEventListener('keydown', (e) => { if (e.code === 'Escape' && player.state.dragMode && !suggest.isOpen()) { player.state.dragMode = false; overlay.classList.remove('hidden'); } });
player.controls.addEventListener('lock', () => overlay.classList.add('hidden'));
player.controls.addEventListener('unlock', () => { if (!suggest.isOpen()) overlay.classList.remove('hidden'); });

// ---- Suggestions: aim + C to pin a suggestion (text + image), L for the list ----
const doors = initDoors({ scene, player, camera });
const arcade = initArcade({ scene, player }); // game room TV: E to play (suggestion 18)
const suggest = initSuggestions({ scene, camera, player, world, zoneAt, renderer });
suggest.onResumeFailed(() => overlay.classList.remove('hidden'));

// ---- Dev mode: suggestions (C / X / L, pins) only while on. Toggle with P or the switch on the start card ----
let dev = false;
try { dev = localStorage.getItem('pixbit-devmode') === '1'; } catch {}
const devBox = document.getElementById('devbox');
function setDev(on) {
  dev = on;
  document.body.classList.toggle('dev', on);
  devBox.checked = on;
  suggest.setEnabled(on);
  try { localStorage.setItem('pixbit-devmode', on ? '1' : '0'); } catch {}
}
devBox.addEventListener('click', (e) => e.stopPropagation());
document.getElementById('devsw').addEventListener('click', (e) => e.stopPropagation());
devBox.addEventListener('change', () => setDev(devBox.checked));
addEventListener('keydown', (e) => { if (e.code === 'KeyP' && !/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) && !suggest.isOpen()) setDev(!dev); });
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
  doors.update(dt);
  arcade.update(dt);
  updateZone(dt);
  frames++; fpsT += dt;
  if (fpsT > 0.5) {
    const near = arcade.prompt() || doors.prompt();
    if (touchUI) { touchUI.setAction(near); hud.textContent = ''; }
    else hud.textContent = `${near ? near.toUpperCase() + ' · ' : ''}${Math.round(frames / fpsT)} fps · ${high ? 'high' : 'low'} quality (Q) · ${dev ? 'DEV · C suggest · X area · L list' : 'dev mode off (P)'}${player.state.dragMode ? ' · drag mouse to look' : ''}`;
    frames = 0; fpsT = 0;
  }
  renderer.render(scene, camera);
});

// Handy for debugging from the console.
Object.assign(window, { __office: { scene, camera, player, renderer } });
