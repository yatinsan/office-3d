/**
 * Hide and Seek. One seeker is picked from the seed (same on every client). Count 3, the seeker is frozen and blind
 * for HIDE seconds while everybody hides, then SEEK seconds to find them. A punch from a seeker tags a hider, who
 * becomes a seeker too. Last hider standing wins; if time runs out the hiders win.
 *
 * Game types are plain objects; src/games.js calls them on every player in the game (tick, onHit), on the host only
 * (hostTick), and on everybody who watches (badge, hud). `ctx` = { me, el(game), toast, send, freeze, blind }.
 */
const COUNT = 3, HIDE = 20, SEEK = 180;
const RED = '#ff5050', GOLD = '#ecc828';

const phaseAt = (el) => (el < COUNT ? 'count' : el < COUNT + HIDE ? 'hide' : el < COUNT + HIDE + SEEK ? 'seek' : 'over');
const hidersOf = (g) => Object.keys(g.players).filter((u) => !g.seekers.includes(u));
const mmss = (s) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, '0')}`;

export default {
  id: 'hideseek',
  name: 'Hide and Seek',
  min: 2,
  max: 8,
  blurb: '1 seeker, 20 s to hide, 3 min round. A punch from a seeker tags you.',

  /** runs on every client when the host starts: pick the first seeker from the shared seed */
  init(g) { g.seekers = [g.order[g.seed % g.order.length]]; },
  /** nobody is left to seek, or to be found: make sure there is always a seeker */
  onLeave(g) { if (!g.seekers.length) { const ids = Object.keys(g.players).sort(); if (ids.length) g.seekers = [ids[0]]; } },
  caught(g, uid) { if (g.players[uid] && !g.seekers.includes(uid)) g.seekers.push(uid); },

  /** every frame, for each player in the game */
  tick(g, ctx) {
    const el = ctx.el(g), ph = phaseAt(el), run = g.run;
    const seeker = g.seekers.includes(ctx.me);
    const blind = seeker && el < COUNT + HIDE;
    ctx.freeze(blind);
    ctx.blind(blind ? (el < COUNT ? 'Get ready' : 'You are the seeker') : null, blind ? `Counting… ${Math.max(0, Math.ceil(COUNT + HIDE - el))}` : '');
    if (ph !== run.ph) {
      run.ph = ph;
      if (ph === 'count') ctx.toast(seeker ? 'You are the SEEKER' : `${g.players[g.seekers[0]] || 'Someone'} is the seeker. Hide!`, 3000);
      else if (ph === 'hide' && !seeker) ctx.toast(`HIDE! The seeker is released in ${HIDE} s`, 3500);
      else if (ph === 'seek') ctx.toast(seeker ? 'GO! Find them and punch them' : 'The seeker is out', 3000);
    }
  },

  /** I got punched by `from`. Returns true: a game punch never hurts (no damage, no knockout). */
  onHit(g, ctx, from) {
    if (phaseAt(ctx.el(g)) !== 'seek') return true;
    if (g.seekers.includes(from) && !g.seekers.includes(ctx.me) && !g.run.sent) {
      g.run.sent = true;
      ctx.send({ op: 'caught', id: g.id, uid: ctx.me });
      ctx.toast('Tagged! You are a seeker now', 2600);
    }
    return true;
  },

  /** host only: a result string ends the game */
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
    if (ph === 'count' || ph === 'hide') return `Hiding · seeker released in ${Math.max(0, Math.ceil(COUNT + HIDE - el))} s`;
    return `Hiders ${h} · ${mmss(COUNT + HIDE + SEEK - el)}`;
  },
  summary(result) {
    return result === 'seekers' ? 'Seekers win' : result === 'hiders' ? 'Hiders win' : 'Game ended';
  },
  caughtText: (name) => `${name} was tagged`,
};
