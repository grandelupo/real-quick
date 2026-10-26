# Real Quick — brand sheet

## 1. Name + outcome

**Real Quick – The Fastest Calorie Tracker.** Store name (30-char limit):
`Real Quick – Calorie Tracker`; home-screen name: `Real Quick`.

Outcome line (onboarding hook, screenshot frame 1, website hero):
**"Snap your food. That's it."** — one tap, counted while you eat.

## 2. Emotion words

**Light, playful, effortless.** Tracking food usually feels like homework;
this should feel like taking a photo of something nice.

## 3. Palette

| Role | Hex | Notes |
|---|---|---|
| Ink (every outline, all text) | `#2B2350` | House dark navy |
| Brand blush (icon field, primary buttons) | `#FF9EB5` / glow `#FFE9EF → #FFB8CA` | The lively brand background |
| Paper (sheets, cards) | `#FFFDF7` | Warm off-white |
| Night sheet | `#FBFAF8` | 20:00–05:59 the world turns white with a line landscape |
| Protein / Carbs / Fat (UI) | `#FF7F70` / `#FFB938` / `#46BFA0` | Fixed hue per macro, everywhere |
| Pizza wedges (icon, mascot) | `#FF8E86` / `#FFC9AE` / `#FFE08A` | Pastel versions of the macro trio |

One pastel world per weekday (`app/src/theme.ts`):

| Day | Background | Ring | Doodles |
|---|---|---|---|
| Mon — mint | `#CFF2E2` | `#3FAF82` | avocado, pea pod, kiwi |
| Tue — peach | `#FFDCC9` | `#F07E45` | peach, croissant, carrot |
| Wed — lavender | `#E4DCFF` | `#7C63E0` | grapes, plum, macaron |
| Thu — butter | `#FFF1B8` | `#E0A417` | banana, lemon, egg |
| Fri — bubblegum | `#FFD8E6` | `#EC5A8C` | strawberry, donut, cherry |
| Sat — sky | `#D3ECFF` | `#3F8ED6` | blueberry, ice cream, cupcake |
| Sun — matcha | `#E2F0C6` | `#6FA22E` | pizza slice, tomato, pear |

The app is fully branded and **follows the clock, not the system
appearance**: day worlds by day, the white night sheet by night (Settings can
turn the night look off). This is a deliberate deviation from BLUEPRINT §2's
native light/dark rule — the brief asked for a branded, non-native look.

## 4. Type

- Display: **Fredoka** (SemiBold/Bold) — rounded, friendly, great numerals.
- Body: **Nunito** (SemiBold/ExtraBold).
- Both embedded (`app/assets/fonts`, OFL), static instances cut from the
  variable fonts so Android weights render exactly. Japanese falls back to
  the system font (Hiragino / Noto Sans JP).

## 5. Mascot — "Slice"

A pizza that is also a pie chart of the day's macros: three pastel wedges
(protein · carbs · fat) in a toasted crust, the protein wedge pulled out
like a slice being grabbed, two oval dot eyes and blush cheeks sitting
inside the big wedge so no line crosses the face. Personality: a cheerful
little foodie who never judges what you ate.

Poses (drawn in code, `app/src/art/Mascot.tsx`): `wave` (onboarding hook,
paywall), `think` (goal step), `happy` (default, share card), `wow` (snap
confirmation, success), `sleep` (empty states, camera off).

## 6. Do / don't

Do: thick ink outlines · flat pastel fills · dot eyes + blush · one doodle
family per weekday · springs on everything that moves.

Don't: photos of food in the UI chrome · gradients on the mascot · 3D or
gloss · red "over budget" alarm colours (over is a soft coral, never a
warning) · guilt copy ("cheat", "bad food").

## Artwork status

Everything in the shipped app is vector art drawn in code, so the app is
complete without generated images. Optional Higgsfield upgrades (sticker-style
mascot pose sheet, richer doodles, a website hero) are listed with ready
prompts in `HANDOFF.md` → *Image prompts*.
