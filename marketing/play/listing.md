# Real Quick — Google Play listing

Package `com.latovi.realquick` · Category **Health & Fitness** · Contact
`karol@karolkrakowski.pl` · Privacy policy
`https://karolkrakowski.pl/apps/real-quick/privacy.htm`

## en-US

| Field | Value | Chars |
|---|---|---|
| App name | `Real Quick – Calorie Tracker` | 28/30 |
| Short description | `Snap your food, see calories & macros. The fastest, simplest calorie tracker.` | 77/80 |

Full description: reuse the App Store description from
`marketing/appstore/listing.md`, replacing the subscription paragraph with:

```
Payment is charged to your Google Play account at confirmation of purchase. Subscriptions renew automatically unless cancelled before the renewal date in Google Play ▸ Profile ▸ Payments & subscriptions ▸ Subscriptions.
```

and "Lock Screen widget / control" with "the 1×1 Snap home-screen widget: one tap opens the camera, snaps, confirms and closes again".

## ja-JP

| Field | Value | Chars |
|---|---|---|
| App name | `Real Quick – カロリー計算` | 19/30 |
| Short description | `写真を撮るだけでカロリーとPFCを記録。いちばん速くて簡単なカロリー計算。` | 37/80 |

## Subscriptions (Play Console ▸ Monetize ▸ Subscriptions)

| Product ID | Base plan id | Price | Offer |
|---|---|---|---|
| `com.latovi.realquick.pro.monthly` | `monthly` (auto-renewing, 1 month) | $4.99 | none — the app's first 3 days are the trial |
| `com.latovi.realquick.pro.yearly` | `yearly` (auto-renewing, 1 year) | $29.99 | none |

The app reads the offer token from the store (`src/iap.ts`), so offer ids can
change without a release.

## Data safety form

| Question | Answer |
|---|---|
| Collects or shares user data? | Collects: **Photos** (Photos and videos), **Other user-generated content** (typed meals), **Device or other IDs** (random install id), **Purchase history**; with live sharing on (opt-in): **Health and fitness** (daily totals) and typed meal titles, stored under a random link until the user stops. Shared: none (the model provider acts as a service provider/processor, which Play does not count as sharing). |
| Processed ephemerally? | Photos and typed meals: **Yes** (not stored by us) |
| Required or optional? | Photos: optional (typing works without the camera) · IDs, purchase history: required for the feature |
| Purpose | App functionality (all) |
| Encrypted in transit | Yes (HTTPS) |
| Users can request deletion | Yes — Settings ▸ Erase all my data / uninstall; server keeps only counters that expire within 2 days |

Content rating questionnaire: reference app type "Utility / Productivity" →
no violence, sexuality, language, controlled substances, gambling, UGC
sharing or location → **Everyone / PEGI 3**.

Target audience: 13+ (not designed for children).

## Graphics

- Icon 512×512: `out/graphics/icon-512.png` (the iOS icon, resized).
- Feature graphic 1024×500: `out/graphics/feature-1024x500.png`, made by
  `feature.py` from the Gemini art in `marketing/brand-art/raw/`.
- Phone screenshots: `marketing/play/out/en-US/*.png` and `out/ja/*.png`, 1080×2160
  (Play caps the ratio at 2:1) — `python3 marketing/appstore/build.py --play`.
