#!/usr/bin/env python3
"""Draws the illustrated profile avatars bundled with the app.

Ten flat-illustration avatars: four women, one man, and five abstract options
for people who would rather not use a face. Everything is drawn as vector-like
shapes and supersampled 4x, so the PNGs stay crisp when scaled down in the app.

    python3 scripts/generate-avatars.py

Output: assets/images/avatars/avatar-<id>.webp (512x512)
"""
from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / 'assets' / 'images' / 'avatars'
SIZE = 512
SCALE = 4  # supersample, then downscale for smooth edges

# Palette aligned with the app tokens (DESIGN.md: white canvas, Rausch accent).
BACKGROUNDS = [
    '#fff1f4', '#fdf0e7', '#eef4ff', '#eaf7f1', '#f6f0ff', '#fff8e6',
    '#eef7fb', '#fdeef1', '#f1f1f4', '#f0f6ea',
]
SKIN = ['#e8b48f', '#d9a077', '#b97c55', '#8d5a3b', '#5d3a26']
HAIR = ['#2b2320', '#3f2d23', '#1f1b1a', '#5b3a29', '#6b4a34']
SHIRT = ['#ff385c', '#2f6f6b', '#3c4f8a', '#8a6a3c', '#454545', '#7a4a86']


def background(draw: ImageDraw.ImageDraw, colour: str) -> None:
    draw.rectangle([0, 0, SIZE * SCALE, SIZE * SCALE], fill=colour)


def shoulders(draw, colour: str, skin: str) -> None:
    """Neck plus a rounded shirt block at the bottom."""
    s = SCALE
    draw.rounded_rectangle([118 * s, 352 * s, 394 * s, 540 * s], radius=120 * s, fill=colour)
    draw.rounded_rectangle([232 * s, 300 * s, 280 * s, 372 * s], radius=24 * s, fill=skin)


def head(draw, skin: str) -> None:
    s = SCALE
    draw.ellipse([156 * s, 120 * s, 356 * s, 340 * s], fill=skin)
    # ears
    draw.ellipse([148 * s, 210 * s, 178 * s, 258 * s], fill=skin)
    draw.ellipse([334 * s, 210 * s, 364 * s, 258 * s], fill=skin)


def face(draw) -> None:
    s = SCALE
    eye = '#2b2320'
    draw.ellipse([204 * s, 214 * s, 222 * s, 236 * s], fill=eye)
    draw.ellipse([290 * s, 214 * s, 308 * s, 236 * s], fill=eye)
    # brows
    draw.rounded_rectangle([196 * s, 196 * s, 232 * s, 202 * s], radius=4 * s, fill=eye)
    draw.rounded_rectangle([280 * s, 196 * s, 316 * s, 202 * s], radius=4 * s, fill=eye)
    # nose + smile
    draw.rounded_rectangle([250 * s, 244 * s, 262 * s, 268 * s], radius=6 * s, fill='#c9906a')
    draw.arc([222 * s, 250 * s, 290 * s, 302 * s], start=20, end=160, fill='#8a4b3a', width=6 * s)


def long_hair(draw, colour: str) -> None:
    s = SCALE
    # hair mass behind the head, with a centre parting
    draw.ellipse([136 * s, 96 * s, 376 * s, 400 * s], fill=colour)
    draw.ellipse([156 * s, 120 * s, 356 * s, 340 * s], fill=BACKGROUNDS[0])  # punched below
    draw.rounded_rectangle([166 * s, 96 * s, 346 * s, 168 * s], radius=36 * s, fill=colour)


def short_hair(draw, colour: str) -> None:
    s = SCALE
    draw.ellipse([150 * s, 104 * s, 362 * s, 320 * s], fill=colour)
    draw.ellipse([168 * s, 136 * s, 344 * s, 330 * s], fill='#00000000')


def fringe(draw, colour: str) -> None:
    s = SCALE
    draw.chord([156 * s, 108 * s, 356 * s, 300 * s], start=180, end=360, fill=colour)


def avatar_spec(index: int) -> dict:
    """Ten deterministic specs: 4 women, 1 man, 5 abstract."""
    specs = [
        {'id': 'a1', 'kind': 'female', 'label': 'Woman, long hair', 'bg': 0, 'skin': 1, 'hair': 0, 'shirt': 0},
        {'id': 'a2', 'kind': 'female', 'label': 'Woman, bun', 'bg': 1, 'skin': 3, 'hair': 1, 'shirt': 1},
        {'id': 'a3', 'kind': 'female', 'label': 'Woman, curly', 'bg': 4, 'skin': 0, 'hair': 2, 'shirt': 5},
        {'id': 'a4', 'kind': 'female', 'label': 'Woman, short hair', 'bg': 2, 'skin': 2, 'hair': 3, 'shirt': 2},
        {'id': 'a5', 'kind': 'male', 'label': 'Man, short hair', 'bg': 3, 'skin': 2, 'hair': 1, 'shirt': 3},
        {'id': 'a6', 'kind': 'neutral', 'label': 'Abstract, house', 'bg': 5},
        {'id': 'a7', 'kind': 'neutral', 'label': 'Abstract, location pin', 'bg': 6},
        {'id': 'a8', 'kind': 'neutral', 'label': 'Abstract, sun over plot', 'bg': 7},
        {'id': 'a9', 'kind': 'neutral', 'label': 'Abstract, rolling land', 'bg': 8},
        {'id': 'a10', 'kind': 'neutral', 'label': 'Abstract, stacked circles', 'bg': 9},
    ]
    return specs[index]


def draw_female(image: Image.Image, spec: dict) -> None:
    s = SCALE
    draw = ImageDraw.Draw(image)
    hair = HAIR[spec['hair']]
    skin = SKIN[spec['skin']]
    background(draw, BACKGROUNDS[spec['bg']])

    if spec['id'] == 'a3':
        # Curly: a ring of overlapping circles, then the face on top.
        for cx, cy, r in [(196, 150, 74), (256, 120, 84), (318, 152, 74), (170, 220, 66), (344, 222, 66)]:
            draw.ellipse([(cx - r) * s, (cy - r) * s, (cx + r) * s, (cy + r) * s], fill=hair)
        shoulders(draw, SHIRT[spec['shirt']], skin)
        head(draw, skin)
        face(draw)
        return

    # Back hair behind the head; a bob stops at the jaw, long hair runs past the shoulders.
    bottom = 360 if spec['id'] == 'a4' else 420
    draw.ellipse([132 * s, 92 * s, 380 * s, bottom * s], fill=hair)
    shoulders(draw, SHIRT[spec['shirt']], skin)
    head(draw, skin)
    if spec['id'] == 'a2':
        draw.ellipse([214 * s, 60 * s, 298 * s, 144 * s], fill=hair)  # bun
    face(draw)
    # Fringe sits above the brows so the eyes stay clear.
    draw.chord([158 * s, 108 * s, 354 * s, 268 * s], start=180, end=360, fill=hair)
    draw.ellipse([170 * s, 116 * s, 342 * s, 190 * s], fill=hair)
    draw.ellipse([188 * s, 148 * s, 324 * s, 198 * s], fill=skin)


def draw_male(image: Image.Image, spec: dict) -> None:
    s = SCALE
    draw = ImageDraw.Draw(image)
    skin = SKIN[spec['skin']]
    hair = HAIR[spec['hair']]
    background(draw, BACKGROUNDS[spec['bg']])
    shoulders(draw, SHIRT[spec['shirt']], skin)
    head(draw, skin)
    # Cropped hair: one clean cap, hairline above the brows.
    draw.chord([154 * s, 100 * s, 358 * s, 292 * s], start=180, end=360, fill=hair)
    face(draw)


def draw_neutral(image: Image.Image, spec: dict) -> None:
    s = SCALE
    draw = ImageDraw.Draw(image)
    background(draw, BACKGROUNDS[spec['bg']])
    ink = '#222222'
    accent = '#ff385c'
    ident = spec['id']

    if ident == 'a6':  # house
        draw.polygon([(256 * s, 128 * s), (392 * s, 256 * s), (120 * s, 256 * s)], fill=accent)
        draw.rounded_rectangle([152 * s, 248 * s, 360 * s, 400 * s], radius=18 * s, fill=ink)
        draw.rounded_rectangle([228 * s, 316 * s, 284 * s, 400 * s], radius=10 * s, fill=BACKGROUNDS[spec['bg']])
    elif ident == 'a7':  # location pin
        draw.ellipse([168 * s, 120 * s, 344 * s, 296 * s], fill=accent)
        draw.polygon([(212 * s, 258 * s), (300 * s, 258 * s), (256 * s, 404 * s)], fill=accent)
        draw.ellipse([224 * s, 176 * s, 288 * s, 240 * s], fill='#ffffff')
    elif ident == 'a8':  # sun + ground
        draw.ellipse([186 * s, 140 * s, 326 * s, 280 * s], fill=accent)
        draw.rounded_rectangle([110 * s, 320 * s, 402 * s, 344 * s], radius=12 * s, fill=ink)
        draw.rounded_rectangle([150 * s, 360 * s, 362 * s, 384 * s], radius=12 * s, fill=ink)
    elif ident == 'a9':  # hills
        draw.ellipse([110 * s, 236 * s, 330 * s, 420 * s], fill=ink)
        draw.ellipse([236 * s, 196 * s, 430 * s, 420 * s], fill=accent)
        draw.ellipse([210 * s, 150 * s, 302 * s, 242 * s], fill='#ffffff')
    else:  # a10 overlapping circle and ring
        draw.ellipse([110 * s, 214 * s, 352 * s, 442 * s], fill=ink)
        draw.ellipse([238 * s, 132 * s, 424 * s, 318 * s], outline=accent, width=34 * s)


def render(spec: dict) -> Image.Image:
    canvas = Image.new('RGB', (SIZE * SCALE, SIZE * SCALE), '#ffffff')
    if spec['kind'] == 'female':
        draw_female(canvas, spec)
    elif spec['kind'] == 'male':
        draw_male(canvas, spec)
    else:
        draw_neutral(canvas, spec)
    # Round mask so the avatar sits in a circle without a square edge.
    mask = Image.new('L', (SIZE * SCALE, SIZE * SCALE), 0)
    ImageDraw.Draw(mask).ellipse([0, 0, SIZE * SCALE - 1, SIZE * SCALE - 1], fill=255)
    canvas = canvas.resize((SIZE, SIZE), Image.LANCZOS)
    mask = mask.resize((SIZE, SIZE), Image.LANCZOS)
    out = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    out.paste(canvas, (0, 0), mask)
    return out


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for index in range(10):
        spec = avatar_spec(index)
        image = render(spec)
        path = OUT / f"{spec['id']}.webp"
        image.save(path, 'WEBP', quality=88, method=6)
        print(f"{path.name}  {spec['kind']:<8} {spec['label']}")


if __name__ == '__main__':
    main()
