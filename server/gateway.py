#!/usr/bin/env python3
"""Real Quick model gateway — the app's only server.

One job: take a food photo (or a typed meal), ask a vision model what is on
the plate, and return calories + macros as JSON. The API key, the prompt and
the model choice live here so they can change without an App Review
(app-builder/BACKEND.md → Model gateway).

    POST /v1/analyze   {kind: "photo"|"text", image?: b64 jpeg, text?, lang, tz}
    GET  /healthz      {ok, key, root, provider, model}

Auth without accounts: every install sends a random X-Install-Id. Free
installs get FREE_PER_DAY counts per local day; Pro installs send their store
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
import os
import re
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
FREE_PER_DAY = int(os.environ.get("FREE_PER_DAY", "3"))
PRO_PER_DAY = int(os.environ.get("PRO_PER_DAY", "60"))
# Free counts per IP per day across all installs — stops reinstall farming.
FREE_PER_IP = int(os.environ.get("FREE_PER_IP", "15"))
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

ERROR_CODES = ("daily_limit", "bad_request", "unauthorized", "upstream", "rate_limited")

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

    def do_OPTIONS(self):  # noqa: N802
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Install-Id, X-Platform, X-Purchase-Token")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.end_headers()

    def do_GET(self):  # noqa: N802
        if self.path == "/healthz":
            self._send(200, {"ok": True, "key": provider_ready(), "root": APPLE_ROOT.exists(), "provider": PROVIDER, "model": {"anthropic": MODEL, "perplexity": PERPLEXITY_MODEL}.get(PROVIDER, PROVIDER)})
        else:
            self._send(404, {"error": {"code": "bad_request"}})

    def do_POST(self):  # noqa: N802
        if self.path != "/v1/analyze":
            self._send(404, {"error": {"code": "bad_request"}})
            return
        started = time.time()
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if not (0 < length <= MAX_BODY):
                raise GatewayError("bad_request", 413, f"length {length}")
            raw = self.rfile.read(length)
            ip = self.headers.get("X-Forwarded-For", self.client_address[0]).split(",")[0].strip()
            status, payload = handle_analyze(self.headers, raw, ip)
            log.info("analyze ok items=%d ms=%d", len(payload["items"]), (time.time() - started) * 1000)
            self._send(status, payload)
        except GatewayError as e:
            log.info("analyze refused code=%s why=%s platform=%s", e.code, e.why, self.headers.get("X-Platform"))
            self._send(e.status, {"error": {"code": e.code}})

    def log_message(self, fmt, *args):  # quiet default access log; we log our own lines
        return


def main():
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    log.info("realquick gateway on :%d provider=%s model=%s key=%s", PORT, PROVIDER, MODEL, provider_ready())
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()


if __name__ == "__main__":
    main()
