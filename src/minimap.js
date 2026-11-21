import { colliders, lvl } from './colliders.js';
import { GAME_X1, GAME_Z1, MEET_Z1, GAME_DOOR, doorLeaves } from './world/helpers.js';

// GTA-style minimap: a square at the right edge, walls only, rotates so "up" is where you look.
const MW = 210, MH = 210; // css px: a circle
const RANGE = 13;      // metres from the centre to the top / bottom edge of the map
const GAME_C = { x: GAME_X1 / 2, z: (MEET_Z1 + GAME_Z1) / 2 }; // middle of the Game Room
const walls = [null, null]; // walls + big blocks, no small furniture (built on first draw: the world fills `colliders` after this module loads)
// one list per floor level (the ground floor is built under the 4th, same x/z)
const getWalls = () => walls[lvl.cur] || (walls[lvl.cur] = colliders.filter((c) => (c.lv || 0) === lvl.cur && Math.max(c.maxX - c.minX, c.maxZ - c.minZ) >= 1.2));

// ---- walking route to the Game Room: A* over a coarse grid of the 4th floor's colliders ----
const CELL = 0.2, GX0 = -4, GZ0 = -2, GNX = 175, GNZ = 213, PAD = 0.12;
function findRoute(sx, sz, tx, tz) {
  const solid = new Uint8Array(GNX * GNZ);
  const doorBlocks = new Set(doorLeaves.map((d) => d.block));
  for (const c of colliders) {
    if (doorBlocks.has(c)) continue;                     // shut cabin / hall doors: you can open them
    if ((c.lv || 0) !== 0) continue;
    if (c.minX === -0.08 && c.maxX === 0.08) continue;   // the glass doors in the west wall (terrace): shut, but you can open them
    if (c.minX === GAME_DOOR[0] && c.maxX === GAME_DOOR[1] && Math.abs(c.minZ - MEET_Z1) < 0.01) continue; // the game room door: shut, but you can open it
    const x0 = Math.max(0, Math.floor((c.minX - PAD - GX0) / CELL)), x1 = Math.min(GNX - 1, Math.floor((c.maxX + PAD - GX0) / CELL));
    const z0 = Math.max(0, Math.floor((c.minZ - PAD - GZ0) / CELL)), z1 = Math.min(GNZ - 1, Math.floor((c.maxZ + PAD - GZ0) / CELL));
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) solid[z * GNX + x] = 1;
  }
  const cell = (x, z) => [Math.min(GNX - 1, Math.max(0, Math.floor((x - GX0) / CELL))), Math.min(GNZ - 1, Math.max(0, Math.floor((z - GZ0) / CELL)))];
  const [ax, az] = cell(sx, sz), [bx, bz] = cell(tx, tz);
  const start = az * GNX + ax, goal = bz * GNX + bx;
  solid[start] = 0; solid[goal] = 0;                       // never block the ends
  const g = new Float32Array(GNX * GNZ).fill(1e9), from = new Int32Array(GNX * GNZ).fill(-1), done = new Uint8Array(GNX * GNZ);
  const open = [[0, start]]; g[start] = 0;
  const h = (i) => Math.hypot((i % GNX) - bx, ((i / GNX) | 0) - bz);
  while (open.length) {
    let bi = 0; for (let i = 1; i < open.length; i++) if (open[i][0] < open[bi][0]) bi = i;
    const [, cur] = open.splice(bi, 1)[0];
    if (done[cur]) continue; done[cur] = 1;
    if (cur === goal) break;
    const cx = cur % GNX, cz = (cur / GNX) | 0;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dz) continue;
      const nx = cx + dx, nz = cz + dz;
      if (nx < 0 || nz < 0 || nx >= GNX || nz >= GNZ) continue;
      const n = nz * GNX + nx;
      if (solid[n] || done[n] || (dx && dz && (solid[cz * GNX + nx] || solid[nz * GNX + cx]))) continue; // no corner cutting
      const ng = g[cur] + (dx && dz ? 1.414 : 1);
      if (ng < g[n]) { g[n] = ng; from[n] = cur; open.push([ng + h(n), n]); }
    }
  }
  if (!done[goal]) return null;
  const pts = [];
  for (let i = goal; i !== -1; i = from[i]) pts.push({ x: GX0 + ((i % GNX) + 0.5) * CELL, z: GZ0 + (((i / GNX) | 0) + 0.5) * CELL });
  return pts.reverse().filter((_, i, a) => i % 3 === 0 || i === a.length - 1);
}

export function initMinimap({ camera, player, online }) {
  // the way from the lift: the fingerprint door -> the lounge balcony door -> the balcony -> along the terrace -> the meeting room -> the game room door
  const WP = [[11.3, 8.1], [9.0, 8.1], [1.6, 5.7], [-2.8, 5.7], [-1.6, 20.8], [0.9, 20.8], [(GAME_DOOR[0] + GAME_DOOR[1]) / 2, MEET_Z1 - 0.6], [(GAME_DOOR[0] + GAME_DOOR[1]) / 2, MEET_Z1 + 0.9]];
  let route = null, routeOn = false, routeT = 0, wpi = 0;
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
      if ((d.y < -2) !== (lvl.cur === 1)) continue; // only people on my floor
      ctx.fillStyle = d.color || '#7ee08f';
      ctx.beginPath(); ctx.arc(d.x, d.z, 0.45, 0, 7); ctx.fill();
    }
    if (routeOn && route && route.length > 1 && !lvl.cur) {   // the way to the Game Room: a dashed yellow line
      ctx.save(); ctx.shadowBlur = 0; ctx.strokeStyle = '#ecc828'; ctx.lineWidth = 0.28; ctx.setLineDash([0.6, 0.45]); ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(px, pz); for (const p of route) ctx.lineTo(p.x, p.z); ctx.stroke(); ctx.restore();
    }
    // you: yellow arrow in the middle, always pointing up
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.translate(W / 2, H / 2); ctx.scale(dpr, dpr);
    ctx.fillStyle = '#ecc828'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(6, 7); ctx.lineTo(0, 3); ctx.lineTo(-6, 7); ctx.closePath(); ctx.fill(); ctx.stroke();
    if (lvl.cur) return;                          // the game room is not on the ground floor
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
    /** turn the walking route to the Game Room on / off */
    navigate(on) {
      routeOn = on; route = null; routeT = 1;
      const x = player.pos.x, z = player.pos.z;                // start at the first stop still ahead of you
      wpi = x > 10.2 ? 0 : x < 0 ? (z > 8 ? 4 : 3) : z > 18.7 ? 6 : 2;
    },
    update(dt, active) {
      wrap.style.display = active ? 'block' : 'none';
      if (routeOn && !lvl.cur && (routeT += dt) >= 1) {       // re-plan once a second as you walk
        routeT = 0;
        const x = player.pos.x, z = player.pos.z;
        wpi = Math.max(wpi, x < 0 ? (z > 8 ? 4 : 3) : x < 10.2 && z > 18.7 ? 6 : 0);   // never send you back to a stop you are already past
        while (wpi < WP.length - 1 && Math.hypot(player.pos.x - WP[wpi][0], player.pos.z - WP[wpi][1]) < 1.3) wpi++;   // reached that stop
        const pts = []; let fx = player.pos.x, fz = player.pos.z;
        for (let i = wpi; i < WP.length; i++) {
          const leg = findRoute(fx, fz, WP[i][0], WP[i][1]) || [{ x: WP[i][0], z: WP[i][1] }];   // no way found: a straight line for that bit
          pts.push(...leg); fx = WP[i][0]; fz = WP[i][1];
        }
        route = pts;
        if (player.pos.z > MEET_Z1 + 0.5 && player.pos.x < GAME_X1) routeOn = false; // arrived
      }
      if (!active || (acc += dt) < 1 / 30) return;
      acc = 0; draw();
    },
  };
}
