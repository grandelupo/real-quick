#!/usr/bin/env python3
"""Play feature graphic (1024×500): the clay objects from app/assets/art on
the blush gradient, headline in Plus Jakarta Sans.

    python3 marketing/play/feature.py
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[2]
ART = ROOT / "app/assets/art"
OUT = ROOT / "marketing/play/out/graphics/feature-1024x500.png"
FONTS = ROOT / "app/assets/fonts"
NAVY = (43, 35, 80)
W, H = 1024, 500


def gradient(w: int, h: int, a: tuple, b: tuple) -> Image.Image:
    img = Image.new("RGB", (w, h))
    px = img.load()
    for y in range(h):
        for x in range(w):
            k = (x / w * 0.6 + y / h * 0.4)
            px[x, y] = tuple(int(a[i] + (b[i] - a[i]) * k) for i in range(3))
    return img


def place(canvas: Image.Image, name: str, size: int, x: int, y: int) -> None:
    obj = Image.open(ART / f"{name}.png").convert("RGBA").resize((size, size), Image.LANCZOS)
    # soft contact shadow
    sh = Image.new("RGBA", (size * 2, size), (0, 0, 0, 0))
    ImageDraw.Draw(sh).ellipse((size * 0.7, size * 0.4, size * 1.3, size * 0.6), fill=(43, 35, 80, 70))
    sh = sh.filter(ImageFilter.GaussianBlur(size * 0.09))
    canvas.alpha_composite(sh, (x - size // 2, y + int(size * 0.42)))
    canvas.alpha_composite(obj, (x, y))


img = gradient(W, H, (255, 220, 229), (255, 184, 202)).convert("RGBA")
place(img, "strawberry", 300, 110, 95)
place(img, "avocado", 150, 20, 300)
place(img, "blueberries", 140, 330, 320)
d = ImageDraw.Draw(img)
big = ImageFont.truetype(str(FONTS / "PlusJakartaSans-ExtraBold.ttf"), 64)
small = ImageFont.truetype(str(FONTS / "PlusJakartaSans-SemiBold.ttf"), 28)
x, y = 500, 150
for text, font, gap in (("Snap your food.", big, 78), ("That’s it.", big, 98), ("Calories counted while you eat.", small, 0)):
    d.text((x, y), text, font=font, fill=NAVY)
    y += gap
OUT.parent.mkdir(parents=True, exist_ok=True)
img.convert("RGB").save(OUT)
print(OUT, img.size)
