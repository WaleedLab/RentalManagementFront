// =============================================================================
//  SHADOW CODEMOD — unify shadow colors through the central --rt-shadow-rgb.
//  Within any *shadow* declaration (box-shadow, text-shadow, --*-shadow*, and
//  filter: drop-shadow), neutral depth colors (black / graphite ink) are routed
//  to var(--rt-shadow-rgb) so all elevation reads identically and is theme-aware
//  from one token. Accent-colored glows (cyan/blue/emerald) are left intact.
//  Idempotent. Excludes the color-system source file.
// =============================================================================
import { readdirSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { join, extname, normalize } from 'node:path';

const ROOT = 'src';
const SOURCE_FILE = normalize('src/styles/_color-system.scss');
const exts = new Set(['.scss', '.css']);
// Neutral depth hues used in shadows → unified shadow color.
const NEUTRALS = ['000000', '0f172a', '020617', '030712', '07121d', '040c16'];

const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p);
    else if (exts.has(extname(p))) files.push(p);
  }
})(ROOT);

function routeValue(value) {
  let v = value;
  for (const key of NEUTRALS) {
    v = v.split(`var(--c-${key}-rgb)`).join('var(--rt-shadow-rgb)');
  }
  return v;
}

let changed = 0;
let decls = 0;
for (const f of files) {
  if (normalize(f) === SOURCE_FILE) continue;
  const original = readFileSync(f, 'utf8');

  // Any property whose name contains "shadow" (box-shadow, text-shadow, --x-shadow…)
  let next = original.replace(/([\w-]*shadow[\w-]*)(\s*:\s*)([^;{}]*)(;)/gi, (m, prop, sep, val, end) => {
    const routed = routeValue(val);
    if (routed !== val) decls++;
    return `${prop}${sep}${routed}${end}`;
  });

  // filter: ... drop-shadow(...)
  next = next.replace(/(filter\s*:\s*)([^;{}]*drop-shadow[^;{}]*)(;)/gi, (m, pre, val, end) => {
    const routed = routeValue(val);
    if (routed !== val) decls++;
    return `${pre}${routed}${end}`;
  });

  if (next !== original) {
    writeFileSync(f, next, 'utf8');
    changed++;
  }
}

console.log(`Files updated: ${changed}`);
console.log(`Shadow declarations normalized: ${decls}`);
