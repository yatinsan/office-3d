# Suggestions

Suggestions left in the 3D walkthrough are saved here, one folder per suggestion, while the dev server is running (`npm run dev`).

```
suggestions/
  suggestions.json          index the 3D view reads (pins, areas, status)
  001-make-this-table-longer/
    suggestion.md           what needs to change, where, status, Claude's notes
    photo.jpg               anything you attached (images, PDFs, sketches…)
```

## In the walkthrough

| Key | Does |
| --- | --- |
| **C** | Aim the dot at something → suggestion pinned on that spot. Aim at an existing pin → open it. |
| **X**, then **X** | Aim at one floor corner, then the opposite corner → suggestion for that whole area. |
| **L** | List of all suggestions (Go there / Open). |

Pick or type the **Section** (e.g. "Long table L2", "Cabin 1"), describe what needs to change, and add images or any files. Yellow = open, green = done.

## Getting Claude to make the change

Tell Claude in the chat, for example:

- "do suggestion 3"
- "do all open suggestions"
- "edit suggestion 2: make it 3 m instead"

Claude reads `suggestions/<NNN>-*/suggestion.md` and its attachments, changes the 3D model (or `floorplan/layout.json`), then marks the suggestion **done** and writes what it changed under *Claude's notes* (both in `suggestion.md` and in `suggestions.json`, so the pin turns green).
