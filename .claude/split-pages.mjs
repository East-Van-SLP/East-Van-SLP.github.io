#!/usr/bin/env node
/**
 * .claude/split-pages.mjs
 *
 * Splits the single-page bundle produced by apply-export.mjs into five real, independently
 * served pages: Home stays at the site root; Services/About/FAQ/Contact each get their own
 * directory with an index.html, so GitHub Pages serves clean URLs (eastvanslp.ca/services/,
 * etc.) reachable by a real <a href> a crawler can follow.
 *
 * Why this exists: the canvas renders all five "pages" as client-side state inside one
 * document — navigation is <button sc-camel-on-click> calling this.go(page), which does
 * this.setState(). There is not one internal <a href> anywhere, so four of five pages were
 * invisible to search engines and unlinkable to anyone. This script does not touch the canvas
 * or its export; it runs on the already-fixed index.html and rewires navigation to real
 * anchors, gives each page its own <title>/description/canonical, and keeps every other line
 * of markup, every style, every animation, and every image byte-for-byte untouched. It also
 * (re)writes sitemap.xml and robots.txt from the same PAGE_URL map every page is built from,
 * so they can't drift out of sync with the actual page set the way a hand-maintained copy
 * eventually would.
 *
 * Pipeline:
 *   node .claude/apply-export.mjs "East Van SLP -  HTML Source/<export>.html"   # -> full index.html
 *   node .claude/split-pages.mjs                                                # -> 5 pages + sitemap/robots
 *
 * Idempotency: sitemap.xml/robots.txt regenerate unconditionally, every run — safe to run just
 * to refresh those two even when index.html is already split. The actual PAGE split step
 * requires an UNSPLIT input containing all five <sc-if value="{{ isX }}"> blocks, and throws
 * by design if index.html is already split (the normal state once the site is live) — re-run
 * apply-export.mjs against the raw canvas export first to regenerate the full document, then
 * run this again.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const INPUT = process.argv[2] || 'index.html';

// Same escaping rule as apply-export.mjs: this payload sits inside
// <script type="__bundler/template">, so every "</" must stay escaped or the tag ends early.
const encode = (doc) => JSON.stringify(doc).replace(/<\//g, '<\\u002F');

const lines = readFileSync(INPUT, 'utf8').split('\n');
const templateLineIdx = lines.findIndex((l) => l.startsWith('"<!DOCTYPE html>'));
if (templateLineIdx === -1) throw new Error('template payload line not found — is this a bundle export?');
const doc = JSON.parse(lines[templateLineIdx]);

// Line 378 (1-indexed) is the asset manifest: { uuid: { mime, compressed, data } }. It is not
// scoped to any one page — every asset an export ever produced lives here, and both the shell
// (splash SVG, unpacker) and the page document reference into it by uuid. Splitting the
// document without also trimming this manifest per page would leave every output file
// carrying every photo from every other page — defeating the entire point of splitting.
const manifestLineIdx = 377;
if (!lines[manifestLineIdx] || lines[manifestLineIdx].trim()[0] !== '{') {
  throw new Error(`expected the asset manifest at line ${manifestLineIdx + 1} — file layout has changed`);
}
const manifest = JSON.parse(lines[manifestLineIdx]);
// Assets the loader SHELL itself needs (splash/unpacker JS) — referenced outside the page
// document entirely, so they must survive in every output file regardless of which page it is.
const shellText = lines.slice(0, manifestLineIdx).join('\n') + '\n' + lines.slice(manifestLineIdx + 1, templateLineIdx).join('\n');
const shellRequiredIds = Object.keys(manifest).filter((id) => shellText.includes(id));

const PAGES = ['home', 'services', 'about', 'faq', 'contact'];
const FLAGS = { home: 'isHome', services: 'isServices', about: 'isAbout', faq: 'isFaq', contact: 'isContact' };
const PAGE_URL = { home: '/', services: '/services/', about: '/about/', faq: '/faq/', contact: '/contact/' };
const OUT_PATH = {
  home: 'index.html',
  services: 'services/index.html',
  about: 'about/index.html',
  faq: 'faq/index.html',
  contact: 'contact/index.html',
};
const SITE = 'https://eastvanslp.ca';

// sitemap.xml / robots.txt describe the site's URL structure, which is just the fixed
// PAGE_URL map above — they don't depend on decoding the bundle at all. Generate them
// unconditionally, before the "is this an unsplit export?" guard below, so refreshing them
// works even when index.html is already split (the normal state once the site is live) and
// isn't blocked by that guard's intentional throw.
const today = new Date().toISOString().slice(0, 10);
const sitemap =
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  PAGES.map(
    (p) =>
      '  <url>\n' +
      `    <loc>${SITE}${PAGE_URL[p]}</loc>\n` +
      `    <lastmod>${today}</lastmod>\n` +
      '  </url>\n'
  ).join('') +
  '</urlset>\n';
writeFileSync('sitemap.xml', sitemap);

const robots = `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`;
writeFileSync('robots.txt', robots);

console.log(`split-pages.mjs: wrote sitemap.xml (${PAGES.length} urls, lastmod ${today}) and robots.txt`);

const META = {
  home: {
    title: 'Meaghan McLeod — East Van SLP',
    desc:
      'Play-based, family-centred speech-language therapy for children in East Vancouver ' +
      '— at home, at daycare or online. RASP registered, practising since 2001.',
  },
  services: {
    title: 'Services — East Van SLP',
    desc:
      'Speech sound therapy, language development, fluency, AAC and autism support, parent ' +
      'coaching, assessments and daycare visits for children across East Vancouver.',
  },
  about: {
    title: 'About Meaghan — East Van SLP',
    desc:
      'Registered speech-language pathologist in East Vancouver since 2001 — play-based, ' +
      'family-centred therapy grounded in compassion and lived experience with disability.',
  },
  faq: {
    title: 'FAQ — East Van SLP',
    desc:
      'Answers about rates, funding, session locations, and what to expect from speech-' +
      'language therapy with Meaghan McLeod in East Vancouver.',
  },
  contact: {
    title: 'Contact — East Van SLP',
    desc:
      'Get in touch about speech-language therapy for your child — home, daycare, office ' +
      'near the PNE, or online sessions with Meaghan McLeod, RASP registered SLP.',
  },
};

// The shell also has its OWN literal, unescaped <title> (the loading-splash page a browser
// paints before any JS runs, and the only <title> a crawler or link-unfurler that doesn't
// execute JavaScript will ever see). It is a distinct line from the one inside the JSON
// document above, and must be set per output file too, or every page shows "Home" here.
const shellTitleLineIdx = lines.findIndex(
  (l, i) => i < manifestLineIdx && l.trim() === `<title>${META.home.title}</title>`
);
if (shellTitleLineIdx === -1) {
  throw new Error(`static shell <title>${META.home.title}</title> line not found before the manifest`);
}

function assertOnce(hay, needle, label) {
  const n = hay.split(needle).length - 1;
  if (n !== 1) throw new Error(`expected exactly 1 occurrence of "${label}", found ${n}`);
}
function replaceOnce(hay, needle, replacement, label) {
  assertOnce(hay, needle, label);
  return hay.split(needle).join(replacement);
}

// ---------- 1. locate the five page blocks ----------
const openers = PAGES.map((p) => doc.indexOf(`<sc-if value="{{ ${FLAGS[p]} }}"`));
openers.forEach((i, k) => {
  if (i === -1) {
    throw new Error(
      `<sc-if value="{{ ${FLAGS[PAGES[k]]} }}"> not found in ${INPUT} — it looks already ` +
      'split. Re-run apply-export.mjs against the raw canvas export first, then run this script again.'
    );
  }
});

let searchFrom = openers[4];
let closeIdx = -1;
while (true) {
  const i = doc.indexOf('</sc-if>', searchFrom);
  if (i === -1) break;
  if (!/is(Home|Services|About|Faq|Contact)/.test(doc.slice(i, i + 90))) {
    closeIdx = i;
    break;
  }
  searchFrom = i + 8;
}
if (closeIdx === -1) throw new Error('could not find the closing </sc-if> for the Contact block');
const suffixStart = closeIdx + '</sc-if>'.length;

const bounds = [...openers, suffixStart];
const rawPrefix = doc.slice(0, openers[0]);
const rawBlocks = {};
PAGES.forEach((p, k) => {
  rawBlocks[p] = doc.slice(bounds[k], bounds[k + 1]);
});
const rawSuffix = doc.slice(suffixStart);

const reassembled = rawPrefix + PAGES.map((p) => rawBlocks[p]).join('') + rawSuffix;
if (reassembled !== doc) {
  throw new Error('block slicing does not reconstruct the original document byte-for-byte — aborting');
}

// ---------- 2. base transforms shared by every output file ----------
// (a) header nav template + logo — both in the prefix.
let basePrefix = rawPrefix;

basePrefix = replaceOnce(
  basePrefix,
  '<button sc-camel-on-click="{{ item.onClick }}" style="position: relative; background: none; border: none; cursor: pointer; padding: 10px 14px; font-size: 15px; font-weight: 500; color: #3D4A31; border-radius: 10px" style-hover="background: #EDF1E5">',
  '<a href="{{ item.href }}" style="position: relative; display: inline-block; text-decoration: none; padding: 10px 14px; font-size: 15px; font-weight: 500; color: #3D4A31; border-radius: 10px" style-hover="background: #EDF1E5">',
  'header nav item open tag'
);
basePrefix = replaceOnce(
  basePrefix,
  '</sc-if>\n</button>\n</sc-for>\n</nav>',
  '</sc-if>\n</a>\n</sc-for>\n</nav>',
  'header nav item close tag'
);
basePrefix = replaceOnce(
  basePrefix,
  '<button sc-camel-on-click="{{ goHome }}" style="display: flex; align-items: center; gap: 12px; background: none; border: none; padding: 0; cursor: pointer; text-align: left">',
  '<a href="{{ goHome }}" style="display: flex; align-items: center; gap: 12px; text-decoration: none; text-align: left">',
  'logo open tag'
);
{
  const openTag = '<a href="{{ goHome }}"';
  const openTagIdx = basePrefix.indexOf(openTag);
  if (openTagIdx === -1) throw new Error('logo anchor open tag missing after rewrite');
  const closeTagIdx = basePrefix.indexOf('</button>', openTagIdx);
  if (closeTagIdx === -1) throw new Error('could not find logo close tag');
  basePrefix = basePrefix.slice(0, closeTagIdx) + '</a>' + basePrefix.slice(closeTagIdx + '</button>'.length);
}

// (b) footer nav template — in the suffix.
let baseSuffix = rawSuffix;
baseSuffix = replaceOnce(
  baseSuffix,
  '<button sc-camel-on-click="{{ item.onClick }}" style="background: none; border: none; padding: 0; cursor: pointer; text-align: left; font-size: 15.5px; color: #DDE5D2" style-hover="color: #8FD14F">{{ item.label }}</button>',
  '<a href="{{ item.href }}" style="display: inline-block; text-decoration: none; text-align: left; font-size: 15.5px; color: #DDE5D2" style-hover="color: #8FD14F">{{ item.label }}</a>',
  'footer nav item'
);

// (c) JS data wiring — nav/goHome/.../goContact now carry real URLs instead of onClick handlers.
baseSuffix = replaceOnce(
  baseSuffix,
  'class Component extends DCLogic {',
  "const PAGE_URL = { home: '/', services: '/services/', about: '/about/', faq: '/faq/', contact: '/contact/' };\n\nclass Component extends DCLogic {",
  'class declaration (for PAGE_URL insertion)'
);
baseSuffix = replaceOnce(
  baseSuffix,
  'nav: pages.map((p) => ({ label: p[1], active: page === p[0], onClick: () => this.go(p[0]) })),',
  'nav: pages.map((p) => ({ label: p[1], active: page === p[0], href: PAGE_URL[p[0]] })),',
  'nav array wiring'
);
baseSuffix = replaceOnce(
  baseSuffix,
  "goHome: () => this.go('home'),\n      goServices: () => this.go('services'),\n      goAbout: () => this.go('about'),\n      goFaq: () => this.go('faq'),\n      goContact: () => this.go('contact'),",
  'goHome: PAGE_URL.home,\n      goServices: PAGE_URL.services,\n      goAbout: PAGE_URL.about,\n      goFaq: PAGE_URL.faq,\n      goContact: PAGE_URL.contact,',
  'go* handler wiring'
);

// (d) Home-page-only cross-page CTAs live inside the Home block.
let homeBlock = rawBlocks.home;
homeBlock = replaceOnce(
  homeBlock,
  '<button sc-camel-on-click="{{ goServices }}" style="background: #FFFDF8; color: #3D4A31; border: 1px solid #DCE4CE; padding: 16px 28px; border-radius: 999px; font-size: 16px; font-weight: 600; cursor: pointer" style-hover="border-color: #8FD14F; background: #F4F7ED">See how I can help</button>',
  '<a href="{{ goServices }}" style="display: inline-block; text-decoration: none; background: #FFFDF8; color: #3D4A31; border: 1px solid #DCE4CE; padding: 16px 28px; border-radius: 999px; font-size: 16px; font-weight: 600" style-hover="border-color: #8FD14F; background: #F4F7ED">See how I can help</a>',
  'hero CTA'
);
homeBlock = replaceOnce(
  homeBlock,
  '<button sc-camel-on-click="{{ goServices }}" data-reveal="1" style="text-align: left; background: #FAF7F0; border: 1px solid #E7E2D6; border-radius: 20px; padding: 28px 26px 30px; cursor: pointer; display: grid; gap: 12px; transition: transform .35s cubic-bezier(.2,.7,.2,1), box-shadow .35s, border-color .35s" style-hover="transform: translateY(-5px); box-shadow: 0 26px 46px -30px rgba(44,58,36,.45); border-color: #C8D6B4">\n<span style="font-size: 12px; font-weight: 700; letter-spacing: .1em; color: #A9B79A">{{ s.num }}</span>\n<span style="font-family: Newsreader, Georgia, serif; font-size: 24px; line-height: 1.2; letter-spacing: -.012em; color: #26301F">{{ s.title }}</span>\n<span style="font-size: 15.5px; line-height: 1.6; color: #66755A">{{ s.blurb }}</span>\n</button>',
  '<a href="{{ goServices }}" data-reveal="1" style="text-align: left; background: #FAF7F0; border: 1px solid #E7E2D6; border-radius: 20px; padding: 28px 26px 30px; text-decoration: none; display: grid; gap: 12px; transition: transform .35s cubic-bezier(.2,.7,.2,1), box-shadow .35s, border-color .35s" style-hover="transform: translateY(-5px); box-shadow: 0 26px 46px -30px rgba(44,58,36,.45); border-color: #C8D6B4">\n<span style="font-size: 12px; font-weight: 700; letter-spacing: .1em; color: #A9B79A">{{ s.num }}</span>\n<span style="font-family: Newsreader, Georgia, serif; font-size: 24px; line-height: 1.2; letter-spacing: -.012em; color: #26301F">{{ s.title }}</span>\n<span style="font-size: 15.5px; line-height: 1.6; color: #66755A">{{ s.blurb }}</span>\n</a>',
  'teaser card template'
);
homeBlock = replaceOnce(
  homeBlock,
  '<button sc-camel-on-click="{{ goServices }}" data-reveal="1" data-span="2" style="grid-column: span 2; text-align: left; background: #F1F4EA; border: 1px dashed #C8D6B4; border-radius: 20px; padding: 28px 26px 30px; cursor: pointer; display: grid; align-content: center; justify-items: start; gap: 14px; transition: transform .35s cubic-bezier(.2,.7,.2,1), border-color .35s, background .35s" style-hover="transform: translateY(-5px); border-color: #8FD14F; background: #EDF3E2">\n<span style="font-family: Newsreader, Georgia, serif; font-size: 24px; line-height: 1.2; letter-spacing: -.012em; color: #26301F">See all services in detail</span>\n<span style="font-size: 15.5px; line-height: 1.6; color: #66755A">What each one looks like in practice, and who it\'s for.</span>\n<span style="font-size: 15px; font-weight: 600; color: #4A6B3C; border-bottom: 2px solid #8FD14F; padding-bottom: 3px">Services →</span>\n</button>',
  '<a href="{{ goServices }}" data-reveal="1" data-span="2" style="grid-column: span 2; text-align: left; background: #F1F4EA; border: 1px dashed #C8D6B4; border-radius: 20px; padding: 28px 26px 30px; text-decoration: none; display: grid; align-content: center; justify-items: start; gap: 14px; transition: transform .35s cubic-bezier(.2,.7,.2,1), border-color .35s, background .35s" style-hover="transform: translateY(-5px); border-color: #8FD14F; background: #EDF3E2">\n<span style="font-family: Newsreader, Georgia, serif; font-size: 24px; line-height: 1.2; letter-spacing: -.012em; color: #26301F">See all services in detail</span>\n<span style="font-size: 15.5px; line-height: 1.6; color: #66755A">What each one looks like in practice, and who it\'s for.</span>\n<span style="font-size: 15px; font-weight: 600; color: #4A6B3C; border-bottom: 2px solid #8FD14F; padding-bottom: 3px">Services →</span>\n</a>',
  'all-services CTA'
);
homeBlock = replaceOnce(
  homeBlock,
  '<button sc-camel-on-click="{{ goAbout }}" style="background: none; border: none; padding: 0; cursor: pointer; font-size: 16.5px; font-weight: 600; color: #4A6B3C; border-bottom: 2px solid #8FD14F; padding-bottom: 3px" style-hover="color: #2C3A24">Read more about my approach →</button>',
  '<a href="{{ goAbout }}" style="display: inline-block; text-decoration: none; font-size: 16.5px; font-weight: 600; color: #4A6B3C; border-bottom: 2px solid #8FD14F; padding-bottom: 3px" style-hover="color: #2C3A24">Read more about my approach →</a>',
  'about teaser CTA'
);

// (e) Hamburger menu for mobile/tablet. The header nav is a plain flex row with no wrap
// handling — below ~920px (covers iPhone 12 Pro at 390px through iPad Air at 820-834px, both
// reported broken) the logo, 5 links and the "Email Meaghan" button don't fit, so the row
// wraps mid-nav and "Contact" strands itself on a third line. Collapses the nav + email CTA
// behind a toggle button at that same breakpoint instead, reusing the state/renderVals/sc-if
// machinery the accordions already use rather than a CSS-only checkbox hack. Must run here,
// after the button->anchor conversion above: it needs {{ item.href }} and the string-valued
// goServices/goAbout/etc. that conversion creates, which don't exist yet when
// apply-export.mjs runs on the raw canvas export.
baseSuffix = replaceOnce(
  baseSuffix,
  "state = { page: 'home', openService: 0, openFaq: -1 };",
  "state = { page: 'home', openService: 0, openFaq: -1, menuOpen: false };",
  'hamburger: state declaration'
);
baseSuffix = replaceOnce(
  baseSuffix,
  "go(page) {\n    this.setState({ page: page });\n    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'auto' });\n  }",
  "go(page) {\n    this.setState({ page: page });\n    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'auto' });\n  }\n\n  toggleMenu() {\n    this.setState({ menuOpen: !this.state.menuOpen });\n  }",
  'hamburger: toggleMenu method'
);
baseSuffix = replaceOnce(
  baseSuffix,
  'nav: pages.map((p) => ({ label: p[1], active: page === p[0], href: PAGE_URL[p[0]] })),',
  'nav: pages.map((p) => ({ label: p[1], active: page === p[0], href: PAGE_URL[p[0]] })),\n      menuOpen: this.state.menuOpen,\n      menuClosed: !this.state.menuOpen,\n      toggleMenu: () => this.toggleMenu(),',
  'hamburger: renderVals exposure'
);
basePrefix = replaceOnce(
  basePrefix,
  '<nav style="display: flex; gap: 4px; margin-left: auto; flex-wrap: wrap">',
  '<nav data-site-nav style="display: flex; gap: 4px; margin-left: auto; flex-wrap: wrap">',
  'hamburger: tag desktop nav'
);
{
  const emailCta =
    '<a href="mailto:meaghan@eastvanslp.ca?subject=Speech%20therapy%20enquiry" style="background: ' +
    '#3F5A32; color: #F7F9F2; padding: 12px 20px; border-radius: 999px; font-size: 14.5px; ' +
    'font-weight: 600; letter-spacing: .01em" style-hover="background: #2C3A24; color: #FFFFFF; ' +
    'text-decoration: none">Email Meaghan</a>';
  assertOnce(basePrefix, emailCta, 'hamburger: header Email Meaghan CTA');
  const hamburgerButton =
    '<button data-menu-toggle sc-camel-on-click="{{ toggleMenu }}" aria-label="Menu" style="display: ' +
    'none; align-items: center; justify-content: center; width: 40px; height: 40px; margin-left: ' +
    'auto; background: none; border: 1px solid #DCE4CE; border-radius: 10px; cursor: pointer; ' +
    'padding: 0">\n' +
    '<sc-if value="{{ menuClosed }}" hint-placeholder-val="{{ true }}">\n' +
    '<span style="display: grid; gap: 5px">\n' +
    '<span style="display: block; width: 18px; height: 2px; border-radius: 2px; background: #3D4A31"></span>\n' +
    '<span style="display: block; width: 18px; height: 2px; border-radius: 2px; background: #3D4A31"></span>\n' +
    '<span style="display: block; width: 18px; height: 2px; border-radius: 2px; background: #3D4A31"></span>\n' +
    '</span>\n' +
    '</sc-if>\n' +
    '<sc-if value="{{ menuOpen }}" hint-placeholder-val="{{ false }}">\n' +
    '<span style="position: relative; width: 18px; height: 18px; display: block">\n' +
    '<span style="position: absolute; top: 8px; left: 0; width: 18px; height: 2px; border-radius: 2px; background: #3D4A31; transform: rotate(45deg)"></span>\n' +
    '<span style="position: absolute; top: 8px; left: 0; width: 18px; height: 2px; border-radius: 2px; background: #3D4A31; transform: rotate(-45deg)"></span>\n' +
    '</span>\n' +
    '</sc-if>\n' +
    '</button>';
  const mobileMenuPanel =
    '<sc-if value="{{ menuOpen }}" hint-placeholder-val="{{ false }}">\n' +
    '<div data-mobile-menu style="border-top: 1px solid #E7E2D6">\n' +
    '<div style="max-width: 1180px; margin: 0 auto; padding: 4px 32px 20px; display: flex; flex-direction: column">\n' +
    '<sc-for list="{{ nav }}" as="item" hint-placeholder-count="5">\n' +
    '<a href="{{ item.href }}" style="padding: 14px 4px; font-size: 16.5px; font-weight: 500; color: #3D4A31; text-decoration: none; border-bottom: 1px solid #EDF1E5">{{ item.label }}</a>\n' +
    '</sc-for>\n' +
    emailCta.replace('padding: 12px 20px', 'margin-top: 16px; text-align: center; padding: 14px 20px') +
    '\n</div>\n</div>\n</sc-if>';
  const emailCtaTaggedForHeader = emailCta.replace('<a href="mailto:', '<a data-email-cta href="mailto:');
  basePrefix = replaceOnce(
    basePrefix,
    emailCta + '\n</div>\n</header>',
    emailCtaTaggedForHeader + '\n' + hamburgerButton + '\n</div>\n' + mobileMenuPanel + '\n</header>',
    'hamburger: insert toggle button + mobile menu panel'
  );
}
basePrefix = replaceOnce(
  basePrefix,
  '@media (max-width: 920px) { [data-stack] { grid-template-columns: 1fr !important; gap: 44px !important; } [data-cols] { grid-template-columns: repeat(2, 1fr) !important; } [data-span="2"] { grid-column: span 1 !important; } }',
  '@media (max-width: 920px) { [data-stack] { grid-template-columns: 1fr !important; gap: 44px !important; } [data-cols] { grid-template-columns: repeat(2, 1fr) !important; } [data-span="2"] { grid-column: span 1 !important; } [data-site-nav] { display: none !important; } header [data-email-cta] { display: none !important; } [data-menu-toggle] { display: flex !important; } }\n@media (min-width: 921px) { [data-mobile-menu] { display: none !important; } }',
  'hamburger: breakpoint CSS (reuses the existing 920px block — already covers iPad Air)'
);

// ---------- 3. per-page assembly: state.page + meta, then encode + write ----------
const applied = [];

for (const page of PAGES) {
  let prefix = basePrefix;
  let suffix = baseSuffix;

  // per-page <head> metadata (title / description / canonical / og:*/ twitter:*)
  const m = META[page];
  const url = `${SITE}${PAGE_URL[page]}`;
  prefix = replaceOnce(
    prefix,
    `<title>${META.home.title}</title>`,
    `<title>${m.title}</title>`,
    `${page}: <title>`
  );
  prefix = replaceOnce(
    prefix,
    `<meta name="description" content="${META.home.desc}">`,
    `<meta name="description" content="${m.desc}">`,
    `${page}: meta description`
  );
  prefix = replaceOnce(
    prefix,
    `<link rel="canonical" href="${SITE}/">`,
    `<link rel="canonical" href="${url}">`,
    `${page}: canonical`
  );
  prefix = replaceOnce(
    prefix,
    `<meta property="og:title" content="${META.home.title}">`,
    `<meta property="og:title" content="${m.title}">`,
    `${page}: og:title`
  );
  prefix = replaceOnce(
    prefix,
    `<meta property="og:description" content="${META.home.desc}">`,
    `<meta property="og:description" content="${m.desc}">`,
    `${page}: og:description`
  );
  prefix = replaceOnce(
    prefix,
    `<meta property="og:url" content="${SITE}/">`,
    `<meta property="og:url" content="${url}">`,
    `${page}: og:url`
  );
  prefix = replaceOnce(
    prefix,
    `<meta name="twitter:title" content="${META.home.title}">`,
    `<meta name="twitter:title" content="${m.title}">`,
    `${page}: twitter:title`
  );
  prefix = replaceOnce(
    prefix,
    `<meta name="twitter:description" content="${META.home.desc}">`,
    `<meta name="twitter:description" content="${m.desc}">`,
    `${page}: twitter:description`
  );

  // state.page must match this file's own (and only) block, or its <sc-if> renders nothing.
  // (Search string includes menuOpen: false because the hamburger-menu transform above
  // already added it to baseSuffix by this point — it must match what's actually there now.)
  suffix = replaceOnce(
    suffix,
    "state = { page: 'home', openService: 0, openFaq: -1, menuOpen: false };",
    `state = { page: '${page}', openService: 0, openFaq: -1, menuOpen: false };`,
    `${page}: initial state.page`
  );

  const block = page === 'home' ? homeBlock : rawBlocks[page];
  const outDoc = prefix + block + suffix;

  // Trim the manifest to what THIS page actually needs: shell-required assets (every page,
  // always) plus whatever uuids this page's own composed document references. An asset used
  // by a different page's block (e.g. About's headshot) is dropped from every other file.
  const keptIds = new Set(shellRequiredIds);
  for (const id of Object.keys(manifest)) {
    if (outDoc.includes(id)) keptIds.add(id);
  }
  const droppedIds = Object.keys(manifest).filter((id) => !keptIds.has(id));
  const trimmedManifest = {};
  for (const id of keptIds) trimmedManifest[id] = manifest[id];
  const trimmedBytes = Object.values(trimmedManifest).reduce((n, a) => n + (a.data || '').length, 0);
  const fullBytes = Object.values(manifest).reduce((n, a) => n + (a.data || '').length, 0);

  const outLines = lines.slice();
  outLines[shellTitleLineIdx] = outLines[shellTitleLineIdx].replace(
    `<title>${META.home.title}</title>`,
    `<title>${m.title}</title>`
  );
  outLines[manifestLineIdx] = JSON.stringify(trimmedManifest);
  outLines[templateLineIdx] = encode(outDoc);
  // Do this splice LAST — it shifts every later index in outLines by one, which would
  // corrupt the manifestLineIdx/templateLineIdx writes above if done before them.
  outLines.splice(shellTitleLineIdx + 1, 0, '  <link rel="apple-touch-icon" href="/apple-touch-icon.png">');
  const outPath = OUT_PATH[page];
  const dir = outPath.includes('/') ? outPath.slice(0, outPath.lastIndexOf('/')) : null;
  if (dir) mkdirSync(dir, { recursive: true });
  writeFileSync(outPath, outLines.join('\n'));
  applied.push(
    `${page.padEnd(9)} -> ${outPath} (doc ${(outDoc.length / 1024).toFixed(1)} KB, ` +
    `assets ${(trimmedBytes / 1024).toFixed(0)}/${(fullBytes / 1024).toFixed(0)} KB, ` +
    `dropped ${droppedIds.length}/${Object.keys(manifest).length})`
  );
}

console.log('split-pages.mjs: wrote 5 pages from', INPUT);
applied.forEach((l) => console.log('  ' + l));
