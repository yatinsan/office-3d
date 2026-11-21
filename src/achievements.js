import { achievementChime } from './sfx.js';

/**
 * Achievements: a shared registry, remembered in localStorage, with a full-screen popup + chime when one is earned
 * and a tile grid for the menu. Import { achievements } anywhere and call achievements.unlock('id').
 */
export const ACHIEVEMENTS = [
  { id: 'lift', icon: '🛗', title: 'Going Up', hint: 'Find the Game Room', text: 'You found the Game Room. You can now ride the lifts between floors.', head: 'Lifts unlocked' },
  { id: 'ride', icon: '⬇️', title: 'Elevator Pitch', hint: 'Ride a lift to another floor', text: 'You took a lift all the way to another floor.' },
  { id: 'pool', icon: '🎱', title: 'Pool Shark', hint: 'Clear the pool table', text: 'You potted every ball on the table. Smooth.' },
  { id: 'balcony', icon: '🪂', title: 'Leap of Faith', hint: 'Jump off the balcony', text: 'You jumped off the balcony. Brave, or just curious?' },
  { id: 'game', icon: '🎮', title: 'Game On', hint: 'Finish a game (arcade, pool or multiplayer)', text: 'You played a game to the end.' },
  { id: 'snake10', icon: '🐍', title: 'Snake Charmer', hint: 'Score 10 in Snake on the arcade TV', text: 'You scored 10 or more in Snake.' },
  { id: 'explorer', icon: '🧭', title: 'Office Explorer', hint: 'Visit every area of the office', text: 'You have seen every corner of the office.' },
  { id: 'pixbit', icon: '💻', title: 'Hello Pixbit', hint: 'Sit at a desk and open the Pixbit site', text: 'You opened the Pixbit website on a desk monitor.' },
  { id: 'friends', icon: '🤝', title: 'Better Together', hint: 'Play a multiplayer game with others', text: 'You played a multiplayer game with other people.' },
];
const BY_ID = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));
const KEY = 'pixbit-achievements';

let have = new Set();
try {
  have = new Set(JSON.parse(localStorage.getItem(KEY) || '[]'));
  if (localStorage.getItem('pixbit-lifts-unlocked') === '1') have.add('lift');   // from before achievements existed
} catch {}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify([...have])); } catch {} };

const CSS = `
#ach-pop { position: fixed; inset: 0; z-index: 40; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 24px;
  background: radial-gradient(ellipse at center, rgba(0,0,0,.55) 0%, rgba(0,0,0,.85) 100%); color: #fff; font-family: system-ui, sans-serif;
  opacity: 0; pointer-events: none; transition: opacity .6s; }
#ach-pop.on { opacity: 1; }
#ach-pop .ai { position: relative; font-size: min(18vw,110px); filter: drop-shadow(0 0 24px #ffd34a); transform: scale(.2) rotate(-25deg); transition: transform .9s cubic-bezier(.2,1.4,.4,1); }
#ach-pop.on .ai { transform: scale(1) rotate(0); }
#ach-pop .ai::after { content: ''; position: absolute; inset: -30%; border-radius: 50%; border: 3px solid #ffd34a; opacity: 0; }
#ach-pop.on .ai::after { animation: ach-ring 1.4s .5s ease-out; }
@keyframes ach-ring { 0% { transform: scale(.4); opacity: .9; } 100% { transform: scale(1.6); opacity: 0; } }
#ach-pop .ah { margin-top: 10px; font-size: min(3.4vw,15px); letter-spacing: .5em; text-transform: uppercase; color: #ffd34a; opacity: .9; }
#ach-pop .at { margin: 6px 0 10px; font-weight: 900; font-size: min(11vw,84px); letter-spacing: .06em; text-transform: uppercase; color: #ffd34a;
  text-shadow: 0 0 30px rgba(255,211,74,.6), 0 4px 0 #8a6a00; transform: scale(1.6); transition: transform 1.2s cubic-bezier(.1,.9,.2,1); }
#ach-pop.on .at { transform: scale(1); }
#ach-pop .ax { max-width: min(90vw,520px); font-size: min(4vw,18px); opacity: .85; line-height: 1.5; }
#ach-pop .ac { margin-top: 16px; font-size: 13px; letter-spacing: .15em; text-transform: uppercase; opacity: .6; }
.ach-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; width: min(92vw, 560px); margin: 6px auto 12px; }
.ach-sum { text-align: center; font: 700 13px system-ui, sans-serif; letter-spacing: .12em; text-transform: uppercase; color: #ecc828; margin-bottom: 4px; }
.ach-tile { border-radius: 12px; padding: 12px 8px 10px; text-align: center; font-family: system-ui, sans-serif; color: #fff; min-height: 112px; display: flex; flex-direction: column; align-items: center; gap: 4px;
  background: linear-gradient(160deg, rgba(255,211,74,.22), rgba(255,211,74,.06)); border: 1px solid rgba(255,211,74,.55); }
.ach-tile .ti { font-size: 34px; }
.ach-tile .tt { font-weight: 800; font-size: 13px; letter-spacing: .04em; text-transform: uppercase; color: #ffd34a; }
.ach-tile .tx { font-size: 11px; opacity: .8; line-height: 1.3; }
.ach-tile.locked { background: rgba(255,255,255,.04); border: 1px dashed rgba(255,255,255,.22); }
.ach-tile.locked .ti { filter: grayscale(1) brightness(0) opacity(.45); }
.ach-tile.locked .tt { color: rgba(255,255,255,.45); }
.ach-tile.fresh { animation: ach-pulse 1.2s ease-out 2; }
@keyframes ach-pulse { 0% { box-shadow: 0 0 0 0 rgba(255,211,74,.8); } 100% { box-shadow: 0 0 0 18px rgba(255,211,74,0); } }
#ach-badge { position: fixed; top: 14px; left: 14px; z-index: 9; display: none; align-items: center; gap: 6px; padding: 5px 10px 5px 8px; border-radius: 999px; pointer-events: none;
  background: rgba(18,22,34,.85); border: 1px solid rgba(255,211,74,.7); color: #fff; font: 600 12px system-ui, sans-serif; box-shadow: 0 4px 16px rgba(0,0,0,.4); }
#ach-badge.on { display: flex; }
#ach-badge .bi { font-size: 18px; }
#ach-badge .bn { min-width: 20px; height: 20px; border-radius: 10px; background: #ffd34a; color: #3a2a00; font-weight: 800; display: flex; align-items: center; justify-content: center; padding: 0 5px; box-sizing: border-box; }
#ach-badge.bump { animation: ach-bump .6s ease-out; }
@keyframes ach-bump { 0% { transform: scale(1); } 30% { transform: scale(1.3); box-shadow: 0 0 0 0 rgba(255,211,74,.9); } 100% { transform: scale(1); box-shadow: 0 0 0 20px rgba(255,211,74,0); } }
#ach-strip { position: fixed; top: 50%; right: 14px; z-index: 39; width: min(94vw, 560px); padding: 12px 12px 4px; border-radius: 18px; pointer-events: none; box-sizing: border-box;
  background: rgba(14,18,28,.94); border: 1px solid rgba(255,211,74,.55); box-shadow: 0 10px 40px rgba(0,0,0,.6);
  transform: translate(120%, -50%); opacity: 0; transition: transform .6s cubic-bezier(.2,1,.3,1), opacity .4s; }
.ach-panel { width: min(94vw, 560px); padding: 12px 12px 4px; border-radius: 18px; box-sizing: border-box; margin: 4px 0 8px;
  background: rgba(14,18,28,.94); border: 1px solid rgba(255,211,74,.55); box-shadow: 0 10px 40px rgba(0,0,0,.6); }
.ach-panel .ach-grid { width: 100%; }
#ach-strip.on { transform: translate(0, -50%); opacity: 1; }
#ach-strip .ach-grid { width: 100%; }
.ach-tile.pop { animation: ach-slot .7s ease-out; }
@keyframes ach-slot { 0% { transform: scale(.94); } 40% { transform: scale(1.03); box-shadow: 0 0 0 0 rgba(255,211,74,.9); } 100% { transform: scale(1); box-shadow: 0 0 0 10px rgba(255,211,74,0); } }
.ach-fly { position: fixed; z-index: 41; pointer-events: none; transition: transform .9s cubic-bezier(.5,0,.8,.4), opacity .9s; transform-origin: center; filter: drop-shadow(0 0 14px #ffd34a); }
@media (max-width: 520px) { .ach-grid { grid-template-columns: repeat(2, 1fr); } }
`;
const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);

const pop = document.createElement('div'); pop.id = 'ach-pop';
const badge = document.createElement('div'); badge.id = 'ach-badge';
document.body.append(pop, badge);
const queue = [];
let showing = false;
const listeners = [];

// unseen = earned but not yet looked at in the gallery; landed = its icon has already flown to the badge.
// The badge is hidden unless something is waiting, and goes away once the Achievements page is opened.
const UKEY = 'pixbit-ach-unseen';
let unseen = new Set(), landed = new Set();
try { unseen = new Set(JSON.parse(localStorage.getItem(UKEY) || '[]')); landed = new Set(unseen); } catch {}
const saveUnseen = () => { try { localStorage.setItem(UKEY, JSON.stringify([...unseen])); } catch {} };
function refreshBadge(bump) {
  const n = [...unseen].filter((id) => landed.has(id)).length;
  badge.classList.toggle('on', n > 0);
  badge.innerHTML = `<span class="bi">🏆</span><span class="bn">${n}</span>`;
  if (bump) { badge.classList.remove('bump'); void badge.offsetWidth; badge.classList.add('bump'); }
}
/** the gallery grid; `skip` = an id to draw as still locked (it is about to fly in) */
function buildTiles(skip) {
  const wrap = document.createElement('div');
  const sum = document.createElement('div'); sum.className = 'ach-sum'; sum.textContent = `${have.size} / ${ACHIEVEMENTS.length} unlocked`;
  const grid = document.createElement('div'); grid.className = 'ach-grid';
  for (const a of ACHIEVEMENTS) {
    const on = have.has(a.id) && a.id !== skip;
    const t = document.createElement('div');
    t.dataset.id = a.id;
    t.className = 'ach-tile' + (on ? '' : ' locked') + (on && !skip && unseen.has(a.id) ? ' fresh' : '');
    t.innerHTML = `<div class="ti">${a.icon}</div><div class="tt">${on ? a.title : '???'}</div><div class="tx">${on ? a.text : a.hint}</div>`;
    grid.appendChild(t);
  }
  wrap.append(sum, grid);
  return wrap;
}
/** the gallery slides in from the right; the popup's icon flies into ITS tile (3rd of 9, say) and fills it,
 *  then the gallery slides away and the small badge keeps the "waiting in the gallery" count.
 *  (Old comment:) a strip with all the achievement slots slides in from the top; the popup's icon flies into ITS slot (3rd of 9, say) and fills it,
 *  then the strip slides away and the small badge keeps the "waiting in the gallery" count */
const strip = document.createElement('div'); strip.id = 'ach-strip';
document.body.appendChild(strip);
function fly(a) {
  const src = pop.querySelector('.ai');
  landed.add(a.id);
  if (!src) { refreshBadge(true); return; }
  const r = src.getBoundingClientRect();   // measured while the popup is still fully shown (its icon shrinks when it fades)
  // a copy takes over from the popup's own icon at exactly the same spot, so the icon leaves the dialog itself
  const el = document.createElement('div');
  el.className = 'ach-fly'; el.textContent = a.icon;
  el.style.cssText = `left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;font-size:${getComputedStyle(src).fontSize};display:flex;align-items:center;justify-content:center`;
  document.body.appendChild(el);
  src.style.visibility = 'hidden';
  strip.innerHTML = '';
  strip.appendChild(buildTiles(a.id));   // the real gallery grid, with this achievement's tile still empty
  strip.classList.add('on');             // slides in from the right while the popup fades behind the icon
  setTimeout(() => {
    const tile = strip.querySelector(`[data-id="${a.id}"]`), ti = tile.querySelector('.ti'), b = ti.getBoundingClientRect();
    const dx = b.left + b.width / 2 - (r.left + r.width / 2), dy = b.top + b.height / 2 - (r.top + r.height / 2), s = b.height / r.height;
    requestAnimationFrame(() => requestAnimationFrame(() => { el.style.transform = `translate(${dx}px,${dy}px) scale(${s})`; }));
    setTimeout(() => {   // landed: the tile fills in
      el.remove();
      tile.classList.remove('locked'); tile.classList.add('pop');
      tile.querySelector('.tt').textContent = a.title; tile.querySelector('.tx').textContent = a.text;
    }, 950);
    setTimeout(() => { strip.classList.remove('on'); refreshBadge(true); }, 3200);   // slides back out
  }, 600);
}
refreshBadge();

function show(a, head, replay) {
  showing = true;
  pop.className = '';
  pop.innerHTML = `<div class="ai">${a.icon}</div><div class="ah">${head || 'Achievement unlocked'}</div><div class="at">${a.title}</div><div class="ax">${a.text}</div>`
    + `<div class="ac">${have.size} / ${ACHIEVEMENTS.length} achievements</div>`;
  requestAnimationFrame(() => requestAnimationFrame(() => pop.classList.add('on')));
  achievementChime();
  setTimeout(() => { if (replay || (unseen.has(a.id) && !landed.has(a.id))) fly(a); pop.classList.remove('on'); }, 3800);   // fly() first: it measures the icon before the popup fades
  setTimeout(() => { showing = false; next(); }, 7400);   // the gallery needs ~3.5 s after the popup fades
}
function next() { if (!showing && queue.length) { const q = queue.shift(); show(q.a, q.head, q.replay); } }
function enqueue(a, head, replay) { queue.push({ a, head, replay }); next(); }

export const achievements = {
  list: ACHIEVEMENTS,
  has: (id) => have.has(id),
  count: () => have.size,
  /** earn an achievement (once): saves it and shows the popup */
  unlock(id) {
    const a = BY_ID[id];
    if (!a || have.has(id)) return false;
    have.add(id); unseen.add(id); save(); saveUnseen();
    enqueue(a, a.head ? `Achievement unlocked · ${a.head}` : '');
    listeners.forEach((f) => f(id));
    return true;
  },
  /** show the popup again (for testing / typing "lift") */
  replay(id) { const a = BY_ID[id]; if (a) enqueue(a, '', true); },
  /** cheat: earn everything at once (saved), one big popup instead of nine */
  unlockAll() {
    for (const a of ACHIEVEMENTS) if (!have.has(a.id)) { have.add(a.id); unseen.add(a.id); }
    save(); saveUnseen();
    enqueue({ id: 'all', icon: '🏆', title: 'Completionist', text: `You unlocked all ${ACHIEVEMENTS.length} achievements.` }, 'All achievements unlocked');
    setTimeout(() => { for (const id of unseen) landed.add(id); refreshBadge(true); }, 4300);
  },
  reset() { have = new Set(); unseen = new Set(); landed = new Set(); save(); saveUnseen(); refreshBadge(); try { localStorage.removeItem('pixbit-lifts-unlocked'); } catch {} },
  onChange: (f) => listeners.push(f),
  /** the tile grid for the menu page */
  tiles: () => { const w = buildTiles(); w.className = 'ach-panel'; return w; },   // same look as the panel that slides in on an unlock
  /** the gallery was opened: everything pending has been seen, the badge goes away */
  markSeen() { unseen = new Set(); landed = new Set(); saveUnseen(); refreshBadge(); },
};
// Cheat words: type one anywhere in the game to replay that achievement's popup + gallery animation (nothing is saved or unlocked).
// "lift" works even with a text box focused (the dev "L" key opens one); the others ignore typing in text boxes.
const CHEATS = { lift: 'lift', ride: 'ride', pool: 'pool', leap: 'balcony', game: 'game', snake: 'snake10', explore: 'explorer', pixbit: 'pixbit', friends: 'friends' };
let typed = '';
addEventListener('keydown', (e) => {
  if (e.repeat || !/^Key[A-Z]$/.test(e.code)) return;
  typed = (typed + e.code.slice(3).toLowerCase()).slice(-12);
  const inBox = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
  if (typed.endsWith('dropit') && !inBox) { typed = ''; achievements.unlockAll(); return; }
  for (const w in CHEATS) {
    if (typed.endsWith(w) && (w === 'lift' || !inBox)) { typed = ''; achievements.replay(CHEATS[w]); break; }
  }
});
window.__achievements = achievements;   // console: __achievements.unlock('pool'), .reset()
