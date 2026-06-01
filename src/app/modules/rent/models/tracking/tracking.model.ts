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
  serialNumber?: string;
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
  /** Booking mode: vehicle DB id for `Vehicle/GetById`. */
  trackingVehicleId?: string;
  /** Pre-filled date range (checkout → expected return). */
  initialFilters?: TrackingFilterForm;
}

export interface TrackingWorkspaceSession {
  iframeUrl: string | null;
  /** Raw HTML from tracking API when response is not a URL. */
  iframeSrcdoc?: string | null;
  liveStatus: TrackingAvailability;
  lastUpdated?: string;
  /** Shown in the empty map state (e.g. no GPS data for range). */
  statusMessage?: string;
  stats: TrackingStatItem[];
  timeline: TrackingTimelineEvent[];
  vehicleInfo: TrackingVehicleInfo;
  source: 'api' | 'url' | 'fallback';
  exportPayload: Record<string, unknown>;
}

export interface TrackingWorkspaceRequest {
  fleetId: string;
  /** Vehicle DB id (`Vehicle/GetById`). */
  vehicleId: string;
  /** GPS serial for display only; `IdVehicle` uses `vehicleId` (DB id). */
  trackingSerialNumber?: string;
  bookingId?: string;
  filters: TrackingFilterForm;
  /** When set, skips `Vehicle/GetById` and uses this snapshot for UI only. */
  vehicleStub?: {
    plateNumber: string;
    vehicleLabel: string;
    branchName?: string;
  };
}
