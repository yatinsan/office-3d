# Cut the tower skyline out of IMG_5660 as an alpha matte for the balcony view.
# usage: sips -s format jpeg IMG_5660.HEIC --out full.jpg; python3 tools/skyline_matte.py full.jpg public/textures/skyline.png
import sys, numpy as np
from PIL import Image
src, out = sys.argv[1], sys.argv[2]
X0, X1, Y0, Y1 = 1480, 3550, 1270, 1760
im = np.asarray(Image.open(src).convert('RGB')).astype(np.float32)
H, W, _ = im.shape
# traced roof line (full-res px): (x_from, x_to, y_top)
segs = [(1480,1580,1490),(1580,1608,1435),(1608,1675,1378),(1675,1700,1408),(1700,1765,1415),(1765,1797,1420),
        (1797,2075,1495),(2075,2090,1390),(2090,2195,1352),(2195,2245,1333),(2245,2400,1345),(2400,2470,1310),
        (2470,2590,1284),(2590,2660,1310),(2660,2930,1308),(2930,2985,1320),(2985,3090,1400),(3090,3150,1480),(3150,3330,1490)]
T = np.full(W, 1e9)
for a,b,y in segs: T[a:b] = y
hx = [3330,3500,3650,3800]; hy = [1470,1450,1430,1420]
T[3330:3800] = np.interp(np.arange(3330,3800), hx, hy)
# sky model: per row, linear fit in x over pixels well above the roof line
sky = np.zeros((H, W, 3), np.float32)
xs = np.arange(W)
for y in range(Y0, Y1):
    m = (T > y + 10) & (xs >= 1300) & (xs < 4032)
    if m.sum() < 20:
        sky[y] = sky[y-1]; continue
    for c in range(3):
        p = np.polyfit(xs[m], im[y, m, c], 1); sky[y, :, c] = p[0]*xs + p[1]
diff = np.abs(im - sky).max(axis=2)
yy = np.arange(H)[:, None]
below = yy - T[None, :]                         # px below roof line
key = np.clip((diff - 11) / 12, 0, 1)            # how unlike the sky a pixel is
alpha = np.where(below > 30, 1.0, np.where(below > -3, key, 0.0))
# crane: thin dark lines above the roofs, keyed only
cr = np.zeros_like(alpha, bool); cr[1280:1335, 2490:2715] = True
alpha = np.where(cr, np.maximum(alpha, np.clip((diff - 10) / 12, 0, 1)), alpha)
# soft left/right edges and bottom fade into the 3D canopy
alpha *= np.clip((xs[None, :] - X0) / 30, 0, 1) * np.clip((X1 - xs[None, :]) / 220, 0, 1)
alpha *= np.clip((Y1 - yy) / 40, 0, 1)
rgba = np.dstack([im, alpha * 255]).clip(0, 255).astype(np.uint8)[Y0:Y1, X0:X1]
img = Image.fromarray(rgba, 'RGBA')
img = img.resize((img.width * 6 // 10, img.height * 6 // 10), Image.LANCZOS)
img.save(out, optimize=True)
print(img.size)
