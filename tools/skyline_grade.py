# Colour-grade the skyline matte so it sits in the 3D scene's sky/canopy instead of looking like a pale pasted photo.
# usage: python3 tools/skyline_grade.py tools/skyline_orig_backup.png public/textures/skyline.png
import sys, numpy as np
from PIL import Image
src, out = sys.argv[1], sys.argv[2]
im = np.asarray(Image.open(src).convert('RGBA')).astype(np.float32)
rgb, a = im[..., :3], im[..., 3] / 255
H, W, _ = rgb.shape
# 1. dehaze: remove the milky veil (buildings darker, more contrast, a touch cooler)
A = np.array([226, 220, 208], np.float32); t = 0.9
rgb = np.clip(A + (rgb - A) / t, 0, 255)
rgb = 128 + (rgb - 128) * 1.0
# 2. partial-alpha fringe near the roofs: photo sky -> the scene's sky colour (left cool grey-blue, right warm)
x = np.linspace(0, 1, W)[None, :, None]
skyL, skyR = np.array([168, 174, 180], np.float32), np.array([228, 212, 184], np.float32)
sky = skyL + (skyR - skyL) * np.clip((x - 0.25) / 0.6, 0, 1)
y = np.linspace(0, 1, H)[:, None, None]
fr = (1 - a[..., None]) * np.clip((0.75 - y) / 0.2, 0, 1)
rgb = rgb * (1 - fr) + sky * fr
# 3. bottom fade: go to the dark canopy colour, not white haze
canopy = np.array([66, 76, 66], np.float32)
b = np.clip((y - 0.55) / 0.45, 0, 1) ** 1.3 * 0.85
rgb = rgb * (1 - b) + canopy * b
Image.fromarray(np.dstack([rgb, a * 255]).clip(0, 255).astype(np.uint8), 'RGBA').save(out, optimize=True)
