#!/usr/bin/env node
/**
 * Apply post-export fixes to a Claude Design bundle export.
 *
 *   node .claude/apply-export.mjs "East Van SLP -  HTML Source/... - V3.html"
 *
 * The canvas does not carry these fixes, so every fresh export drops them.
 * Run this on each new export instead of re-applying them by hand.
 * Every fix is idempotent — running twice is a no-op.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const [input, output = 'index.html'] = process.argv.slice(2);
if (!input) {
  console.error('usage: node .claude/apply-export.mjs <export.html> [output.html]');
  process.exit(1);
}

const SITE = 'https://east-van-slp.github.io/';
const DESC =
  'Play-based, family-centred speech-language therapy for children in East Vancouver ' +
  '— at home, at daycare or online. RASP registered, practising since 2001.';

// The bundle inlines line 390 inside <script type="__bundler/template">, so every
// "</" must stay escaped or the tag terminates early. Verified byte-for-byte
// against an untouched export.
const encode = (doc) => JSON.stringify(doc).replace(/<\//g, '<\\u002F');

const lines = readFileSync(input, 'utf8').split('\n');
const idx = lines.findIndex((l) => l.startsWith('"<!DOCTYPE html>'));
if (idx === -1) throw new Error('template payload line not found — is this a bundle export?');

let doc = JSON.parse(lines[idx]);
const applied = [];
const skipped = [];

const fix = (name, test, transform) => {
  if (test(doc)) { skipped.push(name); return; }
  const next = transform(doc);
  if (next === doc) throw new Error(`fix "${name}" matched nothing — export format changed?`);
  doc = next;
  applied.push(name);
};

// 1. Document language — screen readers and search engines both need it.
fix('html lang', (d) => /<html[^>]*\slang=/.test(d),
    (d) => d.replace('<html>', '<html lang="en">'));

// 2. Favicon. Lives in .claude/favicon.svg.b64 because .gitignore excludes *.svg.
const favicon = readFileSync(join(here, 'favicon.svg.b64'), 'utf8').trim();
fix('favicon', (d) => d.includes('<link rel="icon"'),
    (d) => d.replace(/(<title>[^<]*<\/title>\n)/,
      `$1<link rel="icon" type="image/svg+xml" href="data:image/svg+xml;base64,${favicon}">\n`));

// 3. Search + social metadata. Meaghan shares the site over Messenger, which
//    renders nothing without Open Graph tags.
const META = [
  `<meta name="description" content="${DESC}">`,
  `<meta name="theme-color" content="#3F5A32">`,
  `<link rel="canonical" href="${SITE}">`,
  `<meta property="og:type" content="website">`,
  `<meta property="og:site_name" content="East Van SLP">`,
  `<meta property="og:title" content="Meaghan McLeod — East Van SLP">`,
  `<meta property="og:description" content="${DESC}">`,
  `<meta property="og:url" content="${SITE}">`,
  `<meta property="og:locale" content="en_CA">`,
  `<meta name="twitter:card" content="summary">`,
  `<meta name="twitter:title" content="Meaghan McLeod — East Van SLP">`,
  `<meta name="twitter:description" content="${DESC}">`,
].join('\n');
fix('seo/social meta', (d) => d.includes('name="description"'),
    (d) => d.replace(/(<title>[^<]*<\/title>\n)/, `$1${META}\n`));

// 4. Stagger delay must index within the sibling group, not the whole document,
//    or every revealed element inherits a delay from document order (commit 1f71545).
const STAGGER_OLD = '      const d = (i % 5) * 0.07;';
const STAGGER_NEW =
  "      const sibs = el.parentElement ? Array.prototype.filter.call(el.parentElement.children, " +
  "function (n) { return n.hasAttribute('data-reveal'); }) : [el]; " +
  "const gi = sibs.indexOf(el); const d = Math.min(gi < 0 ? 0 : gi, 5) * 0.07;";
fix('per-group stagger', (d) => d.includes('sibs.indexOf(el)'),
    (d) => d.replace(STAGGER_OLD, STAGGER_NEW));

lines[idx] = encode(doc);
writeFileSync(output, lines.join('\n'));

console.log(`${input}\n  -> ${output}`);
if (applied.length) console.log('  applied:', applied.join(', '));
if (skipped.length) console.log('  already present:', skipped.join(', '));
