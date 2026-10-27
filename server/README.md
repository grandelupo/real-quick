# Real Quick gateway

The app's only server (app-builder/BACKEND.md → *Model gateway*, standalone
shape — no database, no accounts). One file, `gateway.py`.

```
POST /v1/analyze  {kind: "photo"|"text", image?: base64 JPEG, text?, lang: "en"|"ja", tz: "+09:00"}
   → 200 {title, items: [{name, emoji, grams, kcal, protein, carbs, fat}]}
   → 4xx/5xx {error: {code}}   code ∈ daily_limit | bad_request | unauthorized | upstream | rate_limited
GET  /healthz     {ok, key, root, provider, model}
```

Headers: `X-Install-Id` (random per install), `X-Platform` (ios|android),
optional `X-Purchase-Token` (StoreKit 2 JWS / Play purchase token).

- **Quota:** free = `FREE_PER_DAY` (3) per install per local day and
  `FREE_PER_IP` (15) per IP; Pro = `PRO_PER_DAY` (60) per subscriber. Uses
  are refunded when the model fails or sees no food.
- **Receipts:** Apple JWS verified against the pinned `AppleRootCA-G3.cer`
  (SHA-256 `63:34:3A:BF:…:91:79`) + bundle/product/expiry/revocation checks;
  Play tokens verified via the Play Developer API once
  `GOOGLE_SERVICE_ACCOUNT_FILE` is set (until then accepted by shape, logged).
- **Providers:** `anthropic` (default, structured JSON output, prompt cached
  1 h), `perplexity` (Sonar, OpenAI-compatible), `fake` (tests/dev).

## Picking the model (decide before launch)

Per photo (~1.5k input tokens incl. a 1024 px image, ~400 output tokens), at
list prices (Oct 2026):

| Model | ≈ cost / photo | 1 Pro user × 10 photos/day × 30 | Notes |
|---|---|---|---|
| `claude-haiku-5-5` | **$0.0004** | $0.12 / month | fastest; cheapest by far |
| `claude-sonnet-5-5` | $0.007 | $2.10 / month | |
| `claude-opus-5-5` (current default) | $0.014 + thinking | $4+ / month | best judgement, slowest; exceeds a $4.99 sub's net |
| Perplexity `sonar` | ~$0.002 + $5–12 per 1k requests | ~$2–4 / month | built for web search, not vision; better for branded/restaurant items by text |

The default is the most capable model; whether a cheaper one is accurate
enough is a product call. Measure it with your own weighed meals:

```bash
ANTHROPIC_API_KEY=… python3 eval.py my-photos/ claude-haiku-5-5 claude-sonnet-5-5 claude-opus-5-5
```

then set `MODEL=` in `/etc/realquick/gateway.env` and restart — no app release.

## Deploy

```bash
./deploy.sh --key   # first time: code, venv, systemd, Caddy route, key from app-builder/.env
./deploy.sh         # later: code only
```

Serves `https://realquick.lab.karolkrakowski.pl` (wildcard DNS already points
at the VPS) on 127.0.0.1:8099 behind Caddy; the product site is served from
the same host (`/srv/sites/realquick`, `app-builder/deploy-site.py realquick
marketing/site`).

## Tests

```bash
python3 -m unittest test_gateway -v   # 15 tests: quota, refunds, validation, JWS chain, wire codes, Claude request shape
```

## Free days and live sharing

- Every install may count for `TRIAL_DAYS` (3) local days from its first
  `/v1/analyze`, up to `FREE_PER_DAY` a day; afterwards non-subscribers get
  `trial_over` (402). First-seen days live in `installs.json` next to the
  usage file, so a reinstall with a new install id gets a new window only if
  it also has a new IP (`FREE_PER_IP`).
- `POST /v1/share` stores a summary of the install's days (totals and entry
  titles, never photos) under a random token and answers `{token, url}`;
  `GET /s/<token>` renders it as a live page, `DELETE /v1/share` removes it.
  Stored in `shares.json`. Caddy routes `/s/*` here (deploy/Caddyfile.snippet).

## Coupons

`COUPON_CODES="CODE=days,..."` in `/etc/realquick/gateway.env`. The app's
paywall has "Have a coupon code?"; `POST /v1/coupon {code}` with the install
id stores the install's last Pro day in `coupons.json` and `/v1/analyze`
treats it like a subscriber until then. A code never shortens an existing
coupon; 20 attempts per IP per day. Restart the service after changing codes.
