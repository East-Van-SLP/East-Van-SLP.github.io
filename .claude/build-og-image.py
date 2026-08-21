#!/usr/bin/env python3
"""Compose the Open Graph card (1200x630) from Meaghan's headshot.

Needs Pillow. Fonts fall back to Georgia, which is the site's own declared
serif fallback (`font-family: Newsreader, Georgia, serif`).

    python3 .claude/build-og-image.py MMcLeod.jpg og-image.jpg
"""
import sys
from PIL import Image, ImageDraw, ImageFont

SRC = sys.argv[1] if len(sys.argv) > 1 else 'MMcLeod.jpg'
OUT = sys.argv[2] if len(sys.argv) > 2 else 'og-image.jpg'

W, H = 1200, 630
CREAM, INK, GREEN, LIME, MUTED, SAGE = '#FAF7F0', '#26301F', '#3F5A32', '#8FD14F', '#66755A', '#7E8F6C'
WASH = '#EDF1E5'

def font(paths, size):
    for p in paths:
        try:
            return ImageFont.truetype(p, size)
        except OSError:
            continue
    return ImageFont.load_default()

SERIF = ['/System/Library/Fonts/Supplemental/Georgia.ttf']
SANS  = ['/System/Library/Fonts/Helvetica.ttc',
         '/System/Library/Fonts/Supplemental/Arial.ttf']

card = Image.new('RGB', (W, H), CREAM)
d = ImageDraw.Draw(card)

# Blob motif, echoing the bundle's splash SVG (a #3F5A32 circle behind a #8FD14F one).
wash = Image.new('RGB', (W, H), CREAM)
ImageDraw.Draw(wash).ellipse([760, -150, 1320, 410], fill=WASH)
ImageDraw.Draw(wash).ellipse([620, 330, 900, 610], fill=WASH)
card = Image.blend(card, wash, 1.0)
d = ImageDraw.Draw(card)

# Circular portrait, framed so the crop sits on her face rather than the image centre.
photo = Image.open(SRC).convert('RGB')
pw, ph = photo.size
side = int(min(pw, ph) * 0.78)
cx, cy = pw // 2, int(ph * 0.42)
box = (max(0, cx - side // 2), max(0, cy - side // 2))
photo = photo.crop((box[0], box[1], box[0] + side, box[1] + side))

D = 430
photo = photo.resize((D, D), Image.LANCZOS)
mask = Image.new('L', (D * 4, D * 4), 0)
ImageDraw.Draw(mask).ellipse([0, 0, D * 4, D * 4], fill=255)
mask = mask.resize((D, D), Image.LANCZOS)

PX, PY = 726, (H - D) // 2
ring = 7
d.ellipse([PX - ring, PY - ring, PX + D + ring, PY + D + ring], fill=CREAM)
d.ellipse([PX - 3, PY - 3, PX + D + 3, PY + D + 3], fill=LIME)
card.paste(photo, (PX, PY), mask)

# Left column
x = 84
d.rectangle([x, 168, x + 58, 173], fill=LIME)

label = font(SANS, 23)
t = 'EAST VAN SLP'
cur = x
for ch in t:                                    # manual tracking; PIL has no letter-spacing
    d.text((cur, 116), ch, font=label, fill=SAGE)
    cur += d.textlength(ch, font=label) + 4.6

name_f = font(SERIF, 68)
d.text((x, 214), 'Meaghan McLeod', font=name_f, fill=INK)
d.text((x, 318), 'Registered speech-language', font=font(SERIF, 37), fill=GREEN)
d.text((x, 366), 'pathologist, since 2001', font=font(SERIF, 37), fill=GREEN)

body = font(SANS, 25)
d.text((x, 452), 'Play-based speech and language therapy', font=body, fill=MUTED)
d.text((x, 488), 'for children in East Vancouver.', font=body, fill=MUTED)

d.text((x, 546), 'east-van-slp.github.io', font=font(SANS, 22), fill=SAGE)

# The card is only correct if the text column clears the portrait. Fail loudly
# rather than shipping an overlap.
widest = max(d.textlength(t, font=f) for t, f in [
    ('Meaghan McLeod', name_f),
    ('Registered speech-language', font(SERIF, 37)),
    ('Play-based speech and language therapy', body),
])
if x + widest > PX - 16:
    raise SystemExit(f'text column ({x + widest:.0f}px) overlaps portrait at {PX}px — '
                     f'reduce a font size or move the portrait right')

card.save(OUT, 'JPEG', quality=88, optimize=True, progressive=True)
print(f'{OUT}: {W}x{H}')
