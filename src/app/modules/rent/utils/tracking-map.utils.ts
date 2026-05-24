import { TrackingCoordinates } from '../models/tracking/tracking.model';

export function buildMapsSearchUrl(plateNumber: string, label?: string): string {
  const query = [plateNumber, label].filter(part => String(part ?? '').trim()).join(' ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query || plateNumber || 'vehicle')}`;
}

export function buildMapsEmbedUrl(coords: TrackingCoordinates): string {
  const { latitude, longitude } = coords;
  const delta = 0.02;
  const bbox = [longitude - delta, latitude - delta, longitude + delta, latitude + delta].join(',');
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${latitude}%2C${longitude}`;
}

export function buildMapsDirectionsUrl(coords: TrackingCoordinates): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${coords.latitude},${coords.longitude}`;
}
