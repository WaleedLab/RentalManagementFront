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
import { debounceTime, finalize, skip } from 'rxjs';

import { ToastService } from '../../../../../shared/services/toast.service';
import { LayoutService } from '../../../../../shared/services/layout/layout.service';
import { ListCommandBarComponent } from '../../../../../shared/ui/list-command-bar/list-command-bar.component';
import { TrackingWorkspaceContext, TrackingWorkspaceSession } from '../../../models/tracking/tracking.model';
import { VehicleTrackingService } from '../../../services/tracking/vehicle-tracking.service';
import { BookingTrackingService } from '../../../services/tracking/booking-tracking.service';

@Component({
  selector: 'app-tracking-workspace',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, TranslateModule, ListCommandBarComponent],
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

  loading = signal(false);
  mapLoading = signal(false);
  session = signal<TrackingWorkspaceSession | null>(null);
  fullscreen = signal(false);
  isDarkTheme = signal(document.body.classList.contains('dark-only'));

  filtersForm = this.fb.nonNullable.group({
    dateFrom: [''],
    dateTo: [''],
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

  pageTitleKey = computed(() =>
    this.context().mode === 'vehicle' ? 'Tracking vehicle page title' : 'Tracking booking page title',
  );

  pageSubtitle = computed(() => {
    const plate = this.context().vehicleInfo.plateNumber?.trim() || '—';
    const id = this.context().entityId?.trim() || '—';
    return `${plate} · ${id}`;
  });

  readonly pageIconSrc = 'assets/images/rent_icon/car_tracking.png';

  ngOnInit(): void {
    const defaults = this.vehicleTrackingService.createDefaultFilters();
    this.filtersForm.patchValue(
      { dateFrom: defaults.dateFrom, dateTo: defaults.dateTo },
      { emitEvent: false },
    );
    this.trackNow();
    this.filtersForm.valueChanges.pipe(skip(1), debounceTime(350)).subscribe(() => this.trackNow());
  }

  trackNow(): void {
    const ctx = this.context();
    const { dateFrom, dateTo } = this.filtersForm.getRawValue();
    const filters = { dateFrom, dateTo, trackingUrl: '' };

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

}
