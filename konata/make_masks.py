"""Cut Konata out of the mid shots by hair colour -> soft RGBA mattes (960x540)."""
import numpy as np, sys
from PIL import Image, ImageFilter
from collections import deque
A, B = int(sys.argv[1]), int(sys.argv[2])
for n in range(A, B + 1):
    im = Image.open(f'frames/{n:04d}.jpg').convert('RGB').resize((480, 270), Image.BILINEAR)
    hsv = np.asarray(im.convert('HSV')).astype(np.float32)
    h = hsv[..., 0] * 360 / 255; s = hsv[..., 1] / 255; v = hsv[..., 2] / 255
    m = (h > 205) & (h < 245) & (s > 0.5) & (v > 0.28)
    m = np.asarray(Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(3))) > 0
    # largest connected component
    H, W = m.shape; lab = np.zeros((H, W), np.int32); best, bl, cur = 0, 0, 0
    for y in range(H):
        for x in range(W):
            if m[y, x] and not lab[y, x]:
                cur += 1; q = deque([(y, x)]); lab[y, x] = cur; c = 0
                while q:
                    yy, xx = q.popleft(); c += 1
                    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        ny, nx = yy + dy, xx + dx
                        if 0 <= ny < H and 0 <= nx < W and m[ny, nx] and not lab[ny, nx]:
                            lab[ny, nx] = cur; q.append((ny, nx))
                if c > best: best, bl = c, cur
    k = lab == bl
    # column fill: everything below the hair outline is character (she fills the lower frame)
    out = np.zeros_like(k)
    cols = np.nonzero(k.any(0))[0]
    for x in cols:
        ys = np.nonzero(k[:, x])[0]
        if ys[-1] - ys[0] > 6 or ys[0] < H * 0.45: out[ys[0]:, x] = True
    # close small gaps horizontally
    out = np.asarray(Image.fromarray((out * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(7)).filter(ImageFilter.MinFilter(7))) > 0
    a = Image.fromarray((out * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.GaussianBlur(1.2)).resize((960, 540), Image.BILINEAR)
    rgba = Image.new('RGBA', (960, 540), (255, 255, 255, 0)); rgba.putalpha(a)
    rgba.save(f'masks/{n:04d}.png')
print('masks', A, B)
