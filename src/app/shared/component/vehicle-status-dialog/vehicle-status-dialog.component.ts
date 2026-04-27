import { CommonModule } from '@angular/common';
import { Component, Input, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { Subject } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';

import { VehicleStatus } from '../../../modules/rent/models';

@Component({
  selector: 'app-vehicle-status-dialog',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './vehicle-status-dialog.component.html',
  styleUrl: './vehicle-status-dialog.component.scss',
})
export class VehicleStatusDialogComponent {
  @Input() title = 'Change Vehicle Status';
  @Input() message = 'Select the new status for this vehicle.';
  @Input() currentStatus: VehicleStatus = 'Available';
  @Input() vehicleName = '';
  @Input() plateNumber = '';

  private activeModal = inject(NgbActiveModal);
  private translate = inject(TranslateService);
  private resultSubject = new Subject<VehicleStatus | null>();

  result = this.resultSubject.asObservable();
  selectedStatus: VehicleStatus = 'Available';

  readonly statusOptions: Array<{ value: VehicleStatus; label: string; icon: string }> = [
    { value: 'Available', label: 'Available', icon: 'fa-solid fa-circle-check' },
    { value: 'Booked', label: 'Booked', icon: 'fa-solid fa-calendar-check' },
    { value: 'Maintenance', label: 'Maintenance', icon: 'fa-solid fa-screwdriver-wrench' },
    { value: 'Inactive', label: 'Management', icon: 'fa-solid fa-circle-pause' },
    { value: 'Sold', label: 'Sold', icon: 'fa-solid fa-tag' },
  ];

  ngOnInit(): void {
    this.selectedStatus = this.currentStatus;
  }

  get dialogDir(): 'rtl' | 'ltr' {
    const lang = (this.translate.currentLang || this.translate.getDefaultLang() || 'en').toLowerCase();
    return lang.startsWith('ar') ? 'rtl' : 'ltr';
  }

  selectStatus(status: VehicleStatus): void {
    this.selectedStatus = status;
  }

  confirm(): void {
    this.resultSubject.next(this.selectedStatus);
    this.resultSubject.complete();
    this.activeModal.close();
  }

  cancel(): void {
    this.resultSubject.next(null);
    this.resultSubject.complete();
    this.activeModal.dismiss();
  }
}
