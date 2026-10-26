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
| Native components, system light/dark | **Fully branded UI** (Fredoka/Nunito, sticker outlines, pastel weekday worlds); follows the clock (white night look 20:00–05:59) instead of system appearance | Brief: "I don't want native UI … branded and fun" |
| 12–25 screen quiz funnel | **5 short screens** that collect real settings (goal, estimate bias, camera) + a 3-tip tour, then a soft paywall | Brief: "don't make complicated onboarding" |
| TipKit tooltips | On-screen hints on today's page for the first snaps + a visible notes tab | No TipKit in RN; hints fade out after 4 snaps |
| Unlimited free tier | **3 AI counts/day free**, Pro unlimited (gateway-enforced) | Every count has model cost (BLUEPRINT §4 marginal-cost rule) |
| Zero third-party deps | Expo modules + reanimated/gesture-handler/svg, `expo-iap`, `@bacons/apple-targets`, `react-native-android-widget` | Each justified in `marketing/appstore/app-privacy.md` |
| `xcodebuild` UI tests + simulator capture pass | Jest engine/i18n tests; store captures from the web build of the same code (`marketing/appstore/capture.js`) | Expo project; no Mac in the cloud build session |

## Layout

```
app/                  Expo app (CNG: ios/ and android/ are generated, never committed)
  src/engine/         pure logic + Jest tests (nutrition, days, local food table, validation)
  src/                store, gateway client, analysis queue, photos, i18n (en + ja), IAP
  src/components/     day page, capture bar, side notes, sheets, paywall, share card
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
