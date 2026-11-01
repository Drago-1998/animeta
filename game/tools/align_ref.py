# line the reference night picture up with the evening painting: features + RANSAC affine, then a smooth flow
# usage: python3 align_ref.py <painting> <reference> <out.png>  — the reference moved onto the painting (features + affine)
import cv2, numpy as np, sys
E = cv2.imread(sys.argv[1], cv2.IMREAD_UNCHANGED); R = cv2.imread(sys.argv[2], cv2.IMREAD_UNCHANGED); out = sys.argv[3]
def gray(im):
    g = cv2.cvtColor(im[..., :3], cv2.COLOR_BGR2GRAY); g = np.where(im[..., 3] > 128, g, 0).astype(np.uint8)
    return cv2.createCLAHE(3.0, (8, 8)).apply(g)
ge, gr = gray(E), gray(R)
sift = cv2.SIFT_create(6000)
ke, de = sift.detectAndCompute(ge, (E[..., 3] > 128).astype(np.uint8))
kr, dr = sift.detectAndCompute(gr, (R[..., 3] > 128).astype(np.uint8))
m = cv2.BFMatcher().knnMatch(dr, de, k=2)
good = [a for a, b in m if a.distance < .75 * b.distance]
src = np.float32([kr[a.queryIdx].pt for a in good]); dst = np.float32([ke[a.trainIdx].pt for a in good])
A, inl = cv2.estimateAffine2D(src, dst, ransacReprojThreshold=6, maxIters=20000)
print('matches', len(good), 'inliers', int(inl.sum()), '\n', A.round(4))
h, w = E.shape[:2]
Rw = cv2.warpAffine(R, A, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0, 0))
cv2.imwrite(out, Rw)
