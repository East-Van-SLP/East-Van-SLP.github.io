# East Van SLP — Meaghan McLeod

Marketing site for a Vancouver paediatric speech-language pathologist.
Live at **https://eastvanslp.ca/** — GitHub Pages, `main` branch, root path, custom domain
pinned by the tracked `CNAME` file. Repo: `East-Van-SLP/East-Van-SLP.github.io`.

`www`, plain `http`, and the old `east-van-slp.github.io` address all 301 to the apex.
The domain is registered at GoDaddy and **its DNS also carries Meaghan's Microsoft 365 email** —
see "Don't break the email" below before touching anything DNS-shaped.

## What the site is

**Five real pages**, each its own self-contained HTML file, served at real URLs:

| URL | File | Size |
|---|---|---|
| `/` | `index.html` | ~1.6 MB |
| `/services/` | `services/index.html` | ~1.1 MB |
| `/about/` | `about/index.html` | ~1.3 MB |
| `/faq/` | `faq/index.html` | ~0.9 MB |
| `/contact/` | `contact/index.html` | ~1.0 MB |

No build step, no framework, no `package.json`. Deploy = commit to `main`.

Each file is a self-extracting bundle of ~393 lines, and almost none of it is hand-authored:

- a loader shell (splash SVG, error sink, unpacker) with that page's own `<title>`
- one enormous base64 **asset payload** line
- one **template payload** line: a JSON-encoded string holding the real page document

**Never hardcode those line numbers.** They have already shifted once (the template payload was
line 390 before the split, 391 after). Both scripts locate it the robust way, and so should you:

```js
const i = lines.findIndex(l => l.startsWith('"<!DOCTYPE html>'));
```

Decoded, that string is a Claude Design canvas document (`<x-dc>` root) whose
`<script type="text/x-dc">` block defines `class Component extends DCLogic`. That class holds
all copy and all behaviour.

Each page's asset payload is **subset to only what that page uses**, which is why the files
differ in size rather than all carrying the full ~2.3 MB.

## Updating from a new export — TWO steps

Changes are authored in the Claude Design canvas and exported into `East Van SLP -  HTML Source/`
(gitignored). **The canvas carries none of the fixes below**, so a raw export regresses every one
of them. Never copy an export over a page file.

```bash
node .claude/apply-export.mjs "East Van SLP -  HTML Source/<new export>.html"
node .claude/split-pages.mjs
```

**Running only the first step is the main way to break this site.** It writes the whole
single-page bundle back over `index.html`, leaving the root as the old all-in-one SPA while
`/services/`, `/about/`, `/faq/` and `/contact/` sit there as stale copies. Always run both.

**`apply-export.mjs`** decodes the payload, re-applies the fixes, re-encodes, writes `index.html`.
Idempotent; reports what it applied versus found present; throws rather than writing a broken
file if a fix stops matching. It re-applies:

- `<html lang="en">`
- the favicon (data in `.claude/favicon.svg.b64`, because `.gitignore` excludes `*.svg`)
- description / canonical / theme-color / Open Graph / Twitter meta, including `og:image`
- the per-group stagger from `1f71545` (see Site structure)

`SITE` at the top of that script is `https://eastvanslp.ca/` and feeds canonical, `og:url` and
`og:image`. It is the one place the domain is written down.

**`split-pages.mjs`** turns that single bundle into the five pages: rewrites navigation from
`<button onClick=this.go()>` into real `<a href>` anchors, gives each page its own
title/description/canonical/`og:url`, subsets each payload, and keeps every other byte of markup,
style, animation and image identical.

Two behaviours worth knowing:

- It **regenerates `sitemap.xml` and `robots.txt` unconditionally on every run**, from the same
  `PAGE_URL` map the pages are built from, so they cannot drift from the real page set. Safe to
  run just to refresh those two.
- The page-split step **requires unsplit input and throws by design** if `index.html` is already
  split — which is the normal state once the site is live. That is a guard, not a bug: re-run
  `apply-export.mjs` against the raw export first to regenerate the full document.

### Hand-editing a payload

Rarely necessary, but: find the line with the locator above, `JSON.parse` it, edit, then
re-encode with

```js
JSON.stringify(doc).replace(/<\//g, '<\\u002F')
```

The `</` escaping is **load-bearing** — the payload sits inside
`<script type="__bundler/template">`, and one unescaped `</script>` ends the tag early. The asset
payload line should stay byte-identical unless you are adding an image.

## Site structure

Real anchors, real URLs, working Back button. `state.page` survives only to mark the active nav
item; it no longer routes.

Content arrays inside `renderVals()`:

- `serviceData` — 7 services (speech sounds, language, fluency, AAC/autism, parent coaching,
  assessments, daycare visits). Accordion, one open at a time. Voice therapy and feeding &
  swallowing were removed in V2.
- `faqData` — 7 Q&As. "What is your hourly rate?" added in V4.
- `quotes` — 3 testimonials.
- `places`, `logistics`, `creds`, `steps`, `marks`, `trust`, `include`.

Editor-facing props (`data-props`): `showTestimonials`, `homeServiceCount` (7). `acceptingClients`
and the "Currently accepting new families" badge it gated were both removed in V4.

A hamburger menu replaces the nav below the desktop breakpoint; the toggle is a real `<button>`
with `aria-label="Menu"`.

The About page carries a "Registration & memberships" block and the footer a College link, all
`target="_blank" rel="noopener"`. **The College URL ends in Meaghan's registrant UUID, which is
shaped exactly like a bundle asset id — never let a sweep over asset ids touch it.**

`setupReveal()` drives scroll-in animation via IntersectionObserver. The stagger delay is computed
**per sibling group** (`gi` = index among siblings with `[data-reveal]`), not per document. The
canvas still contains the old per-document version, so every export regresses it and
`apply-export.mjs` puts it back.

### Root files that are not pages

| File | Notes |
|---|---|
| `CNAME` | pins the custom domain; deleting it drops the site back to github.io |
| `sitemap.xml`, `robots.txt` | generated by `split-pages.mjs` — edit the script, not these |
| `404.html` | branded page; Pages returns a real 404 status |
| `og-image.jpg` | 1200x630 social card, built by `.claude/build-og-image.py` from `MMcLeod.jpg` (needs Pillow). Must be a real file — `og:image` needs an absolute URL and inlined assets have none. Hence the `!og-image.jpg` exception in `.gitignore`. |
| `favicon.ico`, `apple-touch-icon.png` | built by `.claude/build-icons.py` from `BG Removed Logo.png` (needs Pillow) |
| `googleeddc0e6b08b3d967.html` | Google Search Console verification. **Leave it.** Google re-checks it; removing it un-verifies the property. |

### Business facts baked into the copy

Practising since 2001 · RASP registered, direct bills to Disability Benefit Funding (renamed from
Autism Funding in V2) · in-home within 10 km of Hastings-Sunrise · daycare/school visits · office
near the PNE · Zoom · Mon–Fri 9:00–3:30, a few online slots after 4:00 pm · **$160/hr** for
sessions (public since V4) · reports $80/hr · licensed with the College of Health and Care
Professionals of BC, member of Speech and Hearing BC and Speech-Language & Audiology Canada ·
meaghan@eastvanslp.ca · 778-230-3899.

## Don't break the email

`eastvanslp.ca` DNS lives at GoDaddy and carries **Microsoft 365 email for
meaghan@eastvanslp.ca**: an `MX` to `eastvanslp-ca.mail.protection.outlook.com`, an SPF `TXT`, an
`MS=` verification `TXT`, `autodiscover` / `msoid` / `sip` / `lyncdiscover` CNAMEs, and two `SRV`
records. The website needs only the four `A` records on `@` (GitHub Pages:
`185.199.108-111.153`) and the `www` CNAME. Touch nothing else.

In particular, **never accept GoDaddy's automated "Domain Connect" flow** for a third party — it
grants write access to the whole zone and can replace the Microsoft records. Verification records
(Search Console and the like) go in **by hand**, or better, avoid DNS entirely: Search Console is
verified by the root HTML file above, not by DNS.

## Worked on from two machines

Miguel edits this repo from a Windows PC (primary) and a MacBook. Git is the intended handoff —
but note the repo also sits inside a synced Drive folder, so the working tree *and* `.git` get
copied between machines outside of git. Don't run git operations on both machines at once.

- Start a session with `git status` / `git pull`. Don't assume the tree matches what a prior
  session left.
- Commit and push at natural stopping points, not only at the end of a task.
- Never hardcode an OS-specific absolute path into a script or doc — the two machines' paths
  differ. Scripts in `.claude/` reference paths relative to the repo root only.
- **Line endings** are pinned by `.gitattributes` (`* text=auto eol=lf`). Without it, Windows
  checks out CRLF, Drive copies that to the Mac, and every page shows as modified with a
  thousands-of-lines diff containing no real change. If that reappears, check `.gitattributes`
  still exists before believing the diff.
- The `python` / `python3` / `node` split below is the canonical cross-machine gotcha here.

## Local preview

```bash
node .claude/serve.mjs 8642
```

`.claude/launch.json` points the Claude preview at the same script. It serves directories, so
`/services/` resolves to `services/index.html` the way Pages does.

The config originally read `python -m http.server`, carried over from Windows. It uses Node
because `node` is spelled the same on both machines while the Python entry point is not — macOS
has only `python3`, Windows typically only `python`.

## Repo hygiene

Tracked: `.gitattributes`, `.gitignore`, `CLAUDE.md`, `LICENSE`, `CNAME`, the five page files,
`404.html`, `sitemap.xml`, `robots.txt`, `og-image.jpg`, `favicon.ico`, `apple-touch-icon.png`,
the Search Console file, and `.claude/`.

Ignored: source photos, `.DS_Store`, stray `Meaghan McLeod*.html` exports in the root, the raw
exports in `East Van SLP -  HTML Source/`, and `Search Console Verification/` (the served copy at
the root is the tracked one). The raw exports are multi-MB base64 that git cannot delta-compress,
and each version is already captured as a commit here.

## Known gaps

- **Content still needs JavaScript.** Strip the scripts from any page and about 80 characters of
  text remain. The split fixed *reachability* — each URL now renders its own content on load, so
  crawlers that execute JS index all five instead of only home — but nothing is in the raw HTML.
  Inherent to the bundle format; would require abandoning it.
- **Hamburger toggle has no `aria-expanded`.** It is a focusable, labelled `<button>`, but a
  screen reader cannot tell whether the menu is open. Fix belongs in the canvas, or it needs a new
  `fix()` in `apply-export.mjs` or it will vanish on the next export.
- **Screenshot capture of scrolled positions** has returned blank frames while the DOM confirmed
  content was rendered. If a screenshot looks empty, measure elements rather than trusting it.
