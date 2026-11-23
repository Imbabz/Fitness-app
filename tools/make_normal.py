"""Carte de normales d'une image peinte, à la manière de Laigter / SpriteIlluminator.

Le relief vient de deux sources :
  - la transparence, floutée à trois échelles : les bords s'arrondissent, le
    cœur de la forme se bombe (c'est le « volume » d'un dessin plat) ;
  - la luminosité, un peu : les zones claires avancent, les sombres reculent,
    ce qui donne du modelé à l'intérieur de la forme (plis, bûches, branches).
La pente de ce relief donne la normale. Sortie : RGB = normale, A = alpha.
"""
import sys
import numpy as np
from PIL import Image

def box(a, r):
    if r < 1:
        return a
    k = 2 * r + 1
    p = np.pad(a, r, mode='edge')
    c = np.cumsum(np.cumsum(p, 0), 1)
    c = np.pad(c, ((1, 0), (1, 0)))
    return (c[k:, k:] - c[:-k, k:] - c[k:, :-k] + c[:-k, :-k]) / (k * k)

def blur(a, r):  # trois passes de boîte ≈ une gaussienne
    for _ in range(3):
        a = box(a, max(1, r // 2))
    return a

src, dst = sys.argv[1], sys.argv[2]
strength = float(sys.argv[3]) if len(sys.argv) > 3 else 5.0
im = np.asarray(Image.open(src).convert('RGBA')).astype(np.float32) / 255.0
rgb, a = im[..., :3], im[..., 3]
m = min(a.shape)
h = 0.5 * blur(a, int(m * 0.02)) + 0.3 * blur(a, int(m * 0.05)) + 0.2 * blur(a, int(m * 0.11))
lum = rgb @ np.array([0.299, 0.587, 0.114], np.float32)
lum = blur(lum, 2)
h = h + 0.22 * (lum - lum[a > 0.5].mean() if (a > 0.5).any() else 0) * a
gy, gx = np.gradient(h)
n = np.dstack([-gx * strength * 10, gy * strength * 10, np.ones_like(h)])
n /= np.linalg.norm(n, axis=2, keepdims=True)
out = np.dstack([(n * 0.5 + 0.5), a])
Image.fromarray((out * 255).clip(0, 255).astype(np.uint8), 'RGBA').save(dst, quality=90)
print(dst, im.shape[1], 'x', im.shape[0])
