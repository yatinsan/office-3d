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

DROP = {'pod', 'bench', 'smalldesk', 'lockers'}
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
chairs = [c for c in chairs if c not in ((0.8, 2.95), (1.45, 2.95))] + [(1.35, 2.95), (2.05, 2.95)]

import json
LAYOUT = {o['id']: o for o in json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'layout.json')))}
SPEC = {'W': (1.4, 1.2, [-0.35, 0.35]), 'L': (2.8, 1.2, [-1.05, -0.35, 0.35, 1.05]), 'E': (1.3, 0.8, [0.0])}
CH = 0.35  # chair centre beyond the table edge
for oid, o in LAYOUT.items():
    if oid == 'LOCK':
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
items.append(('lockers', 6.6, 8.25, 7.15, 9.5, ''))  # backed onto the thin wall, facing west

# new cabin doors (hinge, free end) — drawn with swing arcs below
DOORS = [((0.15, 3.5), (1.05, 3.5), -1),    # corner cabin, swings north into the cabin
         ((6.05, 5.75), (5.15, 5.75), -1),  # cabin 2, hinge at the shared wall
         ((6.25, 5.75), (7.15, 5.75), -1)]  # cabin 1, hinge at the shared wall
for (a, b, _) in DOORS:
    items.append(('door', a[0], a[1], b[0], b[1], ''))

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

# lockers: dark front edge on the west face + label
a, b = P(6.6, 8.25), P(6.6, 9.5)
d.line([a, b], fill=(30, 30, 30, 255), width=5)
lx, lz = P(6.8, 8.35)
for k, ch in enumerate('LOCK'):
    d.text((lx, lz + k * 15), ch, fill='#111', font=f11)
ax, az = P(6.55, 8.87)
d.line([(ax, az), (ax - 34, az)], fill='#111', width=2)
d.polygon([(ax - 40, az), (ax - 30, az - 6), (ax - 30, az + 6)], fill='#111')


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
