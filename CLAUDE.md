# East Van SLP — Meaghan McLeod

Marketing site for a Vancouver paediatric speech-language pathologist.
Live at **https://east-van-slp.github.io/** (GitHub Pages, `main` branch, root path).
Repo: `East-Van-SLP/East-Van-SLP.github.io`.

## What the site actually is

`index.html` is the **entire site** — a single self-extracting bundle, ~2.3 MB, 392 lines.
There is no build step, no framework install, no `package.json`. Deploy = commit `index.html`
to `main`; Pages serves it directly.

Its 392 lines are not hand-authored. The structure is:

| Line | Contents |
|---|---|
| 1–377 | Loader shell: splash SVG, error sink, the unpacker script |
| **378** | ~2.28 MB base64 asset payload — 19 assets (photos, Karla + Newsreader woff2, favicon) |
| 379–389 | Unpack glue |
| **390** | ~73 KB JSON-encoded string containing the real page document |

Line 390 decodes to a Claude Design canvas document (`<x-dc>` root) with a
`<script type="text/x-dc">` block defining `class Component extends DCLogic`. That class holds
**all copy and all behaviour**. Everything you'd normally call "the site" lives there.

### Editing it

Do not hand-edit line 378 or 390 in place. Decode → edit → re-encode:

```bash
python3 -c "import json; open('site.html','w').write(json.loads(open('line390.txt').read().strip()))"
```

…where `line390.txt` is `sed -n '390p' index.html`. Re-encode with `json.dumps` and splice back
with `sed`. Line 378 (assets) should stay byte-identical unless you're adding an image.

For anything larger than a copy tweak, prefer re-exporting from the Claude Design canvas that
produced this bundle rather than patching the encoded string.

## Site structure

Client-side routing via `state.page` — no URLs per page, no anchors. Five pages:
`home`, `services`, `about`, `faq`, `contact`.

Content arrays inside `renderVals()`:
- `serviceData` — 9 services (speech sounds, language, fluency, AAC/autism, parent coaching,
  assessments, voice, feeding, daycare visits). Accordion, one open at a time.
- `faqData` — 6 Q&As. Same accordion pattern.
- `quotes`, `places`, `logistics`, `creds`, `steps`, `marks`, `trust`, `include`.

Editor-facing props (in `data-props`): `acceptingClients`, `showTestimonials`, `homeServiceCount`.

`setupReveal()` drives scroll-in animation via IntersectionObserver. The stagger delay is
computed **per sibling group** (`gi` = index among siblings with `[data-reveal]`), not per
document — that was the fix in `1f71545`, and it's easy to regress if you touch that function.

### Business facts baked into the copy
Practising since 2001 · RASP registered, direct bills to Autism Funding · in-home within 10 km of
Hastings-Sunrise · daycare/school visits · office near the PNE · Zoom · Mon–Fri 9:00–3:30, a few
online slots after 4:00 pm · reports $80/hr · meaghan@eastvanslp.ca · 778-230-3899.

## Local preview

```bash
node .claude/serve.mjs 8642
```

`.claude/launch.json` points the Claude preview at the same script, so `preview_start` works too.

The config originally read `python -m http.server`, carried over from Windows. It was switched to
this Node server because `node` is spelled the same on both machines, while the Python entry point
is not — macOS has only `python3`, Windows typically only `python`. `python3 -m http.server` does
work here, so revert if you'd rather; you'd just need to remember to flip it back when working
from Windows.

## Repo hygiene

Only `.gitignore` and `index.html` are tracked. `.gitignore` excludes `*.jpg *.jpeg *.png *.svg
*.zip *.docx`, so the loose source photos and `drive-download-*/` stay local — the site doesn't
need them, the assets are already inlined in line 378.

`Meaghan McLeod - East Van SLP (website).html` is the **original untouched export**. `index.html`
is that file plus a favicon `<link>` and the stagger fix. It is stale; keep it only as a
reference copy, and never deploy it.
