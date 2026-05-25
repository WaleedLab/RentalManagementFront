import packageJson from '../../../../package.json';

/** Semantic version from `package.json` (single source of truth). */
export const APP_VERSION = packageJson.version;

/** User-facing label, e.g. `V1.0.0`. */
export function formatAppVersionLabel(version: string = APP_VERSION): string {
  const trimmed = String(version ?? '').trim();
  if (!trimmed) {
    return 'V0.0.0';
  }
  if (/^v/i.test(trimmed)) {
    const numeric = trimmed.replace(/^v/i, '');
    return `V${numeric}`;
  }
  return `V${trimmed}`;
}
