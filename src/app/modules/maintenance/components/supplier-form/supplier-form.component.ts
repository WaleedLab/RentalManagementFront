import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnInit, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { AuthStateService } from '../../../../core/auth/auth-state.service';
import { SHARED_FORM_FIELD_DIRECTIVES } from '../../../../shared/forms/shared-form-field.imports';
import { ToastService } from '../../../../shared/services/toast.service';
import { focusFirstInvalidControl } from '../../../../shared/utils/focus-first-invalid-control.util';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import { SupplierUpsertRequest } from '../../models/supplier.model';
import { SupplierService } from '../../services/supplier.service';

@Component({
  selector: 'app-supplier-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    TranslateModule,
    ...SHARED_FORM_FIELD_DIRECTIVES,
    PageHeaderComponent,
  ],
  templateUrl: './supplier-form.component.html',
  styleUrl: './supplier-form.component.scss',
})
export class SupplierFormComponent implements OnInit {
  private readonly hostEl = inject(ElementRef<HTMLElement>);
  private fb = inject(NonNullableFormBuilder);
  private authState = inject(AuthStateService);
  private supplierService = inject(SupplierService);
  private toast = inject(ToastService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private translate = inject(TranslateService);

  isEdit = signal(false);
  supplierId = signal<string | null>(null);
  initializing = signal(true);
  saving = signal(false);

  form = this.fb.group({
    supplierName: ['', [Validators.required, Validators.maxLength(200)]],
    phone: ['', [Validators.required, Validators.maxLength(50)]],
    phone2: ['', [Validators.maxLength(50)]],
    address: ['', [Validators.maxLength(500)]],
    email: ['', [Validators.email, Validators.maxLength(200)]],
    taxRecord: ['', [Validators.maxLength(100)]],
    accountNumber: ['', [Validators.maxLength(100)]],
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.initializing.set(false);
      return;
    }

    this.isEdit.set(true);
    this.supplierId.set(id);
    this.supplierService.getById(id, this.authState.fleetId()).subscribe({
      next: row => {
        this.form.patchValue({
          supplierName: row.supplierName ?? '',
          phone: row.phone ?? '',
          phone2: row.phone2 ?? '',
          address: row.address ?? '',
          email: row.email ?? '',
          taxRecord: row.taxRecord ?? '',
          accountNumber: row.accountNumber ?? '',
        });
        this.initializing.set(false);
      },
      error: err => {
        this.toast.error(err?.message ?? this.translate.instant('maintenance.supplier.loadOneFailed'));
        this.initializing.set(false);
      },
    });
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      focusFirstInvalidControl(this.hostEl.nativeElement);
      return;
    }
    const fleetId = (this.authState.fleetId() ?? '').trim();
    if (!fleetId) {
      this.toast.error(this.translate.instant('FleetId is required'));
      return;
    }
    const raw = this.form.getRawValue();
    const payload: SupplierUpsertRequest = {
      id: this.supplierId() ?? undefined,
      fleetId,
      supplierName: raw.supplierName.trim(),
      phone: raw.phone.trim(),
      phone2: raw.phone2.trim() || null,
      address: raw.address.trim() || null,
      email: raw.email.trim() || null,
      taxRecord: raw.taxRecord.trim() || null,
      accountNumber: raw.accountNumber.trim() || null,
    };

    this.saving.set(true);
    const req$ = this.isEdit()
      ? this.supplierService.update(payload)
      : this.supplierService.create(payload);
    req$.subscribe({
      next: () => {
        this.toast.success(
          this.translate.instant(
            this.isEdit() ? 'maintenance.supplier.updated' : 'maintenance.supplier.created',
          ),
        );
        this.router.navigate(['/maintenance/suppliers']);
      },
      error: err => {
        this.toast.error(err?.message ?? this.translate.instant('maintenance.supplier.saveFailed'));
        this.saving.set(false);
      },
      complete: () => this.saving.set(false),
    });
  }
}
