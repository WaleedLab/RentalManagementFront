import { CommonModule } from '@angular/common';
import { Component, Input, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, Subscription, forkJoin } from 'rxjs';

import { ConfirmService } from '../../../../shared/services/confirm.service';
import { ToastService } from '../../../../shared/services/toast.service';
import { DatePickerComponent } from '../../../../shared/ui/date-picker/date-picker.component';
import {
  SmoothSelectComponent,
  SmoothSelectOption,
  SmoothSelectValue,
} from '../../../../shared/ui/smooth-select/smooth-select.component';
import { MaintenanceDetail } from '../../models/maintenance-detail.model';
import { SparePart } from '../../models/spare-part.model';
import { Supplier } from '../../models/supplier.model';
import { MaintenanceDetailService } from '../../services/maintenance-detail.service';
import { SparePartService } from '../../services/spare-part.service';
import { SupplierService } from '../../services/supplier.service';
import { sumMaintenanceDetailLines } from '../../utils/maintenance-detail-total.util';

export type MaintenanceDetailsDialogResult = boolean;

@Component({
  selector: 'app-maintenance-details-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslateModule,
    DatePickerComponent,
    SmoothSelectComponent,
  ],
  templateUrl: './maintenance-details-dialog.component.html',
  styleUrl: './maintenance-details-dialog.component.scss',
})
export class MaintenanceDetailsDialogComponent implements OnInit, OnDestroy {
  @Input() title = '';
  @Input() message = '';
  @Input() plateNumber = '';
  @Input() maintenanceId = '';
  @Input() fleetId = '';

  private activeModal = inject(NgbActiveModal);
  private translate = inject(TranslateService);
  private fb = inject(FormBuilder);
  private detailApi = inject(MaintenanceDetailService);
  private sparePartApi = inject(SparePartService);
  private supplierApi = inject(SupplierService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);

  private resultSubject = new Subject<MaintenanceDetailsDialogResult>();
  private formSub?: Subscription;
  private readonly languageTick = signal(0);

  result = this.resultSubject.asObservable();

  loading = signal(true);
  saving = signal(false);
  deletingIds = signal<string[]>([]);
  details = signal<MaintenanceDetail[]>([]);
  spareParts = signal<SparePart[]>([]);
  suppliers = signal<Supplier[]>([]);

  form = this.fb.group({
    idSparePartName: this.fb.control<number | ''>('', [Validators.required, Validators.min(1)]),
    idSupplier: this.fb.control<number | ''>('', [Validators.required, Validators.min(1)]),
    price: this.fb.control<number | null>(null, [Validators.required, Validators.min(0)]),
    tax: this.fb.control<number | null>(0, [Validators.required, Validators.min(0)]),
    numberInvoice: this.fb.control<number | null>(null, [Validators.required, Validators.min(0)]),
    dateInvoice: this.fb.control<string | null>(null, [Validators.required]),
  });

  sparePartOptions = computed<SmoothSelectOption[]>(() => {
    this.languageTick();
    return this.spareParts().map(part => ({
      label: part.name || `#${part.id}`,
      value: Number(part.id),
    }));
  });

  supplierOptions = computed<SmoothSelectOption[]>(() => {
    this.languageTick();
    return this.suppliers().map(supplier => ({
      label: supplier.supplierName || `#${supplier.id}`,
      value: Number(supplier.id),
    }));
  });

  detailsTotal = computed(() => sumMaintenanceDetailLines(this.details()));

  ngOnInit(): void {
    this.translate.onLangChange.subscribe(() => this.languageTick.update(v => v + 1));

    const today = new Date();
    const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    this.form.patchValue({ dateInvoice: iso, tax: 0 });

    this.loadDialogData();
  }

  ngOnDestroy(): void {
    this.formSub?.unsubscribe();
  }

  get dialogDir(): 'rtl' | 'ltr' {
    const lang = (this.translate.currentLang || this.translate.getDefaultLang() || 'en').toLowerCase();
    return lang.startsWith('ar') ? 'rtl' : 'ltr';
  }

  onSparePartChange(value: SmoothSelectValue): void {
    const parsed = Number(value);
    this.form.controls.idSparePartName.setValue(Number.isFinite(parsed) && parsed > 0 ? parsed : '');
    this.form.controls.idSparePartName.markAsTouched();
  }

  onSupplierChange(value: SmoothSelectValue): void {
    const parsed = Number(value);
    this.form.controls.idSupplier.setValue(Number.isFinite(parsed) && parsed > 0 ? parsed : '');
    this.form.controls.idSupplier.markAsTouched();
  }

  addDetail(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || !this.fleetId?.trim()) {
      return;
    }

    const idMaintenance = Number(this.maintenanceId);
    if (!Number.isFinite(idMaintenance) || idMaintenance <= 0) {
      return;
    }

    const dateInvoice = this.toApiDateTime(this.form.controls.dateInvoice.value);
    if (!dateInvoice) {
      return;
    }

    this.saving.set(true);
    this.detailApi
      .create({
        idMaintenance,
        fleetId: this.fleetId,
        details: [
          {
            idSparePartName: Number(this.form.controls.idSparePartName.value),
            idSupplier: Number(this.form.controls.idSupplier.value),
            price: Number(this.form.controls.price.value ?? 0),
            tax: Number(this.form.controls.tax.value ?? 0),
            numberInvoice: Number(this.form.controls.numberInvoice.value ?? 0),
            dateInvoice,
          },
        ],
      })
      .subscribe({
        next: () => {
          this.toast.success(this.translate.instant('maintenance.details.addSuccess'));
          this.resetFormAfterAdd();
          this.reloadDetails(false);
          this.resultSubject.next(true);
        },
        error: err =>
          this.toast.error(err?.message ?? this.translate.instant('maintenance.details.addFailed')),
        complete: () => this.saving.set(false),
      });
  }

  deleteDetail(row: MaintenanceDetail): void {
    const fleetId = this.fleetId?.trim();
    if (!fleetId || !row.id) {
      return;
    }

    const label = row.sparePartName || `#${row.idSparePartName}`;
    this.confirm
      .confirm(
        this.translate.instant('maintenance.details.deleteTitle'),
        `${this.translate.instant('maintenance.details.deleteConfirm')} ${label}`,
      )
      .subscribe(confirmed => {
        if (!confirmed) {
          return;
        }

        this.deletingIds.update(ids => [...ids, row.id]);
        this.detailApi.softDelete(row.id, fleetId).subscribe({
          next: () => {
            this.toast.success(this.translate.instant('maintenance.details.deleteSuccess'));
            this.reloadDetails(false);
            this.resultSubject.next(true);
          },
          error: err =>
            this.toast.error(err?.message ?? this.translate.instant('maintenance.details.deleteFailed')),
          complete: () =>
            this.deletingIds.update(ids => ids.filter(id => id !== row.id)),
        });
      });
  }

  isDeleting(id: string): boolean {
    return this.deletingIds().includes(id);
  }

  formatMoney(value: number | null | undefined): string {
    const amount = value ?? 0;
    return new Intl.NumberFormat(this.dialogDir === 'rtl' ? 'ar-SA' : 'en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  }

  formatDate(value: string | undefined): string {
    if (!value?.trim()) {
      return '-';
    }
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) {
      return value;
    }
    return d.toLocaleDateString(this.dialogDir === 'rtl' ? 'ar-SA' : 'en-US', { dateStyle: 'medium' });
  }

  close(): void {
    this.resultSubject.complete();
    this.activeModal.close();
  }

  private loadDialogData(): void {
    const fleetId = this.fleetId?.trim();
    const idMaintenance = Number(this.maintenanceId);
    if (!fleetId || !Number.isFinite(idMaintenance) || idMaintenance <= 0) {
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    forkJoin({
      details: this.detailApi.getList(idMaintenance, fleetId),
      spareParts: this.sparePartApi.getPaginated({
        fleetId,
        pageNumber: 1,
        pageSize: 500,
      }),
      suppliers: this.supplierApi.getList(fleetId),
    }).subscribe({
      next: ({ details, spareParts, suppliers }) => {
        this.details.set(details ?? []);
        this.spareParts.set(spareParts.items ?? []);
        this.suppliers.set(suppliers ?? []);
      },
      error: err => {
        this.toast.error(err?.message ?? this.translate.instant('maintenance.details.loadFailed'));
        this.details.set([]);
      },
      complete: () => this.loading.set(false),
    });
  }

  private reloadDetails(showLoader: boolean): void {
    const fleetId = this.fleetId?.trim();
    const idMaintenance = Number(this.maintenanceId);
    if (!fleetId || !Number.isFinite(idMaintenance) || idMaintenance <= 0) {
      return;
    }

    if (showLoader) {
      this.loading.set(true);
    }

    this.detailApi.getList(idMaintenance, fleetId).subscribe({
      next: items => this.details.set(items ?? []),
      error: () => this.details.set([]),
      complete: () => {
        if (showLoader) {
          this.loading.set(false);
        }
      },
    });
  }

  private resetFormAfterAdd(): void {
    const today = new Date();
    const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    this.form.reset({
      idSparePartName: '',
      idSupplier: '',
      price: null,
      tax: 0,
      numberInvoice: null,
      dateInvoice: iso,
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
