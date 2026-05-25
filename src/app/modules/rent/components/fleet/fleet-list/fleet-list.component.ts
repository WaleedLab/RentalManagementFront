import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { Fleet } from '../../../models';
import { FleetService } from '../../../services/fleet/fleet.service';
import { ToastService } from '../../../../../shared/services/toast.service';
import { EmptyStateComponent } from '../../../../../shared/ui/empty-state/empty-state.component';
import { ListCommandBarComponent } from '../../../../../shared/ui/list-command-bar/list-command-bar.component';
import { ListContentShellComponent } from '../../../../../shared/ui/list-content-shell/list-content-shell.component';
import { ListSearchFieldComponent } from '../../../../../shared/ui/list-search-field/list-search-field.component';
import { PaginationBarComponent } from '../../../../../shared/ui/pagination-bar/pagination-bar.component';
import { StatusBadgeComponent } from '../../../../../shared/ui/status-badge/status-badge.component';
import { resolveMediaUrl } from '../../../../../shared/utils/media-url.utils';

@Component({
  selector: 'app-fleet-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
    TranslateModule,
    ListCommandBarComponent,
    ListSearchFieldComponent,
    ListContentShellComponent,
    EmptyStateComponent,
    PaginationBarComponent,
    StatusBadgeComponent,
  ],
  templateUrl: './fleet-list.component.html',
  styleUrl: './fleet-list.component.scss',
})
export class FleetListComponent implements OnInit {
  private fleetService = inject(FleetService);
  private toast = inject(ToastService);
  private translate = inject(TranslateService);

  fleets = signal<Fleet[]>([]);
  totalCount = signal(0);
  totalPages = signal(0);
  pageNumber = signal(1);
  pageSize = signal(10);
  search = signal('');
  loading = signal(false);
  loadFailed = signal(false);
  pageNumbers = computed(() => {
    const total = this.totalPages();
    return Array.from({ length: total }, (_, i) => i + 1);
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadFailed.set(false);
    this.fleetService
      .getPaginated({
        pageNumber: this.pageNumber(),
        pageSize: this.pageSize(),
        search: this.search() || undefined,
      })
      .subscribe({
        next: res => {
          this.fleets.set(res.items ?? []);
          this.totalCount.set(res.totalCount ?? 0);
          this.totalPages.set(res.totalPages ?? 0);
        },
        error: err => {
          this.loadFailed.set(true);
          this.loading.set(false);
          this.toast.error(err?.message ?? this.translate.instant('Failed to load fleets'));
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

  fleetImageUrl(url?: string | null): string {
    return resolveMediaUrl(url) || 'assets/images/logo/logo-icon.png';
  }
}






