import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  HostListener,
  OnInit,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { TranslateModule } from '@ngx-translate/core';
import { finalize } from 'rxjs';

import { ToastService } from '../../../../../shared/services/toast.service';
import { LayoutService } from '../../../../../shared/services/layout/layout.service';
import {
  TrackingTimelineEvent,
  TrackingWorkspaceContext,
  TrackingWorkspaceSession,
} from '../../../models/tracking/tracking.model';
import { VehicleTrackingService } from '../../../services/tracking/vehicle-tracking.service';
import { BookingTrackingService } from '../../../services/tracking/booking-tracking.service';
import { isValidTrackingUrl } from '../../../utils/tracking-url.utils';
import {
  formatTrackingVehicleCaption,
  formatTrackingVehicleSecondary,
} from '../../../utils/tracking-display.utils';

@Component({
  selector: 'app-tracking-workspace',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, TranslateModule],
  templateUrl: './tracking-workspace.component.html',
  styleUrl: './tracking-workspace.component.scss',
})
export class TrackingWorkspaceComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly toast = inject(ToastService);
  private readonly layoutService = inject(LayoutService);
  private readonly vehicleTrackingService = inject(VehicleTrackingService);
  private readonly bookingTrackingService = inject(BookingTrackingService);

  context = input.required<TrackingWorkspaceContext>();

  mapHost = viewChild<ElementRef<HTMLElement>>('mapHost');
  timelineSheet = viewChild<ElementRef<HTMLElement>>('timelineSheet');

  loading = signal(false);
  mapLoading = signal(false);
  session = signal<TrackingWorkspaceSession | null>(null);
  fullscreen = signal(false);
  isDarkTheme = signal(document.body.classList.contains('dark-only'));
  sheetExpanded = signal(false);
  sheetDragOffset = signal(0);

  filtersForm = this.fb.nonNullable.group({
    dateFrom: [''],
    dateTo: [''],
    trackingUrl: [''],
  });

  safeIframeUrl = computed<SafeResourceUrl | null>(() => {
    const url = this.session()?.iframeUrl;
    return url ? this.sanitizer.bypassSecurityTrustResourceUrl(url) : null;
  });

  liveLabel = computed(() => {
    const status = this.session()?.liveStatus;
    if (status === 'live') {
      return 'Tracking live';
    }
    if (status === 'stale') {
      return 'Tracking status stale';
    }
    if (status === 'offline') {
      return 'Tracking offline';
    }
    return 'Tracking status unavailable';
  });

  liveClass = computed(() => {
    const status = this.session()?.liveStatus;
    if (status === 'live') {
      return 'is-live';
    }
    if (status === 'stale') {
      return 'is-stale';
    }
    return 'is-offline';
  });

  extraLines = computed(() => {
    const sessionLines = this.session()?.vehicleInfo?.extraLines;
    if (sessionLines?.length) {
      return sessionLines;
    }
    return this.context().vehicleInfo.extraLines ?? [];
  });

  vehicleCaption = computed(() =>
    formatTrackingVehicleCaption(this.context().vehicleInfo.plateNumber, this.context().vehicleInfo.vehicleLabel),
  );

  vehicleSecondary = computed(() =>
    formatTrackingVehicleSecondary(this.context().vehicleInfo.plateNumber, this.context().vehicleInfo.vehicleLabel),
  );

  ngOnInit(): void {
    const defaults = this.vehicleTrackingService.createDefaultFilters();
    this.filtersForm.patchValue(defaults);
    this.trackNow();
  }

  trackNow(): void {
    const ctx = this.context();
    const filters = this.filtersForm.getRawValue();
    if (filters.trackingUrl.trim() && !isValidTrackingUrl(filters.trackingUrl)) {
      this.toast.error('Tracking invalid URL');
      return;
    }

    this.loading.set(true);
    this.mapLoading.set(true);

    const request$ =
      ctx.mode === 'booking'
        ? this.bookingTrackingService.loadWorkspace(ctx.entityId, ctx.fleetId, filters)
        : this.vehicleTrackingService.loadWorkspace({
            fleetId: ctx.fleetId,
            vehicleId: ctx.entityId,
            filters,
          });

    request$.pipe(finalize(() => this.loading.set(false))).subscribe({
      next: session => this.session.set(session),
      error: () => this.toast.error('Tracking load failed'),
    });
  }

  refresh(): void {
    this.trackNow();
  }

  onIframeLoad(): void {
    this.mapLoading.set(false);
  }

  toggleFullscreen(): void {
    const host = this.mapHost()?.nativeElement;
    if (!host) {
      return;
    }
    if (!document.fullscreenElement) {
      host.requestFullscreen?.().then(() => this.fullscreen.set(true)).catch(() => undefined);
      return;
    }
    document.exitFullscreen?.().then(() => this.fullscreen.set(false)).catch(() => undefined);
  }

  @HostListener('document:fullscreenchange')
  onFullscreenChange(): void {
    this.fullscreen.set(Boolean(document.fullscreenElement));
  }

  toggleTheme(): void {
    this.layoutService.toggleTheme();
    this.isDarkTheme.set(document.body.classList.contains('dark-only'));
  }

  exportSession(): void {
    const payload = this.session()?.exportPayload;
    if (!payload) {
      return;
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `tracking-${this.context().entityId}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  toggleSheet(): void {
    this.sheetExpanded.update(value => !value);
    this.sheetDragOffset.set(0);
  }

  eventIcon(event: TrackingTimelineEvent): string {
    switch (event.type) {
      case 'stop':
        return 'fa-solid fa-circle-pause';
      case 'move':
        return 'fa-solid fa-car-side';
      case 'start':
        return 'fa-solid fa-power-off';
      case 'speed':
        return 'fa-solid fa-gauge-high';
      case 'arrival':
        return 'fa-solid fa-location-dot';
      default:
        return 'fa-solid fa-clock';
    }
  }

  eventTone(event: TrackingTimelineEvent): string {
    switch (event.type) {
      case 'stop':
        return 'tone-stop';
      case 'move':
        return 'tone-move';
      case 'speed':
        return 'tone-speed';
      case 'arrival':
        return 'tone-arrival';
      default:
        return 'tone-idle';
    }
  }
}
