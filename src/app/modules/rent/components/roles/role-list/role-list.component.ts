import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { RoleLookup } from '../../../models';
import { RoleService } from '../../../services/roles/role.service';
import { ToastService } from '../../../../../shared/services/toast.service';
import { EmptyStateComponent } from '../../../../../shared/ui/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../../../../shared/ui/page-header/page-header.component';
import { PaginationBarComponent } from '../../../../../shared/ui/pagination-bar/pagination-bar.component';
import { SmoothSelectComponent, SmoothSelectOption } from '../../../../../shared/ui/smooth-select/smooth-select.component';

@Component({
  selector: 'app-role-list',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, TranslateModule, EmptyStateComponent, PageHeaderComponent, PaginationBarComponent, SmoothSelectComponent],
  templateUrl: './role-list.component.html',
})
export class RoleListComponent implements OnInit {
  private roleService = inject(RoleService);
  private toast = inject(ToastService);
  private translate = inject(TranslateService);

  roles = signal<RoleLookup[]>([]);
  totalCount = signal(0);
  totalPages = signal(0);
  pageNumber = signal(1);
  pageSize = signal(10);
  search = signal('');
  loading = signal(false);
  readonly pageSizeFilterOptions: SmoothSelectOption[] = [
    { label: '10', value: 10 },
    { label: '25', value: 25 },
    { label: '50', value: 50 },
  ];

  pageNumbers = computed(() => Array.from({ length: this.totalPages() }, (_, index) => index + 1));

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.roleService
      .getPaginated({
        pageNumber: this.pageNumber(),
        pageSize: this.pageSize(),
        search: this.search() || undefined,
      })
      .subscribe({
        next: response => {
          const page = response.data;
          this.roles.set(page?.items ?? []);
          this.totalCount.set(page?.totalCount ?? 0);
          this.totalPages.set(page?.totalPages ?? 0);
        },
        error: err => this.toast.error(err?.message ?? this.translate.instant('Failed to load roles')),
        complete: () => this.loading.set(false),
      });
  }

  onSearch(): void {
    this.pageNumber.set(1);
    this.load();
  }

  goToPage(page: number): void {
    this.pageNumber.set(page);
    this.load();
  }

  changePageSize(size: number): void {
    this.pageSize.set(size);
    this.pageNumber.set(1);
    this.load();
  }
}





