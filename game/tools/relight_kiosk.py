# the day and night kiosk from the evening one: the same painting in another light, so the three line up exactly
# usage: python3 relight_kiosk.py <evening kiosk picture> <output folder>  → kiosk_day.webp and kiosk_night.webp (and .png previews)
import numpy as np, cv2, sys
from PIL import Image
src_p, out_dir = sys.argv[1], sys.argv[2]
S = np.array(Image.open(src_p).convert('RGBA')).astype(np.float32) / 255
rgb, A = S[..., :3], S[..., 3]
lin = rgb ** 2.2
H, W = A.shape
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
lum = lambda x: (x * [.2126, .7152, .0722]).sum(-1, keepdims=True)
def blur(m, s): return cv2.GaussianBlur(m.astype(np.float32), (0, 0), s)
def tone(x, white=1.6):           # soft shoulder instead of a hard clip
    return x * (1 + x / white ** 2) / (1 + x)
def out(x, name):
    x = np.clip(x, 0, 1) ** (1 / 2.2)
    im = np.dstack([x, A[..., None]]) * 255
    Image.fromarray(im.round().astype(np.uint8), 'RGBA').save(f'{out_dir}/{name}.webp', quality=92, method=6)
    Image.fromarray(im.round().astype(np.uint8), 'RGBA').save(f'{out_dir}/{name}.png')

# where the light comes in: the window opening (its bottom edge is the sill), and the lamp in the top left corner
hole = (A < .5).astype(np.float32)
hole[:200] = 0
win_glow = blur(hole, 60)                        # near the window
below = np.clip((yy - 950) / 1, 0, 1) * np.exp(-np.clip(yy - 950, 0, None) / 380) * np.exp(-((xx - 480) / 420) ** 4)
bulb = np.array([40, 205], np.float32)
dx, dy = xx - bulb[0], yy - bulb[1]; d = np.hypot(dx, dy) + 1
axis = np.array([.55, .835]); cone = np.clip((dx * axis[0] + dy * axis[1]) / d, 0, 1) ** 1.5
lamp_light = cone * np.exp(-(d / 430) ** 2)
lamp_self = blur(((xx < 150) & (yy > 60) & (yy < 250) & ((xx - 60) ** 2 / 95 ** 2 + (yy - 215) ** 2 / 45 ** 2 < 1)).astype(np.float32), 6)

# DAY: neutral daylight, brighter, sun through the window onto the sill and the desk
day = lin * np.array([.76, .97, 1.4]) * 2.0
day = day * (1 + .5 * below[..., None] + .2 * win_glow[..., None])
day = tone(day)
g = lum(day); day = g + (day - g) * .85
out(day, 'kiosk_day')

# NIGHT: a dark blue room; the lamp lights its corner warm; the street lights glow a little through the window
g = lum(lin); grey = g + (lin - g) * .3
amb = grey * np.array([.095, .15, .30])
lamp = lin * np.array([1.0, .8, .52]) * (2.5 * lamp_light[..., None])
street = lin * np.array([.62, .55, .5]) * (.28 * below[..., None] * np.exp(-np.clip(yy - 950, 0, None) / 160)[..., None] + .12 * win_glow[..., None])
night = amb + lamp + street
night = night * (1 - lamp_self[..., None]) + lin * 1.05 * lamp_self[..., None]
night = tone(night)
out(night, 'kiosk_night')
