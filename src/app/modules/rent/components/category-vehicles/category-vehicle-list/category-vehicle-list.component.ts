import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { AuthStateService } from '../../../../../core/auth/auth-state.service';
import { ToastService } from '../../../../../shared/services/toast.service';
import { EmptyStateComponent } from '../../../../../shared/ui/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../../../../shared/ui/page-header/page-header.component';
import { PaginationBarComponent } from '../../../../../shared/ui/pagination-bar/pagination-bar.component';
import { StatusBadgeComponent } from '../../../../../shared/ui/status-badge/status-badge.component';
import { CategoryVehicle } from '../../../models';
import { CategoryVehicleService } from '../../../services/category-vehicles/category-vehicle.service';

@Component({
  selector: 'app-category-vehicle-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    TranslateModule,
    EmptyStateComponent,
    PageHeaderComponent,
    PaginationBarComponent,
    StatusBadgeComponent,
  ],
  templateUrl: './category-vehicle-list.component.html',
  styleUrl: './category-vehicle-list.component.scss',
})
export class CategoryVehicleListComponent implements OnInit {
  private authState = inject(AuthStateService);
  private categoryVehicleService = inject(CategoryVehicleService);
  private toast = inject(ToastService);
  private translate = inject(TranslateService);

  categories = signal<CategoryVehicle[]>([]);
  loading = signal(false);
  loadFailed = signal(false);
  totalCount = signal(0);
  totalPages = signal(0);
  pageNumber = signal(1);
  pageSize = signal(10);
  search = signal('');
  pageNumbers = computed(() => Array.from({ length: this.totalPages() }, (_, index) => index + 1));

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadFailed.set(false);
    this.categoryVehicleService
      .getPaginated({
        fleetId: this.authState.fleetId() ?? undefined,
        search: this.search() || undefined,
        pageNumber: this.pageNumber(),
        pageSize: this.pageSize(),
      })
      .subscribe({
        next: response => {
          this.categories.set(response.items ?? []);
          this.totalCount.set(response.totalCount ?? 0);
          this.totalPages.set(response.totalPages ?? 0);
        },
        error: err => {
          this.loadFailed.set(true);
          this.loading.set(false);
          this.toast.error(
            err?.message ?? this.translate.instant('Failed to load vehicle categories'),
          );
        },
        complete: () => this.loading.set(false),
      });
  }

  onSearch(): void {
    this.pageNumber.set(1);
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

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages() || page === this.pageNumber()) {
      return;
    }
    this.pageNumber.set(page);
    this.load();
  }

  formatRangeValue(value?: number): string {
    const numericValue = this.toFiniteNumber(value);
    if (numericValue === null) {
      return '-';
    }

    return this.formatNumber(numericValue);
  }

  private formatNumber(value: number): string {
    return new Intl.NumberFormat(this.getCurrentLocale(), {
      minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(value);
  }

  private toFiniteNumber(value?: number): number | null {
    if (value === null || value === undefined) {
      return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private getCurrentLocale(): string {
    const lang = (
      this.translate.currentLang ||
      this.translate.getDefaultLang() ||
      'en'
    ).toLowerCase();
    return lang.startsWith('ar') ? 'ar-SA' : 'en-US';
  }
}
