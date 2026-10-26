#!/usr/bin/env python3
"""Pick the model with numbers, not vibes.

    ANTHROPIC_API_KEY=... python3 eval.py photos/ claude-haiku-5-5 claude-sonnet-5-5 claude-opus-5-5

`photos/` holds JPEGs plus `truth.csv` with `file,kcal` rows — meals you
weighed and looked up yourself (10–20 is enough to see the spread). Prints,
per model: median and mean absolute % error against your kcal, median
latency, and the measured cost per photo. Every run spends real money
(roughly 20 photos × models × ~$0.0005–0.02).
"""

import base64
import csv
import statistics
import sys
import time
from pathlib import Path

import gateway

# $ per million tokens (input, output) — app-builder skill table, Oct 2026.
PRICES = {
    "claude-haiku-5-5": (0.10, 0.50),
    "claude-sonnet-5-5": (2.00, 10.00),
    "claude-opus-5-5": (4.00, 20.00),
}


def main():
    folder, models = Path(sys.argv[1]), sys.argv[2:]
    truth = {r["file"]: float(r["kcal"]) for r in csv.DictReader(open(folder / "truth.csv"))}
    usage_log = []
    orig_info = gateway.log.info
    gateway.log.info = lambda fmt, *a: usage_log.append(a) if fmt.startswith("anthropic ok") else orig_info(fmt, *a)
    for model in models:
        gateway.MODEL = model
        gateway._anthropic_client = None
        errs, lat, cost = [], [], []
        for name, kcal in truth.items():
            img = base64.b64encode((folder / name).read_bytes()).decode()
            t0 = time.time()
            out = gateway.call_anthropic({"kind": "photo", "image": img, "lang": "en", "tz": "+00:00"})
            lat.append(time.time() - t0)
            got = sum(float(i.get("kcal", 0)) for i in out.get("items", []))
            errs.append(abs(got - kcal) / kcal * 100)
            _, tin, tout, _ = usage_log[-1]
            pin, pout = PRICES.get(model, (0, 0))
            cost.append(tin / 1e6 * pin + tout / 1e6 * pout)
            print(f"  {model:20} {name:28} truth {kcal:6.0f}  got {got:6.0f}")
        print(
            f"{model:20} median err {statistics.median(errs):5.1f}%  mean {statistics.mean(errs):5.1f}%  "
            f"latency {statistics.median(lat):4.1f}s  ${statistics.mean(cost):.4f}/photo"
        )


if __name__ == "__main__":
    main()
