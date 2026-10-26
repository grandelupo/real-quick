"""Gateway tests: `python3 -m unittest test_gateway -v` (needs `cryptography`)."""

import base64
import datetime as dt
import json
import os
import re
import tempfile
import threading
import time
import unittest
import urllib.error
import urllib.request
from pathlib import Path

TMP = tempfile.mkdtemp()
os.environ.update(PROVIDER="fake", FAKE_DELAY="0", STATE_FILE=f"{TMP}/usage.json", PORT="0")

import gateway  # noqa: E402

from cryptography import x509  # noqa: E402
from cryptography.hazmat.primitives import hashes, serialization  # noqa: E402
from cryptography.hazmat.primitives.asymmetric import ec, utils  # noqa: E402
from cryptography.x509.oid import NameOID  # noqa: E402

JPEG = base64.b64encode(b"\xff\xd8\xff\xe0" + b"\0" * 400).decode()
APP_API = Path(__file__).resolve().parent.parent / "app" / "src" / "api.ts"


def _cert(name, key, issuer_name, issuer_key, ca):
    now = dt.datetime.now(dt.timezone.utc)
    b = (
        x509.CertificateBuilder()
        .subject_name(x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, name)]))
        .issuer_name(x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, issuer_name)]))
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - dt.timedelta(days=1))
        .not_valid_after(now + dt.timedelta(days=30))
        .add_extension(x509.BasicConstraints(ca=ca, path_length=None), critical=True)
    )
    return b.sign(issuer_key, hashes.SHA256())


def make_chain():
    rk, ik, lk = (ec.generate_private_key(ec.SECP256R1()) for _ in range(3))
    root = _cert("Test Root", rk, "Test Root", rk, True)
    inter = _cert("Test Intermediate", ik, "Test Root", rk, True)
    leaf = _cert("Test Leaf", lk, "Test Intermediate", ik, False)
    return root, inter, leaf, lk


def b64u(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()


def sign_jws(payload, leaf, inter, root, lk):
    header = {"alg": "ES256", "x5c": [base64.b64encode(c.public_bytes(serialization.Encoding.DER)).decode() for c in (leaf, inter, root)]}
    h, p = b64u(json.dumps(header).encode()), b64u(json.dumps(payload).encode())
    der = lk.sign(f"{h}.{p}".encode(), ec.ECDSA(hashes.SHA256()))
    r, s = utils.decode_dss_signature(der)
    return f"{h}.{p}.{b64u(r.to_bytes(32, 'big') + s.to_bytes(32, 'big'))}"


class Headers(dict):
    def get(self, k, d=None):
        return super().get(k, d)


def install():
    return "5f0c8d1e-1111-4222-8333-" + os.urandom(6).hex()


class LogicTests(unittest.TestCase):
    def setUp(self):
        gateway.QUOTA.data.clear()

    def call(self, body, inst=None, ip="1.2.3.4", token=""):
        h = Headers({"X-Install-Id": inst or install(), "X-Platform": "ios", "X-Purchase-Token": token})
        return gateway.handle_analyze(h, json.dumps(body).encode(), ip)

    def test_photo_ok(self):
        status, out = self.call({"kind": "photo", "image": JPEG, "lang": "en", "tz": "+09:00"})
        self.assertEqual(status, 200)
        self.assertEqual(len(out["items"]), 3)

    def test_text_ok(self):
        _, out = self.call({"kind": "text", "text": "grandma casserole"})
        self.assertEqual(out["items"][0]["kcal"], 420)

    def test_free_limit_per_install(self):
        inst = install()
        for _ in range(gateway.FREE_PER_DAY):
            self.call({"kind": "text", "text": "x"}, inst=inst)
        with self.assertRaises(gateway.GatewayError) as e:
            self.call({"kind": "text", "text": "x"}, inst=inst)
        self.assertEqual(e.exception.code, "daily_limit")
        self.assertEqual(e.exception.status, 402)

    def test_free_limit_per_ip_stops_reinstall_farming(self):
        for _ in range(gateway.FREE_PER_IP):
            self.call({"kind": "text", "text": "x"}, ip="9.9.9.9")
        with self.assertRaises(gateway.GatewayError):
            self.call({"kind": "text", "text": "x"}, ip="9.9.9.9")

    def test_upstream_failure_is_refunded(self):
        inst = install()
        orig = gateway.PROVIDERS["fake"]
        gateway.PROVIDERS["fake"] = lambda req: (_ for _ in ()).throw(RuntimeError("boom"))
        try:
            for _ in range(5):
                with self.assertRaises(gateway.GatewayError) as e:
                    self.call({"kind": "text", "text": "x"}, inst=inst)
                self.assertEqual(e.exception.code, "upstream")
        finally:
            gateway.PROVIDERS["fake"] = orig
        self.call({"kind": "text", "text": "x"}, inst=inst)  # still has free counts

    def test_bad_requests(self):
        for body in ({"kind": "photo", "image": "nope"}, {"kind": "photo", "image": base64.b64encode(b"GIF89a" + b"0" * 300).decode()}, {"kind": "text", "text": "  "}, {"kind": "video"}):
            with self.assertRaises(gateway.GatewayError) as e:
                self.call(body)
            self.assertEqual(e.exception.code, "bad_request")
        with self.assertRaises(gateway.GatewayError) as e:
            gateway.handle_analyze(Headers({}), b"{}", "1.1.1.1")
        self.assertEqual(e.exception.code, "unauthorized")

    def test_local_day(self):
        t = dt.datetime(2026, 10, 26, 20, 30, tzinfo=dt.timezone.utc).timestamp()
        self.assertEqual(gateway.local_day("+09:00", t), "2026-10-27")
        self.assertEqual(gateway.local_day("-05:00", t), "2026-10-26")
        self.assertEqual(gateway.local_day("garbage", t), "2026-10-26")

    def test_error_codes_match_the_app(self):
        """Every code the gateway can emit must be decodable by app/src/api.ts."""
        src = APP_API.read_text()
        m = re.search(r"const KNOWN: ApiErrorCode\[\] = \[([^\]]*)\]", src)
        self.assertIsNotNone(m)
        client = set(re.findall(r"'([a-z_]+)'", m.group(1)))
        self.assertEqual(client, set(gateway.ERROR_CODES))


class AnthropicShapeTests(unittest.TestCase):
    def test_request_shape(self):
        seen = {}

        class Block:
            type = "text"
            text = json.dumps({"title": "Toast", "items": []})

        class Usage:
            input_tokens = output_tokens = cache_read_input_tokens = 1

        class Resp:
            stop_reason = "end_turn"
            content = [Block()]
            usage = Usage()

        class Msgs:
            def create(self, **kw):
                seen.update(kw)
                return Resp()

        class Client:
            messages = Msgs()

        gateway._anthropic_client = Client()
        try:
            out = gateway.call_anthropic({"kind": "photo", "image": JPEG, "lang": "ja", "tz": "+09:00"})
        finally:
            gateway._anthropic_client = None
        self.assertEqual(out["title"], "Toast")
        self.assertEqual(seen["model"], gateway.MODEL)
        self.assertEqual(seen["output_config"]["format"]["type"], "json_schema")
        self.assertEqual(seen["system"][0]["cache_control"]["ttl"], "1h")
        content = seen["messages"][0]["content"]
        self.assertEqual(content[0]["type"], "image")
        self.assertIn("Japanese", content[1]["text"])
        self.assertNotIn("thinking", seen)  # adaptive by default; never "disabled" on Opus 5.5


class ReceiptTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.root, cls.inter, cls.leaf, cls.lk = make_chain()
        cls.root_path = Path(TMP) / "root.cer"
        cls.root_path.write_bytes(cls.root.public_bytes(serialization.Encoding.DER))
        gateway.APPLE_ROOT = cls.root_path

    def payload(self, **kw):
        p = {
            "bundleId": "com.latovi.realquick",
            "productId": "com.latovi.realquick.pro.yearly",
            "originalTransactionId": "2000000123",
            "expiresDate": int((time.time() + 86400 * 7) * 1000),
        }
        p.update(kw)
        return p

    def test_valid(self):
        tok = sign_jws(self.payload(), self.leaf, self.inter, self.root, self.lk)
        self.assertEqual(gateway.verify_apple_jws(tok), "2000000123")

    def test_rejects_tampering_and_wrong_claims(self):
        good = sign_jws(self.payload(), self.leaf, self.inter, self.root, self.lk)
        h, p, s = good.split(".")
        forged = b64u(json.dumps(self.payload(productId="com.latovi.realquick.pro.yearly", originalTransactionId="999")).encode())
        cases = [
            f"{h}.{forged}.{s}",
            sign_jws(self.payload(bundleId="com.evil"), self.leaf, self.inter, self.root, self.lk),
            sign_jws(self.payload(productId="other"), self.leaf, self.inter, self.root, self.lk),
            sign_jws(self.payload(revocationDate=1), self.leaf, self.inter, self.root, self.lk),
            sign_jws(self.payload(expiresDate=int((time.time() - 3 * 86400) * 1000)), self.leaf, self.inter, self.root, self.lk),
        ]
        for tok in cases:
            with self.assertRaises(Exception):
                gateway.verify_apple_jws(tok)

    def test_rejects_foreign_root(self):
        root2, inter2, leaf2, lk2 = make_chain()
        tok = sign_jws(self.payload(), leaf2, inter2, root2, lk2)
        with self.assertRaises(Exception):
            gateway.verify_apple_jws(tok)

    def test_pro_gets_pro_limit(self):
        gateway.QUOTA.data.clear()
        tok = sign_jws(self.payload(originalTransactionId="555"), self.leaf, self.inter, self.root, self.lk)
        inst = install()
        for _ in range(gateway.FREE_PER_DAY + 2):
            h = Headers({"X-Install-Id": inst, "X-Platform": "ios", "X-Purchase-Token": tok})
            status, _ = gateway.handle_analyze(h, json.dumps({"kind": "text", "text": "x"}).encode(), "5.5.5.5")
            self.assertEqual(status, 200)


class HttpTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.srv = gateway.ThreadingHTTPServer(("127.0.0.1", 0), gateway.Handler)
        cls.port = cls.srv.server_address[1]
        threading.Thread(target=cls.srv.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.srv.shutdown()

    def test_health(self):
        with urllib.request.urlopen(f"http://127.0.0.1:{self.port}/healthz") as r:
            data = json.loads(r.read())
        self.assertTrue(data["ok"])
        self.assertTrue(data["key"])

    def test_error_shape(self):
        req = urllib.request.Request(
            f"http://127.0.0.1:{self.port}/v1/analyze",
            data=json.dumps({"kind": "nope"}).encode(),
            headers={"Content-Type": "application/json", "X-Install-Id": install()},
        )
        with self.assertRaises(urllib.error.HTTPError) as e:
            urllib.request.urlopen(req)
        self.assertEqual(json.loads(e.exception.read())["error"]["code"], "bad_request")


if __name__ == "__main__":
    unittest.main()
