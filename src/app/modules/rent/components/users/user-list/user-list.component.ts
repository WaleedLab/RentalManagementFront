import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { AuthStateService } from '../../../../../core/auth/auth-state.service';
import { PageHeaderComponent } from '../../../../../shared/ui/page-header/page-header.component';
import { PaginationBarComponent } from '../../../../../shared/ui/pagination-bar/pagination-bar.component';
import { UserService } from '../../../services/users/user.service';
import { ToastService } from '../../../../../shared/services/toast.service';
import { ConfirmService } from '../../../../../shared/services/confirm.service';
import { User } from '../../../models';

@Component({
  selector: 'app-user-list',
  standalone: true,
  imports: [RouterLink, FormsModule, TranslateModule, PageHeaderComponent, PaginationBarComponent],
  templateUrl: './user-list.component.html',
  styleUrl: './user-list.component.scss',
})
export class UserListComponent implements OnInit {
  private authState = inject(AuthStateService);
  private userService = inject(UserService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);
  private translate = inject(TranslateService);

  users = signal<User[]>([]);
  totalCount = signal(0);
  totalPages = signal(0);
  pageNumber = signal(1);
  pageSize = signal(10);
  search = signal('');
  loading = signal(false);
  isSuperAdmin = computed(() => this.authState.isSuperAdmin());
  pageNumbers = computed(() => {
    const total = this.totalPages();
    return Array.from({ length: total }, (_, i) => i + 1);
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.userService
      .getPaginated({
        pageNumber: this.pageNumber(),
        pageSize: this.pageSize(),
        search: this.search() || undefined,
        fleetId: this.authState.fleetId() ?? undefined,
      })
      .subscribe({
        next: res => {
          this.users.set(res.items ?? []);
          this.totalCount.set(res.totalCount ?? 0);
          const pagesFromApi = res.totalPages;
          const calculatedPages =
            res.pageSize && res.pageSize > 0 ? Math.ceil((res.totalCount ?? 0) / res.pageSize) : 0;
          this.totalPages.set(pagesFromApi ?? calculatedPages);
        },
        error: err => {
          this.toast.error(err?.message ?? 'Failed to load users');
          this.loading.set(false);
        },
        complete: () => this.loading.set(false),
      });
  }

  onSearch(): void {
    this.pageNumber.set(1);
    this.load();
  }

  goToPage(p: number): void {
    if (p < 1 || p > this.totalPages() || p === this.pageNumber()) {
      return;
    }
    this.pageNumber.set(p);
    this.load();
  }

  changePageSize(size: number): void {
    if (size <= 0 || size === this.pageSize()) {
      return;
    }
    this.pageSize.set(size);
    this.pageNumber.set(1);
    this.load();
  }

  rolesDisplay(user: User): string {
    const fromRoles = user.roles?.map(r => r.displayName || r.name).filter(Boolean) ?? [];
    if (fromRoles.length) return fromRoles.join(', ');
    return user.userRoles?.length
      ? `${user.userRoles.length} ${this.translate.instant('role(s)')}`
      : '-';
  }

  fleetDisplay(user: User): string {
    return user.fleetId || '-';
  }
}





