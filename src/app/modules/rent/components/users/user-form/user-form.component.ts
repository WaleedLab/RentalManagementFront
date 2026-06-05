import { CommonModule } from '@angular/common';
import { Component, DestroyRef, ElementRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { merge } from 'rxjs';

import { AuthStateService } from '../../../../../core/auth/auth-state.service';
import { SHARED_FORM_FIELD_DIRECTIVES } from '../../../../../shared/forms/shared-form-field.imports';
import { UserService } from '../../../services/users/user.service';
import { RoleService } from '../../../services/roles/role.service';
import { BranchService } from '../../../services/branches/branch.service';
import { ToastService } from '../../../../../shared/services/toast.service';
import { Branch, RoleLookup, UserCreateRequest } from '../../../models';
import { DatePickerComponent } from '../../../../../shared/ui/date-picker/date-picker.component';
import { focusFirstInvalidControl } from '../../../../../shared/utils/focus-first-invalid-control.util';

@Component({
  selector: 'app-user-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    RouterLink,
    TranslateModule,
    ...SHARED_FORM_FIELD_DIRECTIVES,
    DatePickerComponent,
  ],
  templateUrl: './user-form.component.html',
  styleUrl: './user-form.component.scss',
})
export class UserFormComponent implements OnInit {
  private readonly hostEl = inject(ElementRef<HTMLElement>);
  private static readonly USERNAME_REGEX = /^[A-Za-z0-9._-]{3,255}$/;
  private static readonly ARABIC_NAME_REGEX = /^[\u0600-\u06FF\s.'-]{2,255}$/;
  private static readonly ENGLISH_NAME_REGEX = /^[A-Za-z\s.'-]{0,255}$/;
  private static readonly WORKFLOW_SECTION_IDS = [
    'user-form-section-account',
    'user-form-section-identity',
    'user-form-section-linking',
    'user-form-section-permissions',
  ] as const;

  private fb = inject(NonNullableFormBuilder);
  private authState = inject(AuthStateService);
  private userService = inject(UserService);
  private roleService = inject(RoleService);
  private branchService = inject(BranchService);
  private toast = inject(ToastService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  isEdit = signal(false);
  userId = signal<string | null>(null);
  initializing = signal(true);
  roles = signal<RoleLookup[]>([]);
  branches = signal<Branch[]>([]);
  roleSearch = signal('');
  loading = signal(false);
  loadingBranches = signal(false);
  requireFleetInput = signal(false);
  submitAttempted = signal(false);
  private formProgressTick = signal(0);

  filteredRoles = computed(() => {
    const keyword = this.roleSearch().trim().toLowerCase();
    if (!keyword) {
      return this.roles();
    }

    return this.roles().filter(role =>
      [role.name, role.displayName, role.displayNameEn]
        .filter(Boolean)
        .some(value => String(value).toLowerCase().includes(keyword)),
    );
  });

  form = this.fb.group({
    userName: ['', [Validators.required, Validators.maxLength(255), Validators.pattern(UserFormComponent.USERNAME_REGEX)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(255)]],
    password: ['', []],
    nameAr: ['', [Validators.required, Validators.maxLength(255), Validators.pattern(UserFormComponent.ARABIC_NAME_REGEX)]],
    nameEn: ['', [Validators.maxLength(255), Validators.pattern(UserFormComponent.ENGLISH_NAME_REGEX)]],
    isActive: [true],
    expirationDate: [''],
    branchId: ['' as number | ''],
    fleetId: [''],
    rolesId: [[] as string[]],
  });

  accountSectionComplete = computed(() => {
    this.formProgressTick();
    const f = this.form.controls;
    return f.userName.valid && f.email.valid && f.password.valid;
  });

  identitySectionComplete = computed(() => {
    this.formProgressTick();
    const f = this.form.controls;
    return this.accountSectionComplete() && f.nameAr.valid && f.nameEn.valid;
  });

  linkingSectionComplete = computed(() => {
    this.formProgressTick();
    const f = this.form.controls;
    return this.identitySectionComplete() && f.branchId.valid && f.fleetId.valid;
  });

  permissionsSectionComplete = computed(() => {
    this.formProgressTick();
    return this.linkingSectionComplete();
  });

  profileCompletionPercent = computed(() => {
    this.formProgressTick();
    let done = 0;
    if (this.accountSectionComplete()) done++;
    if (this.identitySectionComplete()) done++;
    if (this.linkingSectionComplete()) done++;
    if (this.permissionsSectionComplete()) done++;
    return Math.round((done / 4) * 100);
  });

  currentWorkflowStep = computed(() => {
    this.formProgressTick();
    if (!this.accountSectionComplete()) return 1;
    if (!this.identitySectionComplete()) return 2;
    if (!this.linkingSectionComplete()) return 3;
    if (!this.permissionsSectionComplete()) return 4;
    return 5;
  });

  ngOnInit(): void {
    merge(this.form.valueChanges, this.form.statusChanges)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.formProgressTick.update(v => v + 1));

    const userFleetId = this.authState.fleetId();
    if (userFleetId) {
      this.form.controls.fleetId.setValue(userFleetId);
      this.loadBranches(userFleetId);
      this.requireFleetInput.set(false);
      this.form.controls.fleetId.clearValidators();
    } else {
      this.requireFleetInput.set(true);
      this.form.controls.fleetId.clearValidators();
    }
    this.form.controls.fleetId.updateValueAndValidity({ emitEvent: false });

    this.roleService.getList().subscribe({
      next: list => this.roles.set(list ?? []),
      error: () => this.toast.error('Failed to load roles'),
    });

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEdit.set(true);
      this.userId.set(id);
      this.form.controls.password.clearValidators();
      this.userService.getById(id).subscribe({
        next: user => {
          this.form.patchValue({
            userName: user.userName,
            email: user.email,
            nameAr: user.nameAr || '',
            nameEn: user.nameEn || '',
            isActive: user.isActive,
            expirationDate: user.expirationDate ? user.expirationDate.slice(0, 10) : '',
            branchId: user.branchId ?? '',
            fleetId: user.fleetId || this.resolveFleetId(),
            rolesId:
              user.roleIds ??
              user.roles?.map(r => r.id) ??
              user.userRoles?.map(r => r.roleLookupId) ??
              [],
          });
          this.initializing.set(false);
        },
        error: () => {
          this.toast.error('Failed to load user');
          this.initializing.set(false);
        },
      });
    } else {
      this.form.controls.password.setValidators([Validators.required]);
      this.initializing.set(false);
    }
    this.form.controls.password.updateValueAndValidity();
  }

  focusWorkflowSection(step: 1 | 2 | 3 | 4): void {
    const sectionId = UserFormComponent.WORKFLOW_SECTION_IDS[step - 1];
    const section = this.hostEl.nativeElement.querySelector(
      `#${sectionId}`,
    ) as HTMLDetailsElement | null;
    if (!section) {
      return;
    }

    section.open = true;
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    section.classList.add('user-form-section--focus');
    window.setTimeout(() => section.classList.remove('user-form-section--focus'), 1400);
  }

  hasError(controlName: 'userName' | 'email' | 'password' | 'nameAr' | 'nameEn'): boolean {
    const control = this.form.controls[controlName];
    return !!control && control.invalid && (control.touched || control.dirty || this.submitAttempted());
  }

  onSubmit(): void {
    this.submitAttempted.set(true);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      focusFirstInvalidControl(this.hostEl.nativeElement);
      return;
    }
    const raw = this.form.getRawValue();
    const fleetId = this.resolveFleetId(raw.fleetId);

    this.loading.set(true);
    const body: UserCreateRequest = {
      userName: raw.userName.trim(),
      email: raw.email.trim(),
      password: raw.password,
      nameAr: raw.nameAr.trim() || undefined,
      nameEn: raw.nameEn.trim() || undefined,
      isActive: raw.isActive,
      expirationDate: raw.expirationDate || undefined,
      branchId: this.toOptionalPositiveInteger(raw.branchId),
      fleetId,
      rolesId: raw.rolesId,
    };
    const id = this.userId();
    if (id) {
      this.userService.update({ ...body, id }).subscribe({
        next: () => {
          this.toast.success('User updated');
          this.router.navigate(['/users']);
        },
        error: () => {
          this.toast.error('Failed to update user');
          this.loading.set(false);
        },
        complete: () => this.loading.set(false),
      });
    } else {
      this.userService.create(body).subscribe({
        next: () => {
          this.toast.success('User created');
          this.router.navigate(['/users']);
        },
        error: () => {
          this.toast.error('Failed to create user');
          this.loading.set(false);
        },
        complete: () => this.loading.set(false),
      });
    }
  }

  toggleRole(roleId: string): void {
    const current = this.form.controls.rolesId.value;
    const set = new Set(current);
    if (set.has(roleId)) set.delete(roleId);
    else set.add(roleId);
    this.form.controls.rolesId.setValue(Array.from(set));
  }

  isRoleSelected(roleId: string): boolean {
    return this.form.controls.rolesId.value.includes(roleId);
  }

  roleDisplay(role: RoleLookup): string {
    return role.displayName || role.displayNameEn || role.name;
  }

  selectedRolesCount(): number {
    return this.form.controls.rolesId.value.length;
  }

  private resolveFleetId(rawFleetId?: string): string | undefined {
    return rawFleetId || this.authState.fleetId() || undefined;
  }

  private loadBranches(fleetId: string): void {
    this.loadingBranches.set(true);
    this.branchService.getList(fleetId).subscribe({
      next: branches => {
        const activeBranches = (branches ?? []).filter(branch => branch.isActive !== false);
        this.branches.set(activeBranches);
      },
      error: () => {
        this.toast.error('Failed to load branches');
        this.loadingBranches.set(false);
      },
      complete: () => this.loadingBranches.set(false),
    });
  }

  branchDisplay(branch: Branch): string {
    const name = branch.nameAr || branch.nameEn || '-';
    const code = branch.code?.trim() || '';
    return [name, code].filter(Boolean).join(' - ');
  }

  private toOptionalPositiveInteger(value: unknown): number | undefined {
    const numeric = Number(value ?? 0);
    return Number.isFinite(numeric) && numeric > 0 ? Math.trunc(numeric) : undefined;
  }
}
