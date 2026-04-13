import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnInit, inject, signal } from '@angular/core';
import { FormArray, FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { forkJoin } from 'rxjs';

import { PrivilegeTypeCreateRequest } from '../../../models';
import { PrivilegeService } from '../../../services/privileges/privilege.service';
import { ToastService } from '../../../../../shared/services/toast.service';
import { PageHeaderComponent } from '../../../../../shared/ui/page-header/page-header.component';
import { focusFirstInvalidControl } from '../../../../../shared/utils/focus-first-invalid-control.util';

@Component({
  selector: 'app-privilege-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterLink, TranslateModule, PageHeaderComponent],
  templateUrl: './privilege-form.component.html',
})
export class PrivilegeFormComponent implements OnInit {
  private readonly hostEl = inject(ElementRef<HTMLElement>);
  private static readonly ARABIC_NAME_REGEX = /^[\u0600-\u06FF\s.'-]{2,255}$/;
  private static readonly ENGLISH_NAME_REGEX = /^[A-Za-z\s.'-]{2,255}$/;
  private static readonly PRIVILEGE_CODE_REGEX = /^[A-Z0-9_]{3,500}$/;

  private fb = inject(NonNullableFormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private privilegeService = inject(PrivilegeService);
  private toast = inject(ToastService);
  private translate = inject(TranslateService);

  isEdit = signal(false);
  isBulkMode = signal(false);
  privilegeId = signal<string | null>(null);
  loading = signal(false);

  form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(255), Validators.pattern(PrivilegeFormComponent.ARABIC_NAME_REGEX)]],
    nameEn: ['', [Validators.required, Validators.maxLength(255), Validators.pattern(PrivilegeFormComponent.ENGLISH_NAME_REGEX)]],
    privilegeName: ['', [Validators.required, Validators.maxLength(500), Validators.pattern(PrivilegeFormComponent.PRIVILEGE_CODE_REGEX)]],
    order: [0, [Validators.required, Validators.min(0)]],
  });
  bulkForm = this.fb.group({
    items: this.fb.array([this.createBulkRow(1)]),
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    const mode = (this.route.snapshot.queryParamMap.get('mode') || '').toLowerCase();
    if (!id) {
      this.isBulkMode.set(mode === 'bulk');
      return;
    }

    this.isEdit.set(true);
    this.isBulkMode.set(false);
    this.privilegeId.set(id);
    this.loading.set(true);
    this.privilegeService.getById(id).subscribe({
      next: privilege => {
        this.form.patchValue({
          name: privilege.name || '',
          nameEn: privilege.nameEn || '',
          privilegeName: privilege.privilegeName || '',
          order: privilege.order ?? 0,
        });
      },
      error: () => this.toast.error(this.translate.instant('Failed to load privilege')),
      complete: () => this.loading.set(false),
    });
  }

  get bulkItems(): FormArray {
    return this.bulkForm.controls.items;
  }

  setMode(mode: 'single' | 'bulk'): void {
    if (this.isEdit()) {
      return;
    }

    this.isBulkMode.set(mode === 'bulk');
  }

  addBulkRow(): void {
    this.bulkItems.push(this.createBulkRow(this.nextBulkOrder()));
  }

  cloneBulkRow(index: number): void {
    const row = this.bulkItems.at(index);
    if (!row) {
      return;
    }

    const raw = row.getRawValue();
    this.bulkItems.push(this.createBulkRow(this.nextBulkOrder(), raw.name, raw.nameEn, raw.privilegeName));
  }

  removeBulkRow(index: number): void {
    if (this.bulkItems.length <= 1) {
      this.bulkItems.at(0).reset({
        name: '',
        nameEn: '',
        privilegeName: '',
        order: 1,
      });
      return;
    }

    this.bulkItems.removeAt(index);
  }

  autoFillCode(index: number): void {
    const row = this.bulkItems.at(index);
    if (!row) {
      return;
    }

    const sourceName = String(row.get('nameEn')?.value ?? '');
    const suggestedCode = sourceName
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');

    if (suggestedCode) {
      row.get('privilegeName')?.setValue(suggestedCode);
    }
  }

  save(): void {
    if (this.isBulkMode() && !this.isEdit()) {
      this.saveBulk();
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      focusFirstInvalidControl(this.hostEl.nativeElement);
      return;
    }

    const raw = this.form.getRawValue();
    const body: PrivilegeTypeCreateRequest = {
      name: raw.name.trim(),
      nameEn: raw.nameEn.trim(),
      privilegeName: raw.privilegeName.trim(),
      order: raw.order,
    };

    this.loading.set(true);
    const request$ = this.privilegeId()
      ? this.privilegeService.update({ ...body, id: this.privilegeId()! })
      : this.privilegeService.create(body);

    request$.subscribe({
      next: () => {
        this.toast.success(this.translate.instant(this.isEdit() ? 'Privilege updated' : 'Privilege created'));
        this.router.navigate(['/privileges']);
      },
      error: () => this.loading.set(false),
      complete: () => this.loading.set(false),
    });
  }

  private saveBulk(): void {
    if (this.bulkForm.invalid) {
      this.bulkForm.markAllAsTouched();
      focusFirstInvalidControl(this.hostEl.nativeElement);
      return;
    }

    const payload = this.bulkItems.controls.map(control => {
      const raw = control.getRawValue();
      return {
        name: String(raw.name ?? '').trim(),
        nameEn: String(raw.nameEn ?? '').trim(),
        privilegeName: String(raw.privilegeName ?? '').trim().toUpperCase(),
        order: Number(raw.order ?? 0),
      };
    });

    const duplicates = this.findDuplicateCodes(payload.map(item => item.privilegeName));
    if (duplicates.length > 0) {
      this.toast.error(
        this.translate.instant('Duplicate privilege codes in batch') + `: ${duplicates.join(', ')}`,
      );
      return;
    }

    this.loading.set(true);
    forkJoin(payload.map(item => this.privilegeService.create(item))).subscribe({
      next: () => {
        this.toast.success(
          this.translate.instant('Privileges created') + ` (${payload.length})`,
        );
        this.router.navigate(['/privileges']);
      },
      error: () => {
        this.toast.error(this.translate.instant('Failed to create privileges batch'));
        this.loading.set(false);
      },
      complete: () => this.loading.set(false),
    });
  }

  private createBulkRow(order: number, name: string = '', nameEn: string = '', privilegeName: string = '') {
    return this.fb.group({
      name: [
        name,
        [
          Validators.required,
          Validators.maxLength(255),
          Validators.pattern(PrivilegeFormComponent.ARABIC_NAME_REGEX),
        ],
      ],
      nameEn: [
        nameEn,
        [
          Validators.required,
          Validators.maxLength(255),
          Validators.pattern(PrivilegeFormComponent.ENGLISH_NAME_REGEX),
        ],
      ],
      privilegeName: [
        privilegeName,
        [
          Validators.required,
          Validators.maxLength(500),
          Validators.pattern(PrivilegeFormComponent.PRIVILEGE_CODE_REGEX),
        ],
      ],
      order: [order, [Validators.required, Validators.min(0)]],
    });
  }

  private nextBulkOrder(): number {
    const lastOrder = this.bulkItems.controls
      .map(control => Number(control.get('order')?.value ?? 0))
      .reduce((maxOrder, currentOrder) => Math.max(maxOrder, currentOrder), 0);

    return lastOrder + 1;
  }

  private findDuplicateCodes(codes: string[]): string[] {
    const counts = new Map<string, number>();
    for (const code of codes) {
      const normalized = code.trim().toUpperCase();
      counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
    }

    return Array.from(counts.entries())
      .filter(([, count]) => count > 1)
      .map(([code]) => code);
  }
}





