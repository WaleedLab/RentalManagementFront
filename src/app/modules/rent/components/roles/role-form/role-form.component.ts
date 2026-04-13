import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { PrivilegeTypeLookup, RoleCreateRequest } from '../../../models';
import { PrivilegeService } from '../../../services/privileges/privilege.service';
import { RoleService } from '../../../services/roles/role.service';
import { ToastService } from '../../../../../shared/services/toast.service';
import { PageHeaderComponent } from '../../../../../shared/ui/page-header/page-header.component';
import { focusFirstInvalidControl } from '../../../../../shared/utils/focus-first-invalid-control.util';

@Component({
  selector: 'app-role-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterLink, TranslateModule, PageHeaderComponent],
  templateUrl: './role-form.component.html',
})
export class RoleFormComponent implements OnInit {
  private readonly hostEl = inject(ElementRef<HTMLElement>);
  private static readonly ROLE_NAME_REGEX = /^[\u0600-\u06FFA-Za-z0-9\s.'-]{2,255}$/;
  private static readonly ARABIC_NAME_REGEX = /^[\u0600-\u06FF\s.'-]{2,255}$/;
  private static readonly ENGLISH_NAME_REGEX = /^[A-Za-z\s.'-]{2,255}$/;

  private fb = inject(NonNullableFormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private roleService = inject(RoleService);
  private privilegeService = inject(PrivilegeService);
  private toast = inject(ToastService);
  private translate = inject(TranslateService);

  isEdit = signal(false);
  roleId = signal<string | null>(null);
  privileges = signal<PrivilegeTypeLookup[]>([]);
  privilegeSearch = signal('');
  loading = signal(false);
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

  ngOnInit(): void {
    this.privilegeService.getList().subscribe({
      next: privileges => this.privileges.set(privileges ?? []),
      error: () => this.toast.error(this.translate.instant('Failed to load privileges')),
    });

    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;

    this.isEdit.set(true);
    this.roleId.set(id);
    this.loading.set(true);
    this.roleService.getById(id).subscribe({
      next: role => {
        this.form.patchValue({
          name: role.name,
          displayName: role.displayName || '',
          displayNameEn: role.displayNameEn || '',
          privilegeTypeIds:
            role.privilegeTypeIds ?? role.privilegeTypeRoles?.map(item => item.privilegeTypeLookupId) ?? [],
        });
      },
      error: () => this.toast.error(this.translate.instant('Failed to load role')),
      complete: () => this.loading.set(false),
    });
  }

  togglePrivilege(id: string): void {
    const set = new Set(this.form.controls.privilegeTypeIds.value);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    this.form.controls.privilegeTypeIds.setValue(Array.from(set));
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
  }

  clearSelectedPrivileges(): void {
    this.form.controls.privilegeTypeIds.setValue([]);
    this.form.controls.privilegeTypeIds.markAsDirty();
  }

  selectedPrivilegesCount(): number {
    return this.form.controls.privilegeTypeIds.value.length;
  }

  save(): void {
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





