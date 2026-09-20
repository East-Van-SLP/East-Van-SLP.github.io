#!/usr/bin/env python3
"""Build favicon.ico and apple-touch-icon.png from the logo mark.

Needs Pillow. Source is "BG Removed Logo.png" — the same transparent-background
logomark embedded as the SVG favicon (see .claude/favicon.svg.b64) — not
"Logo.png", which is the smaller raster baked *inside* that SVG.

apple-touch-icon.png is flattened onto the site's own background color (#FAF7F0)
rather than kept transparent: iOS composites home-screen icons on white/black
depending on system theme, and a transparent PNG gets an ugly mismatched square
behind it on either. favicon.ico ships multi-resolution (16/32/48) since that's
still what old bookmark managers, RSS readers and some SEO tools request
directly at /favicon.ico regardless of the <link rel="icon"> in <head>.

    python3 .claude/build-icons.py "BG Removed Logo.png"
"""
import sys
from PIL import Image

SRC = sys.argv[1] if len(sys.argv) > 1 else 'BG Removed Logo.png'
BG = '#FAF7F0'

src = Image.open(SRC).convert('RGBA')

src.save('favicon.ico', sizes=[(16, 16), (32, 32), (48, 48)])

touch = Image.new('RGB', src.size, BG)
touch.paste(src, mask=src.split()[3])
touch.resize((180, 180), Image.LANCZOS).save('apple-touch-icon.png')

print('wrote favicon.ico (16/32/48) and apple-touch-icon.png (180x180) from', SRC)
