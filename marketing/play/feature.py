#!/usr/bin/env python3
"""Play feature graphic (1024x500): the Gemini mascot banner in
marketing/brand-art/raw/feature-gemini.png + the headline in Fredoka.

    python3 marketing/play/feature.py
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "marketing/brand-art/raw/feature-gemini.png"
OUT = ROOT / "marketing/play/out/graphics/feature-1024x500.png"
FONT = ROOT / "app/assets/fonts/PlusJakartaSans-ExtraBold.ttf"
NAVY = (42, 36, 86)
W, H = 1024, 500

img = Image.open(SRC).convert("RGB")
scale = max(W / img.width, H / img.height)  # cover, then centre-crop
img = img.resize((round(img.width * scale), round(img.height * scale)), Image.LANCZOS)
left, top = (img.width - W) // 2, (img.height - H) // 2
img = img.crop((left, top, left + W, top + H))
d = ImageDraw.Draw(img)
big = ImageFont.truetype(str(FONT), 64)
small = ImageFont.truetype(str(FONT.with_name("PlusJakartaSans-SemiBold.ttf")), 30)
x = 470
lines = [("Snap your food.", big), ("That’s it.", big), ("Calories counted while you eat.", small)]
y = 140
for text, font in lines:
    d.text((x, y), text, font=font, fill=NAVY)
    y += font.size + (22 if font is big else 0)
OUT.parent.mkdir(parents=True, exist_ok=True)
img.save(OUT)
print(OUT, img.size)
