import { CommonModule } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

import { VehicleStatus } from '../../../modules/rent/models';
import { parseSaudiPlateDisplay } from './saudi-plate-display.utils';

@Component({
  selector: 'app-vehicle-saudi-plate',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './vehicle-saudi-plate.component.html',
  styleUrl: './vehicle-saudi-plate.component.scss',
})
export class VehicleSaudiPlateComponent {
  readonly plateNumber = input('');
  readonly status = input<VehicleStatus>('Available');
  readonly statusLabel = input('');
  /** Fleet card: Arabic + English rows only (no header, no corner badge). */
  readonly minimal = input(false);

  readonly display = computed(() => parseSaudiPlateDisplay(this.plateNumber()));

  get badgeClass(): string {
    switch (this.status()) {
      case 'Available':
        return 'vehicle-saudi-plate__badge--available';
      case 'Booked':
        return 'vehicle-saudi-plate__badge--booked';
      case 'Maintenance':
        return 'vehicle-saudi-plate__badge--maintenance';
      case 'Sold':
        return 'vehicle-saudi-plate__badge--sold';
      default:
        return 'vehicle-saudi-plate__badge--inactive';
    }
  }
}
