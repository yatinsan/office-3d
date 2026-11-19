# Suggestion 12: make all cabin door like f to open and clsoe

- **Status:** done
- **Section:** Glass wall (Cabin 2) · Cabin 2
- **Point:** x 6.02, y 1.29, z 5.60 m (x from the window wall, z from the corner-cabin end; see floorplan/floorplan_proposed.png)
- **Created:** 2026-11-19 10:53 · **Updated:** 2026-11-19 10:55

## What needs to change

make all cabin door like f to open and clsoe

## Attachments

_None_

## Claude's notes

All three cabin doors (Corner cabin, Cabin 1, Cabin 2) now start closed and open/close with F when you stand next to them, the same as the balcony door. A closed door blocks you; the bottom-left hint shows which door F will use. Code: glassWall() in src/world/helpers.js hands the leaf to src/doors.js.
