export type TrackingAvailability = 'live' | 'stale' | 'unavailable' | 'offline';

export type TrackingTimelineEventType = 'stop' | 'move' | 'start' | 'speed' | 'arrival' | 'idle';

export interface TrackingCoordinates {
  latitude: number;
  longitude: number;
}

export interface VehicleTrackingSnapshot {
  vehicleId: string;
  fleetId: string;
  plateNumber: string;
  vehicleLabel: string;
  branchName?: string;
  status: TrackingAvailability;
  lastUpdated?: string;
  coordinates?: TrackingCoordinates | null;
  speedKmh?: number | null;
  heading?: string | null;
  mapsSearchUrl: string;
  mapsEmbedUrl?: string | null;
  source: 'api' | 'fallback';
}

export interface BookingTrackingSnapshot {
  bookingId: string;
  fleetId: string;
  contractNumber: string;
  customerName: string;
  bookingStatus: string;
  vehiclePlate: string;
  vehicleLabel: string;
  vehicle: VehicleTrackingSnapshot;
}

export interface TrackingFilterForm {
  dateFrom: string;
  dateTo: string;
  trackingUrl: string;
}

export interface TrackingStatItem {
  key: string;
  labelKey: string;
  value: string;
  unitKey?: string;
}

export interface TrackingTimelineEvent {
  id: string;
  type: TrackingTimelineEventType;
  time: string;
  titleKey: string;
  titleText?: string;
  titleParams?: Record<string, string | number>;
  descriptionKey?: string;
  descriptionText?: string;
  descriptionParams?: Record<string, string | number>;
}

export interface TrackingVehicleInfo {
  plateNumber: string;
  vehicleLabel: string;
  branchName?: string;
  statusLabelKey?: string;
  extraLines?: Array<{ labelKey: string; value: string }>;
}

export interface TrackingWorkspaceContext {
  mode: 'vehicle' | 'booking';
  entityId: string;
  fleetId: string;
  title: string;
  subtitle: string;
  backLink: string[];
  detailsLink?: string[];
  vehicleInfo: TrackingVehicleInfo;
}

export interface TrackingWorkspaceSession {
  iframeUrl: string | null;
  liveStatus: TrackingAvailability;
  lastUpdated?: string;
  stats: TrackingStatItem[];
  timeline: TrackingTimelineEvent[];
  vehicleInfo: TrackingVehicleInfo;
  source: 'api' | 'url' | 'fallback';
  exportPayload: Record<string, unknown>;
}

export interface TrackingWorkspaceRequest {
  fleetId: string;
  vehicleId: string;
  bookingId?: string;
  filters: TrackingFilterForm;
}
