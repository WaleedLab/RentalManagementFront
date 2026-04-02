import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { AuthStateService } from '../../../../../core/auth/auth-state.service';
import { UserService } from '../../../services/users/user.service';
import { RoleService } from '../../../services/roles/role.service';
import { FleetService } from '../../../services/fleet/fleet.service';
import { ToastService } from '../../../../../shared/services/toast.service';
import { Fleet, RoleLookup, UserCreateRequest } from '../../../models';
import { PageHeaderComponent } from '../../../../../shared/ui/page-header/page-header.component';
import { SmoothSelectComponent, SmoothSelectOption } from '../../../../../shared/ui/smooth-select/smooth-select.component';

@Component({
  selector: 'app-user-form',
  standalone: true,
  imports: [ReactiveFormsModule, FormsModule, RouterLink, TranslateModule, PageHeaderComponent, SmoothSelectComponent],
  templateUrl: './user-form.component.html',
  styleUrl: './user-form.component.scss',
})
export class UserFormComponent implements OnInit {
  private static readonly USERNAME_REGEX = /^[A-Za-z0-9._-]{3,255}$/;
  private static readonly ARABIC_NAME_REGEX = /^[\u0600-\u06FF\s.'-]{2,255}$/;
  private static readonly ENGLISH_NAME_REGEX = /^[A-Za-z\s.'-]{0,255}$/;

  private fb = inject(NonNullableFormBuilder);
  private authState = inject(AuthStateService);
  private userService = inject(UserService);
  private roleService = inject(RoleService);
  private fleetService = inject(FleetService);
  private toast = inject(ToastService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  isEdit = signal(false);
  userId = signal<string | null>(null);
  roles = signal<RoleLookup[]>([]);
  roleSearch = signal('');
  fleets = signal<Fleet[]>([]);
  fleetLoading = signal(false);
  loading = signal(false);
  isSuperAdmin = computed(() => this.authState.isSuperAdmin());
  fleetSelectOptions = computed<SmoothSelectOption[]>(() => [
    { label: 'Select Fleet', value: '' },
    ...this.fleets().map(fleet => ({
      label: `${fleet.name}${fleet.fleetCode ? ' (' + fleet.fleetCode + ')' : ''}`,
      value: fleet.id,
    })),
  ]);
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
    fleetId: [''],
    rolesId: [[] as string[]],
  });

  ngOnInit(): void {
    this.configureFleetScope();

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
            fleetId: user.fleetId || this.resolveFleetId(),
            rolesId:
              user.roleIds ??
              user.roles?.map(r => r.id) ??
              user.userRoles?.map(r => r.roleLookupId) ??
              [],
          });
        },
        error: () => this.toast.error('Failed to load user'),
      });
    } else {
      this.form.controls.password.setValidators([Validators.required]);
    }
    this.form.controls.password.updateValueAndValidity();
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const raw = this.form.getRawValue();
    this.loading.set(true);
    const body: UserCreateRequest = {
      userName: raw.userName.trim(),
      email: raw.email.trim(),
      password: raw.password,
      nameAr: raw.nameAr.trim() || undefined,
      nameEn: raw.nameEn.trim() || undefined,
      isActive: raw.isActive,
      expirationDate: raw.expirationDate || undefined,
      fleetId: this.resolveFleetId(raw.fleetId),
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

  private configureFleetScope(): void {
    if (this.isSuperAdmin()) {
      this.form.controls.fleetId.setValidators([Validators.required]);
      this.form.controls.fleetId.updateValueAndValidity();
      this.loadFleets();
      return;
    }

    const userFleetId = this.authState.fleetId();
    if (userFleetId) {
      this.form.controls.fleetId.setValue(userFleetId);
    }
  }

  private loadFleets(): void {
    this.fleetLoading.set(true);
    this.fleetService
      .getPaginated({ pageNumber: 1, pageSize: 500 })
      .subscribe({
        next: page => this.fleets.set(page.items ?? []),
        error: () => this.toast.error('Failed to load fleets'),
        complete: () => this.fleetLoading.set(false),
      });
  }

  private resolveFleetId(rawFleetId?: string): string | undefined {
    return rawFleetId || this.authState.fleetId() || undefined;
  }
}





