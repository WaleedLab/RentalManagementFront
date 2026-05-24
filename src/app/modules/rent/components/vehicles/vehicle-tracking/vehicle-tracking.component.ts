import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { finalize } from 'rxjs';

import { AuthStateService } from '../../../../../core/auth/auth-state.service';
import { ToastService } from '../../../../../shared/services/toast.service';
import { TrackingWorkspaceContext } from '../../../models/tracking/tracking.model';
import { VehicleTrackingService } from '../../../services/tracking/vehicle-tracking.service';
import { TrackingWorkspaceComponent } from '../../tracking/tracking-workspace/tracking-workspace.component';

@Component({
  selector: 'app-vehicle-tracking',
  standalone: true,
  imports: [CommonModule, TranslateModule, TrackingWorkspaceComponent],
  templateUrl: './vehicle-tracking.component.html',
  styleUrl: './vehicle-tracking.component.scss',
})
export class VehicleTrackingComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly authState = inject(AuthStateService);
  private readonly trackingService = inject(VehicleTrackingService);
  private readonly toast = inject(ToastService);

  loading = signal(true);
  context = signal<TrackingWorkspaceContext | null>(null);

  ngOnInit(): void {
    const vehicleId = this.route.snapshot.paramMap.get('id');
    const fleetId = this.authState.fleetId()?.trim() ?? '';
    if (!vehicleId || !fleetId) {
      this.loading.set(false);
      this.toast.error('Fleet required for tracking');
      return;
    }

    this.trackingService
      .loadContext(vehicleId, fleetId)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ctx => this.context.set(ctx),
        error: () => this.toast.error('Failed to load vehicle tracking'),
      });
  }
}
