export function isValidTrackingUrl(value: string): boolean {
  const raw = String(value ?? '').trim();
  if (!raw) {
    return false;
  }
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

export function normalizeTrackingUrl(value: string): string {
  return String(value ?? '').trim();
}
