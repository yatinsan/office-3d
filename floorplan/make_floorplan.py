"""Draw the office floor plan (top view, to scale) from the layout used by the 3D model.

Usage:  python3 floorplan/make_floorplan.py [scan_underlay.png]
Writes floorplan/floorplan.png (and floorplan/floorplan_over_scan.png when an underlay is given).
Grid: columns A..K = metres from the window wall (x), rows 1..19 = metres from the corner-cabin end (z).
"""
import os
import sys
from PIL import Image, ImageDraw, ImageFont

PX = 70            # pixels per metre
M_L, M_T = 70, 70  # margins
W_M, D_M = 10.6, 19.0
OUT = os.path.dirname(os.path.abspath(__file__))

# ---------------- layout (metres; x from window wall, z from corner-cabin end) ----------------
# Each entry: (kind, x0, z0, x1, z1, label)
ITEMS = [
    # zones (floor colour)
    ('zone_beige', 0, 0, 3, 7.95, ''), ('zone_beige', 3, 3, 10.3, 7.95, ''), ('zone_beige', 6.9, 7.95, 10.3, 9.25, ''),
    ('zone_dark', 0, 7.95, 6.9, 18.7, ''), ('zone_dark', 6.9, 9.6, 10.05, 18.7, ''),
    ('zone_beige', 3.3, 17.6, 10.05, 18.7, ''),
    # walls
    ('wall', 3, 2.9, 8.9, 3.1, ''), ('wall', 2.9, 0, 3.1, 5.75, ''), ('wall', 6.08, 3, 6.23, 5.75, ''),
    ('wall', 0, 7.8, 1.3, 8.1, ''), ('wall', 0, 18.6, 10.05, 18.8, ''), ('wall', 9.95, 9.6, 10.15, 18.7, ''),
    ('wall', 6.9, 9.25, 8.3, 9.6, ''), ('wall', 0, -0.1, 3, 0.0, ''),
    ('concrete', 8.9, 3, 10.35, 5.75, 'PILLAR'), ('concrete', 6.9, 7.4, 7.3, 9.6, ''),
    ('concrete', 2.35, 0, 3, 0.65, ''),
    # windows / glass
    ('window', -0.08, 0, 0.0, 18.7, ''), ('window', 0, -0.08, 3, 0.0, ''),
    ('glass', 0, 3.44, 3, 3.56, ''), ('glass', 3, 5.69, 8.9, 5.81, ''),
    ('glass', 10.24, 5.75, 10.36, 9.25, ''), ('frost', 8.3, 9.17, 10.3, 9.33, 'frosted'),
    ('glass', 1.25, 15.64, 3.3, 15.76, ''), ('glass', 3.24, 15.7, 3.36, 18.7, ''),
    # doors (gaps drawn as arcs later)
    ('door', 1.75, 3.5, 2.95, 3.5, ''), ('door', 3.15, 5.75, 4.35, 5.75, ''), ('door', 6.3, 5.75, 7.4, 5.75, ''),
    ('door', 10.3, 7.6, 10.3, 8.65, 'ENTRANCE'), ('door', 3.3, 15.85, 3.3, 16.95, ''),
    # reception
    ('sofa', 7.32, 7.5, 8.22, 9.3, 'Sofa'), ('logo', 7.3, 7.6, 7.36, 9.2, ''),
    ('desk_w', 8.88, 5.97, 9.65, 7.22, 'Recep'), ('niche', 9.55, 5.75, 10.15, 6.07, ''),
    # corner cabin + cabins
    ('desk', 0.8, 1.45, 2.4, 2.25, 'C3'), ('desk', 4.0, 3.95, 5.5, 4.75, 'C2'), ('desk', 6.55, 3.95, 8.15, 4.75, 'C1'),
    ('builtin', 5.67, 3.1, 6.08, 4.6, ''), ('builtin', 8.5, 3.1, 8.9, 5.65, ''),
    # lounge
    ('chaise', 2.13, 4.23, 2.88, 6.05, ''), ('beanbag', 0.25, 6.88, 0.95, 7.63, ''), ('beanbag', 0.4, 3.83, 1.1, 4.58, ''),
    # shelving partition
    ('shelf', 1.3, 7.75, 2.6, 8.2, ''), ('shelf', 4.3, 7.75, 6.9, 8.2, ''),
    # workspace pods (desk tops)
    ('pod', 0.9, 10.05, 2.95, 11.45, 'D1'), ('pod', 3.35, 10.05, 5.9, 11.45, 'D2'),
    ('pod', 0.9, 13.05, 2.95, 14.45, 'D3'), ('pod', 3.45, 13.05, 5.1, 14.45, 'D4'), ('pod', 5.75, 13.05, 7.3, 14.45, 'D5'),
    ('pod', 3.9, 15.75, 6.5, 17.15, 'D6'), ('pod', 0.4, 16.45, 2.4, 17.85, 'D7'),
    ('bench', 9.675, 10.0, 10.05, 17.1, 'E'),
    ('smalldesk', 8.0, 18.1, 9.1, 18.65, 'S1'), ('smalldesk', 5.65, 18.1, 6.75, 18.65, 'S2'), ('smalldesk', 4.45, 18.1, 5.55, 18.65, 'S3'),
    ('pillar', 7.05, 15.4, 7.65, 16.0, ''), ('pillar', 0.0, 15.5, 1.25, 15.9, ''),
    ('lockers', 6.95, 9.6, 8.25, 10.15, 'Lockers'),
    ('ydoor', 6.85, 18.55, 7.85, 18.7, ''), ('ydoor', 3.3, 18.55, 4.26, 18.7, ''), ('sdoor', 9.2, 18.55, 10.0, 18.7, ''),
    ('speaker', 4.05, 18.25, 4.35, 18.55, ''),
]
# chairs (centres) — pods: 2 per side per ~2 m, cabins, back desks, east bench
CHAIRS = []
for (x0, x1, zc) in [(0.9, 2.95, 10.75), (3.35, 5.9, 10.75), (0.9, 2.95, 13.75), (3.45, 5.1, 13.75), (5.75, 7.3, 13.75), (3.9, 6.5, 16.45), (0.4, 2.4, 17.15)]:
    n = max(1, int((x1 - x0) / 1.05))
    for i in range(n):
        x = x0 + (i + 0.5) * (x1 - x0) / n
        CHAIRS += [(x, zc - 0.82), (x, zc + 0.82)]
for i in range(6):
    CHAIRS.append((9.18, 10.0 + (i + 0.5) * 7.1 / 6))
for x in (8.28, 8.83, 5.93, 6.48, 4.73, 5.28):
    CHAIRS.append((x, 17.83))
CHAIRS += [(7.25, 3.6), (7.7, 5.15), (8.2, 5.15), (4.65, 3.6), (4.35, 5.15), (5.15, 5.15), (1.5, 1.05), (0.8, 2.95), (1.45, 2.95)]

ZONE_LABELS = [
    (1.5, 1.0, 'CORNER\nCABIN'), (4.6, 3.35, 'CABIN 2'), (7.5, 3.35, 'CABIN 1'), (1.5, 5.2, 'LOUNGE'),
    (3.8, 6.55, 'CORRIDOR'), (8.85, 8.4, 'RECEPTION'), (5.0, 12.2, 'OPEN WORKSPACE'),
    (1.6, 18.35, 'GLASS ROOM'), (12.0, 7.0, 'BUILDING\nHALL'),
]
STYLE = {
    'zone_beige': ('#efe4d2', None), 'zone_dark': ('#cfcfd2', None),
    'wall': ('#2b2b2b', None), 'concrete': ('#9b9b95', '#555'), 'window': ('#4aa3e0', None),
    'glass': ('#7fd0f0', '#2a8db8'), 'frost': ('#e8eef0', '#888'),
    'sofa': ('#222', None), 'logo': ('#f2c500', None), 'desk_w': ('#ffffff', '#333'), 'niche': ('#f5f0dc', '#555'),
    'desk': ('#fff', '#6b4a2b'), 'builtin': ('#ffffff', '#777'), 'chaise': ('#222', None), 'beanbag': ('#555', None),
    'shelf': ('#f2c500', '#222'), 'pod': ('#e7d3ad', '#6b4a2b'), 'bench': ('#e7d3ad', '#6b4a2b'),
    'smalldesk': ('#e7d3ad', '#6b4a2b'), 'pillar': ('#ffffff', '#333'), 'lockers': ('#fafafa', '#555'),
    'ydoor': ('#f1d27a', '#222'), 'sdoor': ('#dfe6e8', '#222'), 'speaker': ('#111', None),
    'door': (None, None),
}


def P(x, z):
    return M_L + x * PX, M_T + z * PX


def font(sz):
    for f in ('/System/Library/Fonts/Supplemental/Arial Bold.ttf', '/System/Library/Fonts/Helvetica.ttc', '/Library/Fonts/Arial.ttf'):
        if os.path.exists(f):
            return ImageFont.truetype(f, sz)
    return ImageFont.load_default()


def draw(base=None):
    Wpx, Hpx = int(M_L + 14.0 * PX), int(M_T + D_M * PX + 40)
    img = Image.new('RGB', (Wpx, Hpx), 'white')
    if base is not None:
        img.paste(base, (M_L, M_T))
    d = ImageDraw.Draw(img, 'RGBA')
    f9, f11, f14, f18 = font(11), font(13), font(15), font(20)
    alpha = 110 if base is not None else 255
    for kind, x0, z0, x1, z1, label in ITEMS:
        fill, line = STYLE[kind]
        a, b = P(x0, z0), P(x1, z1)
        if kind == 'door':
            # door gap: white line + swing arc
            d.line([a, b], fill=(255, 255, 255, 255), width=7)
            d.line([a, b], fill=(220, 0, 0, 255), width=2)   # door opening shown in red
            if label:
                d.text((b[0] + 8, (a[1] + b[1]) / 2 - 8), label, fill='#c00', font=f14)
            continue
        if kind.startswith('zone'):
            if base is None:
                d.rectangle([a, b], fill=fill)
            continue
        hx = fill[1:] if len(fill) == 7 else ''.join(c * 2 for c in fill[1:])
        rgb = tuple(int(hx[i:i + 2], 16) for i in (0, 2, 4))
        d.rectangle([a, b], fill=rgb + (alpha,), outline=line, width=2 if line else 0)
        if label:
            tw = d.textlength(label, font=f11)
            d.text(((a[0] + b[0]) / 2 - tw / 2, (a[1] + b[1]) / 2 - 7), label, fill='#111' if kind != 'sofa' else '#fff', font=f11)
    for (x, z) in CHAIRS:
        cx, cz = P(x, z)
        d.ellipse([cx - 7, cz - 7, cx + 7, cz + 7], fill=(40, 40, 40, 200))
    # grid + labels
    for i in range(0, 11):
        x, _ = P(i, 0)
        d.line([(x, M_T), (x, M_T + D_M * PX)], fill=(0, 0, 255, 40), width=1)
        d.text((x + PX / 2 - 5, M_T - 30), 'ABCDEFGHIJK'[i], fill='#1a3fbf', font=f14)
    for j in range(0, 19):
        _, z = P(0, j)
        d.line([(M_L, z), (M_L + 10.6 * PX, z)], fill=(0, 0, 255, 40), width=1)
        d.text((M_L - 30, z + PX / 2 - 9), str(j + 1), fill='#1a3fbf', font=f14)
    # window label down the left edge
    for k, ch in enumerate('WINDOWS'):
        px, pz = P(-0.62, 10.6 + k * 0.32)
        d.text((px, pz), ch, fill='#1f7fc0', font=f14)
    for (x, z, t) in ZONE_LABELS:
        px, pz = P(x, z)
        for k, line in enumerate(t.split('\n')):
            tw = d.textlength(line, font=f14)
            d.text((px - tw / 2, pz - 9 + k * 17), line, fill='#8a1c1c', font=f14)
    # key dimensions
    def dim(x0, z0, x1, z1, txt, off=(0, 0)):
        a, b = P(x0, z0), P(x1, z1)
        d.line([a, b], fill='#c00', width=2)
        for p in (a, b):
            d.ellipse([p[0] - 3, p[1] - 3, p[0] + 3, p[1] + 3], fill='#c00')
        mx, mz = (a[0] + b[0]) / 2 + off[0], (a[1] + b[1]) / 2 + off[1]
        d.text((mx, mz), txt, fill='#c00', font=f11)
    dim(0, 19.0 - 0.15, 10.05, 19.0 - 0.15, '10.05 m (window → east wall)', (-80, 4))
    dim(10.9, 0, 10.9, 18.7, '18.7 m', (6, 0))
    dim(4.8, 5.75, 4.8, 7.75, '2.0 m', (6, -22))
    dim(7.3, 8.9, 10.3, 8.9, '3.0 m', (-10, 4))
    d.text((M_L, Hpx - 30), 'Pixbit office – current 3D layout (top view). Grid = 1 m. ● = chair. D = desk pod, E = east wall bench, '
           'S = small desk, C = cabin desk.', fill='#333', font=f11)
    return img


if __name__ == '__main__':
    draw().save(os.path.join(OUT, 'floorplan.png'))
    if len(sys.argv) > 1:
        under = Image.open(sys.argv[1]).convert('RGB')
        # underlay is the scan render at 2 cm/px (x 0..10.6 m, z 0..19.2 m)
        under = under.resize((int(under.width * 0.02 * PX), int(under.height * 0.02 * PX)))
        draw(under).save(os.path.join(OUT, 'floorplan_over_scan.png'))
    print('written to', OUT)
