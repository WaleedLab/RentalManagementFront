import { CommonModule } from '@angular/common';
import { Component, Input, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject } from 'rxjs';

import { ToastService } from '../../../../shared/services/toast.service';
import { DatePickerComponent } from '../../../../shared/ui/date-picker/date-picker.component';
import { MaintenanceFinishRequest } from '../../models/maintenance.model';
import { MaintenanceDetailService } from '../../services/maintenance-detail.service';
import { sumMaintenanceDetailLines } from '../../utils/maintenance-detail-total.util';

export type MaintenanceFinishDialogResult = MaintenanceFinishRequest | null;

@Component({
  selector: 'app-maintenance-finish-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule, DatePickerComponent],
  templateUrl: './maintenance-finish-dialog.component.html',
  styleUrl: './maintenance-finish-dialog.component.scss',
})
export class MaintenanceFinishDialogComponent implements OnInit {
  @Input() title = '';
  @Input() message = '';
  @Input() plateNumber = '';
  @Input() maintenanceId = '';
  @Input() fleetId = '';

  private activeModal = inject(NgbActiveModal);
  private translate = inject(TranslateService);
  private fb = inject(FormBuilder);
  private detailApi = inject(MaintenanceDetailService);
  private toast = inject(ToastService);
  private resultSubject = new Subject<MaintenanceFinishDialogResult>();

  result = this.resultSubject.asObservable();

  loading = signal(true);
  detailsCount = signal(0);
  computedTotal = signal(0);

  form = this.fb.group({
    endDate: this.fb.control<string | null>(null, [Validators.required]),
  });

  ngOnInit(): void {
    const today = new Date();
    const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    this.form.patchValue({ endDate: iso });
    this.loadDetails();
  }

  get dialogDir(): 'rtl' | 'ltr' {
    const lang = (this.translate.currentLang || this.translate.getDefaultLang() || 'en').toLowerCase();
    return lang.startsWith('ar') ? 'rtl' : 'ltr';
  }

  formatMoney(value: number | null | undefined): string {
    const amount = value ?? 0;
    return new Intl.NumberFormat(this.dialogDir === 'rtl' ? 'ar-SA' : 'en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  }

  confirm(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || !this.fleetId?.trim() || this.loading()) {
      return;
    }

    const endDate = this.toApiDateTime(this.form.controls.endDate.value);
    if (!endDate) {
      return;
    }

    this.resultSubject.next({
      id: this.maintenanceId,
      fleetId: this.fleetId,
      endDate,
      total: this.computedTotal(),
    });
    this.resultSubject.complete();
    this.activeModal.close();
  }

  cancel(): void {
    this.resultSubject.next(null);
    this.resultSubject.complete();
    this.activeModal.dismiss();
  }

  private loadDetails(): void {
    const fleetId = this.fleetId?.trim();
    const idMaintenance = Number(this.maintenanceId);
    if (!fleetId || !Number.isFinite(idMaintenance) || idMaintenance <= 0) {
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.detailApi.getList(idMaintenance, fleetId).subscribe({
      next: items => {
        const details = items ?? [];
        this.detailsCount.set(details.length);
        this.computedTotal.set(sumMaintenanceDetailLines(details));
      },
      error: err => {
        this.toast.error(err?.message ?? this.translate.instant('maintenance.finish.loadFailed'));
        this.detailsCount.set(0);
        this.computedTotal.set(0);
      },
      complete: () => this.loading.set(false),
    });
  }

  private toApiDateTime(value: string | null): string | null {
    const raw = String(value ?? '').trim();
    if (!raw) {
      return null;
    }
    if (raw.includes('T')) {
      return raw;
    }
    return `${raw}T00:00:00`;
  }
}
