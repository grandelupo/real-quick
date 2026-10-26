# Real Quick — brand sheet

## 1. Name + outcome

**Real Quick – The Fastest Calorie Tracker.** Store name (30-char limit):
`Real Quick – Calorie Tracker`; home-screen name: `Real Quick`.

Outcome line (onboarding hook, screenshot frame 1, website hero):
**"Snap your food. That's it."** — one tap, counted while you eat.

## 2. Emotion words

**Calm, light, effortless.** Tracking food usually feels like homework; this
should feel like glancing at a well-made object. Friendly, never childish.

## 3. Look: soft clay

Depth comes from light, not lines. No outlines anywhere in the UI.

- **Surfaces** are white, resting a little above the page: a wide soft
  shadow (`SHADOW` in `theme.ts`), a hairline of light along the top edge.
- **The clay button**: a gentle vertical gradient of the brand blush with a
  light top edge and a shadow tinted in its own colour.
- **The ring** is a soft tube: a faint inset track, a gradient arc from the
  day's light tone to its strong one, a thin highlight along the arc, on a
  white disc.
- **Backgrounds**: the weekday pastel as a quiet vertical gradient with two
  large soft light orbs. By night an off-white sheet with a pale moon and two
  soft hills.
- **One soft-3D object per day** (`app/assets/art/`, see
  `marketing/brand-art/PROMPTS.md`): matte clay renders — avocado, peach,
  grapes, lemon, strawberry, blueberries, pear — plus the camera for
  onboarding, the paywall and the camera-off state. They are the only
  illustration in the app; no emoji, no doodles, no faces.

## 4. Palette

| Role | Hex | Notes |
|---|---|---|
| Ink (all text) | `#2B2350` | House dark navy; also the dark buttons |
| Brand blush (clay button, accents) | `#FF9EB5` → `#F77F9F` | Button gradient `#FFB7C9 → #FF93AE` |
| Paper (sheets) | `#FFFDF9` | Warm off-white |
| Surface (cards, chips) | `#FFFFFF` | |
| Night sheet | `#F7F5F2 → #ECE8F3` | 20:00–05:59 |
| Protein / Carbs / Fat | `#FF7F70` / `#FFB938` / `#46BFA0` | Fixed hue per macro, everywhere |

One pastel world per weekday (`app/src/theme.ts`):

| Day | Gradient | Ring | Object |
|---|---|---|---|
| Mon — mint | `#E3F6EC → #C4ECD9` | `#3FAF82` | avocado |
| Tue — peach | `#FFE9DC → #FFD0B9` | `#F07E45` | peach |
| Wed — lavender | `#EEE9FF → #D8CEFF` | `#7C63E0` | grapes |
| Thu — butter | `#FFF6D6 → #FFEAA6` | `#E0A417` | lemon |
| Fri — bubblegum | `#FFE6EF → #FFCBDC` | `#EC5A8C` | strawberry |
| Sat — sky | `#E4F2FF → #C6E3FF` | `#3F8ED6` | blueberries |
| Sun — matcha | `#EEF5DB → #DAEBB6` | `#6FA22E` | pear |

The app is fully branded and **follows the clock, not the system
appearance**: day worlds by day, the night sheet by night (Settings can turn
the night look off). A deliberate deviation from BLUEPRINT §2.

## 5. Type

**Plus Jakarta Sans** for everything (Medium, SemiBold, Bold, ExtraBold —
static instances cut from the variable font so Android weights render
exactly; `app/assets/fonts`, OFL). Hero numbers ExtraBold with tight
tracking, titles Bold, body Medium. Japanese falls back to the system font.

## 6. Motion

Short ease-out curves (`app/src/ui/motion.ts`), 140–420 ms, nothing
overshoots, nothing loops. Presses settle 2–3% smaller and slightly dimmer.
No springs, no bobbing, no nudges — the hints are static chips.

## 7. Do / don't

Do: soft shadows · gradients that read as light · one object per day · lots
of quiet space · tabular numerals.

Don't: outlines · emoji · faces on food · springs or bounces · red "over
budget" alarm colours (over is a soft coral) · guilt copy ("cheat", "bad
food").

## 8. App icon

The pizza-that-is-a-pie-chart mascot (`marketing/brand/icon.svg`, with the
face) stays — Karol prefers it to the clay draft in
`marketing/brand-art/raw/icon.png`. It is the one place the face appears.
