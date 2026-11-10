#!/usr/bin/env python3
"""Pick the model, the effort and the prompt with numbers, not vibes.

    # typed meals: a regression guard, no photos needed
    ANTHROPIC_API_KEY=... python3 eval.py text claude-opus-5-5 claude-haiku-5-5

    # photos: the measurement that actually matters
    ANTHROPIC_API_KEY=... python3 eval.py photos/ claude-opus-5-5

    # sweep the effort setting on one model
    ANTHROPIC_API_KEY=... EFFORTS=low,medium python3 eval.py photos/ claude-opus-5-5

`photos/` holds JPEGs plus `truth.csv` with `file,kcal` rows — meals you
weighed and looked up yourself (10-20 is enough to see the spread). Shoot
them the way the app does: one plate, from where you would normally sit.

`text` instead of a folder runs `eval-text.csv`, which is typed meals with
settled reference values. It costs almost nothing and catches a prompt or
model change that breaks the arithmetic — but it tells you nothing about the
hard part, which is judging a portion from a photo. Only the photo set does
that.

Both report **bias** as well as error. For a tracker bias is the number that
matters: counts that scatter either side of the truth average out over a
day, counts that are all 15% low quietly tell the user they can eat more.

Every run spends real money (roughly: photos x models x efforts x ~$0.01).
"""

import base64
import csv
import os
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


def load(target: str) -> tuple[str, list[tuple[str, float]]]:
    """(kind, [(case, truth kcal)]) for a photo folder or the typed set."""
    if target == "text":
        rows = list(csv.DictReader(open(Path(__file__).parent / "eval-text.csv")))
        return "text", [(r["text"], float(r["kcal"])) for r in rows]
    folder = Path(target)
    truth = folder / "truth.csv"
    if not truth.exists():
        sys.exit(f"{truth} not found — it needs `file,kcal` rows for the JPEGs in {folder}/")
    rows = list(csv.DictReader(open(truth)))
    missing = [r["file"] for r in rows if not (folder / r["file"]).exists()]
    if missing:
        sys.exit(f"missing photos: {', '.join(missing)}")
    return "photo", [(str(folder / r["file"]), float(r["kcal"])) for r in rows]


def request(kind: str, case: str) -> dict:
    if kind == "text":
        return {"kind": "text", "text": case, "lang": "en", "tz": "+00:00"}
    img = base64.b64encode(Path(case).read_bytes()).decode()
    return {"kind": "photo", "image": img, "lang": "en", "tz": "+00:00"}


def main():
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    target, models = sys.argv[1], sys.argv[2:]
    kind, cases = load(target)
    efforts = os.environ.get("EFFORTS", gateway.EFFORT).split(",")

    usage_log = []
    orig_info = gateway.log.info
    gateway.log.info = lambda fmt, *a: usage_log.append(a) if fmt.startswith("anthropic ok") else orig_info(fmt, *a)

    print(f"{len(cases)} {kind} cases x {len(models)} model(s) x {len(efforts)} effort(s)\n")
    runs = []
    for model in models:
        for effort in efforts:
            gateway.MODEL = model
            gateway.EFFORT = effort
            gateway._anthropic_client = None
            signed, lat, cost, failed = [], [], [], 0
            for case, kcal in cases:
                label = Path(case).name if kind == "photo" else case
                t0 = time.time()
                try:
                    out = gateway.call_anthropic(request(kind, case))
                except Exception as e:  # a model that errors is a result too
                    failed += 1
                    print(f"  {label[:34]:34} FAILED {type(e).__name__}")
                    continue
                lat.append(time.time() - t0)
                got = sum(float(i.get("kcal", 0)) for i in out.get("items", []))
                err = (got - kcal) / kcal * 100
                signed.append(err)
                _, tin, tout, _ = usage_log[-1]
                pin, pout = PRICES.get(model, (0, 0))
                cost.append(tin / 1e6 * pin + tout / 1e6 * pout)
                print(f"  {label[:34]:34} truth {kcal:6.0f}  got {got:6.0f}  {err:+6.1f}%")
            if not signed:
                print(f"{model} / {effort}: every case failed\n")
                continue
            errs = [abs(e) for e in signed]
            runs.append((model, effort, statistics.median(errs), statistics.median(signed), statistics.mean(cost)))
            print(
                f"\n{model} / effort={effort}\n"
                f"  error  median {statistics.median(errs):5.1f}%   mean {statistics.mean(errs):5.1f}%\n"
                f"  bias   median {statistics.median(signed):+5.1f}%   mean {statistics.mean(signed):+5.1f}%"
                f"   ({sum(1 for e in signed if e < 0)}/{len(signed)} under)\n"
                f"  within 20%: {sum(1 for e in errs if e <= 20)}/{len(errs)}"
                f"   latency {statistics.median(lat):4.1f}s   ${statistics.mean(cost):.4f}/count"
                + (f"   {failed} failed" if failed else "")
                + "\n"
            )

    if len(runs) > 1:
        print("summary (best median error first)")
        for model, effort, err, bias, cost in sorted(runs, key=lambda r: r[2]):
            print(f"  {model:20} effort={effort:7} err {err:5.1f}%  bias {bias:+5.1f}%  ${cost:.4f}")


if __name__ == "__main__":
    main()
