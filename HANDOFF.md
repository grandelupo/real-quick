# Real Quick — handoff

Everything below needs your Apple ID, Google account, money, a decision only
you should make, or credentials that were not available in the cloud session
that built this (no `app-builder/.env`, no Mac, no VPS key). Everything else
is done and committed: app, widgets, gateway + tests, icon, listings (en +
ja), privacy audit, hosted pages, product site, store screenshots, the
subscription review screenshot, the Play set and the portfolio SQL.

## The list

1. **Run the three deploys** the cloud session could not reach (gateway,
   legal pages, product site + waitlist record).
2. **Pick the AI model** (one env line on the server, no release needed).
3. **Build and sign iOS** (team id, prebuild, archive).
4. **App Store Connect:** agreement, app record, subscription products,
   listing, submit.
5. **Google Play:** app, subscriptions, service account, listing, submit.
6. **Verify on real devices:** snap, widgets, trial.

Optional: the image prompts at the end, for richer brand art.

---

### 1. Run the three deploys

Where: your Mac, in the workspace that has `app-builder/` with its `.env`
Prereq: none

1. `cd real-quick/server && ./deploy.sh --key` — installs the gateway on the
   VPS (port 8096, checks the port is free first), writes
   `/etc/realquick/gateway.env` with `ANTHROPIC_API_KEY` from
   `app-builder/.env`, appends the Caddy block, pre-creates its log file.
   Prints `/healthz`; expect `"key": true, "root": true`.
2. `python3 app-builder/deploy-web.py` from `real-quick/` — uploads
   `marketing/web/apps/real-quick/{privacy,support}.htm`. Then copy both files
   into `~/src/karolkrakowski/apps/real-quick/` and commit them there
   (WEBSITE.md §5 — the site deploys with `--delete`).
3. `python3 app-builder/deploy-site.py realquick real-quick/marketing/site`,
   then in `https://waitlist.lab.karolkrakowski.pl/_/` ▸ `apps` ▸ New record:
   `slug = realquick`, `name = Real Quick`,
   `site_url = https://realquick.lab.karolkrakowski.pl`.
4. Portfolio: `python3 app-builder/portfolio.py real-quick` (uploads the
   webp images), then paste `marketing/portfolio.sql` into phpMyAdmin.

Verify: `curl https://realquick.lab.karolkrakowski.pl/healthz`; both legal
URLs return 200; the site shows the waitlist form (`?force=live` shows badges).

### 2. Pick the AI model

Where: the VPS, `/etc/realquick/gateway.env`
Prereq: 1

You asked about Perplexity, so here is the comparison I based the design on:

- **Perplexity (Sonar)** accepts images but is built around web search; every
  call pays a per-request search fee on top of tokens, answers are slower, and
  structured JSON is less reliable. Its real strength — looking up branded or
  restaurant items — matters for *typed* meals, not photos. Supported as
  `PROVIDER=perplexity` if you want to try it.
- **Claude** (default, `PROVIDER=anthropic`): strong vision, guaranteed JSON
  via structured outputs, prompt caching, and the key is already in
  `app-builder/.env`. Per photo: Haiku 5.5 ≈ $0.0004, Sonnet 5.5 ≈ $0.007,
  Opus 5.5 ≈ $0.014.
- Dedicated food APIs (Passio, LogMeal, Calorie Mama, CaloAI) exist; they add a
  vendor and per-call pricing without beating a frontier vision model on mixed
  plates, so they're not used.

The gateway ships with **Opus 5.5** (most capable), but at ~10 photos a day a
Pro user would cost about as much as the subscription brings in. Haiku 5.5 is
~40× cheaper and faster, which matters for "the fastest calorie tracker". Decide
with your own data:

1. Photograph 10–20 meals you weighed; put them in a folder with
   `truth.csv` (`file,kcal`).
2. `ANTHROPIC_API_KEY=… python3 server/eval.py <folder> claude-haiku-5-5 claude-sonnet-5-5 claude-opus-5-5`
3. Set `MODEL=<winner>` in `/etc/realquick/gateway.env`,
   `systemctl restart realquick-gateway`.

Verify: `/healthz` shows the new model; a snap in the app counts in a few
seconds.

### 3. Build and sign iOS

Where: Mac with Xcode, `real-quick/app`
Prereq: none (2 for meaningful counts)

1. Add your team id to `app/app.json` → `expo.ios.appleTeamId` (Xcode ▸
   Settings ▸ Accounts ▸ team ▸ the 10-character id). The widget target needs it.
2. `cd app && npm install && npx expo prebuild --clean`
3. `open ios/RealQuick.xcworkspace` ▸ for **RealQuick** and
   **RealQuickWidgets** targets ▸ Signing & Capabilities ▸ your team,
   "Automatically manage signing" — this registers both bundle ids and the App
   Group `group.com.latovi.realquick.shared`.
4. Scheme ▸ Edit Scheme ▸ Run ▸ Options ▸ StoreKit Configuration ▸
   `RealQuick.storekit` (in `app/`) to test the paywall locally.
5. Run once on the "Upbell Capture" simulator (no new simulators). The widget
   Swift code (`app/targets/widget/*.swift`) was written without a Mac in reach,
   so this is its first compile — if Xcode flags anything, it will be in those
   three files.
6. Product ▸ Archive ▸ Distribute App ▸ App Store Connect ▸ Upload.
   (Or `npx eas-cli build -p ios --profile production` + `eas submit`.)

Verify: the archive uploads; TestFlight shows build 1 (version 1.0.0).

### 4. App Store Connect

Where: appstoreconnect.apple.com
Prereq: 3

1. Business ▸ Paid Applications agreement (skip if already active).
2. Apps ▸ + ▸ New App: iOS, name `Real Quick – Calorie Tracker`, primary
   language English (U.S.), bundle id `com.latovi.realquick`, SKU `realquick`.
3. Monetization ▸ Subscriptions ▸ create group **Real Quick Pro**, then the two
   products exactly as the table in `marketing/appstore/listing.md` →
   *Subscription products* (ids, prices, 1-week free intro offer, en + ja
   display names/descriptions). Upload
   `marketing/appstore/subscription-review.png` as each product's review
   screenshot. Note the JPY prices ASC shows and update the ja description's
   ¥ figures in `listing.md` if they differ.
4. App Store tab ▸ English (U.S.): paste name, subtitle, promotional text,
   description, keywords, URLs from `listing.md`; upload
   `marketing/appstore/out/en-US/01–05.png`. Add language ▸ Japanese: same
   from the ja section + `out/ja/`.
5. App Privacy: answer exactly as `marketing/appstore/app-privacy.md`.
6. Age rating: as `listing.md` → *Age rating*. Category Health & Fitness.
7. App Review Information: paste the notes from `listing.md` (they explain
   why the app is simple on purpose and how to exercise every feature), your
   phone number; no demo account (there are no accounts).
8. Attach build 1 **and both subscriptions** to version 1.0 ▸ Submit.

Verify: status "Waiting for Review" with both subscriptions attached.

### 5. Google Play

Where: play.google.com/console
Prereq: none

1. Create app `Real Quick – Calorie Tracker`, default language en-US, free
   app with in-app purchases.
2. Build: `cd app && npx eas-cli build -p android --profile production`
   (EAS creates and keeps the upload key) and upload the `.aab` to an internal
   testing track (Play needs one upload before subscriptions can be created).
3. Monetize ▸ Subscriptions: the two products + base plans + `trial-1w`
   offers from `marketing/play/listing.md`.
4. Receipt verification: Google Cloud ▸ service account with the Play
   Developer API enabled; Play Console ▸ Users and permissions ▸ invite it
   with "View financial data / Manage orders". Put the JSON key on the VPS at
   `/etc/realquick/play-service-account.json` (owner root, group realquick,
   0640), uncomment `GOOGLE_SERVICE_ACCOUNT_FILE` in
   `/etc/realquick/gateway.env`, restart the gateway.
5. Store listing (en + ja), graphics (`marketing/play/out/…`, icon from
   `marketing/brand/icon.svg`), Data safety + content rating from
   `marketing/play/listing.md`. Promote to production.

Verify: a sandbox/licence-tester purchase turns on Pro; the gateway log shows
no "play token accepted unverified" line.

### 6. Verify on real devices

Prereq: 2–5

- iPhone: complete onboarding, snap a plate (counts within seconds), swipe
  left, type "2 eggs and toast" (instant), start the trial with a sandbox
  account — confirm "1 week free" and "You won't be charged today".
- Lock Screen: add **Snap** (circular) — tap it, unlock, the photo is taken
  automatically. On iOS 18 add the **Snap food** control in place of the
  flashlight. Add the Today widget (small/medium) and check it updates after a
  snap.
- Android: add the 1×1 **Snap** widget — one tap opens the camera, snaps,
  shows "Got it!" and closes back to the home screen.

---

## What is not done, honestly

- **iOS has no camera-from-a-locked-phone mode.** The widget and control open
  the app, which requires unlocking (Face ID makes that a glance), then snap
  instantly. A true no-unlock capture needs a *LockedCameraCapture* extension
  (iOS 18), which the Expo targets plugin cannot generate yet and which can't
  reach the network while locked (photos would wait until the next unlock). Worth
  a v1.1 written natively in Xcode.
- **iOS cannot close itself** after a widget snap (Apple forbids it); Android
  does.
- **Android "without opening the app"** is not possible for a camera photo
  (Android requires a visible activity to use the camera); it opens, snaps,
  confirms and closes in about two seconds.
- Not compiled in this session: the Swift widget target (no Mac) and the
  Android build (no Android SDK). Both config plugins were validated with
  `expo prebuild` for iOS and Android; the JS/TS app typechecks, 25 Jest tests
  and 15 gateway tests pass, and every screen was exercised end to end in the
  web build against a local gateway.

---

## Image prompts (optional — run with Higgsfield on your Mac)

The shipped app draws all its art in code, so none of this is required. These
give the brand a sticker-quality mascot set for the website, launch email and
Play feature graphic. Model: `nano_banana_pro`; save results to
`marketing/brand-art/raw/`, keep the hero as the `--image` reference for every
later pose; cut out with `image_background_remover`.

1. **Hero mascot** (reference for all others):
   > Cute pizza mascot character that is also a pie chart, three pastel
   > wedges in coral pink, soft peach and butter yellow inside a toasted
   > golden crust, one wedge slightly pulled out like a slice being grabbed,
   > flat 2D vector sticker illustration, thick dark navy outline, slightly
   > hand-drawn line, two simple black oval eyes and pink blush cheeks on the
   > big peach wedge, tiny smile, thick white sticker border, solid blush pink
   > (#FFB8CA) background, kawaii, minimal, no text, centered, plenty of margin
2. **Pose sheet** — hero prompt + `--image hero.png` +
   > character sheet, six poses: neutral, waving, thinking, celebrating,
   > sleeping, sad-but-hopeful, same character, consistent style, white background
3. **Weekday doodle sets** (one per day, for the website and share cards):
   > Seamless scatter of cute pastel food doodles: [avocados, pea pods and
   > kiwi slices | peaches, croissants and carrots | grapes, plums and
   > macarons | bananas, lemons and fried eggs | strawberries, donuts and
   > cherries | blueberries, ice cream cones and cupcakes | pizza slices,
   > tomatoes and pears], some with tiny dot eyes and blush, flat 2D, soft
   > dark navy outlines, generous spacing, solid [#CFF2E2 | #FFDCC9 | #E4DCFF
   > | #FFF1B8 | #FFD8E6 | #D3ECFF | #E2F0C6] background, no text
4. **Night landscape**:
   > Minimal line-art night landscape, soft rolling pastel hills, a tiny
   > white house with one warm yellow window, three simple pine trees, a
   > crescent moon and small plus-shaped stars, thin dark navy lines, mostly
   > white background, calm and cozy, flat 2D, no text, wide 9:19 portrait
5. **App icon alternative** (only if you prefer a painted icon over the
   vector one in `marketing/brand/icon.svg`):
   > App icon, a blush-pink, non-realistic cute pizza seen from above that
   > reads as a pie chart with three pastel wedges (coral, peach, butter
   > yellow), one wedge slightly pulled out, kawaii face with dot eyes and
   > blush on the largest wedge, thick navy outline, flat 2D, soft blush pink
   > gradient background, centered, no text, no border, 1024×1024
6. **Play feature graphic** (1024×500):
   > Wide banner, blush pink gradient, the pizza pie-chart mascot on the left
   > waving, three floating pastel food doodles, lots of empty space on the
   > right for a headline, flat 2D sticker style, no text
