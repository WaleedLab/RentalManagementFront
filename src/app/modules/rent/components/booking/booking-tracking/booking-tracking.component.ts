import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { AuthStateService } from '../../../../../core/auth/auth-state.service';
import { ToastService } from '../../../../../shared/services/toast.service';
import { TrackingWorkspaceContext } from '../../../models/tracking/tracking.model';
import { BookingTrackingService } from '../../../services/tracking/booking-tracking.service';
import { parseBookingTrackingRouteParams } from '../../../utils/booking-tracking-params.util';
import { TrackingWorkspaceComponent } from '../../tracking/tracking-workspace/tracking-workspace.component';

@Component({
  selector: 'app-booking-tracking',
  standalone: true,
  imports: [CommonModule, TranslateModule, TrackingWorkspaceComponent],
  templateUrl: './booking-tracking.component.html',
  styleUrl: './booking-tracking.component.scss',
})
export class BookingTrackingComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authState = inject(AuthStateService);
  private readonly trackingService = inject(BookingTrackingService);
  private readonly toast = inject(ToastService);

  context = signal<TrackingWorkspaceContext | null>(null);

  ngOnInit(): void {
    const bookingId = this.route.snapshot.paramMap.get('id')?.trim() ?? '';
    const fleetId = this.authState.fleetId()?.trim() ?? '';

    if (!bookingId || !fleetId) {
      this.toast.error('Fleet required for tracking');
      void this.router.navigate(['/booking']);
      return;
    }

    const params = parseBookingTrackingRouteParams(
      this.route.snapshot.queryParamMap,
      this.router.getCurrentNavigation()?.extras?.state ?? history.state,
    );

    if (!params?.vehicleId || !params.dateFrom || !params.dateTo) {
      this.toast.error('Booking tracking params missing');
      void this.router.navigate(['/booking']);
      return;
    }

    this.context.set(this.trackingService.buildContext(bookingId, fleetId, params));
  }
}
