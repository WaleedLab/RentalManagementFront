import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { AuthStateService } from '../../../../core/auth/auth-state.service';
import { ConfirmService } from '../../../../shared/services/confirm.service';
import { ToastService } from '../../../../shared/services/toast.service';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { ListCommandBarComponent } from '../../../../shared/ui/list-command-bar/list-command-bar.component';
import { ListContentShellComponent } from '../../../../shared/ui/list-content-shell/list-content-shell.component';
import { ListSearchFieldComponent } from '../../../../shared/ui/list-search-field/list-search-field.component';
import { PaginationBarComponent } from '../../../../shared/ui/pagination-bar/pagination-bar.component';
import { SparePart } from '../../models/spare-part.model';
import { SparePartService } from '../../services/spare-part.service';

@Component({
  selector: 'app-spare-part-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    TranslateModule,
    EmptyStateComponent,
    ListCommandBarComponent,
    ListSearchFieldComponent,
    ListContentShellComponent,
    PaginationBarComponent,
  ],
  templateUrl: './spare-part-list.component.html',
  styleUrl: './spare-part-list.component.scss',
})
export class SparePartListComponent implements OnInit {
  private authState = inject(AuthStateService);
  private api = inject(SparePartService);
  private toast = inject(ToastService);
  private translate = inject(TranslateService);
  private confirm = inject(ConfirmService);

  rows = signal<SparePart[]>([]);
  loading = signal(false);
  loadFailed = signal(false);
  totalCount = signal(0);
  totalPages = signal(0);
  pageNumber = signal(1);
  pageSize = signal(10);
  search = signal('');
  deletingIds = signal<string[]>([]);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadFailed.set(false);
    this.api
      .getPaginated({
        fleetId: this.authState.fleetId() ?? undefined,
        search: this.search() || undefined,
        pageNumber: this.pageNumber(),
        pageSize: this.pageSize(),
      })
      .subscribe({
        next: response => {
          this.rows.set(response.items ?? []);
          this.totalCount.set(response.totalCount ?? 0);
          this.totalPages.set(response.totalPages ?? 0);
        },
        error: err => {
          this.loadFailed.set(true);
          this.loading.set(false);
          this.toast.error(err?.message ?? this.translate.instant('maintenance.sparePart.loadFailed'));
        },
        complete: () => this.loading.set(false),
      });
  }

  onSearch(): void {
    this.pageNumber.set(1);
    this.load();
  }

  changePageSize(size: number): void {
    if (size <= 0 || size === this.pageSize()) return;
    this.pageSize.set(size);
    this.pageNumber.set(1);
    this.load();
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages() || page === this.pageNumber()) return;
    this.pageNumber.set(page);
    this.load();
  }

  deleteRow(row: SparePart): void {
    const fleetId = this.authState.fleetId()?.trim();
    if (!fleetId) {
      this.toast.error(this.translate.instant('FleetId is required'));
      return;
    }

    const label = row.name || `#${row.id}`;
    this.confirm
      .confirm(
        this.translate.instant('maintenance.sparePart.deleteTitle'),
        `${this.translate.instant('maintenance.sparePart.deleteConfirm')} ${label}`,
      )
      .subscribe(confirmed => {
        if (!confirmed) return;
        this.deletingIds.update(ids => [...ids, row.id]);
        this.api.softDelete(row.id, fleetId).subscribe({
          next: () => {
            this.toast.success(this.translate.instant('maintenance.sparePart.deleteSuccess'));
            this.load();
          },
          error: err =>
            this.toast.error(err?.message ?? this.translate.instant('maintenance.sparePart.deleteFailed')),
          complete: () =>
            this.deletingIds.update(ids => ids.filter(id => id !== row.id)),
        });
      });
  }

  isDeleting(id: string): boolean {
    return this.deletingIds().includes(id);
  }
}
