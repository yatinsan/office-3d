"""Proposed workspace layout (to scale), drawn on top of the current plan's shell.

Usage:  python3 floorplan/make_proposed.py
Writes floorplan/floorplan_proposed.png. Same grid as make_floorplan.py (1 m, x from windows, z from cabin end).

Layout rules (metres):
  * three lanes running window -> east wall, table centres at z = 10.8 / 13.6 / 16.4
    (2.0 m in front of lane 1 for the lockers, 1.6 m between lanes and to the back wall)
  * window table  4 seats  x 1.45..2.85  (1.45 m walkway along the windows)
  * long table    8 seats  x 3.80..6.60  (0.95 m cross-aisle from the window table)
  * east desk     2 seats  x 8.65..9.95  against the east wall, one chair each end (z sides)
  * main north-south walkway x 6.6..8.65 (2 m), lockers face west, backed onto the thin wall at x 7.15 (z 8.25..9.5)
  * cabin doors: corner cabin at its window end, cabins 1 + 2 side by side at their shared wall
"""
import math
import os
import make_floorplan as mf
from PIL import ImageDraw

TABLE_W = 1.2
LANES = [10.8, 13.6, 16.4]
EAST_Z = [10.85, 13.6, 16.4]   # lane 1 east desk nudged south to clear the reception wall
WIN_X = (1.45, 2.85)
LONG_X = (3.8, 6.6)
EAST_X = (8.65, 9.95)
EAST_D = 0.8

DROP = {'pod', 'bench', 'smalldesk', 'lockers', 'ydoor', 'sdoor'}  # back wall is plain now
items = []
for it in mf.ITEMS:
    kind, x0, z0, x1, z1, label = it
    if kind in DROP:
        continue
    if kind == 'concrete' and (x0, z0) == (6.9, 7.4):
        items.append(('wall', 7.15, 7.4, 7.3, 9.6, ''))  # thin partition wall (logo on its east face)
        continue
    if kind == 'glass' and (x0, z0) in ((1.25, 15.64), (3.24, 15.7)):
        continue  # glass room walls
    if kind == 'door' and (x0, z0) in ((3.3, 15.85), (1.75, 3.5), (3.15, 5.75), (6.3, 5.75)):
        continue  # glass room door + old cabin doors
    items.append(it)

chairs = [c for c in mf.CHAIRS if c[1] < 6.0]  # keep cabin chairs, drop all workspace chairs
chairs = [c for c in chairs if c not in ((0.8, 2.95), (1.45, 2.95), (4.65, 3.6), (4.35, 5.15), (5.15, 5.15))] + [(1.35, 2.95), (2.05, 2.95), (3.9, 3.6), (3.6, 5.15), (4.4, 5.15)]

import json
LOCKS = []
LAYOUT = {o['id']: o for o in json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'layout.json')))}
SPEC = {'W': (1.4, 1.2, [-0.35, 0.35]), 'L': (2.8, 1.2, [-1.05, -0.35, 0.35, 1.05]), 'E': (1.3, 0.8, [0.0])}
CH = 0.35  # chair centre beyond the table edge
for oid, o in LAYOUT.items():
    if oid.startswith('LOCK'):
        rot = o.get('rot', 0) % 360
        hw, hd = (0.625, 0.275) if rot % 180 else (0.275, 0.625)
        items.append(('lockers', o['x'] - hw, o['z'] - hd, o['x'] + hw, o['z'] + hd, ''))
        LOCKS.append((o, rot, hw, hd))
        continue
    w, dd, xs = SPEC[oid[0]]
    rot = o.get('rot', 0) % 180
    hw, hd = (dd / 2, w / 2) if rot else (w / 2, dd / 2)
    kind = 'smalldesk' if oid[0] == 'E' else 'pod'
    items.append((kind, o['x'] - hw, o['z'] - hd, o['x'] + hw, o['z'] + hd, oid))
    for lx in xs:
        for side in (-1, 1):
            off = side * (dd / 2 + CH)
            chairs.append((o['x'] - off, o['z'] + lx) if rot else (o['x'] + lx, o['z'] + off))
items += [('ydoor', 9.95, 11.95, 10.1, 12.95, ''), ('ydoor', 9.95, 14.95, 10.1, 15.95, '')]  # amber doors on the east wall

# new cabin doors (hinge, free end) — drawn with swing arcs below
DOORS = [((0.15, 3.5), (1.05, 3.5), -1),    # corner cabin, swings north into the cabin
         ((6.05, 5.75), (5.15, 5.75), -1),  # cabin 2, hinge at the shared wall
         ((6.25, 5.75), (7.15, 5.75), -1)]  # cabin 1, hinge at the shared wall
for (a, b, _) in DOORS:
    items.append(('door', a[0], a[1], b[0], b[1], ''))

# suggestions 4-6: lounge bean bag removed, cabin 2 desk moved west, chaise replaced by a sofa
items = [it for it in items if not (it[0] == 'beanbag' and it[1] == 0.4)]
items = [('desk', 3.25, 3.95, 4.75, 4.75, 'C2') if it[-1] == 'C2' else it for it in items]
items = [('sofa', 2.15, 4.2, 3.0, 5.8, 'Sofa') if it[0] == 'chaise' else it for it in items]
items.append(('door', 0.0, 4.9, 0.0, 6.5, ''))  # suggestion 10: lounge balcony double door
mf.ITEMS = items
mf.CHAIRS = chairs
mf.ZONE_LABELS = [z for z in mf.ZONE_LABELS if z[2] not in ('GLASS ROOM', 'OPEN WORKSPACE')] + [(7.65, 14.85, 'OPEN\nWORKSPACE')]

img = mf.draw()
d = ImageDraw.Draw(img, 'RGBA')
P = mf.P
f11, f14 = mf.font(13), mf.font(15)

# door leaves + swing arcs
for (h, e, s) in DOORS:
    r = math.dist(h, e) * mf.PX
    hx, hz = P(*h)
    leaf_end = P(h[0], h[1] + s * math.dist(h, e))
    d.line([(hx, hz), leaf_end], fill=(220, 0, 0, 255), width=3)
    box = [hx - r, hz - r, hx + r, hz + r]
    start = 180 if e[0] < h[0] else 270
    d.arc(box, start, start + 90, fill=(220, 0, 0, 200), width=1)

# lockers: dark edge on the door side (rot: 0 west, 90 north, 180 east, 270 south)
for (o, rot, hw, hd) in LOCKS:
    x0, z0, x1, z1 = o['x'] - hw, o['z'] - hd, o['x'] + hw, o['z'] + hd
    edge = {0: (x0, z0, x0, z1), 90: (x0, z0, x1, z0), 180: (x1, z0, x1, z1), 270: (x0, z1, x1, z1)}[rot]
    d.line([P(edge[0], edge[1]), P(edge[2], edge[3])], fill=(30, 30, 30, 255), width=5)
    cx, cz = P(o['x'], o['z'])
    d.text((cx - 14, cz - 7), 'LOCK', fill='#111', font=f11)


def dim(x0, z0, x1, z1, txt, off=(0, 0)):
    a, b = P(x0, z0), P(x1, z1)
    d.line([a, b], fill='#c00', width=2)
    for p in (a, b):
        d.ellipse([p[0] - 3, p[1] - 3, p[0] + 3, p[1] + 3], fill='#c00')
    d.text(((a[0] + b[0]) / 2 + off[0], (a[1] + b[1]) / 2 + off[1]), txt, fill='#c00', font=f11)


# cover the old caption
Wpx, Hpx = img.size
d.rectangle([0, Hpx - 34, Wpx, Hpx], fill='white')
d.text((mf.M_L, Hpx - 30), 'Pixbit office – PROPOSED layout (top view). Grid = 1 m. ● = chair. W = 4-seat window table, '
       'L = 8-seat long table, E = 2-seat east-wall desk. Red = doors.', fill='#333', font=f11)
out = os.path.join(mf.OUT, 'floorplan_proposed.png')
img.save(out)
print('written', out)
