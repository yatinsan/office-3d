import * as THREE from 'three';
import { LIFTS } from './world/hall.js';

/**
 * Fire alarm pull stations (the red boxes beside each lift on the 4th floor, built in world/hall.js → liftFront):
 * get very close and look at it: a small red E appears; hold E to pull (ring fills). A siren sounds and the hall strobes red for ~10 s.
 * (suggestion 62)
 */
const DURATION = 10;
let ac = null, siren = null;
function startSiren() {
  try {
    ac ||= new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === 'suspended') ac.resume();
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'square';
    g.gain.value = 0.07;
    o.connect(g).connect(ac.destination);
    const t = ac.currentTime;
    for (let i = 0; i < DURATION * 2; i++) o.frequency.setValueAtTime(i % 2 ? 740 : 980, t + i * 0.5); // two-tone horn
    g.gain.setValueAtTime(0.07, t + DURATION - 0.1); g.gain.linearRampToValueAtTime(0.0001, t + DURATION);
    o.start(t); o.stop(t + DURATION + 0.05);
    siren = o;
  } catch { /* no audio */ }
}
function stopSiren() { try { siren?.stop(); } catch { /* already stopped */ } siren = null; }

export function initAlarm({ scene, player, camera }) {
  const stations = LIFTS.filter((l) => l.n === 5).map((l) => {
    const k = -l.out;
    return { x: l.x + l.out * 0.05, y: 1.3, z: l.z - k * 0.97, out: l.out };
  });
  if (!stations.length) return { update() {}, prompt: () => '' };

  const HOLD = 1.2, C = 2 * Math.PI * 18;
  const style = document.createElement('style');
  style.textContent = `#alarmkey{position:fixed;left:50%;bottom:120px;width:56px;height:56px;margin-left:-28px;z-index:6;pointer-events:none;opacity:0;transform:scale(.7);transition:opacity .15s,transform .15s}
    #alarmkey.show{opacity:1;transform:scale(1)}#alarmkey.on{animation:alarmpulse .4s steps(2) infinite}
    @keyframes alarmpulse{50%{filter:brightness(.55)}}
    #alarmkey svg{width:100%;height:100%;overflow:visible}#alarmkey .ring{transform:rotate(-90deg);transform-origin:22px 22px}`;
  document.head.appendChild(style);
  const el = document.createElement('div'); el.id = 'alarmkey';
  el.innerHTML = `<svg viewBox="0 0 44 44"><circle cx="22" cy="22" r="20" fill="rgba(20,0,0,.7)"/>
    <circle cx="22" cy="22" r="18" fill="none" stroke="rgba(255,255,255,.2)" stroke-width="3"/>
    <circle class="ring" cx="22" cy="22" r="18" fill="none" stroke="#ff3b2e" stroke-width="3.5" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C}"/>
    <text x="22" y="29" text-anchor="middle" font-family="system-ui,sans-serif" font-weight="900" font-size="20" fill="#ff3b2e">E</text></svg>`;
  document.body.appendChild(el);
  const ring = el.querySelector('.ring');

  // a flashing red light over each station + a red lever that drops when pulled
  const lights = stations.map((s) => {
    const l = new THREE.PointLight('#ff2a1a', 0, 9, 1.4);
    l.position.set(s.x + s.out * 0.6, 2.6, s.z); scene.add(l);
    const lever = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.04, 0.06), new THREE.MeshStandardMaterial({ color: '#c81e14', roughness: 0.4 }));
    lever.position.set(s.x + s.out * 0.06, s.y, s.z); scene.add(lever);
    return { l, lever };
  });

  let t = 0, on = false, holding = false, progress = 0;
  const v = new THREE.Vector3(), fwd = new THREE.Vector3();
  /** very close AND looking at the pull station (so it never shows at the lift's own button/doors) */
  const facing = () => stations.some((s) => {
    v.set(s.x - camera.position.x, s.y - camera.position.y, s.z - camera.position.z);
    const d = v.length(); if (d > 1.0 || (player.pos.x - s.x) * s.out < 0) return false;
    camera.getWorldDirection(fwd);
    return fwd.dot(v.divideScalar(d)) > 0.9;
  });
  const pull = () => {
    on = true; t = DURATION; progress = 0; holding = false;
    for (const { lever } of lights) lever.position.y = 1.24;
    startSiren();
  };
  const stop = () => {
    on = false; stopSiren();
    for (const { l, lever } of lights) { l.intensity = 0; lever.position.y = 1.3; }
  };
  addEventListener('keydown', (e) => { if (e.code === 'KeyE' && !e.repeat && !typing(e)) holding = true; });
  addEventListener('keyup', (e) => { if (e.code === 'KeyE') holding = false; });
  addEventListener('blur', () => { holding = false; });
  const typing = (e) => /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName);

  function update(dt) {
    const show = !player.state.paused && facing();
    el.classList.toggle('show', show || on);
    el.classList.toggle('on', on);
    if (on) {
      t -= dt;
      if (t <= 0) { stop(); el.classList.remove('show'); return; }
      ring.setAttribute('stroke-dashoffset', String(C * (1 - t / DURATION)));
      const flash = Math.floor(t * 4) % 2 ? 14 : 2;
      for (const { l } of lights) l.intensity = flash;
      return;
    }
    if (show && holding) { progress += dt / HOLD; if (progress >= 1) pull(); }
    else progress = Math.max(0, progress - dt * 2.5);
    ring.setAttribute('stroke-dashoffset', String(C * (1 - Math.min(progress, 1))));
  }
  return { update, prompt: () => '' };
}
