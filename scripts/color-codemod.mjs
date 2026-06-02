// =============================================================================
//  COLOR CODEMOD — centralize every hardcoded color into _color-system.scss
// -----------------------------------------------------------------------------
//  1. Scans src/**/*.{scss,css} (except the color-system source file).
//  2. Collects every distinct #hex (3/6 digit) and rgb()/rgba() triplet.
//  3. Generates `--c-<hex>` + `--c-<hex>-rgb` tokens and injects them into the
//     single source-of-truth file between the RT-LEGACY-TOKENS markers.
//  4. Rewrites each literal to var(--c-…), preserving the exact alpha per use.
//  Hex/rgb inside url(...) (e.g. inline SVG data URIs) are left untouched.
//  Idempotent: running again is a no-op on already-tokenized files.
// =============================================================================
import { readdirSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { join, extname, normalize } from 'node:path';

const ROOT = 'src';
const SOURCE_FILE = normalize('src/styles/_color-system.scss');
const exts = new Set(['.scss', '.css']);

const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p);
    else if (exts.has(extname(p))) files.push(p);
  }
})(ROOT);

const expand3 = h => h.split('').map(c => c + c).join('');
const toHex = n => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0');
const tripletToKey = (r, g, b) => `${toHex(+r)}${toHex(+g)}${toHex(+b)}`;
const keyToRgb = k => [parseInt(k.slice(0, 2), 16), parseInt(k.slice(2, 4), 16), parseInt(k.slice(4, 6), 16)];

// Mask url(...) segments so we never touch inline SVG data URIs.
function maskUrls(text, store) {
  return text.replace(/url\((?:[^()]|\([^()]*\))*\)/g, m => {
    store.push(m);
    return `\u0000URL${store.length - 1}\u0000`;
  });
}
const unmaskUrls = (text, store) => text.replace(/\u0000URL(\d+)\u0000/g, (_, i) => store[+i]);

const usedKeys = new Set();

function transform(text) {
  const store = [];
  let out = maskUrls(text, store);

  // rgb()/rgba() → var(--c-<hex>-rgb)
  out = out.replace(
    /\b(rgba?)\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(,|\))/g,
    (_, fn, r, g, b, sep) => {
      const key = tripletToKey(r, g, b);
      usedKeys.add(key);
      return `${fn}(var(--c-${key}-rgb)${sep}`;
    },
  );

  // 6-digit hex → var(--c-<hex>)
  out = out.replace(/#([0-9a-fA-F]{6})\b/g, (_, h) => {
    const key = h.toLowerCase();
    usedKeys.add(key);
    return `var(--c-${key})`;
  });

  // 3-digit hex → var(--c-<hex6>)
  out = out.replace(/#([0-9a-fA-F]{3})\b/g, (_, h) => {
    const key = expand3(h.toLowerCase());
    usedKeys.add(key);
    return `var(--c-${key})`;
  });

  return unmaskUrls(out, store);
}

let changed = 0;
for (const f of files) {
  if (normalize(f) === SOURCE_FILE) continue;
  const original = readFileSync(f, 'utf8');
  const next = transform(original);
  if (next !== original) {
    writeFileSync(f, next, 'utf8');
    changed++;
  }
}

// ---- Build token block (grouped, sorted) ------------------------------------
const keys = [...usedKeys].sort();
const lines = [];
for (const key of keys) {
  const [r, g, b] = keyToRgb(key);
  lines.push(`  --c-${key}: #${key};`);
  lines.push(`  --c-${key}-rgb: ${r}, ${g}, ${b};`);
}
const block = [
  '// >>> RT-LEGACY-TOKENS:BEGIN',
  `:root {`,
  ...lines,
  `}`,
  '// >>> RT-LEGACY-TOKENS:END',
].join('\n');

// ---- Inject into the single source-of-truth file ----------------------------
const src = readFileSync(SOURCE_FILE, 'utf8');
const injected = src.replace(
  /\/\/ >>> RT-LEGACY-TOKENS:BEGIN[\s\S]*?\/\/ >>> RT-LEGACY-TOKENS:END/,
  block,
);
writeFileSync(SOURCE_FILE, injected, 'utf8');

console.log(`Files rewritten: ${changed}/${files.length}`);
console.log(`Distinct color tokens generated: ${keys.length}`);
