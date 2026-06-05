import { CommonModule } from '@angular/common';
import { Component, DestroyRef, ElementRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { merge, forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { PrivilegeTypeLookup, RoleCreateRequest } from '../../../models';
import { PrivilegeService } from '../../../services/privileges/privilege.service';
import { RoleService } from '../../../services/roles/role.service';
import { ToastService } from '../../../../../shared/services/toast.service';
import { focusFirstInvalidControl } from '../../../../../shared/utils/focus-first-invalid-control.util';

@Component({
  selector: 'app-role-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterLink, TranslateModule],
  templateUrl: './role-form.component.html',
  styleUrl: './role-form.component.scss',
})
export class RoleFormComponent implements OnInit {
  private readonly hostEl = inject(ElementRef<HTMLElement>);
  private static readonly ROLE_NAME_REGEX = /^[\u0600-\u06FFA-Za-z0-9\s.'-]{2,255}$/;
  private static readonly ARABIC_NAME_REGEX = /^[\u0600-\u06FF\s.'-]{2,255}$/;
  private static readonly ENGLISH_NAME_REGEX = /^[A-Za-z\s.'-]{2,255}$/;
  private static readonly WORKFLOW_SECTION_IDS = [
    'role-form-section-identity',
    'role-form-section-permissions',
  ] as const;

  private fb = inject(NonNullableFormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private roleService = inject(RoleService);
  private privilegeService = inject(PrivilegeService);
  private toast = inject(ToastService);
  private translate = inject(TranslateService);
  private destroyRef = inject(DestroyRef);

  isEdit = signal(false);
  roleId = signal<string | null>(null);
  initializing = signal(true);
  privileges = signal<PrivilegeTypeLookup[]>([]);
  privilegeSearch = signal('');
  loading = signal(false);
  submitAttempted = signal(false);
  private formProgressTick = signal(0);

  filteredPrivileges = computed(() => {
    const term = this.privilegeSearch().trim().toLowerCase();
    if (!term) {
      return this.privileges();
    }

    return this.privileges().filter(privilege =>
      [privilege.name, privilege.nameEn, privilege.privilegeName]
        .filter(Boolean)
        .some(value => String(value).toLowerCase().includes(term)),
    );
  });

  form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(255), Validators.pattern(RoleFormComponent.ROLE_NAME_REGEX)]],
    displayName: ['', [Validators.required, Validators.maxLength(255), Validators.pattern(RoleFormComponent.ARABIC_NAME_REGEX)]],
    displayNameEn: ['', [Validators.required, Validators.maxLength(255), Validators.pattern(RoleFormComponent.ENGLISH_NAME_REGEX)]],
    privilegeTypeIds: [[] as string[], [Validators.required]],
  });

  identitySectionComplete = computed(() => {
    this.formProgressTick();
    const f = this.form.controls;
    return f.name.valid && f.displayName.valid && f.displayNameEn.valid;
  });

  permissionsSectionComplete = computed(() => {
    this.formProgressTick();
    return this.identitySectionComplete() && this.form.controls.privilegeTypeIds.valid;
  });

  profileCompletionPercent = computed(() => {
    this.formProgressTick();
    let done = 0;
    if (this.identitySectionComplete()) done++;
    if (this.permissionsSectionComplete()) done++;
    return Math.round((done / 2) * 100);
  });

  currentWorkflowStep = computed(() => {
    this.formProgressTick();
    if (!this.identitySectionComplete()) return 1;
    if (!this.permissionsSectionComplete()) return 2;
    return 3;
  });

  ngOnInit(): void {
    merge(this.form.valueChanges, this.form.statusChanges)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.formProgressTick.update(v => v + 1));

    const id = this.route.snapshot.paramMap.get('id');
    const privileges$ = this.privilegeService.getList().pipe(
      catchError(() => {
        this.toast.error(this.translate.instant('Failed to load privileges'));
        return of([] as PrivilegeTypeLookup[]);
      }),
    );

    if (id) {
      this.isEdit.set(true);
      this.roleId.set(id);
      forkJoin({
        privileges: privileges$,
        role: this.roleService.getById(id),
      }).subscribe({
        next: ({ privileges, role }) => {
          this.privileges.set(privileges ?? []);
          this.form.patchValue({
            name: role.name,
            displayName: role.displayName || '',
            displayNameEn: role.displayNameEn || '',
            privilegeTypeIds:
              role.privilegeTypeIds ?? role.privilegeTypeRoles?.map(item => item.privilegeTypeLookupId) ?? [],
          });
          this.initializing.set(false);
        },
        error: () => {
          this.toast.error(this.translate.instant('Failed to load role'));
          this.initializing.set(false);
        },
      });
      return;
    }

    privileges$.subscribe({
      next: privileges => {
        this.privileges.set(privileges ?? []);
        this.initializing.set(false);
      },
    });
  }

  focusWorkflowSection(step: 1 | 2): void {
    const sectionId = RoleFormComponent.WORKFLOW_SECTION_IDS[step - 1];
    const section = this.hostEl.nativeElement.querySelector(
      `#${sectionId}`,
    ) as HTMLDetailsElement | null;
    if (!section) {
      return;
    }

    section.open = true;
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    section.classList.add('role-form-section--focus');
    window.setTimeout(() => section.classList.remove('role-form-section--focus'), 1400);
  }

  hasError(controlName: 'name' | 'displayName' | 'displayNameEn'): boolean {
    const control = this.form.controls[controlName];
    return !!control && control.invalid && (control.touched || control.dirty || this.submitAttempted());
  }

  hasPrivilegesError(): boolean {
    const control = this.form.controls.privilegeTypeIds;
    return control.invalid && (control.touched || control.dirty || this.submitAttempted());
  }

  togglePrivilege(id: string): void {
    const set = new Set(this.form.controls.privilegeTypeIds.value);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    this.form.controls.privilegeTypeIds.setValue(Array.from(set));
    this.form.controls.privilegeTypeIds.markAsTouched();
  }

  isPrivilegeSelected(id: string): boolean {
    return this.form.controls.privilegeTypeIds.value.includes(id);
  }

  selectAllFiltered(): void {
    const selected = new Set(this.form.controls.privilegeTypeIds.value);
    for (const privilege of this.filteredPrivileges()) {
      selected.add(privilege.id);
    }

    this.form.controls.privilegeTypeIds.setValue(Array.from(selected));
    this.form.controls.privilegeTypeIds.markAsDirty();
    this.form.controls.privilegeTypeIds.markAsTouched();
  }

  clearSelectedPrivileges(): void {
    this.form.controls.privilegeTypeIds.setValue([]);
    this.form.controls.privilegeTypeIds.markAsDirty();
    this.form.controls.privilegeTypeIds.markAsTouched();
  }

  selectedPrivilegesCount(): number {
    return this.form.controls.privilegeTypeIds.value.length;
  }

  save(): void {
    this.submitAttempted.set(true);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      focusFirstInvalidControl(this.hostEl.nativeElement);
      return;
    }

    const raw = this.form.getRawValue();
    const body: RoleCreateRequest = {
      name: raw.name.trim(),
      displayName: raw.displayName.trim(),
      displayNameEn: raw.displayNameEn.trim(),
      privilegeTypeIds: raw.privilegeTypeIds,
    };

    this.loading.set(true);
    const request$ = this.roleId()
      ? this.roleService.update({ ...body, id: this.roleId()! })
      : this.roleService.create(body);

    request$.subscribe({
      next: () => {
        this.toast.success(this.translate.instant(this.isEdit() ? 'Role updated' : 'Role created'));
        this.router.navigate(['/roles']);
      },
      error: () => this.loading.set(false),
      complete: () => this.loading.set(false),
    });
  }
}
