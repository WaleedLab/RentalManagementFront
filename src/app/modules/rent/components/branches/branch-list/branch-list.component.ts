import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { AuthStateService } from '../../../../../core/auth/auth-state.service';
import type { Branch, BranchPaginatedRequest } from '../../../models';
import { HasPrivilegeDirective } from '../../../../../shared/directives/has-privilege.directive';
import { BranchService } from '../../../services/branches/branch.service';
import { ConfirmService } from '../../../../../shared/services/confirm.service';
import { ToastService } from '../../../../../shared/services/toast.service';
import { EmptyStateComponent } from '../../../../../shared/ui/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../../../../shared/ui/page-header/page-header.component';
import { PaginationBarComponent } from '../../../../../shared/ui/pagination-bar/pagination-bar.component';
import { StatusBadgeComponent } from '../../../../../shared/ui/status-badge/status-badge.component';

@Component({
  selector: 'app-branch-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
    TranslateModule,
    HasPrivilegeDirective,
    EmptyStateComponent,
    PageHeaderComponent,
    PaginationBarComponent,
    StatusBadgeComponent,
  ],
  templateUrl: './branch-list.component.html',
  styleUrl: './branch-list.component.scss',
})
export class BranchListComponent implements OnInit {
  private authState = inject(AuthStateService);
  private branchApi = inject(BranchService);
  private confirm = inject(ConfirmService);
  private toast = inject(ToastService);
  private translate = inject(TranslateService);

  fleetId = signal<string>('');
  branches = signal<Branch[]>([]);
  loading = signal(false);
  loadFailed = signal(false);
  totalCount = signal(0);
  totalPages = signal(0);
  pageNumber = signal(1);
  pageSize = signal(10);
  search = signal('');
  deletingIds = signal<number[]>([]);
  pageNumbers = computed(() => Array.from({ length: this.totalPages() }, (_, i) => i + 1));

  ngOnInit(): void {
    this.fleetId.set(this.authState.fleetId() ?? '');
    this.load();
  }

  private buildParams(): BranchPaginatedRequest {
    return {
      fleetId: this.fleetId() || undefined,
      pageNumber: this.pageNumber(),
      pageSize: this.pageSize(),
      search: this.search() || undefined,
    };
  }

  load(): void {
    this.loading.set(true);
    this.loadFailed.set(false);
    this.branchApi.getPaginated(this.buildParams()).subscribe({
      next: res => {
        this.branches.set(res.items ?? []);
        this.totalCount.set(res.totalCount ?? 0);
        this.totalPages.set(res.totalPages ?? 0);
      },
      error: err => {
        this.loadFailed.set(true);
        this.toast.error(err?.message ?? this.translate.instant('Failed to load branches'));
        this.loading.set(false);
      },
      complete: () => this.loading.set(false),
    });
  }

  onSearch(): void {
    this.pageNumber.set(1);
    this.load();
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages() || page === this.pageNumber()) {
      return;
    }
    this.pageNumber.set(page);
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

  isDeleting(id: number): boolean {
    return this.deletingIds().includes(id);
  }

  delete(branch: Branch): void {
    this.confirm.confirm(
      this.translate.instant('Delete Branch'),
      `${this.translate.instant('Delete')} "${branch.nameAr}"?`,
    ).subscribe(ok => {
      if (!ok) return;

      this.deletingIds.update(ids => [...ids, branch.id]);
      this.branchApi.softDelete(branch.id).subscribe({
        next: () => {
          this.toast.success(this.translate.instant('Branch deleted successfully'));
          this.load();
        },
        error: err => this.toast.error(err?.message ?? this.translate.instant('Failed to delete branch')),
        complete: () =>
          this.deletingIds.update(ids => ids.filter(currentId => currentId !== branch.id)),
      });
    });
  }
}





