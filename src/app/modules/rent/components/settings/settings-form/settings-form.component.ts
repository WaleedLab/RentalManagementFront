import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnInit, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { AuthStateService } from '../../../../../core/auth/auth-state.service';
import { ToastService } from '../../../../../shared/services/toast.service';
import { PageHeaderComponent } from '../../../../../shared/ui/page-header/page-header.component';
import { Setting, SettingUpsertRequest } from '../../../models/settings/setting.model';
import { SettingService } from '../../../services/settings/setting.service';
import { focusFirstInvalidControl } from '../../../../../shared/utils/focus-first-invalid-control.util';

@Component({
  selector: 'app-settings-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule, PageHeaderComponent],
  templateUrl: './settings-form.component.html',
  styleUrl: './settings-form.component.scss',
})
export class SettingsFormComponent implements OnInit {
  private readonly hostEl = inject(ElementRef<HTMLElement>);
  private fb = inject(NonNullableFormBuilder);
  private authState = inject(AuthStateService);
  private settingsApi = inject(SettingService);
  private toast = inject(ToastService);
  private translate = inject(TranslateService);

  loading = signal(false);
  saving = signal(false);
  settingsId = signal<number>(0);

  form = this.fb.group({
    number_hour_latefree: [0, [Validators.required, Validators.min(0)]],
    number_mints_late_forr_finshcontract: [0, [Validators.required, Validators.min(0)]],
    number_hour_late_forr_finshinday: [0, [Validators.required, Validators.min(0)]],
    number_incres_km_for_finshcontract: [0, [Validators.required, Validators.min(0)]],
    minValue: [0, [Validators.required, Validators.min(0)]],
    tax: [0, [Validators.required, Validators.min(0)]],
    dateOfExp: [false],
    dateOfExpWithNation: [false],
    expDateAndInsuranceExp: [false],
    oneBookingOrMore: [false],
    bookingdebts: [false],
    bookingissues: [false],
    showBookingDistanceGps: [true],
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    const fleetId = this.authState.fleetId();
    this.loading.set(true);
    this.settingsApi.getCurrent(fleetId).subscribe({
      next: setting => this.patchForm(setting),
      error: err => {
        this.toast.error(err?.message ?? this.translate.instant('Failed to load settings'));
        this.loading.set(false);
      },
      complete: () => this.loading.set(false),
    });
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      focusFirstInvalidControl(this.hostEl.nativeElement);
      return;
    }

    const fleetId = (this.authState.fleetId() ?? '').trim();
    if (!fleetId) {
      this.toast.error(this.translate.instant('Fleet context is missing'));
      return;
    }

    const raw = this.form.getRawValue();
    const body: SettingUpsertRequest = {
      id: this.settingsId() || undefined,
      fleetId,
      number_hour_latefree: this.toNonNegativeInteger(raw.number_hour_latefree),
      number_mints_late_forr_finshcontract: this.toNonNegativeInteger(raw.number_mints_late_forr_finshcontract),
      number_hour_late_forr_finshinday: this.toNonNegativeInteger(raw.number_hour_late_forr_finshinday),
      number_incres_km_for_finshcontract: this.toNonNegativeInteger(raw.number_incres_km_for_finshcontract),
      minValue: this.toNonNegativeInteger(raw.minValue),
      tax: this.toNonNegativeDecimal(raw.tax),
      dateOfExp: !!raw.dateOfExp,
      dateOfExpWithNation: !!raw.dateOfExpWithNation,
      expDateAndInsuranceExp: !!raw.expDateAndInsuranceExp,
      oneBookingOrMore: !!raw.oneBookingOrMore,
      bookingdebts: !!raw.bookingdebts,
      bookingissues: !!raw.bookingissues,
      showBookingDistanceGps: !!raw.showBookingDistanceGps,
    };

    this.saving.set(true);
    this.settingsApi.save(body).subscribe({
      next: setting => {
        this.patchForm(setting);
        this.toast.success(this.translate.instant('Settings saved successfully'));
      },
      error: err => {
        this.toast.error(err?.message ?? this.translate.instant('Failed to save settings'));
        this.saving.set(false);
      },
      complete: () => this.saving.set(false),
    });
  }

  private patchForm(setting: Setting): void {
    this.settingsId.set(setting.id || 0);
    this.form.patchValue({
      number_hour_latefree: this.toNonNegativeInteger(setting.number_hour_latefree),
      number_mints_late_forr_finshcontract: this.toNonNegativeInteger(setting.number_mints_late_forr_finshcontract),
      number_hour_late_forr_finshinday: this.toNonNegativeInteger(setting.number_hour_late_forr_finshinday),
      number_incres_km_for_finshcontract: this.toNonNegativeInteger(setting.number_incres_km_for_finshcontract),
      minValue: this.toNonNegativeInteger(setting.minValue),
      tax: this.toNonNegativeDecimal(setting.tax),
      dateOfExp: !!setting.dateOfExp,
      dateOfExpWithNation: !!setting.dateOfExpWithNation,
      expDateAndInsuranceExp: !!setting.expDateAndInsuranceExp,
      oneBookingOrMore: !!setting.oneBookingOrMore,
      bookingdebts: !!setting.bookingdebts,
      bookingissues: !!setting.bookingissues,
      showBookingDistanceGps: !!setting.showBookingDistanceGps,
    });
  }

  private toNonNegativeInteger(value: unknown): number {
    const numeric = Number(value ?? 0);
    if (!Number.isFinite(numeric) || numeric < 0) return 0;
    return Math.trunc(numeric);
  }

  private toNonNegativeDecimal(value: unknown): number {
    const numeric = Number(value ?? 0);
    if (!Number.isFinite(numeric) || numeric < 0) return 0;
    return Number(numeric.toFixed(2));
  }
}

