import { CommonModule } from '@angular/common';
import {
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  OnInit,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DomSanitizer, SafeHtml, SafeResourceUrl } from '@angular/platform-browser';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, debounceTime, distinctUntilChanged, finalize, map, skip, switchMap, throwError } from 'rxjs';

import { AuthStateService } from '../../../../../core/auth/auth-state.service';
import { ToastService } from '../../../../../shared/services/toast.service';
import { LayoutService } from '../../../../../shared/services/layout/layout.service';
import { ListCommandBarComponent } from '../../../../../shared/ui/list-command-bar/list-command-bar.component';
import {
  DateRangeFilterComponent,
  DateRangeValue,
} from '../../../../../shared/ui/date-range-filter/date-range-filter.component';
import { TrackingWorkspaceContext, TrackingWorkspaceSession } from '../../../models/tracking/tracking.model';
import { VehicleTrackingService } from '../../../services/tracking/vehicle-tracking.service';
import { resolveTrackingErrorMessage } from '../../../utils/tracking-error.utils';

@Component({
  selector: 'app-tracking-workspace',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    TranslateModule,
    ListCommandBarComponent,
    DateRangeFilterComponent,
  ],
  templateUrl: './tracking-workspace.component.html',
  styleUrl: './tracking-workspace.component.scss',
})
export class TrackingWorkspaceComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly toast = inject(ToastService);
  private readonly layoutService = inject(LayoutService);
  private readonly vehicleTrackingService = inject(VehicleTrackingService);
  private readonly translate = inject(TranslateService);
  private readonly authState = inject(AuthStateService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly trackTrigger$ = new Subject<void>();

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

  safeIframeSrcdoc = computed<SafeHtml | null>(() => {
    const html = this.session()?.iframeSrcdoc;
    return html ? this.sanitizer.bypassSecurityTrustHtml(html) : null;
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
    const ctx = this.context();
    const defaults =
      ctx.initialFilters ?? this.vehicleTrackingService.createDefaultFilters();
    this.filtersForm.patchValue(
      { dateFrom: defaults.dateFrom, dateTo: defaults.dateTo },
      { emitEvent: false },
    );

    this.trackTrigger$
      .pipe(
        debounceTime(280),
        switchMap(() => this.runTrackRequest()),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: session => this.session.set(session),
        error: (err: unknown) => this.handleTrackError(err),
      });

    this.filtersForm.valueChanges
      .pipe(
        skip(1),
        debounceTime(350),
        distinctUntilChanged(
          (a, b) => (a.dateFrom ?? '') === (b.dateFrom ?? '') && (a.dateTo ?? '') === (b.dateTo ?? ''),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.queueTrack());

    this.queueTrack();
  }

  trackNow(): void {
    this.queueTrack();
  }

  private queueTrack(): void {
    this.trackTrigger$.next();
  }

  private runTrackRequest() {
    const ctx = this.context();
    const { dateFrom, dateTo } = this.filtersForm.getRawValue();

    if (!dateFrom?.trim() || !dateTo?.trim()) {
      return throwError(() => new Error('Tracking date range is required'));
    }

    if (!this.authState.token()?.trim()) {
      return throwError(() => new Error('Session expired. Please login again.'));
    }

    const vehicleId =
      ctx.mode === 'booking' ? (ctx.trackingVehicleId ?? '').trim() : ctx.entityId.trim();

    if (!vehicleId) {
      return throwError(() => new Error('Tracking load failed'));
    }

    this.loading.set(true);
    this.mapLoading.set(true);

    const filters = { dateFrom, dateTo, trackingUrl: '' };

    return this.vehicleTrackingService
      .loadWorkspace({
        fleetId: ctx.fleetId,
        vehicleId,
        bookingId: ctx.mode === 'booking' ? ctx.entityId : undefined,
        filters,
        vehicleStub:
          ctx.mode === 'booking'
            ? {
                plateNumber: ctx.vehicleInfo.plateNumber,
                vehicleLabel: ctx.vehicleInfo.vehicleLabel,
                branchName: ctx.vehicleInfo.branchName,
              }
            : undefined,
      })
      .pipe(
        map(session =>
          ctx.mode === 'booking' && ctx.vehicleInfo.extraLines?.length
            ? {
                ...session,
                vehicleInfo: {
                  ...session.vehicleInfo,
                  extraLines: ctx.vehicleInfo.extraLines,
                },
              }
            : session,
        ),
        finalize(() => this.loading.set(false)),
      );
  }

  private handleTrackError(err: unknown): void {
    this.loading.set(false);
    this.mapLoading.set(false);

    if (this.session()) {
      return;
    }

    const message = resolveTrackingErrorMessage(err);
    const translated = this.translate.instant(message);
    this.toast.error(translated === message ? message : translated);
  }

  refresh(): void {
    this.trackNow();
  }

  onDateRangeChange(range: DateRangeValue): void {
    if (!range.from?.trim() || !range.to?.trim()) {
      return;
    }
    this.filtersForm.patchValue({ dateFrom: range.from, dateTo: range.to });
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
