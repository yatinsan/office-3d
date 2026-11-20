# Suggestion 47: in this add a door unlock for 8 sec like , after reach here click like press and

- **Status:** done
- **Section:** Building Hall
- **Point:** x 10.31, y 1.26, z 9.55 m (x from the window wall, z from the corner-cabin end; see floorplan/floorplan_proposed.png)
- **Created:** 2026-11-20 10:17 · **Updated:** 2026-11-20 10:17

## What needs to change

in this add a door unlock for 8 sec like , after reach here click like press and hold F the the circle full like , for press 3 sec , and wehn i reach the door , show top right in black box , to unlock press and hold F , like in gta , and in the finger print item  show a lock icon , 

also when i press F show a animation that a hand go and press the lock

## Attachments

_None_

## Claude's notes

Fingerprint entry lock on the reception entrance door. From the hall the door is locked. Standing at the door shows a black box top right: 'Use fingerprint to unlock'. Only when you are right at the reader (within ~0.9 m) does it change to 'Press and hold F to unlock'. Hold F for 1 s: the ring fills while a hand presses the reader (LED blinks blue), then the door opens for 8 s with a countdown and locks again once the doorway is clear. From inside reception F opens it as usual. The amber workspace doors stay closed. On phones, hold the action button. Next to the reader's padlock icon there is now a small black box with the same status (Locked / Hold F to unlock / Unlocking… with a progress bar / Door unlocked with the countdown). The icon and the box only appear when you are near the reader or the door.

Code: `src/unlock.js`, `locked()` / `byName()` in `src/doors.js`, `READER` in `src/world/helpers.js`, wired up in `src/main.js`, hold support for the touch action button in `src/touch.js`.
