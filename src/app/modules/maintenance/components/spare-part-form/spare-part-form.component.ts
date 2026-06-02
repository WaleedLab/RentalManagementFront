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
import { SparePartUpsertRequest } from '../../models/spare-part.model';
import { SparePartService } from '../../services/spare-part.service';

@Component({
  selector: 'app-spare-part-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    TranslateModule,
    ...SHARED_FORM_FIELD_DIRECTIVES,
    PageHeaderComponent,
  ],
  templateUrl: './spare-part-form.component.html',
  styleUrl: './spare-part-form.component.scss',
})
export class SparePartFormComponent implements OnInit {
  private readonly hostEl = inject(ElementRef<HTMLElement>);
  private fb = inject(NonNullableFormBuilder);
  private authState = inject(AuthStateService);
  private sparePartService = inject(SparePartService);
  private toast = inject(ToastService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private translate = inject(TranslateService);

  isEdit = signal(false);
  sparePartId = signal<string | null>(null);
  initializing = signal(true);
  saving = signal(false);

  form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(200)]],
    number: [0, [Validators.required, Validators.min(0)]],
    description: ['', [Validators.maxLength(1000)]],
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.initializing.set(false);
      return;
    }

    this.isEdit.set(true);
    this.sparePartId.set(id);
    this.sparePartService.getById(id, this.authState.fleetId()).subscribe({
      next: row => {
        this.form.patchValue({
          name: row.name ?? '',
          number: row.number ?? 0,
          description: row.description ?? '',
        });
        this.initializing.set(false);
      },
      error: err => {
        this.toast.error(err?.message ?? this.translate.instant('maintenance.sparePart.loadOneFailed'));
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
    const payload: SparePartUpsertRequest = {
      id: this.sparePartId() ?? undefined,
      fleetId,
      name: raw.name.trim(),
      number: Number(raw.number) || 0,
      description: raw.description.trim() || null,
    };

    this.saving.set(true);
    const req$ = this.isEdit()
      ? this.sparePartService.update(payload)
      : this.sparePartService.create(payload);
    req$.subscribe({
      next: () => {
        this.toast.success(
          this.translate.instant(
            this.isEdit() ? 'maintenance.sparePart.updated' : 'maintenance.sparePart.created',
          ),
        );
        this.router.navigate(['/maintenance/spare-parts']);
      },
      error: err => {
        this.toast.error(err?.message ?? this.translate.instant('maintenance.sparePart.saveFailed'));
        this.saving.set(false);
      },
      complete: () => this.saving.set(false),
    });
  }
}
