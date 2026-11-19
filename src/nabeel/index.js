import * as THREE from 'three';
import { createCharacter } from './character.js';
import { pieces, pieceAt, labelAt } from '../merge.js';
import { colliders } from '../colliders.js';

/**
 * Nabeel mode: a third-person, over-the-shoulder action mode.
 * 1 = fists, 2 = stick, 3 = gun (or mouse wheel). Click / hold to attack.
 * Hit a chair, desk, monitor, plant, light… enough times and it breaks into pieces that fly apart.
 * Walls, pillars, floor and ceiling only take bullet holes.
 */

const WEAPONS = [
  { id: 'hand', name: 'Fists', icon: '✊', range: 1.5, damage: 1, rate: 0.38 },
  { id: 'stick', name: 'Stick', icon: '🏏', range: 2.3, damage: 2.5, rate: 0.6 },
  { id: 'gun', name: 'Gun', icon: '🔫', range: 60, damage: 1.5, rate: 0.14 },
];
const UNBREAKABLE = new Set(['Wall', 'Pillar', 'Window column']);
const CAM_DIST = 2.7, CAM_SIDE = 0.55, CAM_UP = 0.25;
const MAX_DEBRIS = 450;

export function initNabeel({ scene, camera, player, world, hud }) {
  const ch = createCharacter();
  ch.root.visible = false;
  scene.add(ch.root);

  let on = false;
  let weapon = 0;
  let cooldown = 0, attackT = 0, attackDur = 0, punchSide = 0, recoil = 0;
  let firing = false;
  let yaw = 0, walkPhase = 0, destroyed = 0;
  const last = new THREE.Vector3();
  const health = new Map(); // pieceId → hp left

  // ---------- HUD ----------
  const ui = document.createElement('div');
  ui.id = 'nabeel-ui';
  ui.innerHTML = `
    <div class="nb-tag">NABEEL MODE</div>
    <div class="nb-score">Destroyed <b>0</b></div>
    <div class="nb-target"></div>
    <div class="nb-weapons">${WEAPONS.map((w, i) => `<div class="nb-slot" data-i="${i}"><span>${w.icon}</span><small>${i + 1} ${w.name}</small></div>`).join('')}</div>
    <div class="nb-feed"></div>`;
  document.body.appendChild(ui);
  const scoreEl = ui.querySelector('.nb-score b');
  const targetEl = ui.querySelector('.nb-target');
  const feedEl = ui.querySelector('.nb-feed');
  const slots = [...ui.querySelectorAll('.nb-slot')];
  let targetTimer = 0;

  function feed(text) {
    const d = document.createElement('div');
    d.textContent = text;
    feedEl.prepend(d);
    setTimeout(() => d.classList.add('out'), 1800);
    setTimeout(() => d.remove(), 2400);
    while (feedEl.children.length > 4) feedEl.lastChild.remove();
  }

  function selectWeapon(i) {
    weapon = (i + WEAPONS.length) % WEAPONS.length;
    slots.forEach((s, j) => s.classList.toggle('on', j === weapon));
    ch.gun.visible = WEAPONS[weapon].id === 'gun';
    ch.stick.visible = WEAPONS[weapon].id === 'stick';
    attackT = 0;
  }
  selectWeapon(0);

  function setOn(v) {
    on = v;
    ch.root.visible = v;
    ui.classList.toggle('show', v);
    document.body.classList.toggle('nabeel', v);
    if (v) { yaw = cameraYaw() + Math.PI; last.copy(player.pos); }
  }

  // ---------- sound (synthesised, no assets) ----------
  let ac = null;
  const audio = () => (ac ||= new (window.AudioContext || window.webkitAudioContext)());
  function noise(dur, { freq = 1200, q = 0.7, gain = 0.5, type = 'lowpass', decay = 0.15 } = {}) {
    const a = audio(), n = Math.floor(a.sampleRate * dur);
    const buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (a.sampleRate * decay));
    const src = a.createBufferSource(); src.buffer = buf;
    const f = a.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = a.createGain(); g.gain.value = gain;
    src.connect(f).connect(g).connect(a.destination);
    src.start();
  }
  function thump(freq = 120, gain = 0.6, dur = 0.15) {
    const a = audio(), o = a.createOscillator(), g = a.createGain();
    o.frequency.setValueAtTime(freq, a.currentTime);
    o.frequency.exponentialRampToValueAtTime(freq * 0.4, a.currentTime + dur);
    g.gain.setValueAtTime(gain, a.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + dur);
    o.connect(g).connect(a.destination); o.start(); o.stop(a.currentTime + dur);
  }
  const sfx = {
    gun() { noise(0.35, { freq: 2600, gain: 0.55, decay: 0.05 }); thump(90, 0.5, 0.12); },
    swing() { noise(0.25, { freq: 700, type: 'bandpass', q: 1.5, gain: 0.25, decay: 0.12 }); },
    hit() { thump(140, 0.7, 0.12); noise(0.12, { freq: 900, gain: 0.3, decay: 0.03 }); },
    smash() { noise(0.9, { freq: 3000, gain: 0.5, decay: 0.25 }); thump(70, 0.8, 0.35); },
  };

  // ---------- aiming ----------
  const ray = new THREE.Raycaster();
  const debrisGroup = new THREE.Group();
  scene.add(debrisGroup);
  const decals = new THREE.Group();
  scene.add(decals);
  const center = new THREE.Vector2(0, 0);
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), head = new THREE.Vector3();
  const fwd = new THREE.Vector3(), right = new THREE.Vector3();

  function cameraYaw() { camera.getWorldDirection(fwd); return Math.atan2(-fwd.x, -fwd.z); }

  function aim(maxDist) {
    ray.setFromCamera(center, camera);
    // start the ray level with the character so things between camera and Nabeel don't count
    head.set(player.pos.x, 1.4 + player.feetY, player.pos.z);
    const skip = Math.max(0, tmp.subVectors(head, ray.ray.origin).dot(ray.ray.direction));
    ray.ray.origin.addScaledVector(ray.ray.direction, skip);
    ray.far = maxDist;
    ray.near = 0;
    const hits = ray.intersectObjects([...world.children, ...debrisGroup.children], false);
    return hits.find((h) => h.object.material?.visible !== false) || null;
  }

  // ---------- attacks ----------
  function attack() {
    const w = WEAPONS[weapon];
    cooldown = w.rate;
    yaw = cameraYaw() + Math.PI; // snap to face where you aim
    if (w.id === 'gun') {
      attackT = attackDur = 0.12;
      recoil = 1;
      sfx.gun();
      const hit = aim(w.range);
      ch.root.updateMatrixWorld(true);
      const from = ch.gun.userData.muzzle.getWorldPosition(new THREE.Vector3());
      const to = hit ? hit.point.clone() : ray.ray.at(w.range, new THREE.Vector3());
      muzzleFlash(from);
      tracer(from, to);
      if (hit) impact(hit, w, ray.ray.direction);
    } else {
      attackT = attackDur = w.id === 'stick' ? 0.45 : 0.3;
      punchSide ^= 1;
      sfx.swing();
      // land the blow a moment into the swing
      setTimeout(() => {
        if (!on) return;
        const hit = aim(w.range + 3);
        if (!hit) return;
        const reach = Math.hypot(hit.point.x - player.pos.x, hit.point.z - player.pos.z);
        if (reach > w.range || hit.point.y > 2.3 + player.feetY) return;
        sfx.hit();
        impact(hit, w, ray.ray.direction);
      }, w.id === 'stick' ? 180 : 110);
    }
  }

  function impact(hit, w, dir) {
    if (hit.object.userData.debris) { // shove loose debris around
      const d = hit.object.userData.debris;
      d.vel.addScaledVector(dir, 4 * w.damage).y += 2;
      d.spin.set(Math.random() * 10 - 5, Math.random() * 10 - 5, Math.random() * 10 - 5);
      d.sleep = false;
      return;
    }
    const pid = pieceAt(hit);
    const label = pid >= 0 ? pieces[pid].label : labelAt(hit);
    const colour = hit.object.material?.color || new THREE.Color('#888');
    sparks(hit.point, hit.face?.normal ? tmp2.copy(hit.face.normal) : tmp2.set(0, 1, 0), colour, w.id === 'gun' ? 6 : 4);
    if (pid < 0 || UNBREAKABLE.has(pieces[pid].label) || pieces[pid].gone) {
      if (w.id === 'gun') bulletHole(hit);
      if (label) showTarget(label, null);
      return;
    }
    const p = pieces[pid];
    if (!health.has(pid)) health.set(pid, maxHp(p));
    const hp = health.get(pid) - w.damage;
    health.set(pid, hp);
    if (w.id === 'gun') bulletHole(hit);
    if (hp <= 0) { shatter(pid, dir, w); showTarget(p.label, 0); }
    else showTarget(p.label, hp / p.maxHp);
  }

  function showTarget(label, frac) {
    targetEl.innerHTML = frac == null ? `${label}` : `${label} <i><s style="width:${Math.max(0, frac) * 100}%"></s></i>`;
    targetEl.classList.add('show');
    targetTimer = 1.5;
  }

  // ---------- breaking things ----------
  function pieceBox(p) {
    const b = new THREE.Box3();
    for (const part of p.parts) {
      const a = part.mesh.geometry.attributes.position.array;
      for (let i = part.start * 9; i < part.end * 9; i += 3) b.expandByPoint(tmp.set(a[i], a[i + 1], a[i + 2]));
    }
    return b;
  }
  function maxHp(p) {
    p.box ||= pieceBox(p);
    const s = p.box.getSize(tmp);
    p.maxHp = THREE.MathUtils.clamp(Math.round(s.x * s.y * s.z * 10 + 2), 2, 10);
    return p.maxHp;
  }

  function shatter(pid, dir, w, chained = false) {
    const p = pieces[pid];
    p.gone = true;
    p.box ||= pieceBox(p);
    const size = p.box.getSize(new THREE.Vector3());
    const mid = p.box.getCenter(new THREE.Vector3());
    // Cell size so a piece breaks into ~10-30 chunks of its own geometry.
    const cell = Math.max(0.12, Math.max(size.x, size.y, size.z) / 3.2);
    let biggest = null, biggestTris = 0;
    for (const part of p.parts) {
      const geo = part.mesh.geometry;
      const pos = geo.attributes.position, nor = geo.attributes.normal, uv = geo.attributes.uv;
      // Big triangles (table tops, panels) get subdivided first so they break into shards, not two huge halves.
      const cells = new Map();
      const add = (P, N, U, depth) => {
        const e = Math.max(
          Math.hypot(P[0] - P[3], P[1] - P[4], P[2] - P[5]),
          Math.hypot(P[3] - P[6], P[4] - P[7], P[5] - P[8]),
          Math.hypot(P[6] - P[0], P[7] - P[1], P[8] - P[2]));
        if (e > cell * 0.9 && depth < 4) {
          const mid = (A, n, i, j) => Array.from({ length: n }, (_, k) => (A[i * n + k] + A[j * n + k]) / 2);
          const v = (A, n, i) => Array.from({ length: n }, (_, k) => A[i * n + k]);
          const pts = [0, 1, 2].map((i) => [v(P, 3, i), v(N, 3, i), v(U, 2, i)]);
          const m = [[0, 1], [1, 2], [2, 0]].map(([i, j]) => [mid(P, 3, i, j), mid(N, 3, i, j), mid(U, 2, i, j)]);
          for (const tri of [[pts[0], m[0], m[2]], [m[0], pts[1], m[1]], [m[2], m[1], pts[2]], [m[0], m[1], m[2]]]) {
            add(tri.flatMap((q) => q[0]), tri.flatMap((q) => q[1]), tri.flatMap((q) => q[2]), depth + 1);
          }
          return;
        }
        const cx = (P[0] + P[3] + P[6]) / 3, cy = (P[1] + P[4] + P[7]) / 3, cz = (P[2] + P[5] + P[8]) / 3;
        const key = `${Math.floor(cx / cell)},${Math.floor(cy / cell)},${Math.floor(cz / cell)}`;
        if (!cells.has(key)) cells.set(key, []);
        cells.get(key).push([P, N, U]);
      };
      for (let t = part.start; t < part.end; t++) {
        add(Array.from(pos.array.subarray(t * 9, t * 9 + 9)), Array.from(nor.array.subarray(t * 9, t * 9 + 9)), Array.from(uv.array.subarray(t * 6, t * 6 + 6)), 0);
      }
      for (const tris of cells.values()) {
        const n = tris.length * 3;
        const P = new Float32Array(n * 3), N = new Float32Array(n * 3), U = new Float32Array(n * 2);
        const c = new THREE.Vector3();
        tris.forEach(([tp, tn, tu], k) => { P.set(tp, k * 9); N.set(tn, k * 9); U.set(tu, k * 6); });
        for (let i = 0; i < n; i++) c.x += P[i * 3], c.y += P[i * 3 + 1], c.z += P[i * 3 + 2];
        c.divideScalar(n);
        for (let i = 0; i < n; i++) P[i * 3] -= c.x, P[i * 3 + 1] -= c.y, P[i * 3 + 2] -= c.z;
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(P, 3));
        g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
        g.setAttribute('uv', new THREE.BufferAttribute(U, 2));
        g.computeBoundingSphere();
        if (g.boundingSphere.radius < 0.002) continue;
        spawnDebris(g, part.mesh.material, c, mid, dir, w);
      }
      if (part.end - part.start > biggestTris) { biggestTris = part.end - part.start; biggest = part.mesh.material; }
      // collapse the original triangles in the merged mesh
      pos.array.fill(0, part.start * 9, part.end * 9);
      pos.addUpdateRange(part.start * 9, (part.end - part.start) * 9);
      pos.needsUpdate = true;
    }
    // extra splinters so big flat parts (table tops) still look smashed
    const splinter = new THREE.BoxGeometry(1, 1, 1);
    const shards = THREE.MathUtils.clamp(Math.round((size.x + size.y + size.z) * 5), 5, 18);
    for (let i = 0; i < shards; i++) {
      const s = 0.03 + Math.random() * Math.min(0.12, Math.max(size.x, size.z) / 6);
      const g = splinter.clone(); g.scale(s, s * (0.4 + Math.random()), s * (0.5 + Math.random()));
      const at = new THREE.Vector3(
        THREE.MathUtils.lerp(p.box.min.x, p.box.max.x, Math.random()),
        THREE.MathUtils.lerp(p.box.min.y, p.box.max.y, Math.random()),
        THREE.MathUtils.lerp(p.box.min.z, p.box.max.z, Math.random()));
      spawnDebris(g, biggest, at, mid, dir, w);
    }
    // whatever it was, you can walk through it now
    const pad = 0.2;
    for (let i = colliders.length - 1; i >= 0; i--) {
      const c = colliders[i];
      if (c.minX >= p.box.min.x - pad && c.maxX <= p.box.max.x + pad && c.minZ >= p.box.min.z - pad && c.maxZ <= p.box.max.z + pad) colliders.splice(i, 1);
    }
    if (!chained) sfx.smash();
    destroyed++;
    scoreEl.textContent = destroyed;
    if (!chained) feed(`${p.label.toUpperCase()} DESTROYED`);
    // whatever was standing on it (monitors on a desk, a plant on a shelf) comes down with it
    pieces.forEach((q, qid) => {
      if (q.gone || UNBREAKABLE.has(q.label) || !q.parts.length) return;
      q.box ||= pieceBox(q);
      const c = q.box.getCenter(tmp2);
      if (q.box.min.y > p.box.min.y + 0.2 && q.box.min.y < p.box.max.y + 0.15 &&
          c.x > p.box.min.x && c.x < p.box.max.x && c.z > p.box.min.z && c.z < p.box.max.z) shatter(qid, dir, w, true);
    });
  }

  const debris = [];
  function spawnDebris(geo, material, at, from, dir, w) {
    const m = new THREE.Mesh(geo, material);
    m.position.copy(at);
    m.castShadow = true;
    const out = tmp.subVectors(at, from).setY(0);
    if (out.lengthSq() < 1e-4) out.set(Math.random() - 0.5, 0, Math.random() - 0.5);
    out.normalize();
    const power = w.id === 'gun' ? 2.5 : w.id === 'stick' ? 3.5 : 2.2;
    const d = {
      mesh: m,
      vel: new THREE.Vector3().addScaledVector(out, 1 + Math.random() * power).addScaledVector(dir, power * (0.5 + Math.random())).setY(1.5 + Math.random() * 3),
      spin: new THREE.Vector3(Math.random() * 12 - 6, Math.random() * 12 - 6, Math.random() * 12 - 6),
      rest: (geo.boundingSphere?.radius || 0.05) * 0.35,
      sleep: false,
    };
    m.userData.debris = d;
    debrisGroup.add(m);
    debris.push(d);
    while (debris.length > MAX_DEBRIS) { const old = debris.shift(); debrisGroup.remove(old.mesh); old.mesh.geometry.dispose(); }
  }

  function updateDebris(dt) {
    for (const d of debris) {
      if (d.sleep) continue;
      const m = d.mesh;
      d.vel.y -= 14 * dt;
      m.position.addScaledVector(d.vel, dt);
      m.rotation.x += d.spin.x * dt; m.rotation.y += d.spin.y * dt; m.rotation.z += d.spin.z * dt;
      if (m.position.y < d.rest) {
        m.position.y = d.rest;
        d.vel.y = -d.vel.y * 0.3;
        d.vel.x *= 0.6; d.vel.z *= 0.6;
        d.spin.multiplyScalar(0.5);
        if (Math.abs(d.vel.y) < 0.4 && d.vel.lengthSq() < 0.1) d.sleep = true;
      }
    }
  }

  // ---------- effects ----------
  const fx = [];
  const sparkGeo = new THREE.BoxGeometry(0.025, 0.025, 0.025);
  function sparks(at, normal, colour, n) {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(sparkGeo, new THREE.MeshBasicMaterial({ color: i % 2 ? colour : '#ffd27a' }));
      m.position.copy(at);
      scene.add(m);
      fx.push({ m, life: 0.4 + Math.random() * 0.3, vel: normal.clone().multiplyScalar(2).add(new THREE.Vector3(Math.random() - 0.5, Math.random(), Math.random() - 0.5).multiplyScalar(3)), grav: true });
    }
  }
  const flashLight = new THREE.PointLight('#ffb347', 0, 4, 2);
  scene.add(flashLight);
  const flashMat = new THREE.SpriteMaterial({ color: '#ffd27a', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  function muzzleFlash(at) {
    const s = new THREE.Sprite(flashMat.clone());
    s.position.copy(at); s.scale.setScalar(0.22);
    scene.add(s);
    fx.push({ m: s, life: 0.06, fade: true });
    flashLight.position.copy(at); flashLight.intensity = 6;
  }
  function tracer(a, b) {
    const g = new THREE.BufferGeometry().setFromPoints([a, b]);
    const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: '#ffe9a8', transparent: true, opacity: 0.9 }));
    scene.add(l);
    fx.push({ m: l, life: 0.08, fade: true });
  }
  const holeGeo = new THREE.CircleGeometry(0.025, 10);
  const holeMat = new THREE.MeshBasicMaterial({ color: '#111', polygonOffset: true, polygonOffsetFactor: -4, depthWrite: false });
  function bulletHole(hit) {
    if (!hit.face) return;
    const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
    const m = new THREE.Mesh(holeGeo, holeMat);
    m.position.copy(hit.point).addScaledVector(n, 0.004);
    m.lookAt(tmp.copy(m.position).add(n));
    decals.add(m);
    if (decals.children.length > 250) decals.remove(decals.children[0]);
  }
  function updateFx(dt) {
    flashLight.intensity *= Math.exp(-40 * dt);
    for (let i = fx.length - 1; i >= 0; i--) {
      const f = fx[i];
      f.life -= dt;
      if (f.vel) { if (f.grav) f.vel.y -= 9 * dt; f.m.position.addScaledVector(f.vel, dt); }
      if (f.fade && f.m.material) f.m.material.opacity = Math.max(0, f.life / 0.08);
      if (f.life <= 0) {
        scene.remove(f.m);
        if (f.m.isLine) f.m.geometry.dispose(); // sparks + sprites share their geometry
        f.m.material.dispose();
        fx.splice(i, 1);
      }
    }
  }

  // ---------- input ----------
  const active = () => on && !player.state.paused && (player.controls.isLocked || player.state.dragMode);
  let downX = 0, downY = 0;
  addEventListener('mousedown', (e) => {
    if (!active() || e.button !== 0) return;
    if (player.state.dragMode) { downX = e.clientX; downY = e.clientY; return; } // in drag-look, a click (not a drag) attacks
    firing = true;
  });
  addEventListener('mouseup', (e) => {
    firing = false;
    if (active() && player.state.dragMode && Math.hypot(e.clientX - downX, e.clientY - downY) < 5 && e.button === 0 && cooldown <= 0) attack();
  });
  addEventListener('keydown', (e) => {
    if (!on || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (e.code === 'Digit1') selectWeapon(0);
    if (e.code === 'Digit2') selectWeapon(1);
    if (e.code === 'Digit3') selectWeapon(2);
  });
  addEventListener('wheel', (e) => { if (active()) selectWeapon(weapon + (e.deltaY > 0 ? 1 : -1)); }, { passive: true });

  // ---------- per frame ----------
  function angleLerp(a, b, k) {
    let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
    return a + d * k;
  }

  function animate(dt) {
    const w = WEAPONS[weapon];
    const dx = player.pos.x - last.x, dz = player.pos.z - last.z;
    last.copy(player.pos);
    const speed = Math.hypot(dx, dz) / Math.max(dt, 1e-4);
    const air = player.feetY > 0.02;

    // facing: move direction like a third-person game, but aim direction while holding a gun or attacking
    const aiming = w.id === 'gun' || attackT > 0;
    if (aiming) yaw = angleLerp(yaw, cameraYaw() + Math.PI, 1 - Math.exp(-25 * dt));
    else if (speed > 0.3) yaw = angleLerp(yaw, Math.atan2(dx, dz), 1 - Math.exp(-12 * dt));
    ch.root.position.set(player.pos.x, player.feetY, player.pos.z);
    ch.root.rotation.y = yaw;

    // walk / run cycle
    walkPhase += dt * Math.min(speed, 7) * 2.1;
    const amt = air ? 0 : Math.min(1, speed / 3) * (speed > 4.5 ? 1.3 : 1);
    const s = Math.sin(walkPhase);
    ch.legL.hip.rotation.x = s * 0.6 * amt + (air ? -0.5 : 0);
    ch.legR.hip.rotation.x = -s * 0.6 * amt + (air ? 0.3 : 0);
    ch.legL.knee.rotation.x = Math.max(0, -Math.cos(walkPhase)) * 0.9 * amt + (air ? 0.8 : 0);
    ch.legR.knee.rotation.x = Math.max(0, Math.cos(walkPhase)) * 0.9 * amt + (air ? 0.4 : 0);
    ch.body.position.y = Math.abs(Math.cos(walkPhase)) * 0.04 * amt;
    ch.torso.rotation.x = 0.08 * amt;
    ch.torso.rotation.y = s * 0.12 * amt;

    // arms: idle swing by default
    const armSwing = s * 0.5 * amt;
    const L = ch.armL, R = ch.armR;
    L.shoulder.rotation.set(-armSwing, 0, 0.12);
    R.shoulder.rotation.set(armSwing, 0, -0.12);
    L.elbow.rotation.set(-0.25 - amt * 0.3, 0, 0);
    R.elbow.rotation.set(-0.25 - amt * 0.3, 0, 0);
    ch.stick.rotation.set(Math.PI / 2, 0, 0);

    camera.getWorldDirection(fwd);
    const pitch = Math.asin(THREE.MathUtils.clamp(fwd.y, -1, 1));
    const t = attackDur ? 1 - attackT / attackDur : 0; // 0 → 1 through the attack
    if (w.id === 'gun') {
      // two-hand aim along the camera pitch, with recoil kick
      const up = -Math.PI / 2 - pitch - recoil * 0.25;
      R.shoulder.rotation.set(up, 0.15, 0);
      R.elbow.rotation.set(-recoil * 0.2, 0, 0);
      L.shoulder.rotation.set(up + 0.1, -0.55, 0);
      L.elbow.rotation.set(-0.35, 0, 0);
      ch.torso.rotation.y = 0;
      ch.neck.rotation.x = -pitch * 0.5;
    } else if (w.id === 'stick') {
      if (attackT > 0) {
        // wind up over the right shoulder, then a big horizontal swing across
        const k = t < 0.3 ? t / 0.3 : 1;
        const sweep = t < 0.3 ? 0 : Math.min(1, (t - 0.3) / 0.35);
        R.shoulder.rotation.set(-1.4 * k - pitch * 0.5, 1.2 - sweep * 2.6, -0.3);
        R.elbow.rotation.set(-0.6 + sweep * 0.5, 0, 0);
        L.shoulder.rotation.set(-1.2 * k, -0.6 + sweep * 0.6, 0);
        L.elbow.rotation.set(-1.0, 0, 0);
        ch.torso.rotation.y = 0.5 - sweep * 1.1;
        ch.stick.rotation.set(Math.PI / 2 - 0.2, 0, 0);
      } else {
        // resting on the shoulder, GTA style
        R.shoulder.rotation.set(-0.5 + armSwing * 0.3, 0, -0.15);
        R.elbow.rotation.set(-1.6, 0, 0);
        ch.stick.rotation.set(Math.PI / 2 + 1.3, 0, 0);
      }
    } else if (attackT > 0) {
      // jab with alternating fists
      const k = Math.sin(Math.min(1, t * 1.6) * Math.PI);
      const arm = punchSide ? L : R, other = punchSide ? R : L;
      arm.shoulder.rotation.set(-Math.PI / 2 * (0.4 + 0.6 * k) - pitch * 0.4, (punchSide ? -1 : 1) * 0.15, 0);
      arm.elbow.rotation.set(-1.6 * (1 - k), 0, 0);
      other.shoulder.rotation.set(-0.9, 0, 0);
      other.elbow.rotation.set(-1.9, 0, 0);
      ch.torso.rotation.y = (punchSide ? -1 : 1) * 0.35 * k;
    } else if (!amt) {
      // fists up, ready
      for (const a of [L, R]) { a.shoulder.rotation.x = -0.7; a.elbow.rotation.x = -1.9; }
      L.shoulder.rotation.z = 0.25; R.shoulder.rotation.z = -0.25;
    }
    if (w.id !== 'gun') ch.neck.rotation.x = -pitch * 0.3;
  }

  function placeCamera() {
    // over-the-shoulder: behind the character along the look direction, a little to the right
    camera.getWorldDirection(fwd);
    right.crossVectors(fwd, camera.up).normalize();
    head.set(player.pos.x, 1.55 + player.feetY, player.pos.z);
    const want = tmp.copy(head).addScaledVector(fwd, -CAM_DIST).addScaledVector(right, CAM_SIDE);
    want.y += CAM_UP;
    // pull in so the camera never ends up inside a wall / desk
    let ok = 1;
    for (let i = 1; i <= 24; i++) {
      const f = i / 24;
      const x = head.x + (want.x - head.x) * f, z = head.z + (want.z - head.z) * f, y = head.y + (want.y - head.y) * f;
      if (colliders.some((c) => y < (c.maxY ?? Infinity) + 0.15 && x > c.minX - 0.12 && x < c.maxX + 0.12 && z > c.minZ - 0.12 && z < c.maxZ + 0.12)) { ok = Math.max(0.12, (i - 1) / 24); break; }
    }
    camera.position.lerpVectors(head, want, ok);
    camera.position.y = THREE.MathUtils.clamp(camera.position.y, 0.35, 3.4);
  }

  function update(dt) {
    if (!on) return;
    dt = Math.min(dt, 0.05);
    cooldown -= dt;
    if (attackT > 0) attackT = Math.max(0, attackT - dt);
    recoil *= Math.exp(-14 * dt);
    if (firing && cooldown <= 0 && active()) attack();
    if (targetTimer > 0 && (targetTimer -= dt) <= 0) targetEl.classList.remove('show');
    animate(dt);
    placeCamera();
    updateDebris(dt);
    updateFx(dt);
  }

  return { update, setOn, isOn: () => on, character: ch };
}
