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

### Updating it from a new export

Changes are authored in the Claude Design canvas and exported as a fresh bundle into
`East Van SLP -  HTML Source/` (gitignored). **The canvas does not carry the fixes below**, so a
raw export always regresses them. Never copy an export straight over `index.html`. Run:

```bash
node .claude/apply-export.mjs "East Van SLP -  HTML Source/<new export>.html"
```

That decodes line 390, applies every fix, re-encodes, and writes `index.html`. It is idempotent —
running it twice changes nothing — and it reports which fixes it applied versus found already
present. If a fix stops matching it throws rather than silently writing a broken file.

Fixes it re-applies: `<html lang="en">` · favicon (data lives in `.claude/favicon.svg.b64`,
because `.gitignore` excludes `*.svg`) · description / canonical / theme-color / Open Graph /
Twitter meta · the per-group stagger from `1f71545`.

To add a fix, add another `fix()` call. To hand-edit instead, decode with:

```bash
sed -n '390p' index.html > line390.txt
```

then `JSON.parse` it. Re-encode with `JSON.stringify(doc).replace(/<\//g, '<\\u002F')` — the
`</` escaping is load-bearing, since the payload sits inside
`<script type="__bundler/template">` and an unescaped `</script>` would end the tag early. Line
378 (assets) should stay byte-identical unless you're adding an image.

## Site structure

Client-side routing via `state.page` — no URLs per page, no anchors. Five pages:
`home`, `services`, `about`, `faq`, `contact`.

Content arrays inside `renderVals()`:
- `serviceData` — 7 services (speech sounds, language, fluency, AAC/autism, parent coaching,
  assessments, daycare visits). Accordion, one open at a time. Voice therapy and feeding &
  swallowing were removed in V2.
- `faqData` — 6 Q&As. Same accordion pattern.
- `quotes`, `places`, `logistics`, `creds`, `steps`, `marks`, `trust`, `include`.

Editor-facing props (in `data-props`): `acceptingClients`, `showTestimonials`, `homeServiceCount`.

`setupReveal()` drives scroll-in animation via IntersectionObserver. The stagger delay is
computed **per sibling group** (`gi` = index among siblings with `[data-reveal]`), not per
document — that was the fix in `1f71545`. The canvas still has the old per-document version, so
every export regresses it; `apply-export.mjs` puts it back.

### Business facts baked into the copy
Practising since 2001 · RASP registered, direct bills to Disability Benefit Funding (renamed from
Autism Funding in V2) · in-home within 10 km of
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

Tracked: `.gitignore`, `index.html`, `CLAUDE.md`, `LICENSE`, `.claude/`. Everything else is
ignored — source photos, `.DS_Store`, and the raw exports in `East Van SLP -  HTML Source/`
(multi-MB base64 that git cannot delta-compress; each version is already captured as an
`index.html` commit).

## Known gaps

- **No `og:image`.** Link previews on Messenger and Facebook show title and description but no
  picture. Adding one means committing an image file and referencing it by absolute URL — the
  bundle's inlined assets are not reachable as URLs. Every candidate photo in this repo shows a
  client's child, so the image needs Meaghan's explicit consent before it goes in a social card.
- **`homeServiceCount` is 6** while there are now 7 services, so the home page hides exactly one.
  That was a sensible teaser at 9 services; at 7 it looks arbitrary. It is a canvas prop, not a
  defect — change it in the canvas, not here.
