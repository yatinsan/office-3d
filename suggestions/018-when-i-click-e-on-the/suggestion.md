# Suggestion 18: when i click e on the tv just play game like play in tv and show suggeaion and w

- **Status:** done
- **Section:** TV · Game room · Game Room
- **Point:** x 0.09, y 1.36, z 25.25 m (x from the window wall, z from the corner-cabin end; see floorplan/floorplan_proposed.png)
- **Created:** 2026-11-19 12:37 · **Updated:** 2026-11-19 12:37

## What needs to change

when i click e on the tv just play game like play in tv and show suggeaion and when i press somting , it will full screen ,  like for fist 

show a game list and fist now show snak game and play that

## Attachments

_None_

## Claude's notes

The game room TV is now playable. Walk up to it (the hint at the bottom says 'E play TV games') and press E: the TV turns on with a game list (Snake, plus Pong, Tetris and Car Race shown as coming soon). Use ↑/↓ to choose and Enter to play. Snake runs on the TV with arrows or WASD, and the score and best score are shown. Press F to go full screen and F again to return to the TV. Backspace goes back to the list, and E in the list turns the TV off. While the TV is on, walking, doors and the C/X/L suggestion keys are paused so they don't clash with the game. Code: src/arcade.js (wired up in src/main.js).
