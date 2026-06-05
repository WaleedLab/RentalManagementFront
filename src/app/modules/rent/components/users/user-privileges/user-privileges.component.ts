import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { PrivilegeTypeLookup, User } from '../../../models';
import { PrivilegeService } from '../../../services/privileges/privilege.service';
import { UserService } from '../../../services/users/user.service';
import { ToastService } from '../../../../../shared/services/toast.service';

@Component({
  selector: 'app-user-privileges',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TranslateModule],
  templateUrl: './user-privileges.component.html',
  styleUrl: './user-privileges.component.scss',
})
export class UserPrivilegesComponent implements OnInit {
  private static readonly WORKFLOW_SECTION_IDS = [
    'user-privileges-section-user',
    'user-privileges-section-permissions',
  ] as const;

  private readonly hostEl = inject(ElementRef<HTMLElement>);
  private route = inject(ActivatedRoute);
  private userService = inject(UserService);
  private privilegeService = inject(PrivilegeService);
  private toast = inject(ToastService);
  private translate = inject(TranslateService);

  userId = signal('');
  user = signal<User | null>(null);
  privileges = signal<PrivilegeTypeLookup[]>([]);
  selectedIds = signal<Set<string>>(new Set());
  privilegeSearch = signal('');
  initializing = signal(true);
  loading = signal(false);

  filteredPrivileges = computed(() => {
    const term = this.privilegeSearch().trim().toLowerCase();
    if (!term) {
      return this.privileges();
    }

    return this.privileges().filter(privilege =>
      this.privilegeSearchValues(privilege).some(value => value.includes(term)),
    );
  });

  userSectionComplete = computed(() => this.user() !== null);

  permissionsSectionComplete = computed(() => this.user() !== null);

  profileCompletionPercent = computed(() => {
    let done = 0;
    if (this.userSectionComplete()) done++;
    if (this.permissionsSectionComplete()) done++;
    return Math.round((done / 2) * 100);
  });

  currentWorkflowStep = computed(() => {
    if (!this.userSectionComplete()) return 1;
    if (!this.permissionsSectionComplete()) return 2;
    return 3;
  });

  selectedPrivilegesCount = computed(() => this.selectedIds().size);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.initializing.set(false);
      return;
    }

    this.userId.set(id);

    const user$ = this.userService.getById(id).pipe(
      catchError(() => {
        this.toast.error(this.translate.instant('users.privileges.failedToLoadUser'));
        return of(null);
      }),
    );

    const privileges$ = this.privilegeService.getList().pipe(
      catchError(() => {
        this.toast.error(this.translate.instant('Failed to load privileges'));
        return of([] as PrivilegeTypeLookup[]);
      }),
    );

    forkJoin({ user: user$, privileges: privileges$ }).subscribe({
      next: ({ user, privileges }) => {
        this.user.set(user);
        this.privileges.set(privileges ?? []);

        if (user) {
          const activePrivileges =
            user.userPrivileges?.filter(p => p.isActive).map(p => p.privilegeTypeId) ??
            user.privilegeTypeIds ??
            [];
          this.selectedIds.set(new Set(activePrivileges));
        }

        this.initializing.set(false);
      },
      error: () => this.initializing.set(false),
    });
  }

  focusWorkflowSection(step: 1 | 2): void {
    const sectionId = UserPrivilegesComponent.WORKFLOW_SECTION_IDS[step - 1];
    const section = this.hostEl.nativeElement.querySelector(
      `#${sectionId}`,
    ) as HTMLDetailsElement | null;
    if (!section) {
      return;
    }

    section.open = true;
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    section.classList.add('user-privileges-section--focus');
    window.setTimeout(() => section.classList.remove('user-privileges-section--focus'), 1400);
  }

  toggle(privilegeId: string): void {
    const set = new Set(this.selectedIds());
    if (set.has(privilegeId)) set.delete(privilegeId);
    else set.add(privilegeId);
    this.selectedIds.set(set);
  }

  isSelected(privilegeId: string): boolean {
    return this.selectedIds().has(privilegeId);
  }

  selectAllFiltered(): void {
    const selected = new Set(this.selectedIds());
    for (const privilege of this.filteredPrivileges()) {
      selected.add(privilege.id);
    }
    this.selectedIds.set(selected);
  }

  clearSelectedPrivileges(): void {
    this.selectedIds.set(new Set());
  }

  privilegeLabel(privilege: PrivilegeTypeLookup): string {
    return (
      privilege.privilegeName ||
      privilege.displayName ||
      privilege.displayNameEn ||
      privilege.nameEn ||
      privilege.name ||
      privilege.id
    );
  }

  privilegeMeta(privilege: PrivilegeTypeLookup): string {
    const title = this.privilegeLabel(privilege);
    const candidates = [privilege.name, privilege.nameEn, privilege.displayName, privilege.displayNameEn].filter(
      Boolean,
    ) as string[];

    for (const candidate of candidates) {
      if (candidate !== title) {
        return candidate;
      }
    }

    return '';
  }

  save(): void {
    if (!this.userId()) {
      return;
    }

    this.loading.set(true);
    const privilegeTypeIds = Array.from(this.selectedIds());
    this.userService
      .updatePrivileges({
        userId: this.userId(),
        privilegeTypeIds,
        userPrivileges: privilegeTypeIds.map(privilegeTypeId => ({ privilegeTypeId, isActive: true })),
      })
      .subscribe({
        next: () => {
          this.toast.success(this.translate.instant('users.privileges.updated'));
        },
        error: () => this.loading.set(false),
        complete: () => this.loading.set(false),
      });
  }

  private privilegeSearchValues(privilege: PrivilegeTypeLookup): string[] {
    return [
      privilege.privilegeName,
      privilege.displayName,
      privilege.displayNameEn,
      privilege.nameEn,
      privilege.name,
      privilege.id,
    ]
      .filter(Boolean)
      .map(value => String(value).toLowerCase());
  }
}
