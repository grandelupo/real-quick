#!/usr/bin/env python3
"""
Everything App Store Connect needs for Real Quick 1.0 that the API can set,
read from listing.md so the listing stays the one source:

    app-builder/.venv/bin/python real-quick/marketing/appstore/asc-setup.py            # all steps
    app-builder/.venv/bin/python real-quick/marketing/appstore/asc-setup.py subs age   # only some

Steps: app (price free, availability, content rights, category), meta (name,
subtitle, keywords, promo, description, URLs, copyright for en-US + ja),
shots (out/en-US, out/ja), review (contact + notes), subs (group, both
products, localizations, prices in every territory, no intro offer,
review screenshot), age (age-rating declaration). Safe to re-run: each step
looks before it creates.

Needs the app record (only the website can create one) and its editable 1.0
version. Not in the API, so not here: the App Privacy answers
(app-privacy.md).
"""

from __future__ import annotations

import argparse
import hashlib
import re
import sys
from pathlib import Path

import requests

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(Path.home() / "src" / "app-builder"))
import asc  # noqa: E402

BUNDLE = "com.latovi.realquick"
LISTING = (HERE / "listing.md").read_text()
COPYRIGHT = "2026 Karol Krakowski"
SUPPORT = "https://karolkrakowski.pl/apps/real-quick/support.htm"
PRIVACY = "https://karolkrakowski.pl/apps/real-quick/privacy.htm"
MARKETING = "https://realquick.lab.karolkrakowski.pl"
CONTACT = {"contactFirstName": "Karol", "contactLastName": "Krakowski", "contactPhone": "+48535782052", "contactEmail": "repus.soft@gmail.com"}
SUBS = [
    {"productId": "com.latovi.realquick.pro.monthly", "period": "ONE_MONTH", "level": 2, "usd": "4.99", "ref": "Real Quick Pro Monthly",
     "loc": {"en-US": ("Real Quick Pro Monthly", "Unlimited AI food counts, billed monthly"), "ja": ("Real Quick Pro 月額", "AIの食事計算が無制限（毎月請求）")}},
    {"productId": "com.latovi.realquick.pro.yearly", "period": "ONE_YEAR", "level": 1, "usd": "29.99", "ref": "Real Quick Pro Yearly",
     "loc": {"en-US": ("Real Quick Pro Yearly", "Unlimited AI food counts, billed yearly"), "ja": ("Real Quick Pro 年額", "AIの食事計算が無制限（毎年請求）")}},
]
GROUP = "Real Quick Pro"


# ── listing.md ─────────────────────────────────────────────────────────────

def section(title: str) -> str:
    m = re.search(rf"^## {re.escape(title)}.*?$(.*?)(?=^## |\Z)", LISTING, re.M | re.S)
    return m.group(1) if m else sys.exit(f"listing.md has no '## {title}' section")


def field(sec: str, name: str) -> str:
    m = re.search(rf"^\| {name} \| `(.+?)` \|", sec, re.M)
    return m.group(1) if m else sys.exit(f"listing.md: no {name} row")


def fenced(sec: str) -> str:
    m = re.search(r"```\n(.*?)\n```", sec, re.S)
    return m.group(1).strip() if m else sys.exit("listing.md: no fenced block")


def locale_copy(title: str) -> dict:
    sec = section(title)
    return {"name": field(sec, "Name"), "subtitle": field(sec, "Subtitle"), "keywords": field(sec, "Keywords"),
            "promo": field(sec, "Promotional text"), "description": fenced(sec)}


# ── helpers ────────────────────────────────────────────────────────────────

def rel(type_: str, id_: str) -> dict:
    return {"data": {"type": type_, "id": id_}}


def upload(c: asc.Client, ops: list, data: bytes) -> None:
    for op in ops:
        chunk = data[op["offset"]: op["offset"] + op["length"]]
        headers = {h["name"]: h["value"] for h in op.get("requestHeaders", [])}
        r = requests.request(op["method"], op["url"], data=chunk, headers=headers, timeout=300)
        if r.status_code >= 400:
            sys.exit(f"upload failed: {r.status_code} {r.text[:200]}")


def maybe(c: asc.Client, path: str) -> dict | None:
    """GET a to-one relationship that may not exist yet (Apple answers 404, not null)."""
    r = requests.get(asc.API + path, headers={"Authorization": "Bearer " + c.token()}, timeout=60)
    if r.status_code == 404:
        return None
    if r.status_code >= 400:
        sys.exit(f"GET {path} → {r.status_code}: {r.text[:300]}")
    return r.json().get("data")


def territories(c: asc.Client) -> list[str]:
    return [t["id"] for t in c.get_all("/territories", limit=200)]


# ── steps ──────────────────────────────────────────────────────────────────

def step_app(c, app, version) -> None:
    aid = app["id"]
    c.patch(f"/apps/{aid}", {"type": "apps", "id": aid, "attributes": {"contentRightsDeclaration": "DOES_NOT_USE_THIRD_PARTY_CONTENT"}})
    info = asc.app_info(c, aid)
    c.patch(f"/appInfos/{info['id']}", {"type": "appInfos", "id": info["id"], "relationships": {
        "primaryCategory": rel("appCategories", "HEALTH_AND_FITNESS"), "secondaryCategory": rel("appCategories", "FOOD_AND_DRINK")}})
    print("content rights, category Health & Fitness / Food & Drink")

    # 404 here just means no schedule has been set yet.
    sched = requests.get(f"{asc.API}/apps/{aid}/appPriceSchedule", headers={"Authorization": "Bearer " + c.token()}, params={"include": "manualPrices"}, timeout=60)
    if sched.status_code == 200 and sched.json().get("included"):
        print("price schedule already set")
    else:
        free = next(p for p in c.get_all(f"/apps/{aid}/appPricePoints", **{"filter[territory]": "USA", "limit": 200})
                    if float(p["attributes"]["customerPrice"]) == 0)
        c.req("POST", "/appPriceSchedules", json={
            "data": {"type": "appPriceSchedules", "relationships": {
                "app": rel("apps", aid), "baseTerritory": rel("territories", "USA"),
                "manualPrices": {"data": [{"type": "appPrices", "id": "${free}"}]}}},
            "included": [{"type": "appPrices", "id": "${free}", "attributes": {"startDate": None},
                          "relationships": {"appPricePoint": rel("appPricePoints", free["id"])}}]})
        print("price: free")

    have = requests.get(f"{asc.API}/apps/{aid}/appAvailabilityV2", headers={"Authorization": "Bearer " + c.token()}, timeout=60)
    if have.status_code == 200 and have.json().get("data"):
        print("availability already set")
    else:
        terrs = territories(c)
        included = [{"type": "territoryAvailabilities", "id": f"${{{t}}}", "attributes": {"available": True},
                     "relationships": {"territory": rel("territories", t)}} for t in terrs]
        c.req("POST", asc.API.replace("/v1", "/v2") + "/appAvailabilities", json={
            "data": {"type": "appAvailabilities", "attributes": {"availableInNewTerritories": True}, "relationships": {
                "app": rel("apps", aid), "territoryAvailabilities": {"data": [{"type": "territoryAvailabilities", "id": i["id"]} for i in included]}}},
            "included": included})
        print(f"availability: {len(terrs)} territories")

    c.patch(f"/appStoreVersions/{version['id']}", {"type": "appStoreVersions", "id": version["id"], "attributes": {"copyright": COPYRIGHT}})
    print("copyright")


def step_meta(c, app, version) -> None:
    for locale, title in (("en-US", "en-US (primary)"), ("ja", "ja (Japanese)")):
        t = locale_copy(title)
        a = argparse.Namespace(app=BUNDLE, version=version["attributes"]["versionString"], locale=locale,
                               name=t["name"], subtitle=t["subtitle"], promo=t["promo"], description=t["description"],
                               keywords=t["keywords"], whats_new=None, support_url=SUPPORT, marketing_url=MARKETING, privacy_url=PRIVACY)
        print(f"[{locale}]")
        asc.cmd_metadata_set(c, a)


def step_shots(c, app, version) -> None:
    for locale, folder in (("en-US", "en-US"), ("ja", "ja")):
        print(f"[{locale}]")
        asc.cmd_screenshots_upload(c, argparse.Namespace(app=BUNDLE, version=version["attributes"]["versionString"], locale=locale,
                                                         dir=str(HERE / "out" / folder), type="APP_IPHONE_67", keep=False))


def step_review(c, app, version) -> None:
    notes = fenced(section("App Review notes"))
    attrs = {**CONTACT, "demoAccountRequired": False, "notes": notes}
    have = maybe(c, f"/appStoreVersions/{version['id']}/appStoreReviewDetail")
    if have:
        c.patch(f"/appStoreReviewDetails/{have['id']}", {"type": "appStoreReviewDetails", "id": have["id"], "attributes": attrs})
    else:
        c.post("/appStoreReviewDetails", {"type": "appStoreReviewDetails", "attributes": attrs,
                                          "relationships": {"appStoreVersion": rel("appStoreVersions", version["id"])}})
    print(f"review contact + notes ({len(notes)} chars)")


def step_subs(c, app, version) -> None:
    aid = app["id"]
    groups = c.get_all(f"/apps/{aid}/subscriptionGroups", limit=50)
    group = next((g for g in groups if g["attributes"]["referenceName"] == GROUP), None)
    if not group:
        group = c.post("/subscriptionGroups", {"type": "subscriptionGroups", "attributes": {"referenceName": GROUP},
                                               "relationships": {"app": rel("apps", aid)}})["data"]
        print(f"group {GROUP}")
    glocs = {l["attributes"]["locale"] for l in c.get_all(f"/subscriptionGroups/{group['id']}/subscriptionGroupLocalizations")}
    for locale in ("en-US", "ja"):
        if locale not in glocs:
            c.post("/subscriptionGroupLocalizations", {"type": "subscriptionGroupLocalizations", "attributes": {"name": GROUP, "locale": locale},
                                                       "relationships": {"subscriptionGroup": rel("subscriptionGroups", group["id"])}})
            print(f"  group name {locale}")

    terrs = None
    review_png = (HERE / "subscription-review.png").read_bytes()
    existing = {s["attributes"]["productId"]: s for s in c.get_all(f"/subscriptionGroups/{group['id']}/subscriptions")}
    for spec in SUBS:
        sub = existing.get(spec["productId"])
        if not sub:
            sub = c.post("/subscriptions", {"type": "subscriptions", "attributes": {
                "name": spec["ref"], "productId": spec["productId"], "subscriptionPeriod": spec["period"],
                "familySharable": False, "groupLevel": spec["level"]},
                "relationships": {"group": rel("subscriptionGroups", group["id"])}})["data"]
            print(f"{spec['productId']}")
        sid = sub["id"]

        locs = {l["attributes"]["locale"]: l for l in c.get_all(f"/subscriptions/{sid}/subscriptionLocalizations")}
        for locale, (name, desc) in spec["loc"].items():
            if locale in locs:
                c.patch(f"/subscriptionLocalizations/{locs[locale]['id']}", {"type": "subscriptionLocalizations", "id": locs[locale]["id"],
                                                                             "attributes": {"name": name, "description": desc}})
            else:
                c.post("/subscriptionLocalizations", {"type": "subscriptionLocalizations", "attributes": {"name": name, "locale": locale, "description": desc},
                                                      "relationships": {"subscription": rel("subscriptions", sid)}})
        print(f"  localizations en-US, ja")


        # Apple wants availability before prices (409 otherwise).
        terrs = terrs or territories(c)
        if not maybe(c, f"/subscriptions/{sid}/subscriptionAvailability"):
            c.post("/subscriptionAvailabilities", {"type": "subscriptionAvailabilities", "attributes": {"availableInNewTerritories": True},
                                                   "relationships": {"subscription": rel("subscriptions", sid),
                                                                     "availableTerritories": {"data": [{"type": "territories", "id": t} for t in terrs]}}})
            print(f"  availability: {len(terrs)} territories")

        if c.get(f"/subscriptions/{sid}/prices", limit=1).get("data"):
            print("  prices already set")
        else:
            usd = next(p for p in c.get_all(f"/subscriptions/{sid}/pricePoints", **{"filter[territory]": "USA", "limit": 200})
                       if p["attributes"]["customerPrice"] == spec["usd"])
            points = [usd] + c.get_all(f"/subscriptionPricePoints/{usd['id']}/equalizations", limit=200, include="territory")
            for p in points:
                c.post("/subscriptionPrices", {"type": "subscriptionPrices", "attributes": {"preserveCurrentPrice": False},
                                               "relationships": {"subscription": rel("subscriptions", sid),
                                                                 "subscriptionPricePoint": rel("subscriptionPricePoints", p["id"])}})
            jpy = next((p for p in points if p.get("relationships", {}).get("territory", {}).get("data", {}).get("id") == "JPN"), None)
            print(f"  prices: {len(points)} territories, US ${spec['usd']}" + (f", Japan ¥{jpy['attributes']['customerPrice']}" if jpy else ""))


        # No introductory offer: the app itself is free for its first 3 days
        # (every count costs model time), so a store trial on top would undo that.
        offers = c.get_all(f"/subscriptions/{sid}/introductoryOffers", limit=200)
        for o in offers:
            c.delete(f"/subscriptionIntroductoryOffers/{o['id']}")
        print(f"  intro offers: {'removed ' + str(len(offers)) if offers else 'none'}")

        shot = maybe(c, f"/subscriptions/{sid}/appStoreReviewScreenshot")
        if shot and (shot["attributes"].get("assetDeliveryState") or {}).get("state") == "FAILED":
            c.delete(f"/subscriptionAppStoreReviewScreenshots/{shot['id']}")
            print(f"  review screenshot had failed ({shot['attributes']['assetDeliveryState'].get('errors')}); re-uploading")
            shot = None
        if shot:
            print("  review screenshot already set")
        else:
            shot = c.post("/subscriptionAppStoreReviewScreenshots", {"type": "subscriptionAppStoreReviewScreenshots",
                          "attributes": {"fileName": "subscription-review.png", "fileSize": len(review_png)},
                          "relationships": {"subscription": rel("subscriptions", sid)}})["data"]
            upload(c, shot["attributes"]["uploadOperations"], review_png)
            c.patch(f"/subscriptionAppStoreReviewScreenshots/{shot['id']}", {"type": "subscriptionAppStoreReviewScreenshots", "id": shot["id"],
                    "attributes": {"uploaded": True, "sourceFileChecksum": hashlib.md5(review_png).hexdigest()}})
            print("  review screenshot")


def step_age(c, app, version) -> None:
    """Age rating as listing.md says: every descriptor NONE, no gambling, no chat,
    no user content, no web access. The one honest Yes is health/wellness
    topics (it is a calorie tracker); Apple computes the rating from that."""
    info = asc.app_info(c, app["id"])
    decl = c.get(f"/appInfos/{info['id']}/ageRatingDeclaration")["data"]
    bools = {"gambling", "lootBox", "advertising", "ageAssurance", "messagingAndChat", "parentalControls", "healthOrWellnessTopics",
             "userGeneratedContent", "socialMedia", "socialMediaAgeRestricted", "unrestrictedWebAccess", "gamblingAndContests", "seventeenPlus"}
    enums = {"alcoholTobaccoOrDrugUseOrReferences", "contests", "gamblingSimulated", "medicalOrTreatmentInformation", "profanityOrCrudeHumor",
             "sexualContentGraphicAndNudity", "sexualContentOrNudity", "horrorOrFearThemes", "matureOrSuggestiveThemes", "violenceCartoonOrFantasy",
             "violenceRealisticProlongedGraphicOrSadistic", "violenceRealistic", "gunsOrOtherWeapons"}
    attrs = {}
    for k in decl["attributes"]:
        if k in bools:
            attrs[k] = k == "healthOrWellnessTopics"
        elif k in enums:
            attrs[k] = "NONE"
    unknown = sorted(set(decl["attributes"]) - bools - enums)
    c.patch(f"/ageRatingDeclarations/{decl['id']}", {"type": "ageRatingDeclarations", "id": decl["id"], "attributes": attrs})
    rating = c.get(f"/appInfos/{info['id']}")["data"]["attributes"].get("appStoreAgeRating")
    print(f"age rating: {len(attrs)} answers set; left untouched: {', '.join(unknown)}; App Store rating now {rating}")


STEPS = {"app": step_app, "meta": step_meta, "shots": step_shots, "review": step_review, "subs": step_subs, "age": step_age}


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    p.add_argument("steps", nargs="*", choices=[*STEPS, []], default=list(STEPS))
    a = p.parse_args()
    c = asc.Client()
    app = asc.find_app(c, BUNDLE)
    version = asc.pick_version(c, app["id"], None)
    if asc.version_state(version) not in asc.EDITABLE:
        sys.exit(f"version {version['attributes']['versionString']} is {asc.version_state(version)}, not editable")
    for name in a.steps or STEPS:
        print(f"── {name}")
        STEPS[name](c, app, version)


if __name__ == "__main__":
    main()
