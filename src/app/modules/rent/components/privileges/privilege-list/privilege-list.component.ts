import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { catchError, of } from 'rxjs';

import { PrivilegeTypeLookup } from '../../../models';
import { PrivilegeService } from '../../../services/privileges/privilege.service';
import { ToastService } from '../../../../../shared/services/toast.service';
import { EmptyStateComponent } from '../../../../../shared/ui/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../../../../shared/ui/page-header/page-header.component';
import { PaginationBarComponent } from '../../../../../shared/ui/pagination-bar/pagination-bar.component';

@Component({
  selector: 'app-privilege-list',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, TranslateModule, EmptyStateComponent, PageHeaderComponent, PaginationBarComponent],
  templateUrl: './privilege-list.component.html',
})
export class PrivilegeListComponent implements OnInit {
  private privilegeService = inject(PrivilegeService);
  private toast = inject(ToastService);
  private translate = inject(TranslateService);

  privileges = signal<PrivilegeTypeLookup[]>([]);
  totalCount = signal(0);
  totalPages = signal(0);
  pageNumber = signal(1);
  pageSize = signal(10);
  search = signal('');
  loading = signal(false);

  pageNumbers = computed(() => Array.from({ length: this.totalPages() }, (_, index) => index + 1));

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.privilegeService
      .getPaginated({
        pageNumber: this.pageNumber(),
        pageSize: this.pageSize(),
        search: this.search() || undefined,
      })
      .subscribe({
        next: response => {
          const page = response.data;
          if ((page?.items?.length ?? 0) > 0 || (page?.totalCount ?? 0) > 0) {
            this.privileges.set(page?.items ?? []);
            this.totalCount.set(page?.totalCount ?? (page?.items?.length ?? 0));
            this.totalPages.set(page?.totalPages ?? 0);
            this.loading.set(false);
            return;
          }

          this.privilegeService.getList().pipe(
            catchError(() => of([])),
          ).subscribe(items => {
            this.privileges.set(items);
            this.totalCount.set(items.length);
            this.totalPages.set(items.length > 0 ? 1 : 0);
            this.loading.set(false);
          });
        },
        error: () => {
          this.privilegeService.getList().pipe(
            catchError(err => {
              this.toast.error(err?.message ?? this.translate.instant('Failed to load privileges'));
              return of([]);
            }),
          ).subscribe(items => {
            this.privileges.set(items);
            this.totalCount.set(items.length);
            this.totalPages.set(items.length > 0 ? 1 : 0);
            this.loading.set(false);
          });
        },
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
}





