#!/usr/bin/env python3
"""
Cut a soft-3D render off its white background and drop it into the app.

    python3 marketing/brand-art/cutout.py raw/avocado.png            # → app/assets/art/avocado.png
    python3 marketing/brand-art/cutout.py raw/*.png --size 1024

The renders come from Gemini (prompts in marketing/brand-art/PROMPTS.md) on a
flat white background with no shadow. The background is flood-filled from the
corners, so white highlights inside the object survive; the edge gets a
one-pixel erosion and a soft blur so no white halo is left. Output is a
trimmed, padded, square PNG with alpha. Pillow only.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = ROOT / "app" / "assets" / "art"


def cutout(src: Path, size: int) -> Image.Image:
    rgb = Image.open(src).convert("RGB")
    px = np.asarray(rgb).astype(np.int16)
    # near-white pixels, then only the component(s) that touch the border
    white = (px.min(axis=2) >= 232) & ((px.max(axis=2) - px.min(axis=2)) <= 14)
    labels, _ = ndimage.label(white)
    edge = np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))
    bg = np.isin(labels, edge[edge != 0])
    alpha = Image.fromarray(np.where(bg, 0, 255).astype(np.uint8))
    alpha = alpha.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1.1))
    out = rgb.copy()
    out.putalpha(alpha)
    bbox = alpha.point(lambda v: 255 if v > 10 else 0).getbbox()
    if not bbox:
        raise SystemExit(f"{src}: nothing left after keying")
    out = out.crop(bbox)
    side = int(max(out.size) * 1.08)
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(out, ((side - out.width) // 2, (side - out.height) // 2), out)
    return canvas.resize((size, size), Image.LANCZOS)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("files", nargs="+")
    ap.add_argument("--size", type=int, default=768)
    ap.add_argument("--out", default=str(OUT_DIR))
    a = ap.parse_args()
    out_dir = Path(a.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    for f in a.files:
        src = Path(f)
        name = src.stem.removeprefix("raw-")
        dst = out_dir / f"{name}.png"
        cutout(src, a.size).save(dst, optimize=True)
        print(dst, dst.stat().st_size // 1024, "KB")


if __name__ == "__main__":
    main()
