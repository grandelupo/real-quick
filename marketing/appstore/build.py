#!/usr/bin/env python3
"""App Store screenshot composer — the single-look ad system (BLUEPRINT.md §2).

TEMPLATE: copy to <repo>/marketing/appstore/build.py and fill in the two
UPPERCASE blocks below — the brand gradient and the frames. Everything else is
fixed by the blueprint: one gradient, one white rounded headline, one device
mockup, nothing else on the frame.

Raw captures come from the UI-test capture pass, so they are reproducible
after any wording change:

    xcrun simctl boot "<6.9-inch device>"
    xcrun simctl status_bar "<6.9-inch device>" override --time 9:41 \
      --batteryState charged --batteryLevel 100 --cellularBars 4 --wifiBars 3
    xcodebuild test -project <App>.xcodeproj -scheme <App> \
      -destination 'platform=iOS Simulator,name=<6.9-inch device>' \
      -only-testing:<App>UITests/<App>UITests/testCaptureStoreScreens \
      -resultBundlePath out.xcresult
    xcrun xcresulttool export attachments --path out.xcresult \
      --output-path /tmp/shots      # then copy the named PNGs into raw/

If a screen needs history to look alive, seed the simulator with real records
first (see the reference app's marketing/appstore/seed-demo-data.py).

Then compose:

    python3 marketing/appstore/build.py

Output lands in out/en-US/. Only the standard library + Google Chrome.
"""

import base64
import pathlib
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parent
RAW = ROOT / "raw"
OUT = ROOT / "out"
CHROME = next(
    (p for p in [
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        *sorted(pathlib.Path("/opt/pw-browsers").glob("chromium-*/chrome-linux*/chrome")),
    ] if pathlib.Path(p).exists()),
    "chromium",
)
# Real Quick's display face (BRAND: Plus Jakarta Sans), embedded — not SF Rounded.
FONT = ROOT.parent.parent / "app" / "assets" / "fonts" / "PlusJakartaSans-Bold.ttf"

# ---------------------------------------------------------------- FILL IN ---
# The brand gradient: a radial glow over a vertical wash, both drawn from the
# app's accent colour. Dark, saturated frames read best in the store grid.
GLOW = "#FFB8CA"        # blush glow at the top (the icon's background)
GRADIENT_TOP = "#EC5A8C"     # bubblegum
GRADIENT_BOTTOM = "#2B2350"  # the ink navy

# One frame = (capture in raw/, headline). Headlines are benefits in the
# user's words, sentence case, six words or fewer. Frame 1 carries the core
# promise — the same one the onboarding hook makes; the rest are one proof
# each. 3–5 frames.
FRAMES = {
    "en-US": [
        ("01-home.png", "Snap your food. That’s it."),
        ("02-notes.png", "Fix or type anything, instantly"),
        ("03-yesterday.png", "A new colour every day"),
        ("04-night.png", "Soft and calm after dark"),
        ("05-settings.png", "Estimates that lean your way"),
    ],
    "ja": [
        ("01-home.png", "撮るだけで、カロリー記録。"),
        ("02-notes.png", "入力も修正も、すぐに。"),
        ("03-yesterday.png", "毎日ちがう色で楽しく"),
        ("04-night.png", "夜はやさしいナイトモード"),
        ("05-settings.png", "見積もりはあなた好みに"),
    ],
}

# Captures come from the web build (capture.js) without OS chrome; this is
# the canonical 9:41 status bar the simulator override would force.
STATUS_BAR = """<div style="height:{h}px;display:flex;align-items:center;justify-content:space-between;
  padding:14px 70px 0 92px;font:600 46px -apple-system,'SF Pro Text','Inter','Helvetica',sans-serif;color:#000;background:{bg}">
  <span>9:41</span>
  <svg width="190" height="36" viewBox="0 0 190 36"><g fill="#000">
    <rect x="0" y="24" width="8" height="12" rx="2"/><rect x="12" y="17" width="8" height="19" rx="2"/>
    <rect x="24" y="9" width="8" height="27" rx="2"/><rect x="36" y="1" width="8" height="35" rx="2"/>
    <path d="M78 34l-6-7a10 10 0 0 1 12 0zM66 20a18 18 0 0 1 24 0l-3.5 4a12.5 12.5 0 0 0-17 0zM60 13a27 27 0 0 1 36 0l-3.5 4a21.5 21.5 0 0 0-29 0z"/>
    <rect x="112" y="4" width="66" height="30" rx="9" fill="none" stroke="#000" stroke-width="3" opacity="0.45"/>
    <rect x="117" y="9" width="56" height="20" rx="5"/><rect x="181" y="13" width="5" height="12" rx="2" opacity="0.45"/>
  </g></svg></div>"""
# ---------------------------------------------------------------------------

# One slot: 6.9" iPhone. Apps are iPhone-only (BLUEPRINT.md §6), so this is
# the only set App Store Connect requires; Apple downscales it for the rest.
SLOT = dict(
    canvas=(1320, 2868), device_width=1052, pad=18,
    outer_radius=168, inner_radius=150, h1=116, h1_top=148,
)
# `--play`: Google Play phone slot — Play caps the aspect ratio at 2:1.
if "--play" in sys.argv:
    SLOT = dict(
        canvas=(1080, 2160), device_width=700, pad=12,
        outer_radius=112, inner_radius=100, h1=84, h1_top=96,
    )
    OUT = ROOT.parent / "play" / "out"

PAGE = """<!doctype html>
<meta charset="utf-8">
<style>
  @font-face {{
    font-family: "Brand";
    src: url(data:font/ttf;base64,{font}) format("truetype");
  }}
  * {{ margin: 0; padding: 0; }}
  body {{
    width: {w}px; height: {h}px; overflow: hidden;
    display: flex; flex-direction: column; align-items: center;
    background:
      radial-gradient({glow_w}px {glow_h}px at 50% -12%, {glow} 0%, transparent 62%),
      linear-gradient(180deg, {top} 0%, {bottom} 100%);
  }}
  h1 {{
    font-family: "Brand", -apple-system, sans-serif;
    
    font-size: {h1}px; line-height: 1.09; letter-spacing: -0.022em;
    color: #FFFFFF; text-align: center;
    margin: {h1_top}px 80px 0;
    text-wrap: balance;
  }}
  .device {{
    margin: auto 0;
    width: {device_width}px; padding: {pad}px;
    background: #0B0B0C; border-radius: {outer_radius}px;
    box-shadow: 0 70px 140px rgba(0, 0, 0, 0.5),
                0 20px 45px rgba(0, 0, 0, 0.35);
  }}
  .device .screen {{ border-radius: {inner_radius}px; overflow: hidden; background: #fff; }}
  .device img {{ display: block; width: 100%; }}
</style>
<body>
  <h1>{headline}</h1>
  <div class="device"><div class="screen">{status}<img src="data:image/png;base64,{shot}"></div></div>
</body>
"""


def b64(path: pathlib.Path) -> str:
    return base64.b64encode(path.read_bytes()).decode()


REVIEW_PAGE = """<!doctype html><meta charset="utf-8">
<style>* {{ margin: 0; padding: 0; }} body {{ width: 1320px; height: 2868px; overflow: hidden; background: #fff; }} img {{ display: block; width: 1320px; }}</style>
<body>{status}<img src="data:image/png;base64,{shot}"></body>"""


def review_screenshot() -> None:
    """subscription-review.png: the raw paywall capture (1320×2706) under the
    status bar, so it is exactly the 6.9" size App Store Connect accepts."""
    raw = ROOT / "subscription-review.png"
    if not raw.exists() or "--play" in sys.argv:
        return
    html = REVIEW_PAGE.format(status=STATUS_BAR.format(h=162, bg="#FBFAF8").replace("46px", "58px"), shot=b64(raw))
    with tempfile.NamedTemporaryFile("w", suffix=".html", delete=False) as f:
        f.write(html)
        page = f.name
    subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-sandbox", "--force-device-scale-factor=1", f"--user-data-dir={tempfile.mkdtemp()}",
                    "--window-size=1320,2868", f"--screenshot={raw}", f"file://{page}"], check=False, capture_output=True)
    pathlib.Path(page).unlink()
    print("subscription-review.png  ←  padded to 1320×2868")


def main() -> None:
    font = b64(pathlib.Path(FONT))
    width, height = SLOT["canvas"]
    for locale, frames in FRAMES.items():
        target_dir = OUT / locale
        target_dir.mkdir(parents=True, exist_ok=True)
        for index, (raw_name, headline) in enumerate(frames, start=1):
            raw = RAW / locale / raw_name
            if not raw.exists():
                sys.exit(f"missing capture: {raw}\nRun capture.js first — see its header.")
            bg = "#FBFAF8" if "night" in raw_name else "transparent"
            html = PAGE.format(
                w=width, h=height, font=font, headline=headline, shot=b64(raw),
                status=STATUS_BAR.format(h=int(SLOT["device_width"] * 54 / 440), bg=bg).replace("46px", f"{int(SLOT['device_width'] * 46 / 1052)}px"),
                glow=GLOW, top=GRADIENT_TOP, bottom=GRADIENT_BOTTOM,
                glow_w=width + 100, glow_h=int(height * 0.32),
                device_width=SLOT["device_width"], pad=SLOT["pad"],
                outer_radius=SLOT["outer_radius"], inner_radius=SLOT["inner_radius"],
                h1=SLOT["h1"], h1_top=SLOT["h1_top"],
            )
            with tempfile.NamedTemporaryFile("w", suffix=".html", delete=False) as f:
                f.write(html)
                page = f.name
            target = target_dir / f"{index:02d}.png"
            subprocess.run(
                [CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-sandbox",
                 "--force-device-scale-factor=1", f"--user-data-dir={tempfile.mkdtemp()}",
                 f"--window-size={width},{height}",
                 f"--screenshot={target}", f"file://{page}"],
                check=False, capture_output=True,  # headless Chrome may crash on teardown after writing the file
            )
            pathlib.Path(page).unlink()
            if not target.exists():
                sys.exit(f"Chrome wrote no screenshot for {raw_name}")
            print(f"{target.relative_to(ROOT.parent)}  ←  {raw_name}  “{headline}”")
    review_screenshot()


if __name__ == "__main__":
    main()
