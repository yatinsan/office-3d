# Open World (multiplayer)

Pick **Open World** in the Esc menu to walk the office with other people. Hold **V** to talk (on phones, hold the mic button). Voices come from the speaker's character, so people nearby are louder.

## How it works

- **Firebase Realtime Database** is used only as the lobby and the WebRTC handshake:
  - `rooms/office/players/<uid>`: name and colour of everyone in the world. Firebase deletes the entry automatically when someone closes the tab.
  - `rooms/office/signal/<uid>`: offer / answer / ICE messages, deleted as soon as they are read.
- **WebRTC** connects every pair of players directly:
  - a data channel carries position, facing and "is talking" about 15 times a second,
  - an audio channel carries push-to-talk voice.

Everyone connects to everyone, which works well for up to about 10–15 people. Nothing passes through Firebase once two players are connected, so the free plan is plenty.

**Limit:** without a TURN server, two players on very strict networks (some offices, schools, mobile carriers) may not be able to connect directly. They'll show as "joining…" and won't see each other. A TURN server can be added to `ICE` in `src/online.js` later if that happens.

## Setup (about 5 minutes)

1. Open <https://console.firebase.google.com> and **create a project**. Google Analytics isn't needed.
2. **Build → Authentication → Get started → Sign-in method → Anonymous → Enable.** Players are signed in anonymously; nobody needs an account.
3. **Build → Realtime Database → Create database.** Pick a region near you and start in **locked mode**.
4. In the database, open the **Rules** tab, replace everything with the contents of [`database.rules.json`](database.rules.json), and click **Publish**.
5. **Project settings (gear) → Your apps → Web (`</>`)**: register an app (no hosting needed) and copy the `firebaseConfig` values into [`src/firebase-config.js`](src/firebase-config.js). Make sure `databaseURL` is filled in; if it's missing from the snippet, copy it from the top of the Realtime Database page.
6. **Authentication → Settings → Authorized domains:** add `yatinsan.github.io` (for the live site). `localhost` is already there.

The config values are public by design; the rules are what stop people from writing other players' data.

## Files

- `src/online.js`: Open World mode: lobby, WebRTC peers, avatars with name tags, push to talk.
- `src/firebase-config.js`: your Firebase project settings and the room name.
- `database.rules.json`: Realtime Database security rules to paste into the console.

## Menu and character

- **Start menu** (plain text, arrows + Enter, or hover + click): **Play**, **Settings**. Play opens the character screen every time (name + dress colour, pre-filled with your last choice), then starts **Open World**. **Free Walk is temporarily hidden** (see `list` in `src/modes.js`); with two or more modes Play shows a mode page again.
- **Esc in game** opens the pause menu: **Resume**, **Character**, **Settings**, **Quit**. Quit disconnects, puts you back at the spawn and shows the start menu again.
- **Settings:** mic mode (push to talk / always on), dev mode, and a Controls page.
- **Character screen:** every time you press Play (not Resume) you get a third-person front view to pick a name and a dress colour; Done starts the game in first person. The name and colour are remembered in this browser and pre-filled. **Character** in the pause menu reopens the screen mid-game.
- **Scavenger Hunt is temporarily hidden.** Its code (`src/hunt.js`) is untouched. To bring it back, uncomment `modes.register(hunt);` in `src/main.js` (and add it to the Play page if you want it listed).

## In-game HUD

- **Top left:** online count (green; amber while people are still "joining", red when not connected).
- **Bottom centre:** mic chip (LIVE / TALKING / MUTED / PUSH TO TALK / MIC BLOCKED; the ring pulses with your voice, click it or press V to mute) and a small chip to switch push to talk / always on (T).
- **Above other players:** an animated speaker while they talk, and a small red mic-with-slash while they are muted in always-on mode. The position message carries a sixth `muted` field; older clients ignore it.
