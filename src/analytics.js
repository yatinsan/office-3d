import { FIREBASE_CONFIG } from './firebase-config.js';

/**
 * Google Analytics via Firebase. Does nothing until FIREBASE_CONFIG.measurementId is set.
 * Loaded lazily from the CDN (same as the multiplayer code) so it never blocks the game.
 * Use track('event_name', { ...params }) anywhere to log a custom event.
 */
const FB = 'https://www.gstatic.com/firebasejs/11.0.2/';
let ready = null;

export function initAnalytics() {
  if (ready || !FIREBASE_CONFIG.measurementId || location.hostname === 'localhost') return ready;
  ready = (async () => {
    try {
      const [app, an] = await Promise.all([
        import(/* @vite-ignore */ FB + 'firebase-app.js'),
        import(/* @vite-ignore */ FB + 'firebase-analytics.js'),
      ]);
      if (!(await an.isSupported())) return null;
      const a = app.initializeApp(FIREBASE_CONFIG, 'pixbit-analytics');
      return { an, inst: an.getAnalytics(a) };
    } catch { return null; }
  })();
  return ready;
}

export function track(name, params) {
  ready?.then((r) => { if (r) r.an.logEvent(r.inst, name, params); });
}
