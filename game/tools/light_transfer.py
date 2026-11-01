# light from a reference picture (lined up with the painting) moved onto the painting: per channel, the ratio of the two
# usage: python3 light_transfer.py <painting> <lined-up reference> <out.png> [blur]
# the night kiosk: align_ref.py, then warp_flow.py (smoothing 10), then this with blur 6
# blurred, so colour and light come from the reference and the drawing from the painting
import cv2, numpy as np, sys
E = cv2.imread(sys.argv[1], cv2.IMREAD_UNCHANGED).astype(np.float32) / 255
R = cv2.imread(sys.argv[2], cv2.IMREAD_UNCHANGED).astype(np.float32) / 255
out, sg = sys.argv[3], float(sys.argv[4]) if len(sys.argv) > 4 else 6
el, rl = E[..., :3] ** 2.2, R[..., :3] ** 2.2
m = ((E[..., 3] > .9) & (R[..., 3] > .9)).astype(np.float32)
m = cv2.erode(m, np.ones((5, 5), np.uint8))
def nblur(x, s):
    n = cv2.GaussianBlur(x * m[..., None], (0, 0), s); d = cv2.GaussianBlur(m, (0, 0), s)[..., None]
    return n / np.maximum(d, 1e-4), d
eps = .004
Y = lambda x: (x * [.0722, .7152, .2126]).sum(-1, keepdims=True)    # BGR order (cv2)
def gain(s):
    rb, d = nblur(rl, s); eb, _ = nblur(el, s)
    return (rb + eps) / (eb + eps), (Y(rb) + eps) / (Y(eb) + eps), d
# brightness follows the reference closely, its colour only over a wider area, so no coloured fringes at edges
_, Gy, d = gain(sg); Gc, Gyc, _ = gain(sg * 3)
G = Gy * (Gc / Gyc)
# where the reference has nothing (its edges, the strip under its bottom), the light of the wider surroundings
Gw, _, _ = gain(sg * 8)
k = np.clip(d / .5, 0, 1)
G = G * k + Gw * (1 - k)
night = np.clip(el * np.clip(G, 0, 8), 0, 1) ** (1 / 2.2)
o = np.dstack([night, E[..., 3:4]]) * 255
cv2.imwrite(out, o.round().astype(np.uint8))
