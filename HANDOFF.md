# Real Quick — handoff

State on 27 Oct 2026, after the redesign (soft-clay look, Plus Jakarta Sans,
one soft-3D object per weekday, the 3D forest, live sharing, 3 free days —
see `marketing/brand.md` and `CLAUDE.md`).

## Done

- **Gateway** live at `https://realquick.lab.karolkrakowski.pl` (VPS port
  8099, `server/deploy.sh --key`), model Opus 5.5, `/healthz` ok. It enforces
  the 3 free days per install (`installs.json`) and hosts the live share
  pages (`/s/<token>`, `shares.json`); Caddy routes `/s/*` to it.
- **Legal pages** on karolkrakowski.pl (`apps/real-quick/privacy.htm`,
  `support.htm`), **product site** + waitlist record, **Play feature
  graphic** and 512 icon (`marketing/play/out/graphics/`).
- **App Store Connect** (app id 6827108476), all through
  `marketing/appstore/asc-setup.py`: free price, 175 territories, category,
  copyright, en-US + ja listing, review contact and notes, both
  subscriptions (group *Real Quick Pro*, prices in every territory — US
  $4.99 / $29.99, Japan ¥800 / ¥5,000 — **no intro trial**, review
  screenshots), age rating 4+. Screenshots: `asc-setup.py shots`.
- **Builds**: 1 (first look), 2 (redesign), 3 (forest, sharing, free days;
  crashed on launch — expo-gl lacks two WebGL methods three calls), 4 (no
  crash, but no forest and no day swipe), 5 (forest draws, swipe and camera
  zoom fixed; forest only two thirds wide, roll dived into the ground),
  6 (full-width forest, roll about the planet's centre), 7 (no flash on the
  day change, short/quick swipes go through, trees above the chips), 8
  (photo thumbnails survive app updates), 9 (the snap button no longer
  shrinks to an icon), 10 (daily mascot intro in the ring; smooth clay
  forest), 11 (trees with real branches and leaves, swipe up turns the
  globe away, swipes no longer misread their direction), 12 (plain
  paywall with a coupon field, month view from the date, rubber band at
  the first and last day), 13 (the forest fades in once drawn), 14 (sheets scroll only when they must, a moon at night), 15 (a real dark night page, night look off by default and offered after five late snacks, taller forest band, expo-updates for OTA fixes) uploaded with `xcodebuild archive` + `-exportArchive`
  (`app/ios/build/ship/export.plist`); the archive signs through the Xcode
  account, team H85T7F9AS6, the upload uses the ASC API key (see
  `CLAUDE.md`). Both targets carry the App Group.

## Before "Submit for Review"

1. **Anthropic credits.** The key in `app-builder/.env` is out of credit;
   every count answers `upstream`. App Review will snap a plate. Top up,
   then check: a typed meal through `/v1/analyze` returns items.
2. **App Privacy** answers in App Store Connect — not in the API. Fill from
   `marketing/appstore/app-privacy.md`.
3. Build 15 is attached to 1.0; submit with
   `app-builder/.venv/bin/python app-builder/asc.py submit com.latovi.realquick`.

## Then

- **Pick the model** (`/etc/realquick/gateway.env`, `MODEL=`, restart the
  service). Opus 5.5 ships; Haiku 5.5 is ~40× cheaper and matters at ~10
  photos a day per Pro user. `server/eval.py` compares them on your own
  weighed meals.
- **Google Play**: see `marketing/play/listing.md`; build with
  `npx eas-cli build -p android --profile production`; receipt verification
  needs a service-account JSON on the VPS (`GOOGLE_SERVICE_ACCOUNT_FILE`).
- **Verify on devices**: snap, the forest (tilt, wind, growth over a day,
  overgrowth past the goal, night), Lock Screen *Snap* widget and the iOS 18
  control, Today widget, live sharing from Settings or the share button, a
  sandbox purchase on day 4 (set the phone's date forward).
- **Portfolio**: `python3 app-builder/portfolio.py real-quick` and
  `marketing/portfolio.sql` once the app is live (needs the store link).

## Not done, honestly

- iOS has no camera-from-a-locked-phone mode (needs a LockedCameraCapture
  extension written natively — v1.1). iOS cannot close itself after a widget
  snap; Android does.
- Android has not been built on this machine (no SDK); EAS builds it.
- The web preview and the store captures are the real app rendered with
  react-native-web (the forest included, via WebGL); the native build was
  compiled and archived but not run on a device by me — the forest's frame
  rate and the tilt parallax are the two things to feel on a phone first.
