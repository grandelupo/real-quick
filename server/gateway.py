#!/usr/bin/env python3
"""Real Quick model gateway — the app's only server.

One job: take a food photo (or a typed meal), ask a vision model what is on
the plate, and return calories + macros as JSON. The API key, the prompt and
the model choice live here so they can change without an App Review
(app-builder/BACKEND.md → Model gateway).

    POST /v1/analyze   {kind: "photo"|"text", image?: b64 jpeg, text?, lang, tz}
    GET  /healthz      {ok, key, root, provider, model}
    POST /v1/share     {name?, unit?, days:{YYYY-MM-DD:{kcal,goal,protein,carbs,fat,entries:[{t,title,kcal}]}}} → {token, url}
    DELETE /v1/share   stop sharing (X-Install-Id)
    GET  /s/<token>    the live share page (HTML); GET /v1/share/<token> the same as JSON

Auth without accounts: every install sends a random X-Install-Id. Free
installs get FREE_PER_DAY counts per local day for TRIAL_DAYS days from their
first count, then nothing; Pro installs send their store
receipt (iOS: the StoreKit 2 signed transaction JWS, verified against Apple's
pinned root; Android: the Play purchase token, verified with the Play
Developer API when a service account is configured).

Error codes on the wire equal the app's ApiErrorCode values (app/src/api.ts);
test_gateway.py pins that contract.

Standard library + `anthropic` (provider "anthropic") + `cryptography`
(receipt verification). Config is environment-only, see deploy/realquick.env.example.
"""

from __future__ import annotations

import base64
import json
import logging
import html
import os
import re
import secrets
import threading
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

log = logging.getLogger("realquick")

# ---------------------------------------------------------------- config ---

HERE = Path(__file__).resolve().parent
PORT = int(os.environ.get("PORT", "8099"))
PROVIDER = os.environ.get("PROVIDER", "anthropic")  # anthropic | perplexity | fake
MODEL = os.environ.get("MODEL", "claude-opus-5-5")
EFFORT = os.environ.get("EFFORT", "low")
PERPLEXITY_MODEL = os.environ.get("PERPLEXITY_MODEL", "sonar")
FREE_PER_DAY = int(os.environ.get("FREE_PER_DAY", "12"))
PRO_PER_DAY = int(os.environ.get("PRO_PER_DAY", "60"))
# Free counts per IP per day across all installs — stops reinstall farming.
FREE_PER_IP = int(os.environ.get("FREE_PER_IP", "15"))
# The free window: an install may count for this many local days from the day
# it first asked; after that only a subscriber may count (every count costs us).
TRIAL_DAYS = int(os.environ.get("TRIAL_DAYS", "3"))
# Public base of the live share pages (/s/<token>), served by this process behind Caddy.
SHARE_BASE = os.environ.get("SHARE_BASE", "https://realquick.lab.karolkrakowski.pl").rstrip("/")
BUNDLE_ID = os.environ.get("BUNDLE_ID", "com.latovi.realquick")
ANDROID_PACKAGE = os.environ.get("ANDROID_PACKAGE", "com.latovi.realquick")
PRODUCT_IDS = {"com.latovi.realquick.pro.monthly", "com.latovi.realquick.pro.yearly"}
STATE_FILE = Path(os.environ.get("STATE_FILE", "/var/lib/realquick/usage.json"))
APPLE_ROOT = Path(os.environ.get("APPLE_ROOT", str(HERE / "AppleRootCA-G3.cer")))
GOOGLE_SA_FILE = os.environ.get("GOOGLE_SERVICE_ACCOUNT_FILE", "")
# Development only: accept receipts that fail verification (StoreKit local
# testing signs with an Xcode certificate that can never chain to Apple).
DEV_ALLOW_UNSIGNED = os.environ.get("DEV_ALLOW_UNSIGNED") == "1"
MAX_BODY = 4 * 1024 * 1024
TIMEOUT = 40

ERROR_CODES = ("daily_limit", "trial_over", "bad_request", "unauthorized", "upstream", "rate_limited")

# ---------------------------------------------------------------- prompt ---

SYSTEM_PROMPT = """You are the food counter inside Real Quick, a calorie tracker.

You get one photo of something a person is about to eat (or a short text of
what they ate). Identify each distinct food or drink and estimate the portion
actually shown, then its energy and macronutrients for that whole portion.

Rules:
- Estimate what is visible: use plates, cutlery, hands and packaging for
  scale. When a portion is ambiguous, use a typical single serving.
- Include what the eye can infer: oil on fried or glossy food, dressing on
  salad, sugar in a sweet drink, butter on toast, cheese in a sandwich.
- Split a mixed plate into its main components (at most 8). A packaged
  product with a visible label: use the label's values for the visible amount.
- Typed text: honour stated quantities and units exactly ("2 eggs", "150 g").
- kcal must agree with the macros (about 4 per g protein or carbs, 9 per g fat,
  7 per g alcohol).
- Names are short (1-4 words) and in the user's language given as `lang`.
  `title` names the whole meal in 1-4 words, same language.
- One emoji per item that looks like the food.
- If there is no food or drink at all, return an empty `items` list.
Return only the JSON object described by the schema."""

SCHEMA = {
    "type": "object",
    "properties": {
        "title": {"type": "string"},
        "items": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "emoji": {"type": "string"},
                    "grams": {"type": "number"},
                    "kcal": {"type": "number"},
                    "protein": {"type": "number"},
                    "carbs": {"type": "number"},
                    "fat": {"type": "number"},
                },
                "required": ["name", "emoji", "grams", "kcal", "protein", "carbs", "fat"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["title", "items"],
    "additionalProperties": False,
}

LANG_NAMES = {"en": "English", "ja": "Japanese"}


class GatewayError(Exception):
    def __init__(self, code: str, status: int, why: str = ""):
        assert code in ERROR_CODES, code
        super().__init__(code)
        self.code = code
        self.status = status
        self.why = why


# ------------------------------------------------------------- providers ---


def _user_text(req: dict) -> str:
    lang = LANG_NAMES.get(req.get("lang", "en"), "English")
    if req["kind"] == "text":
        return f"lang: {lang}\nThe user typed what they ate:\n<meal>{req['text']}</meal>"
    return f"lang: {lang}\nCount the food in this photo."


_anthropic_client = None


def call_anthropic(req: dict) -> dict:
    global _anthropic_client
    import anthropic  # imported lazily so the fake provider runs without it

    if _anthropic_client is None:
        _anthropic_client = anthropic.Anthropic(timeout=TIMEOUT, max_retries=1)
    content: list[dict] = []
    if req["kind"] == "photo":
        content.append({"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": req["image"]}})
    content.append({"type": "text", "text": _user_text(req)})
    try:
        resp = _anthropic_client.messages.create(
            model=MODEL,
            max_tokens=4000,
            # The prompt never changes: cache it for an hour.
            system=[{"type": "text", "text": SYSTEM_PROMPT, "cache_control": {"type": "ephemeral", "ttl": "1h"}}],
            messages=[{"role": "user", "content": content}],
            output_config={"effort": EFFORT, "format": {"type": "json_schema", "schema": SCHEMA}},
        )
    except anthropic.RateLimitError as e:
        raise GatewayError("upstream", 503, f"anthropic rate limit: {e}") from e
    except anthropic.APIStatusError as e:
        raise GatewayError("upstream", 502, f"anthropic {e.status_code}: {e.message}") from e
    except anthropic.APIConnectionError as e:
        raise GatewayError("upstream", 502, f"anthropic connection: {e}") from e
    if resp.stop_reason == "refusal":
        return {"title": "", "items": []}
    text = next((b.text for b in resp.content if b.type == "text"), "")
    usage = resp.usage
    log.info(
        "anthropic ok model=%s in=%s out=%s cache_read=%s",
        MODEL,
        usage.input_tokens,
        usage.output_tokens,
        getattr(usage, "cache_read_input_tokens", 0),
    )
    return json.loads(text)


def call_perplexity(req: dict) -> dict:
    key = os.environ.get("PERPLEXITY_API_KEY", "")
    content: list[dict] = [{"type": "text", "text": _user_text(req)}]
    if req["kind"] == "photo":
        content.append({"type": "image_url", "image_url": {"url": "data:image/jpeg;base64," + req["image"]}})
    body = {
        "model": PERPLEXITY_MODEL,
        "messages": [{"role": "system", "content": SYSTEM_PROMPT}, {"role": "user", "content": content}],
        "response_format": {"type": "json_schema", "json_schema": {"schema": SCHEMA}},
        "max_tokens": 1200,
    }
    r = urllib.request.Request(
        "https://api.perplexity.ai/chat/completions",
        data=json.dumps(body).encode(),
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(r, timeout=TIMEOUT) as res:
            data = json.loads(res.read())
    except urllib.error.HTTPError as e:
        raise GatewayError("upstream", 502, f"perplexity {e.code}: {e.read()[:300]!r}") from e
    except (urllib.error.URLError, TimeoutError) as e:
        raise GatewayError("upstream", 502, f"perplexity connection: {e}") from e
    text = data["choices"][0]["message"]["content"]
    m = re.search(r"\{.*\}", text, re.S)  # sonar sometimes wraps JSON in prose
    return json.loads(m.group(0) if m else text)


FAKE_PLATE = {
    "title": "Chicken rice bowl",
    "items": [
        {"name": "Grilled chicken", "emoji": "🍗", "grams": 140, "kcal": 231, "protein": 43, "carbs": 0, "fat": 5},
        {"name": "White rice", "emoji": "🍚", "grams": 180, "kcal": 234, "protein": 4.3, "carbs": 51, "fat": 0.5},
        {"name": "Avocado", "emoji": "🥑", "grams": 50, "kcal": 80, "protein": 1, "carbs": 4.3, "fat": 7.3},
    ],
}


def call_fake(req: dict) -> dict:
    """Deterministic answer for local development and tests — no key, no cost."""
    time.sleep(float(os.environ.get("FAKE_DELAY", "0.8")))
    if req["kind"] == "text":
        return {"title": req["text"][:40], "items": [{"name": req["text"][:40], "emoji": "🍽️", "grams": 250, "kcal": 420, "protein": 18, "carbs": 48, "fat": 16}]}
    return FAKE_PLATE


PROVIDERS = {"anthropic": call_anthropic, "perplexity": call_perplexity, "fake": call_fake}


def provider_ready() -> bool:
    if PROVIDER == "fake":
        return True
    if PROVIDER == "perplexity":
        return bool(os.environ.get("PERPLEXITY_API_KEY"))
    return bool(os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_AUTH_TOKEN"))


# --------------------------------------------------------------- receipts ---


def _b64url(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def verify_apple_jws(token: str, now: float | None = None) -> str:
    """Verify a StoreKit 2 signed transaction; return originalTransactionId."""
    from cryptography import x509
    from cryptography.hazmat.primitives import hashes
    from cryptography.hazmat.primitives.asymmetric import ec, utils

    parts = token.split(".")
    if len(parts) != 3:
        raise ValueError("not a JWS")
    header = json.loads(_b64url(parts[0]))
    if header.get("alg") != "ES256":
        raise ValueError("alg")
    chain = [x509.load_der_x509_certificate(base64.b64decode(c)) for c in header.get("x5c", [])]
    if len(chain) < 2:
        raise ValueError("x5c too short")
    root = x509.load_der_x509_certificate(APPLE_ROOT.read_bytes())
    # Each cert must be issued by the next; the top one by the pinned Apple
    # root (a root included in x5c verifies only if it is that same key).
    issuers = chain[1:] + [root]
    when = datetime.fromtimestamp(now or time.time(), tz=timezone.utc)
    for cert, issuer in zip(chain, issuers):
        cert.verify_directly_issued_by(issuer)
        if not (cert.not_valid_before_utc <= when <= cert.not_valid_after_utc):
            raise ValueError("cert expired")
    sig = _b64url(parts[2])
    r, s = int.from_bytes(sig[:32], "big"), int.from_bytes(sig[32:], "big")
    pub = chain[0].public_key()
    assert isinstance(pub, ec.EllipticCurvePublicKey)
    pub.verify(utils.encode_dss_signature(r, s), f"{parts[0]}.{parts[1]}".encode(), ec.ECDSA(hashes.SHA256()))
    payload = json.loads(_b64url(parts[1]))
    if payload.get("bundleId") != BUNDLE_ID:
        raise ValueError("bundle")
    if payload.get("productId") not in PRODUCT_IDS:
        raise ValueError("product")
    if payload.get("revocationDate"):
        raise ValueError("revoked")
    expires = payload.get("expiresDate", 0) / 1000
    # A day of grace covers renewals the client has not seen yet.
    if expires and expires + 86400 < (now or time.time()):
        raise ValueError("expired")
    return str(payload.get("originalTransactionId") or payload.get("transactionId"))


_google_token: dict = {}


def _google_access_token() -> str:
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import padding

    if _google_token.get("exp", 0) > time.time() + 60:
        return _google_token["tok"]
    sa = json.loads(Path(GOOGLE_SA_FILE).read_text())
    now = int(time.time())
    head = base64.urlsafe_b64encode(json.dumps({"alg": "RS256", "typ": "JWT"}).encode()).rstrip(b"=")
    claim = base64.urlsafe_b64encode(
        json.dumps(
            {
                "iss": sa["client_email"],
                "scope": "https://www.googleapis.com/auth/androidpublisher",
                "aud": "https://oauth2.googleapis.com/token",
                "iat": now,
                "exp": now + 3600,
            }
        ).encode()
    ).rstrip(b"=")
    key = serialization.load_pem_private_key(sa["private_key"].encode(), password=None)
    sig = key.sign(head + b"." + claim, padding.PKCS1v15(), hashes.SHA256())  # type: ignore[call-arg]
    jwt = b".".join([head, claim, base64.urlsafe_b64encode(sig).rstrip(b"=")]).decode()
    body = f"grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion={jwt}".encode()
    with urllib.request.urlopen(urllib.request.Request("https://oauth2.googleapis.com/token", data=body), timeout=15) as r:
        data = json.loads(r.read())
    _google_token.update(tok=data["access_token"], exp=time.time() + int(data.get("expires_in", 3600)))
    return _google_token["tok"]


def verify_play_token(token: str) -> str:
    if not re.fullmatch(r"[A-Za-z0-9._\-]{20,600}", token):
        raise ValueError("token shape")
    if not GOOGLE_SA_FILE:
        # No Play credentials on the box yet: trust the token's shape. The
        # worst case is a free user getting the Pro daily cap — logged so it is visible.
        log.warning("play token accepted unverified (GOOGLE_SERVICE_ACCOUNT_FILE unset)")
        return "play:" + token[-24:]
    url = f"https://androidpublisher.googleapis.com/androidpublisher/v3/applications/{ANDROID_PACKAGE}/purchases/subscriptionsv2/tokens/{token}"
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {_google_access_token()}"})
    with urllib.request.urlopen(req, timeout=15) as r:
        data = json.loads(r.read())
    if data.get("subscriptionState") not in ("SUBSCRIPTION_STATE_ACTIVE", "SUBSCRIPTION_STATE_IN_GRACE_PERIOD"):
        raise ValueError(f"state {data.get('subscriptionState')}")
    items = data.get("lineItems", [])
    if not any(i.get("productId") in PRODUCT_IDS for i in items):
        raise ValueError("product")
    return "play:" + str(data.get("latestOrderId", token[-24:]))


_receipt_cache: dict[str, tuple[str, float]] = {}


def subscriber_for(platform: str, token: str) -> str | None:
    """Subscriber key for a valid Pro receipt, else None (treated as free)."""
    if not token:
        return None
    hit = _receipt_cache.get(token)
    if hit and hit[1] > time.time():
        return hit[0]
    try:
        sub = verify_apple_jws(token) if platform == "ios" else verify_play_token(token)
    except Exception as e:  # noqa: BLE001 — any failure means "not verified"
        log.info("receipt refused platform=%s why=%s", platform, e)
        if DEV_ALLOW_UNSIGNED:
            return "dev:" + token[-16:]
        return None
    _receipt_cache[token] = (sub, time.time() + 3600)
    return sub


# ------------------------------------------------------------------ quota ---


@dataclass
class Quota:
    path: Path
    lock: threading.Lock

    def __post_init__(self):
        self.data: dict[str, int] = {}
        try:
            self.data = json.loads(self.path.read_text())
        except (OSError, ValueError):
            self.data = {}

    def _save(self):
        try:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            tmp = self.path.with_suffix(".tmp")
            tmp.write_text(json.dumps(self.data))
            tmp.replace(self.path)
        except OSError as e:
            log.warning("quota save failed: %s", e)

    def take(self, keys_and_limits: list[tuple[str, int]], day: str) -> bool:
        """Atomically check every (key, limit) and count one use on all of them."""
        with self.lock:
            # Forget yesterday — keys are prefixed with the day.
            stale = [k for k in self.data if not k.startswith(day) and not k.startswith(_yesterday(day))]
            for k in stale:
                del self.data[k]
            full = [f"{day}|{k}" for k, _ in keys_and_limits]
            if any(self.data.get(fk, 0) >= lim for fk, (_, lim) in zip(full, keys_and_limits)):
                return False
            for fk in full:
                self.data[fk] = self.data.get(fk, 0) + 1
            self._save()
            return True

    def give_back(self, keys: list[str], day: str):
        """Refund a use when the upstream failed — users never pay for our errors."""
        with self.lock:
            for k in keys:
                fk = f"{day}|{k}"
                if self.data.get(fk, 0) > 0:
                    self.data[fk] -= 1
            self._save()


def _yesterday(day: str) -> str:
    return (datetime.strptime(day, "%Y-%m-%d") - timedelta(days=1)).strftime("%Y-%m-%d")


def local_day(tz: str, now: float | None = None) -> str:
    m = re.fullmatch(r"([+-])(\d{2}):(\d{2})", tz or "")
    offset = 0
    if m:
        offset = (int(m.group(2)) * 60 + int(m.group(3))) * (1 if m.group(1) == "+" else -1)
        offset = max(-14 * 60, min(14 * 60, offset))
    t = datetime.fromtimestamp(now or time.time(), tz=timezone.utc) + timedelta(minutes=offset)
    return t.strftime("%Y-%m-%d")


QUOTA = Quota(STATE_FILE, threading.Lock())


class JsonStore:
    """A small dict persisted as one JSON file, written atomically under a lock."""

    def __init__(self, path: Path):
        self.path = path
        self.lock = threading.Lock()
        try:
            self.data: dict = json.loads(path.read_text())
        except (OSError, ValueError):
            self.data = {}

    def save(self):
        try:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            tmp = self.path.with_suffix(".tmp")
            tmp.write_text(json.dumps(self.data, ensure_ascii=False))
            tmp.replace(self.path)
        except OSError as e:
            log.warning("%s save failed: %s", self.path.name, e)


INSTALLS = JsonStore(STATE_FILE.with_name("installs.json"))
SHARES = JsonStore(STATE_FILE.with_name("shares.json"))


def trial_day(install: str, day: str) -> int:
    """0-based index of `day` in this install's free window (0 = first day it counted)."""
    with INSTALLS.lock:
        first = INSTALLS.data.get(install)
        if not first:
            INSTALLS.data[install] = first = day
            INSTALLS.save()
    delta = datetime.strptime(day, "%Y-%m-%d") - datetime.strptime(first, "%Y-%m-%d")
    return max(0, delta.days)

# ----------------------------------------------------------------- handler ---

INSTALL_RE = re.compile(r"[0-9a-fA-F-]{16,64}")


def validate(body: dict) -> dict:
    kind = body.get("kind")
    lang = body.get("lang") if body.get("lang") in LANG_NAMES else "en"
    tz = body.get("tz") if isinstance(body.get("tz"), str) else "+00:00"
    if kind == "photo":
        img = body.get("image")
        if not isinstance(img, str) or not (100 < len(img) < MAX_BODY):
            raise GatewayError("bad_request", 400, "image missing or size out of range")
        try:
            head = base64.b64decode(img[:64] + "=" * (-len(img[:64]) % 4))
        except ValueError as e:
            raise GatewayError("bad_request", 400, "image not base64") from e
        if not head.startswith(b"\xff\xd8"):
            raise GatewayError("bad_request", 400, "image not jpeg")
        return {"kind": "photo", "image": img, "lang": lang, "tz": tz}
    if kind == "text":
        text = body.get("text")
        if not isinstance(text, str) or not text.strip():
            raise GatewayError("bad_request", 400, "text missing")
        return {"kind": "text", "text": text.strip()[:500], "lang": lang, "tz": tz}
    raise GatewayError("bad_request", 400, f"kind {kind!r}")


def handle_analyze(headers, raw: bytes, ip: str) -> tuple[int, dict]:
    install = headers.get("X-Install-Id", "")
    if not INSTALL_RE.fullmatch(install):
        raise GatewayError("unauthorized", 401, "install id missing")
    try:
        body = json.loads(raw)
    except ValueError as e:
        raise GatewayError("bad_request", 400, "json") from e
    if not isinstance(body, dict):
        raise GatewayError("bad_request", 400, "json shape")
    req = validate(body)
    day = local_day(req["tz"])
    platform = headers.get("X-Platform", "")
    sub = subscriber_for(platform, headers.get("X-Purchase-Token", ""))
    if sub:
        limits = [(f"sub:{sub}", PRO_PER_DAY)]
    else:
        if trial_day(install, day) >= TRIAL_DAYS:
            raise GatewayError("trial_over", 402, "free days over")
        limits = [(f"inst:{install}", FREE_PER_DAY), (f"ip:{ip}", FREE_PER_IP)]
    if not QUOTA.take(limits, day):
        log.info("limit pro=%s", bool(sub))
        raise GatewayError("daily_limit" if not sub else "rate_limited", 402 if not sub else 429, "daily limit")
    try:
        result = PROVIDERS[PROVIDER](req)
    except GatewayError:
        QUOTA.give_back([k for k, _ in limits], day)
        raise
    except Exception as e:  # noqa: BLE001
        QUOTA.give_back([k for k, _ in limits], day)
        raise GatewayError("upstream", 502, f"{type(e).__name__}: {e}") from e
    if not isinstance(result, dict) or not isinstance(result.get("items"), list):
        QUOTA.give_back([k for k, _ in limits], day)
        raise GatewayError("upstream", 502, "model returned no items list")
    # Unrecognisable photos cost the user nothing.
    if not result["items"]:
        QUOTA.give_back([k for k, _ in limits], day)
    return 200, {"title": result.get("title", ""), "items": result["items"][:12]}


# ------------------------------------------------------------------ share ---
# Live sharing without accounts: the app pushes a summary of its days (totals
# and entry titles — never photos) under a random token; anyone with the link
# sees today and the history at /s/<token> until the owner stops sharing.

DAY_RE = re.compile(r"\d{4}-\d{2}-\d{2}")
MAX_SHARE_DAYS = 120
MAX_SHARE_ENTRIES = 40


def _num(v, lo=0.0, hi=100000.0) -> float:
    try:
        f = float(v)
    except (TypeError, ValueError):
        return 0.0
    if f != f:
        return 0.0
    return max(lo, min(hi, f))


def validate_share(body: dict) -> dict:
    name = body.get("name")
    name = name.strip()[:40] if isinstance(name, str) else ""
    unit = body.get("unit") if body.get("unit") in ("kcal", "kJ") else "kcal"
    days_in = body.get("days")
    if not isinstance(days_in, dict):
        raise GatewayError("bad_request", 400, "days missing")
    days = {}
    for key in sorted(days_in, reverse=True)[:MAX_SHARE_DAYS]:
        d = days_in[key]
        if not (isinstance(key, str) and DAY_RE.fullmatch(key) and isinstance(d, dict)):
            continue
        entries = []
        for e in (d.get("entries") or [])[:MAX_SHARE_ENTRIES]:
            if not isinstance(e, dict):
                continue
            title = e.get("title")
            entries.append({"t": str(e.get("t", ""))[:5], "title": (title.strip()[:60] if isinstance(title, str) else ""), "kcal": round(_num(e.get("kcal")))})
        days[key] = {"kcal": round(_num(d.get("kcal"))), "goal": round(_num(d.get("goal"), 1, 20000)), "protein": round(_num(d.get("protein"))),
                     "carbs": round(_num(d.get("carbs"))), "fat": round(_num(d.get("fat"))), "entries": entries}
    return {"name": name, "unit": unit, "days": days}


def handle_share_put(headers, raw: bytes) -> tuple[int, dict]:
    install = headers.get("X-Install-Id", "")
    if not INSTALL_RE.fullmatch(install):
        raise GatewayError("unauthorized", 401, "install id missing")
    try:
        body = json.loads(raw)
    except ValueError as e:
        raise GatewayError("bad_request", 400, "json") from e
    if not isinstance(body, dict):
        raise GatewayError("bad_request", 400, "json shape")
    share = validate_share(body)
    with SHARES.lock:
        index = SHARES.data.setdefault("_by_install", {})
        token = index.get(install)
        if not token or token not in SHARES.data:
            token = secrets.token_urlsafe(9)
            index[install] = token
        SHARES.data[token] = {"install": install, "updated": time.time(), **share}
        SHARES.save()
    return 200, {"token": token, "url": f"{SHARE_BASE}/s/{token}"}


def handle_share_delete(headers) -> tuple[int, dict]:
    install = headers.get("X-Install-Id", "")
    if not INSTALL_RE.fullmatch(install):
        raise GatewayError("unauthorized", 401, "install id missing")
    with SHARES.lock:
        index = SHARES.data.setdefault("_by_install", {})
        token = index.pop(install, None)
        if token:
            SHARES.data.pop(token, None)
        SHARES.save()
    return 200, {"ok": True}


def share_for(token: str) -> dict | None:
    if not re.fullmatch(r"[A-Za-z0-9_-]{8,24}", token or ""):
        return None
    with SHARES.lock:
        return SHARES.data.get(token)


SHARE_PAGE = """<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>__TITLE__</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;800&display=swap" rel="stylesheet">
<style>
:root{--ink:#2B2350;--soft:rgba(43,35,80,.6);--hair:rgba(43,35,80,.08)}
*{box-sizing:border-box;margin:0}body{font-family:'Plus Jakarta Sans',system-ui,sans-serif;color:var(--ink);background:linear-gradient(180deg,var(--bg,#EEE9FF) 0%,#fff 70%);min-height:100vh;padding:28px 18px 60px;transition:background .6s}
main{max-width:520px;margin:0 auto}h1{font-size:26px;font-weight:800;letter-spacing:-.6px}.sub{color:var(--soft);font-size:14px;margin-top:4px}
.today{margin-top:22px;background:#fff;border-radius:28px;padding:22px;box-shadow:0 10px 30px rgba(43,35,80,.10);display:flex;gap:20px;align-items:center}
.ring{width:132px;height:132px;flex:none;position:relative}.ring svg{transform:rotate(-90deg)}.ring circle{transition:stroke-dashoffset .9s cubic-bezier(.2,.7,.2,1)}.ring b{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:30px;font-weight:800;letter-spacing:-1px}.ring b span{font-size:11px;color:var(--soft);font-weight:600;letter-spacing:0}
.macros{flex:1;display:grid;gap:10px}.m{font-size:13px;font-weight:600}.m i{display:inline-block;width:7px;height:7px;border-radius:4px;margin-right:6px}.bar{height:5px;border-radius:3px;background:var(--hair);margin-top:5px;overflow:hidden}.bar b{display:block;height:100%;border-radius:3px;transition:width .9s cubic-bezier(.2,.7,.2,1)}
h2{font-size:13px;letter-spacing:1px;text-transform:uppercase;color:var(--soft);margin:30px 0 10px}
.day{background:#fff;border-radius:20px;padding:14px 16px;box-shadow:0 6px 18px rgba(43,35,80,.06);margin-bottom:10px}.day header{display:flex;justify-content:space-between;align-items:baseline;font-weight:800}.day header small{color:var(--soft);font-weight:600}
.day ul{list-style:none;margin-top:8px;color:var(--soft);font-size:13px}.day li{display:flex;justify-content:space-between;padding:3px 0;border-top:1px solid var(--hair)}.day li span:first-child{color:var(--ink)}
.foot{text-align:center;color:var(--soft);font-size:12px;margin-top:34px}
</style></head><body><main>
<h1 id="t">__TITLE__</h1><div class="sub" id="s"></div>
<section class="today" id="today"></section>
<h2>History</h2><div id="hist"></div>
<div class="foot">Shared live from Real Quick · updates while they share</div>
</main>
<script>
const TOKEN=__TOKEN__;let share=__SHARE__;
const WEEK=[["Monday","#E3F6EC","#3FAF82"],["Tuesday","#FFE9DC","#F07E45"],["Wednesday","#EEE9FF","#7C63E0"],["Thursday","#FFF6D6","#E0A417"],["Friday","#FFE6EF","#EC5A8C"],["Saturday","#E4F2FF","#3F8ED6"],["Sunday","#EEF5DB","#6FA22E"]];
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fmt=n=>Number(n||0).toLocaleString();
const key=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const wd=k=>(new Date(k+'T12:00:00').getDay()+6)%7;
const bar=(v,t,c)=>'<div class="bar"><b style="width:'+(t>0?Math.min(1,v/t)*100:0).toFixed(0)+'%;background:'+c+'"></b></div>';
function render(){
  const days=share.days||{},unit=share.unit||'kcal',today=key(new Date()),w=wd(today);
  document.documentElement.style.setProperty('--bg',WEEK[w][1]);
  document.getElementById('t').textContent=share.name?share.name+'’s days':'A day on Real Quick';
  document.getElementById('s').textContent=WEEK[w][0]+' · live';
  const d=days[today],T=document.getElementById('today');
  if(d){const k=d.goal>0?Math.min(1,d.kcal/d.goal):0,c=2*Math.PI*54,over=d.kcal>d.goal*1.05,col=over?'#FF7F70':WEEK[w][2];
    const p=d.goal*0.25/4,cb=d.goal*0.45/4,f=d.goal*0.30/9;
    T.innerHTML='<div class="ring"><svg width="132" height="132"><circle cx="66" cy="66" r="54" stroke="rgba(43,35,80,.08)" stroke-width="12" fill="none"/><circle cx="66" cy="66" r="54" stroke="'+col+'" stroke-width="12" fill="none" stroke-linecap="round" stroke-dasharray="'+c.toFixed(1)+'" stroke-dashoffset="'+(c*(1-k)).toFixed(1)+'"/></svg><b>'+fmt(d.kcal)+'<span>of '+fmt(d.goal)+' '+unit+'</span></b></div>'+
      '<div class="macros"><div class="m"><i style="background:#FF7F70"></i>Protein '+fmt(d.protein)+' g'+bar(d.protein,p,'#FF7F70')+'</div><div class="m"><i style="background:#FFB938"></i>Carbs '+fmt(d.carbs)+' g'+bar(d.carbs,cb,'#FFB938')+'</div><div class="m"><i style="background:#46BFA0"></i>Fat '+fmt(d.fat)+' g'+bar(d.fat,f,'#46BFA0')+'</div></div>';
  } else T.innerHTML='<div class="sub">Nothing counted yet today.</div>';
  const keys=Object.keys(days).filter(k=>k!==today).sort().reverse();
  document.getElementById('hist').innerHTML=keys.length?keys.map(k=>{const v=days[k],dt=new Date(k+'T12:00:00'),over=v.kcal>v.goal*1.05;
    return '<article class="day"><header><span>'+dt.toLocaleDateString(undefined,{weekday:'long',day:'numeric',month:'long'})+'</span><small>'+fmt(v.kcal)+' / '+fmt(v.goal)+' '+unit+'</small></header>'+bar(v.kcal,v.goal,over?'#FF7F70':WEEK[wd(k)][2])+'<ul>'+(v.entries||[]).map(e=>'<li><span>'+esc(e.title||'Snapped')+'</span><span>'+fmt(e.kcal)+'</span></li>').join('')+'</ul></article>';}).join(''):'<div class="sub">No earlier days yet.</div>';
}
render();
setInterval(async()=>{try{const r=await fetch('/v1/share/'+TOKEN,{cache:'no-store'});if(r.status===404){location.reload();return;}share=await r.json();render();}catch(e){}},60000);
</script></body></html>"""


def render_share(token: str, share: dict) -> str:
    """The page renders itself from the embedded JSON (the viewer's clock
    decides what "today" is) and refreshes from /v1/share/<token> every minute."""
    name = share.get("name") or ""
    public = {k: v for k, v in share.items() if k != "install"}
    data = json.dumps(public, ensure_ascii=False).replace("</", "<\\/")
    title = f"{name}’s days" if name else "A day on Real Quick"
    return SHARE_PAGE.replace("__TITLE__", html.escape(title)).replace("__TOKEN__", json.dumps(token)).replace("__SHARE__", data)

class Handler(BaseHTTPRequestHandler):
    server_version = "realquick/1"

    def _send(self, status: int, payload: dict):
        data = json.dumps(payload, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("Access-Control-Allow-Origin", "*")  # the web dev build
        self.end_headers()
        self.wfile.write(data)

    def _send_html(self, status: int, body: str):
        data = body.encode()
        self.send_response(status)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def do_OPTIONS(self):  # noqa: N802
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Install-Id, X-Platform, X-Purchase-Token")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, DELETE, OPTIONS")
        self.end_headers()

    def do_GET(self):  # noqa: N802
        path = self.path.split("?")[0]
        if path == "/healthz":
            self._send(200, {"ok": True, "key": provider_ready(), "root": APPLE_ROOT.exists(), "provider": PROVIDER, "model": {"anthropic": MODEL, "perplexity": PERPLEXITY_MODEL}.get(PROVIDER, PROVIDER)})
        elif path.startswith("/s/"):
            share = share_for(path[3:])
            if not share:
                self._send_html(404, "<!doctype html><meta charset=utf-8><title>Real Quick</title><p style='font-family:system-ui;padding:40px'>This link is no longer shared.</p>")
            else:
                self._send_html(200, render_share(path[3:], share))
        elif path.startswith("/v1/share/"):
            share = share_for(path[len("/v1/share/"):])
            if not share:
                self._send(404, {"error": {"code": "bad_request"}})
            else:
                self._send(200, {k: v for k, v in share.items() if k != "install"})
        else:
            self._send(404, {"error": {"code": "bad_request"}})

    def _body(self) -> bytes:
        length = int(self.headers.get("Content-Length", "0"))
        if not (0 < length <= MAX_BODY):
            raise GatewayError("bad_request", 413, f"length {length}")
        return self.rfile.read(length)

    def do_POST(self):  # noqa: N802
        started = time.time()
        try:
            if self.path == "/v1/analyze":
                raw = self._body()
                ip = self.headers.get("X-Forwarded-For", self.client_address[0]).split(",")[0].strip()
                status, payload = handle_analyze(self.headers, raw, ip)
                log.info("analyze ok items=%d ms=%d", len(payload["items"]), (time.time() - started) * 1000)
            elif self.path == "/v1/share":
                status, payload = handle_share_put(self.headers, self._body())
                log.info("share updated")
            else:
                raise GatewayError("bad_request", 404, "no such path")
            self._send(status, payload)
        except GatewayError as e:
            log.info("%s refused code=%s why=%s platform=%s", self.path, e.code, e.why, self.headers.get("X-Platform"))
            self._send(e.status, {"error": {"code": e.code}})

    def do_DELETE(self):  # noqa: N802
        try:
            if self.path != "/v1/share":
                raise GatewayError("bad_request", 404, "no such path")
            status, payload = handle_share_delete(self.headers)
            log.info("share stopped")
            self._send(status, payload)
        except GatewayError as e:
            self._send(e.status, {"error": {"code": e.code}})

    def log_message(self, fmt, *args):  # quiet default access log; we log our own lines
        return


def main():
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    log.info("realquick gateway on :%d provider=%s model=%s key=%s", PORT, PROVIDER, MODEL, provider_ready())
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()


if __name__ == "__main__":
    main()
