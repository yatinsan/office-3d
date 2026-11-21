import * as THREE from 'three';
import { officeChair, visitorChair, beanBag, pottedPlant } from '../props.js';

/**
 * Prop Hunt. Same round as Hide and Seek (one seeker from the shared seed, 20 s to hide, 3 min to seek, a tag turns a
 * hider into a seeker), but hiders look like office props: keys 1-5 pick the prop, R freezes you in place so you read as
 * plain furniture. Everybody else sees the prop instead of your body (src/games.js applies it with avatar.setDisguise).
 * A swing that hits nobody stuns the seeker for MISS_STUN seconds, so punching every chair does not pay.
 */
const COUNT = 3, HIDE = 20, SEEK = 180, MISS_STUN = 2;
const RED = '#ff5050', GOLD = '#ecc828';

/** the disguises: hit = how high a seeker aims a punch at it */
const PROPS = [
  { name: 'Office chair', hit: 0.55, make: (g) => officeChair(g, 0, 0) },
  { name: 'Visitor chair', hit: 0.5, make: (g) => visitorChair(g, 0, 0) },
  { name: 'Bean bag', hit: 0.35, make: (g) => beanBag(g, 0, 0) },
  { name: 'Plant', hit: 0.55, make: (g) => pottedPlant(g, 0, 0) },
  { name: 'Big plant', hit: 0.7, make: (g) => pottedPlant(g, 0, 0, { size: 0.6, h: 0.6 }) },
];

const phaseAt = (el) => (el < COUNT ? 'count' : el < COUNT + HIDE ? 'hide' : el < COUNT + HIDE + SEEK ? 'seek' : 'over');
const hidersOf = (g) => Object.keys(g.players).filter((u) => !g.seekers.includes(u));
const mmss = (s) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, '0')}`;

export default {
  id: 'prophunt',
  name: 'Prop Hunt',
  min: 2,
  max: 8,
  blurb: 'Hide as a chair or plant (keys 1-5, R freezes). The seeker punches what looks wrong.',
  props: PROPS,

  /** a prop for the avatar: faces the way the avatar faces */
  makeProp(idx) {
    const g = new THREE.Group();
    PROPS[idx].make(g);
    g.rotation.y = Math.PI;
    return g;
  },
  /** which prop `uid` shows right now, or null (seekers and players who have not picked yet look like people) */
  disguiseOf(g, uid) {
    const d = g.disguise && g.disguise[uid];
    return d && !g.seekers.includes(uid) && g.players[uid] ? d.p : null;
  },

  init(g) { g.seekers = [g.order[g.seed % g.order.length]]; g.disguise = {}; },
  onLeave(g) { if (!g.seekers.length) { const ids = Object.keys(g.players).sort(); if (ids.length) g.seekers = [ids[0]]; } },
  caught(g, uid) { if (g.players[uid] && !g.seekers.includes(uid)) g.seekers.push(uid); },

  tick(g, ctx) {
    const el = ctx.el(g), ph = phaseAt(el), run = g.run, me = ctx.me;
    const seeker = g.seekers.includes(me);
    const blind = seeker && el < COUNT + HIDE;
    ctx.blind(blind ? (el < COUNT ? 'Get ready' : 'You are the seeker') : null, blind ? `Counting… ${Math.max(0, Math.ceil(COUNT + HIDE - el))}` : '');
    if (!run.init) { run.init = true; ctx.keys(); } // forget key presses from before the game
    if (seeker) ctx.freeze(blind);
    else {
      const mine = g.disguise[me];
      if (!mine && !run.picked) { run.picked = true; ctx.send({ op: 'disguise', id: g.id, uid: me, p: Math.floor(Math.random() * PROPS.length), f: 0 }); } // start as a random prop
      for (const k of ctx.keys()) {
        const cur = g.disguise[me] || { p: 0, f: 0 }, n = /^(?:Digit|Numpad)([1-5])$/.exec(k);
        if (n) { ctx.send({ op: 'disguise', id: g.id, uid: me, p: +n[1] - 1, f: cur.f }); ctx.toast(`You are a ${PROPS[+n[1] - 1].name}`, 1400); }
        else if (k === 'KeyR') { ctx.send({ op: 'disguise', id: g.id, uid: me, p: cur.p, f: cur.f ? 0 : 1 }); ctx.toast(cur.f ? 'Moving again' : 'Frozen: you look like furniture', 1400); }
      }
      ctx.freeze(!!(g.disguise[me] && g.disguise[me].f));
    }
    if (ph !== run.ph) {
      run.ph = ph;
      if (ph === 'count') ctx.toast(seeker ? 'You are the SEEKER' : `${g.players[g.seekers[0]] || 'Someone'} is the seeker. Become a prop: 1-5, R freezes`, 3500);
      else if (ph === 'seek') ctx.toast(seeker ? 'GO! Punch whatever looks like a person. Misses cost a stun' : 'The seeker is out. Stay frozen!', 3200);
    }
  },

  /** I got punched by `from`: a seeker's punch tags a hider. A game punch never hurts. */
  onHit(g, ctx, from) {
    if (phaseAt(ctx.el(g)) !== 'seek') return true;
    if (g.seekers.includes(from) && !g.seekers.includes(ctx.me) && !g.run.sent) {
      g.run.sent = true;
      ctx.freeze(false);
      ctx.send({ op: 'caught', id: g.id, uid: ctx.me });
      ctx.toast('Found! You are a seeker now', 2600);
    }
    return true;
  },
  /** the seeker swung at nothing */
  onMiss(g, ctx) {
    if (phaseAt(ctx.el(g)) === 'seek' && g.seekers.includes(ctx.me)) { ctx.stun(MISS_STUN); ctx.toast(`Nothing there. Stunned ${MISS_STUN} s`, 1400); }
  },

  hostTick(g, ctx) {
    const n = Object.keys(g.players).length, el = ctx.el(g);
    if (n < 2) return 'abort';
    if (phaseAt(el) === 'seek' && hidersOf(g).length === 0) return 'seekers';
    if (el >= COUNT + HIDE + SEEK) return 'hiders';
    return null;
  },

  badge: (g, uid) => (g.seekers.includes(uid) ? RED : GOLD),
  hud(g, ctx) {
    const el = ctx.el(g), ph = phaseAt(el), h = hidersOf(g).length;
    if (ph === 'count' || ph === 'hide') return `Hide as a prop · seeker released in ${Math.max(0, Math.ceil(COUNT + HIDE - el))} s`;
    return `Hiders ${h} · ${mmss(COUNT + HIDE + SEEK - el)}`;
  },
  summary: (result) => (result === 'seekers' ? 'Seekers win' : result === 'hiders' ? 'Hiders win' : 'Game ended'),
  caughtText: (name) => `${name} was found`,
};
