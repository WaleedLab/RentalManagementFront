import { environment } from '../../../environments/environment';

function normalizeMediaPath(input: string): string | null {
  const normalized = input.trim().replace(/\\/g, '/');
  if (!normalized) {
    return null;
  }

  const wwwrootMarker = '/wwwroot/';
  const lower = normalized.toLowerCase();
  const markerIndex = lower.indexOf(wwwrootMarker);
  if (markerIndex >= 0) {
    return normalized.slice(markerIndex + wwwrootMarker.length);
  }

  if (/^[a-z]:\//i.test(normalized)) {
    return null;
  }

  const cleaned = normalized.replace(/^\/+/, '');
  if (/^files\/vehicle\//i.test(cleaned)) {
    return `uploads/vehicle/${cleaned.slice('files/vehicle/'.length)}`;
  }
  if (/^files\/fleet\//i.test(cleaned)) {
    return `uploads/fleet/${cleaned.slice('files/fleet/'.length)}`;
  }
  if (/^files\//i.test(cleaned)) {
    return cleaned.replace(/^files\//i, 'uploads/');
  }
  if (/^(customer|vehicle|fleet|subscriptionsofcustomer)\//i.test(cleaned)) {
    return `uploads/${cleaned}`;
  }

  return cleaned;
}

export function resolveMediaUrl(path?: string | null): string | null {
  if (!path) {
    return null;
  }

  const raw = String(path).trim();
  if (!raw) {
    return null;
  }

  if (/^data:image\//i.test(raw)) {
    return raw;
  }

  // Never treat API routes as media (bad legacy values in Url fields).
  if (/\/Api\//i.test(raw)) {
    return null;
  }

  if (/^https?:\/\//i.test(raw)) {
    try {
      const parsed = new URL(raw);
      const parsedPath = `${parsed.pathname}${parsed.search}${parsed.hash}`;

      // In dev, force local /uploads path through Angular proxy to avoid direct cert/CORS issues.
      if (!environment.production && parsed.pathname.startsWith('/uploads/')) {
        return parsedPath;
      }

      return raw;
    } catch {
      return raw;
    }
  }

  const normalizedPath = normalizeMediaPath(raw);
  if (!normalizedPath) {
    return null;
  }

  const origin = environment.apiBaseUrl.split('/Api/')[0];

  return `${origin}/${normalizedPath}`;
}
