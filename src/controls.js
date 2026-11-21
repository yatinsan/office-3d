import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { moveWithCollisions } from './colliders.js';

const EYE = 1.65;
const RADIUS = 0.25;
const WALK = 3.0;
const RUN = 6.0;
const GRAVITY = 18;
const JUMP_V = 5.2;

export function createPlayer(camera, domElement, { spawn, yaw = 0 }) {
  const controls = new PointerLockControls(camera, domElement);
  const keys = {};
  const touch = { x: 0, y: 0, run: false }; // on-screen joystick (src/touch.js): x right, y forward, -1..1
  const pos = new THREE.Vector3(spawn.x, 0, spawn.z); // feet position
  const vel = new THREE.Vector3();
  let vy = 0, feetY = 0, bobT = 0, bob = 0, crouch = 0; // crouch: hold C, 0..1

  camera.position.set(pos.x, EYE, pos.z);
  camera.rotation.set(0, yaw, 0, 'YXZ');

  // Fallback for embedded browsers that block Pointer Lock: click-and-drag to look.
  const state = { dragMode: false, paused: false, stunned: false, crouch: 0, baseY: 0 }; // paused: a form is open, ignore movement keys; stunned: knocked out
  let dragging = false, lastX = 0, lastY = 0;
  const euler = new THREE.Euler(0, 0, 0, 'YXZ');
  domElement.addEventListener('mousedown', (e) => { if (state.dragMode) { dragging = true; lastX = e.clientX; lastY = e.clientY; } });
  addEventListener('mouseup', () => { dragging = false; });
  addEventListener('mousemove', (e) => {
    if (!state.dragMode || !dragging || state.paused) return;
    euler.setFromQuaternion(camera.quaternion);
    euler.y -= (e.clientX - lastX) * 0.004;
    euler.x = Math.max(-1.45, Math.min(1.45, euler.x - (e.clientY - lastY) * 0.004));
    camera.quaternion.setFromEuler(euler);
    lastX = e.clientX; lastY = e.clientY;
  });
  const active = () => !state.paused && !state.stunned && (controls.isLocked || state.dragMode);

  addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (e.code === 'Space') { crouch = 0; jump(); }
    if (e.code === 'KeyM' && !e.repeat && !state.paused && document.body.classList.contains('dev') &&!/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) {
      state.god = !state.god;
      if (!state.god) { vy = 0; feetY = Math.max(0, feetY); vel.set(0, 0, 0); } // drop back down and walk again
      const t = document.createElement('div');
      t.textContent = state.god ? 'God mode ON — W/A/S/D fly, E up, Q down, Shift fast, M to exit' : 'God mode OFF';
      t.style.cssText = 'position:fixed;top:14%;left:50%;transform:translateX(-50%);background:#000a;color:#fff;padding:8px 16px;border-radius:8px;font:14px sans-serif;z-index:99;pointer-events:none';
      document.body.appendChild(t); setTimeout(() => t.remove(), 2200);
    }
  });
  function jump() { if (active() && !state.god && feetY <= 0.001) vy = JUMP_V; }
  addEventListener('keyup', (e) => { keys[e.code] = false; });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

  const fwd = new THREE.Vector3(), right = new THREE.Vector3(), wish = new THREE.Vector3();

  function update(dt) {
    dt = Math.min(dt, 0.05);
    wish.set(0, 0, 0);
    if (active()) {
      camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize();
      right.crossVectors(fwd, camera.up).normalize();
      if (keys.KeyW || keys.ArrowUp) wish.add(fwd);
      if (keys.KeyS || keys.ArrowDown) wish.sub(fwd);
      if (keys.KeyD || keys.ArrowRight) wish.add(right);
      if (keys.KeyA || keys.ArrowLeft) wish.sub(right);
      if (touch.x || touch.y) wish.addScaledVector(fwd, touch.y).addScaledVector(right, touch.x);
    }
    const wantCrouch = !!keys.KeyC && active() && feetY <= 0.001 && (state.canCrouch ? state.canCrouch() : true);
    crouch += ((wantCrouch ? 1 : 0) - crouch) * (1 - Math.exp(-14 * dt));
    state.crouch = crouch; // read by the avatar (online.js) for the crouch pose
    const running = (keys.ShiftLeft || keys.ShiftRight || touch.run) && !wantCrouch;
    if (wish.lengthSq() > 0) {
      const mag = Math.min(1, wish.length());
      wish.normalize().multiplyScalar((running ? RUN : WALK) * (1 - 0.5 * crouch) * (touch.x || touch.y ? Math.max(0.5, mag) : 1));
    }
    // Smooth acceleration / braking.
    const k = 1 - Math.exp(-(feetY > 0 ? 3 : 12) * dt);
    vel.x += (wish.x - vel.x) * k;
    vel.z += (wish.z - vel.z) * k;

    if (state.god) {
      // God mode: free fly, no gravity, no collisions. W/S follow where you look, E up, Q down, Shift = fast.
      const sp = (keys.ShiftLeft || keys.ShiftRight ? 16 : 7);
      let ux = 0, uy = 0, uz = 0;
      if (active()) {
        camera.getWorldDirection(fwd); right.crossVectors(fwd, camera.up).normalize();
        const f = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0) + touch.y;
        const r = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + touch.x;
        ux = fwd.x * f + right.x * r; uy = fwd.y * f + (keys.KeyE ? 1 : 0) - (keys.KeyQ ? 1 : 0); uz = fwd.z * f + right.z * r;
      }
      const kg = 1 - Math.exp(-10 * dt);
      vel.x += (ux * sp - vel.x) * kg; vel.z += (uz * sp - vel.z) * kg; vy += (uy * sp - vy) * kg;
      pos.x += vel.x * dt; pos.z += vel.z * dt;
      feetY += vy * dt;
      bob = 0;
      camera.position.set(pos.x, EYE + feetY + state.baseY, pos.z);
      return;
    }

    moveWithCollisions(pos, vel.x * dt, vel.z * dt, RADIUS);

    vy -= GRAVITY * dt;
    feetY = Math.max(0, feetY + vy * dt);
    if (feetY === 0) vy = Math.max(vy, 0);

    const speed = Math.hypot(vel.x, vel.z);
    if (feetY === 0 && speed > 0.3) { bobT += dt * speed * 2.6; bob = Math.sin(bobT) * 0.035 * Math.min(1, speed / WALK); }
    else bob *= 0.85;

    // looking down: the head leans a little forward (same eye height), like a person bending their neck
    const dn = Math.min(1, Math.max(0, -camera.rotation.x) / 0.8);
    const fw = dn * 0.12;
    camera.position.set(pos.x - Math.sin(camera.rotation.y) * fw, EYE - 0.6 * crouch + feetY + bob + state.baseY, pos.z - Math.cos(camera.rotation.y) * fw);
  }

  return { controls, update, pos, state, touch, jump };
}
