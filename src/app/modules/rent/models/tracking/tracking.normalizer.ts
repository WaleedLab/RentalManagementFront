import { Vehicle } from '../vehicles/vehicle.model';
import {
  TrackingAvailability,
  TrackingCoordinates,
  TrackingFilterForm,
  TrackingStatItem,
  TrackingTimelineEvent,
  TrackingTimelineEventType,
  TrackingVehicleInfo,
  TrackingWorkspaceSession,
  VehicleTrackingSnapshot,
} from './tracking.model';
import { buildMapsEmbedUrl, buildMapsSearchUrl } from '../../utils/tracking-map.utils';
import { isValidTrackingUrl, normalizeTrackingUrl } from '../../utils/tracking-url.utils';

function pickNumber(raw: Record<string, unknown>, ...keys: string[]): number | undefined {
  for (const key of keys) {
    const value = raw[key];
    if (value != null && value !== '') {
      const num = Number(value);
      if (Number.isFinite(num)) {
        return num;
      }
    }
  }
  return undefined;
}

function pickString(raw: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = raw[key];
    if (value != null && String(value).trim()) {
      return String(value).trim();
    }
  }
  return undefined;
}

function normalizeCoordinates(raw: Record<string, unknown>): TrackingCoordinates | null {
  const latitude = pickNumber(raw, 'latitude', 'Latitude', 'lat', 'Lat');
  const longitude = pickNumber(raw, 'longitude', 'Longitude', 'lng', 'Lng', 'lon', 'Lon');
  if (latitude == null || longitude == null) {
    return null;
  }
  return { latitude, longitude };
}

function resolveAvailability(
  coordinates: TrackingCoordinates | null,
  lastUpdated?: string,
  explicit?: string,
): TrackingAvailability {
  const normalized = explicit?.toLowerCase();
  if (normalized === 'live' || normalized === 'online') {
    return 'live';
  }
  if (normalized === 'offline') {
    return 'offline';
  }
  if (normalized === 'stale') {
    return 'stale';
  }
  if (!coordinates && !lastUpdated) {
    return 'unavailable';
  }
  if (!lastUpdated) {
    return coordinates ? 'live' : 'unavailable';
  }
  const updated = new Date(lastUpdated).getTime();
  if (!Number.isFinite(updated)) {
    return 'live';
  }
  const ageMs = Date.now() - updated;
  return ageMs > 1000 * 60 * 30 ? 'stale' : 'live';
}

function normalizeEventType(value?: string): TrackingTimelineEventType {
  const raw = String(value ?? '').toLowerCase();
  if (raw.includes('stop') || raw.includes('park')) {
    return 'stop';
  }
  if (raw.includes('move') || raw.includes('drive')) {
    return 'move';
  }
  if (raw.includes('start') || raw.includes('ign')) {
    return 'start';
  }
  if (raw.includes('speed')) {
    return 'speed';
  }
  if (raw.includes('arriv')) {
    return 'arrival';
  }
  return 'idle';
}

function normalizeTimeline(raw: unknown): TrackingTimelineEvent[] {
  const list = Array.isArray(raw) ? raw : [];
  return list
    .map((item, index) => {
      const row = (item ?? {}) as Record<string, unknown>;
      const type = normalizeEventType(pickString(row, 'type', 'Type', 'eventType', 'EventType'));
      const time = pickString(row, 'time', 'Time', 'timestamp', 'Timestamp', 'occurredAt', 'OccurredAt') ?? '';
      const title =
        pickString(row, 'title', 'Title', 'label', 'Label', 'description', 'Description') ?? 'Tracking event';
      return {
        id: pickString(row, 'id', 'Id') ?? `event-${index}-${time}`,
        type,
        time,
        titleKey: 'Tracking event',
        titleText: title,
        descriptionText: pickString(row, 'description', 'Description', 'details', 'Details'),
      };
    })
    .filter(event => event.time || event.titleKey);
}

function buildStats(raw: Record<string, unknown>, snapshot?: Partial<VehicleTrackingSnapshot>): TrackingStatItem[] {
  const distanceKm = pickNumber(raw, 'distanceKm', 'DistanceKm', 'distance', 'Distance');
  const maxSpeed = pickNumber(raw, 'maxSpeedKmh', 'MaxSpeedKmh', 'maxSpeed', 'MaxSpeed');
  const runningMinutes = pickNumber(raw, 'runningDurationMinutes', 'RunningDurationMinutes', 'runningMinutes');
  const stops = pickNumber(raw, 'stopsCount', 'StopsCount', 'stops', 'Stops');
  const speedNow = pickNumber(raw, 'speedKmh', 'SpeedKmh', 'speed', 'Speed') ?? snapshot?.speedKmh ?? undefined;

  const runningLabel =
    runningMinutes != null
      ? runningMinutes >= 60
        ? `${Math.floor(runningMinutes / 60)}h ${runningMinutes % 60}m`
        : `${runningMinutes}m`
      : '—';

  return [
    { key: 'distance', labelKey: 'Tracking stat distance', value: distanceKm != null ? String(Math.round(distanceKm)) : '', unitKey: 'km' },
    { key: 'maxSpeed', labelKey: 'Tracking stat max speed', value: maxSpeed != null ? String(Math.round(maxSpeed)) : '', unitKey: 'km/h' },
    { key: 'stops', labelKey: 'Tracking stat stops', value: stops != null ? String(stops) : '' },
    { key: 'running', labelKey: 'Tracking stat running', value: runningLabel === '—' ? '' : runningLabel },
    {
      key: 'speedNow',
      labelKey: 'Tracking stat current speed',
      value: speedNow != null ? String(Math.round(speedNow)) : '',
      unitKey: 'km/h',
    },
  ];
}

function buildVehicleInfo(vehicle: Vehicle, extra?: Record<string, unknown>): TrackingVehicleInfo {
  const plateNumber = vehicle.plateNumber || '';
  const vehicleLabel =
    [vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(' ').trim() || plateNumber;
  return {
    plateNumber,
    vehicleLabel,
    branchName: vehicle.branchName,
    statusLabelKey: pickString(extra ?? {}, 'vehicleStatus', 'VehicleStatus', 'statusLabel'),
  };
}

export function buildVehicleTrackingFallback(vehicle: Vehicle, fleetId: string): VehicleTrackingSnapshot {
  const plateNumber = vehicle.plateNumber || '';
  const vehicleLabel = [vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(' ').trim() || plateNumber;
  return {
    vehicleId: vehicle.id,
    fleetId,
    plateNumber,
    vehicleLabel,
    branchName: vehicle.branchName,
    status: 'unavailable',
    coordinates: null,
    mapsSearchUrl: buildMapsSearchUrl(plateNumber, vehicleLabel),
    mapsEmbedUrl: null,
    source: 'fallback',
  };
}

export function normalizeVehicleTrackingResponse(
  raw: unknown,
  vehicle: Vehicle,
  fleetId: string,
): VehicleTrackingSnapshot {
  const item = (raw ?? {}) as Record<string, unknown>;
  const coordinates = normalizeCoordinates(item);
  const lastUpdated = pickString(item, 'lastUpdated', 'LastUpdated', 'updatedAt', 'UpdatedAt', 'timestamp', 'Timestamp');
  const plateNumber = pickString(item, 'plateNumber', 'PlateNumber', 'vehiclePlateNumber') ?? vehicle.plateNumber ?? '';
  const vehicleLabel =
    pickString(item, 'vehicleLabel', 'VehicleLabel', 'vehicleName', 'VehicleName') ??
    [vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(' ').trim() ??
    plateNumber;

  const status =
    resolveAvailability(coordinates, lastUpdated, pickString(item, 'status', 'Status')) ?? 'unavailable';

  const mapsSearchUrl = buildMapsSearchUrl(plateNumber, vehicleLabel);
  const mapsEmbedUrl = coordinates ? buildMapsEmbedUrl(coordinates) : null;

  return {
    vehicleId: vehicle.id,
    fleetId,
    plateNumber,
    vehicleLabel,
    branchName: vehicle.branchName,
    status,
    lastUpdated,
    coordinates,
    speedKmh: pickNumber(item, 'speedKmh', 'SpeedKmh', 'speed', 'Speed'),
    heading: pickString(item, 'heading', 'Heading', 'direction', 'Direction'),
    mapsSearchUrl,
    mapsEmbedUrl,
    source: 'api',
  };
}

function tryParseJsonPayload(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    return null;
  }
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return null;
  }
}

/** Resolves map URL or HTML from GetTrackingQuery `Result<string>.data`. */
export function resolveTrackingMapDisplay(raw: unknown): { iframeUrl: string | null; iframeSrcdoc: string | null } {
  if (raw == null) {
    return { iframeUrl: null, iframeSrcdoc: null };
  }

  if (typeof raw === 'string') {
    const text = raw.trim();
    if (!text) {
      return { iframeUrl: null, iframeSrcdoc: null };
    }
    if (isValidTrackingUrl(text)) {
      return { iframeUrl: normalizeTrackingUrl(text), iframeSrcdoc: null };
    }
    if (text.startsWith('<')) {
      return { iframeUrl: null, iframeSrcdoc: text };
    }
    const parsed = tryParseJsonPayload(text);
    if (parsed != null) {
      return resolveTrackingMapDisplay(parsed);
    }
    return { iframeUrl: null, iframeSrcdoc: null };
  }

  if (typeof raw === 'object') {
    const item = raw as Record<string, unknown>;
    const nested = item['data'] ?? item['Data'] ?? item['result'] ?? item['Result'];
    if (nested != null && nested !== raw) {
      const fromNested = resolveTrackingMapDisplay(nested);
      if (fromNested.iframeUrl || fromNested.iframeSrcdoc) {
        return fromNested;
      }
    }
    const url = pickString(
      item,
      'iframeUrl',
      'IframeUrl',
      'trackingUrl',
      'TrackingUrl',
      'mapUrl',
      'MapUrl',
      'url',
      'Url',
      'viewUrl',
      'ViewUrl',
    );
    if (url && isValidTrackingUrl(url)) {
      return { iframeUrl: normalizeTrackingUrl(url), iframeSrcdoc: null };
    }
  }

  return { iframeUrl: null, iframeSrcdoc: null };
}

/**
 * Builds session from API payload (string URL/HTML from SHowView, or structured JSON).
 */
export function buildTrackingWorkspaceSessionFromApi(
  raw: unknown,
  vehicle: Vehicle,
  fleetId: string,
  filters: TrackingFilterForm,
): TrackingWorkspaceSession {
  const map = resolveTrackingMapDisplay(raw);

  if (map.iframeUrl || map.iframeSrcdoc) {
    return {
      iframeUrl: map.iframeUrl,
      iframeSrcdoc: map.iframeSrcdoc,
      liveStatus: 'live',
      lastUpdated: new Date().toISOString(),
      stats: buildStats({}),
      timeline: [],
      vehicleInfo: buildVehicleInfo(vehicle),
      source: 'api',
      exportPayload: { filters, vehicleId: vehicle.id, fleetId, raw },
    };
  }

  if (raw != null && typeof raw === 'object') {
    return buildTrackingWorkspaceSession(raw, { ...vehicle, fleetId }, filters);
  }

  return buildEmptyWorkspaceSession({ ...vehicle, fleetId }, filters);
}

export function buildTrackingWorkspaceSession(
  raw: unknown,
  vehicle: Vehicle,
  filters: TrackingFilterForm,
  pastedUrl?: string,
): TrackingWorkspaceSession {
  const item = (raw ?? {}) as Record<string, unknown>;
  const snapshot = normalizeVehicleTrackingResponse(raw, vehicle, vehicle.fleetId);
  const apiIframe =
    pickString(item, 'iframeUrl', 'IframeUrl', 'trackingUrl', 'TrackingUrl', 'mapUrl', 'MapUrl') ??
    snapshot.mapsEmbedUrl;
  const iframeUrl = pastedUrl && isValidTrackingUrl(pastedUrl) ? normalizeTrackingUrl(pastedUrl) : apiIframe;
  const statsRaw = (item['stats'] ?? item['Stats'] ?? item) as Record<string, unknown>;

  return {
    iframeUrl: iframeUrl ?? null,
    iframeSrcdoc: null,
    liveStatus: pastedUrl ? 'live' : snapshot.status,
    lastUpdated: snapshot.lastUpdated,
    stats: buildStats(statsRaw, snapshot),
    timeline: normalizeTimeline(item['events'] ?? item['Events'] ?? item['timeline'] ?? item['Timeline']),
    vehicleInfo: buildVehicleInfo(vehicle, statsRaw),
    source: pastedUrl ? 'url' : snapshot.source === 'api' ? 'api' : 'fallback',
    exportPayload: {
      filters,
      vehicleId: vehicle.id,
      plateNumber: vehicle.plateNumber,
      snapshot,
      raw: item,
    },
  };
}

export function buildEmptyWorkspaceSession(
  vehicle: Vehicle,
  filters: TrackingFilterForm,
  pastedUrl?: string,
): TrackingWorkspaceSession {
  if (pastedUrl && isValidTrackingUrl(pastedUrl)) {
    return {
      iframeUrl: normalizeTrackingUrl(pastedUrl),
      iframeSrcdoc: null,
      liveStatus: 'live',
      stats: buildStats({}),
      timeline: [],
      vehicleInfo: buildVehicleInfo(vehicle),
      source: 'url',
      exportPayload: { filters, vehicleId: vehicle.id, pastedUrl },
    };
  }

  const fallback = buildVehicleTrackingFallback(vehicle, vehicle.fleetId);
  return {
    iframeUrl: fallback.mapsEmbedUrl ?? null,
    iframeSrcdoc: null,
    liveStatus: 'offline',
    stats: buildStats({}, fallback),
    timeline: [],
    vehicleInfo: buildVehicleInfo(vehicle),
    source: 'fallback',
    exportPayload: { filters, vehicleId: vehicle.id, fallback },
  };
}
