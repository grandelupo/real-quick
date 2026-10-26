# Soft-3D art — how it was made

The objects in `app/assets/art/` (one per weekday + the camera) are matte
clay renders from Gemini (Karol's own web subscription, driven through
`video-generator/tools/gemini-web`), cut out with `cutout.py`. Raw renders
stay in `raw/`. The style prompt is the same for every object; only the
*Object* line changes. No reference image is needed — the prompt alone keeps
the set consistent.

## Style prompt

> Soft 3D render in a matte clay / claymorphism style: smooth rounded forms,
> soft matte material with a very gentle sheen, soft studio light from the top
> left, subtle ambient occlusion in the creases, pastel but natural colours, no
> outlines, no face, no text. A single object, centered, filling about 70% of
> the frame, floating with NO drop shadow and NO ground plane, on a pure flat
> white background (#FFFFFF). Square 1:1, high resolution. Style of premium
> modern app illustrations (like the Forest app).
>
> Object: …

## Objects

| File | Day | Object line |
|---|---|---|
| avocado | Mon · mint | an avocado cut in half, the half with the pit facing the camera, three-quarter view from slightly above; soft sage-green flesh, cream-green centre, a smooth round brown pit |
| peach | Tue · peach | a whole ripe peach with one small green leaf, three-quarter view; soft peach-to-rose gradient skin with a gentle seam |
| grapes | Wed · lavender | a small bunch of purple grapes (about nine plump round grapes) with a short stem and one leaf; soft lavender-violet tones |
| lemon | Thu · butter | a whole lemon beside a single lemon slice leaning against it; soft butter-yellow skin, pale segments |
| strawberry | Fri · bubblegum | a single strawberry with a green calyx, tilted slightly; soft rose-red with gently dimpled seeds |
| blueberries | Sat · sky | a small cluster of five blueberries, one in front, soft dusty blue with a lighter bloom |
| pear | Sun · matcha | a single pear with a short brown stem and one leaf, three-quarter view; soft matcha-green to pale yellow gradient |
| camera | — | a cute compact camera seen from the front, slightly from above; cream body with a rounded dark-navy lens ring and a small coral shutter button |

Then: `python3 marketing/brand-art/cutout.py marketing/brand-art/raw/<name>.png`.
