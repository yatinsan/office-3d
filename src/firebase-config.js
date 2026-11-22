/**
 * Firebase project for Open World (multiplayer). Firebase is used ONLY as the lobby + WebRTC handshake:
 * who is in the world, and the offer / answer / ICE messages. Positions and voice go peer-to-peer over WebRTC.
 *
 * Paste the `firebaseConfig` from Firebase console → Project settings → Your apps → Web app.
 * These values are public by design (they ship in every web app); the database rules in
 * database.rules.json are what protect the data. See MULTIPLAYER.md for the full setup.
 */
export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyD_KZcTz53Bfh12ZB7Gwed8f1WCKrsGIX4',
  authDomain: 'office-world-60ed1.firebaseapp.com',
  databaseURL: 'https://office-world-60ed1-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'office-world-60ed1',
  storageBucket: 'office-world-60ed1.firebasestorage.app',
  messagingSenderId: '607388062460',
  appId: '1:607388062460:web:4b68c0880c4d8822607d79',
  measurementId: 'G-Z93G3CN494', // Google Analytics: Firebase console → Project settings → Your apps → Web app → measurementId (G-XXXXXXXXXX)
};

/** Everyone in the same room sees each other. */
export const ROOM = 'office';

export const isConfigured = () => !FIREBASE_CONFIG.apiKey.startsWith('PASTE');
