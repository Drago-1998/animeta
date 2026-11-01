# warp the moving picture onto the reference one with smoothed dense optical flow
# usage: python3 warp_flow.py <reference frame> <picture to move> <out.png> <preview.png> [smoothing] [--ref-alpha]
import cv2, numpy as np, sys
ref_p, mov_p, out_p, prev_p = sys.argv[1:5]
smooth = float(sys.argv[5]) if len(sys.argv) > 5 else 25
R = cv2.imread(ref_p, cv2.IMREAD_UNCHANGED); M = cv2.imread(mov_p, cv2.IMREAD_UNCHANGED)
def prep(im):
    g = cv2.cvtColor(im[..., :3], cv2.COLOR_BGR2GRAY)
    if im.shape[2] == 4: g = np.where(im[..., 3] > 128, g, 128).astype(np.uint8)
    g = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8)).apply(g)
    return g
r, m = prep(R), prep(M)
dis = cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_ULTRAFAST)
dis.setFinestScale(1); dis.setPatchSize(16); dis.setPatchStride(4); dis.setGradientDescentIterations(25)
dis.setVariationalRefinementIterations(5); dis.setVariationalRefinementAlpha(40)
flow = dis.calc(r, m, None)          # for each ref pixel, where it is in the moving one
# only the painted part of the reference counts: inside the window there is nothing to follow
valid = (R[..., 3] > 128).astype(np.float32) if R.shape[2] == 4 else np.ones(r.shape, np.float32)
valid = cv2.erode(valid, np.ones((9, 9), np.uint8))
num = cv2.GaussianBlur(flow * valid[..., None], (0, 0), smooth); den = cv2.GaussianBlur(valid, (0, 0), smooth)[..., None]
flow = num / np.maximum(den, 1e-3)
# where there is no painting for far around (the middle of the window), fill from wider around
num2 = cv2.GaussianBlur(flow * valid[..., None], (0, 0), smooth * 6); den2 = cv2.GaussianBlur(valid, (0, 0), smooth * 6)[..., None]
wide = num2 / np.maximum(den2, 1e-3); k = np.clip(den / .3, 0, 1)
flow = (flow * k + wide * (1 - k)).astype(np.float32)
h, w = r.shape; gx, gy = np.meshgrid(np.arange(w, dtype=np.float32), np.arange(h, dtype=np.float32))
W = cv2.remap(M, gx + flow[..., 0], gy + flow[..., 1], cv2.INTER_CUBIC, borderMode=cv2.BORDER_REFLECT)
if R.shape[2] == 4 and '--ref-alpha' in sys.argv:
    # the window is cut where the reference has it, so its edges stay straight; colour where the moving picture had its
    # hole and the reference has wood comes from the nearest wood
    a = W[..., 3] > 128; need = (R[..., 3] > 128) & ~a
    col = W[..., :3].astype(np.float32) * a[..., None]; wt = a.astype(np.float32)
    for sg in (3, 8, 20):
        c2 = cv2.GaussianBlur(col, (0, 0), sg); w2 = cv2.GaussianBlur(wt, (0, 0), sg)[..., None]
        fill = need & (w2[..., 0] > .05); W[..., :3][fill] = (c2 / np.maximum(w2, 1e-3))[fill].astype(np.uint8); need &= ~fill
    W[..., 3] = R[..., 3]
cv2.imwrite(out_p, W)
if R.shape[2] == 4: print('alpha mismatch px', int(((R[..., 3] > 128) != (W[..., 3] > 128)).sum()))
mag = np.hypot(flow[..., 0], flow[..., 1]); print('flow px: mean %.1f max %.1f' % (mag.mean(), mag.max()))
# 50/50 preview before | after
def comp(a):
    a = a.astype(float); al = a[..., 3:4] / 255 if a.shape[2] == 4 else 1
    return a[..., :3] * al + np.array([255, 0, 255]) * (1 - al)
pv = np.hstack([(comp(R) + comp(M)) / 2, (comp(R) + comp(W)) / 2]).astype(np.uint8)
cv2.imwrite(prev_p, pv)
