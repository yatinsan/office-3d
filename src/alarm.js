import * as THREE from 'three';
import { LIFTS, X0 } from './world/hall.js';
import { lvl } from './colliders.js';

/**
 * Fire alarm pull stations (the red box beside lift 5 and the one by the fire exit, built in world/hall.js):
 * get very close and look at it: a small red E appears; hold E to pull (ring fills). A siren sounds and the hall strobes red for 15 s.
 * (suggestion 62)
 */
const DURATION = 15;
/** read by the minimap: while `on`, it flashes red/white and marks the pulled station */
export const alarmState = { on: false, t: 0, pts: [] };
/**
 * The alarm sound is the first full beat of the supplied clip (public/sounds/alarm.mp3), repeated while the alarm runs.
 * It is positional: loudest next to a pull station, a little quieter the further you are, and panned left / right
 * by where the nearest station is compared with where you look (update() calls setSpatial every frame).
 */
let actx = null, buf = null, loading = false, gainN = null, panN = null, sirenTimer = 0;
function startSiren() {
  stopSiren();
  try {
    actx ||= new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    gainN = actx.createGain(); gainN.gain.value = 0.5;
    panN = actx.createStereoPanner ? actx.createStereoPanner() : null;
    if (panN) gainN.connect(panN).connect(actx.destination); else gainN.connect(actx.destination);
    const play = () => { if (!buf) return; const s = actx.createBufferSource(); s.buffer = buf; s.connect(gainN); s.start(); };
    if (!buf && !loading) {
      loading = true;
      fetch('sounds/alarm.mp3').then((r) => r.arrayBuffer()).then((d) => actx.decodeAudioData(d)).then((b) => { buf = b; if (sirenTimer) play(); }).catch(() => {});
    }
    play();
    sirenTimer = setInterval(play, 2000);
  } catch { /* no audio */ }
}
function stopSiren() { clearInterval(sirenTimer); sirenTimer = 0; try { gainN?.disconnect(); panN?.disconnect(); } catch { /* ignore */ } gainN = panN = null; }
function setSpatial(gain, pan) {
  if (!gainN) return;
  const t = actx.currentTime;
  gainN.gain.setTargetAtTime(gain, t, 0.08);
  panN?.pan.setTargetAtTime(pan, t, 0.08);
}

export function initAlarm({ scene, player, camera, onPull = () => {} }) {
  const stations = LIFTS.filter((l) => l.n === 5).map((l) => {
    const k = -l.out;
    return { x: l.x + l.out * 0.05, y: 1.3, z: l.z - k * 0.97, out: l.out };
  });
  stations.push({ x: X0 + 0.02, y: 1.4, z: 0.55, out: 1 }); // by the fire exit on the office wall (suggestion 63)
  if (!stations.length) return { update() {}, prompt: () => '', trigger() {} };

  alarmState.pts = stations.map((s) => ({ x: s.x, z: s.z }));
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

  // hint panel above each pull station, same style as the fingerprint-door panel (src/unlock.js): dark tile with icon + title / sub text + a progress line
  const W = 896, H = 192, lc = document.createElement('canvas'); lc.width = W; lc.height = H;
  const lg = lc.getContext('2d'), labelTex = new THREE.CanvasTexture(lc); labelTex.colorSpace = THREE.SRGBColorSpace;
  let labelKey = '';
  const drawLabel = (sub, frac) => {
    const key = `${sub}|${Math.round(frac * 40)}`; if (key === labelKey) return; labelKey = key;
    lg.clearRect(0, 0, W, H);
    lg.fillStyle = 'rgba(28,28,30,.96)'; lg.fillRect(190, 0, W - 190, H - 6);
    lg.fillStyle = '#ff3b30'; lg.fillRect(190, H - 6, W - 190, 6);
    if (frac > 0) { lg.fillStyle = '#ecc828'; lg.fillRect(190, H - 6, (W - 190) * Math.min(1, frac), 6); }
    lg.fillStyle = 'rgba(28,28,30,.98)'; lg.fillRect(4, 4, 184, 184);
    lg.shadowColor = '#ff3b30'; lg.shadowBlur = 14; lg.strokeStyle = '#ff3b30'; lg.lineWidth = 7; lg.strokeRect(5, 5, 182, 182); lg.shadowBlur = 0;
    lg.fillStyle = '#ff6a5c';   // bell
    lg.beginPath(); lg.moveTo(52, 128); lg.quadraticCurveTo(62, 118, 62, 90); lg.arc(96, 90, 34, Math.PI, 0); lg.quadraticCurveTo(130, 118, 140, 128); lg.closePath(); lg.fill();
    lg.beginPath(); lg.arc(96, 140, 11, 0, Math.PI * 2); lg.fill(); lg.fillRect(91, 46, 10, 14);
    lg.fillStyle = '#ff3b30'; lg.fillRect(222, 46, 4, 100);
    lg.fillStyle = '#fff'; lg.font = '700 64px system-ui, sans-serif'; lg.textBaseline = 'alphabetic'; lg.fillText('Emergency', 256, 98);
    lg.fillStyle = 'rgba(255,255,255,.8)'; lg.font = '400 40px system-ui, sans-serif'; lg.fillText(sub, 256, 152);
    labelTex.needsUpdate = true;
  };
  const labels = stations.map((s) => {
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex, transparent: true, depthTest: false, depthWrite: false }));
    m.scale.set(0.62, 0.62 * H / W, 1); m.position.set(s.x + s.out * 0.15, s.y + 0.38, s.z); m.renderOrder = 20; m.visible = false; scene.add(m);
    return m;
  });

  // a flashing red light over each station + a red lever that drops when pulled
  const lights = stations.map((s) => {
    const l = new THREE.PointLight('#ff2a1a', 0, 9, 1.4);
    l.position.set(s.x + s.out * 0.6, 2.6, s.z); scene.add(l);
    const lever = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.04, 0.06), new THREE.MeshStandardMaterial({ color: '#c81e14', roughness: 0.4 }));
    lever.position.set(s.x + s.out * 0.06, s.y, s.z); scene.add(lever);
    return { l, lever };
  });

  // red light that travels with you, so every room goes red (not only the hall), plus a pulsing red edge glow on screen
  const wash = new THREE.PointLight('#ff2a1a', 0, 14, 1.2); scene.add(wash);
  const glow = document.createElement('div');
  glow.style.cssText = 'position:fixed;inset:0;z-index:4;pointer-events:none;opacity:0;background:radial-gradient(ellipse at center,rgba(255,20,10,0) 45%,rgba(255,20,10,.55) 100%)';
  document.body.appendChild(glow);

  // extra red light effect only (no models): along the hall ceiling, so the whole corridor throbs
  const extra = [[13.2, 5], [13.2, 14], [13.2, 23], [13.2, 32]].map(([x, z]) => {
    const l = new THREE.PointLight('#ff2a1a', 0, 10, 1.4); l.position.set(x, 2.9, z); scene.add(l); return l;
  });

  // big GTA-style "EMERGENCY" text with who pulled it
  const bs = document.createElement('style');
  bs.textContent = `#alarmbanner{position:fixed;left:0;right:0;top:16%;z-index:9;text-align:center;pointer-events:none;opacity:0;transform:scale(1.5);transition:opacity .25s,transform .35s cubic-bezier(.2,1.6,.4,1)}
    #alarmbanner.show{opacity:1;transform:scale(1)}
    #alarmbanner .big{font:italic 900 clamp(48px,10vw,128px)/1 Impact,'Arial Black',system-ui,sans-serif;letter-spacing:4px;text-transform:uppercase;color:#e5281c;-webkit-text-stroke:3px #000;text-shadow:4px 4px 0 #000,0 0 28px rgba(229,40,28,.7)}
    #alarmbanner .sub{margin-top:10px;font:800 clamp(16px,2.6vw,26px)/1.2 system-ui,sans-serif;color:#fff;text-transform:uppercase;letter-spacing:2px;text-shadow:2px 2px 0 #000}`;
  document.head.appendChild(bs);
  const banner = document.createElement('div'); banner.id = 'alarmbanner';
  banner.innerHTML = '<div class="big">Emergency</div><div class="sub"></div>';
  document.body.appendChild(banner);
  const bsub = banner.querySelector('.sub');

  let bannerT = 0, t = 0, on = false, holding = false, progress = 0;
  const v = new THREE.Vector3(), fwd = new THREE.Vector3();
  /** very close AND looking at the pull station (so it never shows at the lift's own button/doors) */
  const facing = () => stations.some((s) => {
    v.set(s.x - camera.position.x, s.y - camera.position.y, s.z - camera.position.z);
    const d = v.length(); if (d > 1.0 || (player.pos.x - s.x) * s.out < 0) return false;
    camera.getWorldDirection(fwd);
    return fwd.dot(v.divideScalar(d)) > 0.9;
  });
  const pull = (who) => {
    if (on) { t = DURATION; return; }
    bsub.textContent = `${who || 'You'} pulled the fire alarm`; banner.classList.add('show'); bannerT = 4.5;
    on = true; alarmState.on = true; t = DURATION; progress = 0; holding = false;
    if (!who) onPull();
    for (const { lever } of lights) lever.position.y = 1.24;
    startSiren();
  };
  const stop = () => {
    on = false; alarmState.on = false; stopSiren();
    for (const { l, lever } of lights) { l.intensity = 0; lever.position.y = 1.3; }
    extra.forEach((l) => { l.intensity = 0; });
    banner.classList.remove('show');
    wash.intensity = 0; glow.style.opacity = '0';
  };
  addEventListener('keydown', (e) => { if (e.code === 'KeyE' && !e.repeat && !typing(e)) holding = true; });
  addEventListener('keyup', (e) => { if (e.code === 'KeyE') holding = false; });
  addEventListener('blur', () => { holding = false; });
  const typing = (e) => /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName);

  function update(dt) {
    const show = !player.state.paused && facing();
    el.classList.toggle('show', show || on);
    el.classList.toggle('on', on);
    labels.forEach((m, i) => { const st = stations[i]; m.visible = !on && !player.state.paused && Math.hypot(player.pos.x - st.x, player.pos.z - st.z) < 6 && (player.pos.x - st.x) * st.out > 0; });
    if (labels.some((m) => m.visible)) drawLabel(progress > 0 ? 'Keep holding E' : 'Hold E to pull the alarm', progress);
    if (on) {
      t -= dt; alarmState.t = t;
      if (bannerT > 0 && (bannerT -= dt) <= 0) banner.classList.remove('show');
      if (t <= 0) { stop(); el.classList.remove('show'); return; }
      ring.setAttribute('stroke-dashoffset', String(C * (1 - t / DURATION)));
      const p = 0.5 + 0.5 * Math.sin(performance.now() / 1000 * Math.PI * 2 * 1.1), fade = Math.min(1, t / 1.5);   // slow pulse, fades out at the end
      for (const { l } of lights) l.intensity = (2 + 12 * p) * fade;
      extra.forEach((l, i) => { l.intensity = (1 + 9 * (0.5 + 0.5 * Math.sin(performance.now() / 1000 * Math.PI * 2 * 1.1 + i * 0.9))) * fade; });
      // positional sound: nearest station sets the volume (full beside it, ~15 % far away) and the left / right pan
      let best = null, bd = 1e9;
      for (const s of stations) { const d = Math.hypot(player.pos.x - s.x, player.pos.z - s.z); if (d < bd) { bd = d; best = s; } }
      camera.getWorldDirection(fwd);
      const rx = -fwd.z, rz = fwd.x, rl = Math.hypot(rx, rz) || 1;   // my right-hand direction on the floor
      const side = best && bd > 0.01 ? ((best.x - player.pos.x) * rx + (best.z - player.pos.z) * rz) / (rl * bd) : 0;
      setSpatial(lvl.cur ? 0.12 : 0.15 + 0.85 * Math.max(0, 1 - bd / 30) ** 1.5, lvl.cur ? 0 : side * Math.min(1, bd / 4) * 0.9);
      wash.position.copy(camera.position); wash.intensity = (3 + 14 * p) * fade;
      glow.style.opacity = String((0.25 + 0.75 * p) * fade);
      return;
    }
    if (show && holding) { progress += dt / HOLD; if (progress >= 1) pull(); }
    else progress = Math.max(0, progress - dt * 2.5);
    ring.setAttribute('stroke-dashoffset', String(C * (1 - Math.min(progress, 1))));
  }
  return { update, prompt: () => '', trigger: (name) => pull(name || 'Someone') };
}
