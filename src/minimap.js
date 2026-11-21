import { colliders } from './colliders.js';
import { GAME_X1, GAME_Z1, MEET_Z1 } from './world/helpers.js';

// GTA-style minimap: a square at the right edge, walls only, rotates so "up" is where you look.
const MW = 210, MH = 210; // css px: a circle
const RANGE = 13;      // metres from the centre to the top / bottom edge of the map
const GAME_C = { x: GAME_X1 / 2, z: (MEET_Z1 + GAME_Z1) / 2 }; // middle of the Game Room
let walls = null; // walls + big blocks, no small furniture (built on first draw: the world fills `colliders` after this module loads)
const getWalls = () => walls || (walls = colliders.filter((c) => Math.max(c.maxX - c.minX, c.maxZ - c.minZ) >= 1.2));

export function initMinimap({ camera, player, online }) {
  const wrap = document.createElement('div');
  wrap.id = 'minimap';
  wrap.style.cssText = `position:fixed;left:14px;bottom:46px;opacity:.72;width:${MW}px;height:${MH}px;box-sizing:border-box;z-index:5;pointer-events:none;display:none;` +
    'background:radial-gradient(circle closest-side,rgba(90,95,104,.85) 0%,rgba(90,95,104,.65) 55%,rgba(105,110,118,0) 100%);' + // light gray behind the walls, fading out to the scene at the end
    '-webkit-mask-image:radial-gradient(circle,#000 20%,rgba(0,0,0,.6) 50%,rgba(0,0,0,.2) 75%,transparent 100%);mask-image:radial-gradient(circle,#000 20%,rgba(0,0,0,.6) 50%,rgba(0,0,0,.2) 75%,transparent 100%);'; // no background disc, no edge: just the walls fading into the scene
  const cv = document.createElement('canvas');
  const dpr = Math.min(devicePixelRatio || 1, 2);
  cv.width = Math.round(MW * dpr); cv.height = Math.round(MH * dpr);
  cv.style.cssText = 'width:100%;height:100%;display:block;';
  wrap.appendChild(cv);
  document.body.appendChild(wrap);
  const ctx = cv.getContext('2d');
  const k = (MH * dpr) / (RANGE * 2); // pixels per metre
  let acc = 0;

  function draw() {
    const W = cv.width, H = cv.height, yaw = camera.rotation.y, px = player.pos.x, pz = player.pos.z;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.translate(W / 2, H / 2); ctx.rotate(yaw); ctx.scale(k, k); ctx.translate(-px, -pz);
    ctx.fillStyle = '#e4e8ee'; ctx.shadowColor = 'rgba(0,0,0,.7)'; ctx.shadowBlur = 5; // soft dark glow keeps the walls readable on any background
    const m = RANGE * 2;
    for (const c of getWalls()) {
      if (c.maxX < px - m || c.minX > px + m || c.maxZ < pz - m || c.minZ > pz + m) continue;
      ctx.fillRect(c.minX, c.minZ, c.maxX - c.minX, c.maxZ - c.minZ);
    }
    for (const d of online?.peerDots?.() || []) {
      ctx.fillStyle = d.color || '#7ee08f';
      ctx.beginPath(); ctx.arc(d.x, d.z, 0.45, 0, 7); ctx.fill();
    }
    // you: yellow arrow in the middle, always pointing up
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.translate(W / 2, H / 2); ctx.scale(dpr, dpr);
    ctx.fillStyle = '#ecc828'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(6, 7); ctx.lineTo(0, 3); ctx.lineTo(-6, 7); ctx.closePath(); ctx.fill(); ctx.stroke();
    // game room: a little game-pad badge at its real spot on the map (not pinned: it only shows while the room is inside the map)
    const s = MH / (RANGE * 2), c = Math.cos(yaw), sn = Math.sin(yaw), dx = GAME_C.x - px, dz = GAME_C.z - pz;
    let ix = (dx * c - dz * sn) * s, iy = (dx * sn + dz * c) * s;
    if (Math.hypot(ix, iy) > MH / 2 - 16) return; // only at its real spot: out of range = no icon
    ctx.save(); ctx.translate(ix, iy); ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(12,12,16,.85)'; ctx.strokeStyle = '#ecc828'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(0, 0, 12, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ecc828';
    ctx.beginPath(); ctx.roundRect(-8, -4.5, 16, 9, 4); ctx.fill();                      // pad body
    ctx.fillStyle = '#12121a';
    ctx.fillRect(-5.5, -0.8, 4, 1.6); ctx.fillRect(-4.3, -2, 1.6, 4);                    // d-pad
    ctx.beginPath(); ctx.arc(2.8, 1, 1, 0, 7); ctx.arc(5, -1, 1, 0, 7); ctx.fill();      // buttons
    ctx.restore();
  }

  return {
    show(on) { wrap.style.display = on ? 'block' : 'none'; },
    update(dt, active) {
      wrap.style.display = active ? 'block' : 'none';
      if (!active || (acc += dt) < 1 / 30) return;
      acc = 0; draw();
    },
  };
}
