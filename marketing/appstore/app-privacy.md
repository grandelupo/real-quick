# Real Quick — App Privacy answers + the audit behind them

Audited from the code on 2026-10-26 (APP-STORE.md §4). Real Quick is **not**
a "Data Not Collected" app: it sends food photos and typed meals to a model
provider through our gateway, and Apple counts that as collection even though
nothing is kept by us.

## Answers for App Store Connect

| Data type | Collected | Linked to identity | Tracking | Purpose |
|---|---|---|---|---|
| User Content ▸ **Photos or Videos** | Yes | No | No | App Functionality |
| User Content ▸ **Other User Content** (typed meals) | Yes | No | No | App Functionality |
| Identifiers ▸ **Device ID** (random install id) | Yes | No | No | App Functionality |
| Purchases ▸ **Purchase History** (receipt check for Pro) | Yes | No | No | App Functionality |
| Everything else (contact info, health & fitness, location, contacts, browsing, search, usage data, diagnostics, sensitive info, financial info, body, surroundings) | **No** | — | — | — |

"Used to track you": **No** for every type. No ads, no analytics, no SDKs.

## Why each answer

- **Photos.** `src/photos.ts` → `src/api.ts` sends a 1024 px JPEG to
  `https://realquick.lab.karolkrakowski.pl/v1/analyze`. `server/gateway.py`
  forwards it to the model provider (Anthropic by default) and never writes it
  to disk. The provider may retain API inputs briefly under its own policy —
  that makes it "collected" under Apple's definition. Not linked: the request
  carries no name, email or account.
- **Other User Content.** Typed meals the on-device table can't resolve
  (`src/engine/foods.ts` → `parseLocally` returns null) go the same way.
- **Device ID.** `src/store.ts` creates a random UUID (`installId`) on first
  launch; the gateway counts free uses per install per day in
  `/var/lib/realquick/usage.json`, pruning anything older than yesterday. It
  is not derived from hardware and not shared.
- **Purchase History.** For Pro, the app sends the StoreKit 2 signed
  transaction (Play purchase token on Android) so the gateway can verify the
  subscription; the gateway keeps only a per-day counter keyed by the
  transaction's `originalTransactionId`.
- **IP address.** Used transiently by the gateway to cap free uses per network
  per day (anti-abuse) and pruned with the counters; not used for location.
  Apple has no separate IP category; this is disclosed in the privacy policy.
- **Health & Fitness — No.** The goal, the BMR profile (sex, age, height,
  weight) and the whole food diary live only in AsyncStorage on the device.
- **Camera.** Used only while the app is open, for the food preview and
  capture. `NSCameraUsageDescription` (en + ja) matches. No microphone
  (`RECORD_AUDIO` is explicitly blocked on Android, `microphonePermission:
  false` on iOS).

## The audit commands

```bash
cd app
# third-party native modules — each one justified below
node -e "const p=require('./package.json');console.log(Object.keys(p.dependencies).join('\n'))"
# network calls: exactly one place
grep -rn "fetch(\|XMLHttpRequest\|WebSocket" src | grep -v __tests__
# permissions requested
grep -rn "Permission\|requestPerm" src | grep -v "^src/i18n"
```

| Dependency | Why | Data |
|---|---|---|
| expo-camera | the food camera | photos stay local until counted |
| expo-iap | StoreKit 2 / Play Billing | Apple/Google's own collection |
| @bacons/apple-targets | iOS widgets + App Group storage | local only |
| react-native-android-widget | Android widgets | local only |
| expo-sharing, react-native-view-shot | share card image | user-initiated, system sheet |
| async-storage, expo-file-system, expo-image-manipulator | local storage of diary + photos | local only |
| expo-localization, expo-haptics, expo-crypto, reanimated, gesture-handler, svg, safe-area, fonts, splash | UI | none |

No analytics, crash reporting, ads or attribution SDKs.

## Re-audit triggers

Any new SDK, a second network endpoint, accounts, analytics or crash
reporting, storing photos server-side, cloud sync, or a different model
provider (update the privacy policy's processor list) re-opens every answer
above.
