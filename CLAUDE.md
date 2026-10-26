# Read this first

This project follows the standing app blueprint in `app-builder/` (clone
`grandelupo/app-builder` next to this repo). Read `app-builder/BLUEPRINT.md`,
`APP-STORE.md`, `BACKEND.md` (→ *Model gateway*), `BRAND.md` and
`WEBSITE.md` before changing anything. Where this file and the blueprint
disagree, **this file wins** — every deviation below was asked for in the
brief and is deliberate.

## Documented deviations from BLUEPRINT

| Blueprint default | Real Quick | Why |
|---|---|---|
| Native SwiftUI, iPhone-only | **Expo SDK 57 (React Native), iOS + Android**, still iPhone-only on iOS (`plugins/with-iphone-only.js`) | Brief: "both Android and iOS – use Expo" |
| Native components, system light/dark | **Fully branded UI** (Plus Jakarta Sans, soft-clay surfaces, one soft-3D object per weekday, pastel gradients); follows the clock (off-white night look 20:00–05:59) instead of system appearance | Brief: "I don't want native UI … branded and fun"; Karol's review: refined, no bounces, no emoji |
| 12–25 screen quiz funnel | **5 short screens** that collect real settings (goal, estimate bias, camera) + a 3-tip tour, then a soft paywall | Brief: "don't make complicated onboarding" |
| TipKit tooltips | On-screen hints on today's page for the first snaps + a visible notes tab | No TipKit in RN; hints fade out after 4 snaps |
| Unlimited free tier | **3 free days**, then everything behind Pro (gateway-enforced per install); no store trial | Every count has model cost (BLUEPRINT §4); Karol, 27 Oct 2026 |
| Zero third-party deps | Expo modules + reanimated/gesture-handler/svg, `expo-iap`, `@bacons/apple-targets`, `react-native-android-widget`, `expo-gl` + `three` + `expo-sensors` for the forest | Each justified in `marketing/appstore/app-privacy.md` |
| `xcodebuild` UI tests + simulator capture pass | Jest engine/i18n tests; store captures from the web build of the same code (`marketing/appstore/capture.js`) | Expo project; no Mac in the cloud build session |

## Layout

```
app/                  Expo app (CNG: ios/ and android/ are generated, never committed)
  src/engine/         pure logic + Jest tests (nutrition, days, local food table, validation)
  src/                store, gateway client, analysis queue, photos, i18n (en + ja), IAP
  src/components/     day page, capture bar, notebook food list, macro chips, sheets, paywall, share sheet
  src/forest/         the 3D forest (expo-gl + three, procedural): scene.ts, Forest.tsx
  src/share.ts        live sharing: pushes day summaries to the gateway while on
  src/widgets/        widget snapshot + Android widgets (react-native-android-widget)
  targets/widget/     iOS WidgetKit extension (Swift) via @bacons/apple-targets
  plugins/            config plugins (iPhone-only)
  RealQuick.storekit  StoreKit test configuration (select it in the Xcode scheme)
server/               model gateway (Python): gateway.py, tests, deploy kit, eval.py
marketing/            brand sheet, App Store + Play listings, privacy audit, hosted
                      pages (web/), product site (site/), screenshots, portfolio
HANDOFF.md            what only Karol can do, step by step + image prompts
```

## Commands

```bash
cd app
npm test                 # engine + i18n (Jest)
npm run typecheck
npx expo-doctor
npx expo start --web     # quickest visual check (mock products, no camera in headless)
                         # with CI=1 the server does NOT watch files — restart it after edits
npx expo prebuild --clean && npx expo run:ios   # dev build on the "Upbell Capture" simulator
cd ../server && python3 -m unittest test_gateway -v
PROVIDER=fake PORT=8787 STATE_FILE=/tmp/rq.json python3 gateway.py   # local gateway, no key
EXPO_PUBLIC_GATEWAY_URL=http://localhost:8787 npx expo start          # point the app at it
```

If a build fails with `'hermes/hermes.h' file not found` (ExpoModulesJSI or
RNWorklets), `ios/Pods/hermes-engine/destroot/include/` has been emptied —
it happened here when the disk filled up mid-extraction. Restore it from the
cached tarball: `tar -xzf ~/Library/Caches/ReactNative/hermes-ios-*-release.tar.gz
-C ios/Pods/hermes-engine --include 'destroot/include/*'` (or `pod install` after
deleting `ios/Pods/hermes-engine`). Xcode's run-script phases find `node`
through `ios/.xcode.env.local` (`export NODE_BINARY=/usr/local/bin/node`).

Shipping a new build: bump `expo.ios.buildNumber` in `app.json` **and** the
`CFBundleVersion` Expo wrote into `ios/RealQuick/Info.plist` and the widget's
Info.plist (prebuild rewrites them; between prebuilds use PlistBuddy) — passing
`CURRENT_PROJECT_VERSION` to xcodebuild alone is not enough, App Store Connect
checks the plist. Then archive + `-exportArchive` with
`ios/build/ship/export.plist`, wait for the build to be VALID, and
`asc.py version attach-build com.latovi.realquick --build N`.

Simulators: use the single existing iOS simulator ("Upbell Capture"); never
create simulators or Android emulators (see app-builder/CLAUDE.md). Android is
verified on a real device or via EAS.

## Rules that keep it working

- The engine owns every number; the model only names foods and estimates
  portions (`engine/validate.ts` sanitises its answer).
- Wire error codes in `server/gateway.py` (`ERROR_CODES`) must equal
  `KNOWN` in `app/src/api.ts`; `test_gateway.py` fails otherwise.
- The prompt, the model and the provider live on the server
  (`server/deploy/realquick.env.example`) so they change without a release.
- Every string goes through `t()`; `src/__tests__/i18n.test.ts` fails on a
  missing Japanese key or placeholder.
- Widgets read only the App Group / AsyncStorage snapshot
  (`src/widgets/snapshot.ts`), never the network.
- Money: the app is free for `TRIAL_DAYS` (3) from first launch, then every
  count needs Pro — the gateway enforces it per install (`trial_over`), the
  app gates snap/typing on `freeDaysLeft()`. No store intro offer, on purpose.
- The forest is one GL scene owned by Home (`src/forest/Forest.tsx`); day
  pages only draw the gradient, ring and hero. Keep it procedural (no model
  files) and keep the frame cheap: ~25 trees, ~50 small plants, 220 points.
- Look and motion rules live in `marketing/brand.md`: no outlines, no emoji,
  no springs or loops — every animation is a short ease-out from
  `src/ui/motion.ts`; illustration is only the clay set in `app/assets/art/`
  (`marketing/brand-art/PROMPTS.md` says how to make more).
