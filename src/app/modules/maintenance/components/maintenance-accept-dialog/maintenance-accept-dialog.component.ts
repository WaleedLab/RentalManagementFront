import { CommonModule } from '@angular/common';
import { Component, Input, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, Subscription } from 'rxjs';

import { DatePickerComponent } from '../../../../shared/ui/date-picker/date-picker.component';
import { MaintenanceAcceptRequest } from '../../models/maintenance.model';
import {
  computeMaintenanceEndDate,
  parseMaintenanceDurationDays,
} from '../../utils/maintenance-duration.util';

export type MaintenanceAcceptDialogResult = MaintenanceAcceptRequest | null;

@Component({
  selector: 'app-maintenance-accept-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule, DatePickerComponent],
  templateUrl: './maintenance-accept-dialog.component.html',
  styleUrl: './maintenance-accept-dialog.component.scss',
})
export class MaintenanceAcceptDialogComponent implements OnInit, OnDestroy {
  @Input() title = '';
  @Input() message = '';
  @Input() plateNumber = '';
  @Input() maintenanceId = '';
  @Input() fleetId = '';

  private activeModal = inject(NgbActiveModal);
  private translate = inject(TranslateService);
  private fb = inject(FormBuilder);
  private resultSubject = new Subject<MaintenanceAcceptDialogResult>();
  private formSub?: Subscription;

  result = this.resultSubject.asObservable();

  computedEndDate = signal<string | null>(null);

  form = this.fb.group({
    startDate: this.fb.control<string | null>(null, [Validators.required]),
    durationDays: this.fb.control<number | null>(null, [
      Validators.required,
      Validators.min(1),
      Validators.max(3650),
    ]),
  });

  ngOnInit(): void {
    const today = new Date();
    const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    this.form.patchValue({ startDate: iso, durationDays: 1 });
    this.refreshComputedEndDate();

    this.formSub = this.form.valueChanges.subscribe(() => this.refreshComputedEndDate());
  }

  ngOnDestroy(): void {
    this.formSub?.unsubscribe();
  }

  get dialogDir(): 'rtl' | 'ltr' {
    const lang = (this.translate.currentLang || this.translate.getDefaultLang() || 'en').toLowerCase();
    return lang.startsWith('ar') ? 'rtl' : 'ltr';
  }

  formatPreviewDate(iso: string | null): string {
    if (!iso?.trim()) {
      return '-';
    }
    const d = new Date(`${iso}T12:00:00`);
    if (Number.isNaN(d.getTime())) {
      return iso;
    }
    const locale = this.dialogDir === 'rtl' ? 'ar-SA' : 'en-US';
    return d.toLocaleDateString(locale, { dateStyle: 'medium' });
  }

  confirm(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || !this.fleetId?.trim()) {
      return;
    }

    const startDate = String(this.form.controls.startDate.value ?? '').trim();
    const days = parseMaintenanceDurationDays(this.form.controls.durationDays.value);
    if (!startDate || days === null) {
      return;
    }

    const endDate = computeMaintenanceEndDate(startDate, days);
    if (!endDate) {
      return;
    }

    this.resultSubject.next({
      id: this.maintenanceId,
      fleetId: this.fleetId,
      startDate,
      durationMaintenance: String(days),
      endDate,
    });
    this.resultSubject.complete();
    this.activeModal.close();
  }

  cancel(): void {
    this.resultSubject.next(null);
    this.resultSubject.complete();
    this.activeModal.dismiss();
  }

  private refreshComputedEndDate(): void {
    const startDate = String(this.form.controls.startDate.value ?? '').trim();
    const days = parseMaintenanceDurationDays(this.form.controls.durationDays.value);
    if (!startDate || days === null) {
      this.computedEndDate.set(null);
      return;
    }
    this.computedEndDate.set(computeMaintenanceEndDate(startDate, days));
  }
}
