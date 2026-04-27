import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnInit, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { AuthStateService } from '../../../../../core/auth/auth-state.service';
import type { Branch, BranchUpsertRequest } from '../../../models';
import { BranchService } from '../../../services/branches/branch.service';
import { ToastService } from '../../../../../shared/services/toast.service';
import { PageHeaderComponent } from '../../../../../shared/ui/page-header/page-header.component';
import { focusFirstInvalidControl } from '../../../../../shared/utils/focus-first-invalid-control.util';

@Component({
  selector: 'app-branch-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, TranslateModule, PageHeaderComponent],
  templateUrl: './branch-form.component.html',
  styleUrl: './branch-form.component.scss',
})
export class BranchFormComponent implements OnInit {
  private readonly hostEl = inject(ElementRef<HTMLElement>);
  private static readonly ARABIC_NAME_REGEX = /^[\u0600-\u06FF0-9\s.'-]{2,255}$/;
  private static readonly ENGLISH_NAME_REGEX = /^[A-Za-z0-9\s.'-]{0,255}$/;
  private static readonly BRANCH_CODE_REGEX = /^[A-Za-z0-9-_]{0,100}$/;

  private fb = inject(NonNullableFormBuilder);
  private authState = inject(AuthStateService);
  private branchApi = inject(BranchService);
  private toast = inject(ToastService);
  private translate = inject(TranslateService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  isEdit = signal(false);
  loading = signal(false);
  branchId = signal<number | null>(null);
  fleetId = signal<string>('');

  form = this.fb.group({
    nameAr: ['', [Validators.required, Validators.maxLength(255), Validators.pattern(BranchFormComponent.ARABIC_NAME_REGEX)]],
    nameEn: ['', [Validators.maxLength(255), Validators.pattern(BranchFormComponent.ENGLISH_NAME_REGEX)]],
    code: ['', [Validators.maxLength(100), Validators.pattern(BranchFormComponent.BRANCH_CODE_REGEX)]],
    isActive: [true],
  });

  ngOnInit(): void {
    const fleet = this.authState.fleetId() ?? '';
    if (fleet) {
      this.fleetId.set(fleet);
    }

    const idRaw = this.route.snapshot.paramMap.get('id');
    if (!idRaw) return;

    const id = Number(idRaw);
    if (!Number.isFinite(id)) return;
    this.isEdit.set(true);
    this.branchId.set(id);
    this.loadBranch(id);
  }

  private loadBranch(id: number): void {
    const fleetId = this.resolveFleetId();

    this.loading.set(true);
    this.branchApi.getById(id, fleetId).subscribe({
      next: (branch: Branch) => {
        if (branch.fleetId?.trim()) {
          this.fleetId.set(branch.fleetId.trim());
        }

        this.form.patchValue({
          nameAr: branch.nameAr ?? '',
          nameEn: branch.nameEn ?? '',
          code: branch.code ?? '',
          isActive: !!branch.isActive,
        });
      },
      error: err => {
        this.toast.error(err?.message ?? this.translate.instant('Failed to load branch'));
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

    const raw = this.form.getRawValue();
    const fleetId = this.resolveFleetId();
    if (!fleetId) {
      this.toast.error(this.translate.instant('FleetId is required'));
      return;
    }

    const body: BranchUpsertRequest = {
      id: this.branchId() ?? undefined,
      fleetId,
      nameAr: raw.nameAr.trim(),
      nameEn: raw.nameEn.trim() || undefined,
      code: raw.code.trim() || undefined,
      isActive: raw.isActive,
    };

    this.loading.set(true);
    const branchId = this.branchId();
    const request$ = branchId ? this.branchApi.update(branchId, body) : this.branchApi.create(body);

    request$.subscribe({
      next: () => {
        this.toast.success(
          this.translate.instant(branchId ? 'Branch updated successfully' : 'Branch created successfully'),
        );
        this.router.navigate(['/branches']);
      },
      error: err => {
        this.toast.error(err?.message ?? this.translate.instant('Failed to save branch'));
        this.loading.set(false);
      },
      complete: () => this.loading.set(false),
    });
  }

  private resolveFleetId(): string | undefined {
    return this.fleetId().trim() || undefined;
  }
}





