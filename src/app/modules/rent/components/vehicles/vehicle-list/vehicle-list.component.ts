import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { AuthStateService } from '../../../../../core/auth/auth-state.service';
import { resolveMediaUrl } from '../../../../../shared/utils/media-url.utils';
import { Branch, CategoryVehicle, Vehicle, VehicleOrderBy, VehicleOrderDirection, VehicleStatus } from '../../../models';
import { BranchService } from '../../../services/branches/branch.service';
import { CategoryVehicleService } from '../../../services/category-vehicles/category-vehicle.service';
import { ToastService } from '../../../../../shared/services/toast.service';
import { VehicleService } from '../../../services/vehicles/vehicle.service';
import { EmptyStateComponent } from '../../../../../shared/ui/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../../../../shared/ui/page-header/page-header.component';
import { PaginationBarComponent } from '../../../../../shared/ui/pagination-bar/pagination-bar.component';
import { SmoothSelectOption, SmoothSelectComponent } from '../../../../../shared/ui/smooth-select/smooth-select.component';
import { StatusBadgeComponent } from '../../../../../shared/ui/status-badge/status-badge.component';

@Component({
  selector: 'app-vehicle-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TranslateModule, PageHeaderComponent, EmptyStateComponent, PaginationBarComponent, SmoothSelectComponent, StatusBadgeComponent],
  templateUrl: './vehicle-list.component.html',
  styleUrl: './vehicle-list.component.scss',
})
export class VehicleListComponent implements OnInit {
  private vehicleService = inject(VehicleService);
  private branchService = inject(BranchService);
  private categoryVehicleService = inject(CategoryVehicleService);
  private authState = inject(AuthStateService);
  private toast = inject(ToastService);
  private translate = inject(TranslateService);
  private readonly vehicleFallbackImage = 'assets/images/rent_icon/car_defulte.png';

  vehicles = signal<Vehicle[]>([]);
  branches = signal<Branch[]>([]);
  categories = signal<CategoryVehicle[]>([]);
  filteredVehicles = computed(() => this.applyClientSort(this.applyClientFilters(this.vehicles())));
  totalCount = signal(0);
  totalPages = signal(0);
  pageNumber = signal(1);
  pageSize = signal(12);
  search = signal('');
  status = signal<VehicleStatus | ''>('');
  branchId = signal<number | ''>('');
  categoryId = signal<string>('');
  orderBy = signal<VehicleOrderBy>('CreatedAt');
  orderByDirection = signal<VehicleOrderDirection>('DESC');
  loading = signal(false);
  readonly statusFilterOptions: SmoothSelectOption[] = [
    { label: 'All statuses', value: '' },
    { label: 'Available', value: 'Available' },
    { label: 'Booked', value: 'Booked' },
    { label: 'Maintenance', value: 'Maintenance' },
    { label: 'Inactive', value: 'Inactive' },
  ];
  readonly orderByFilterOptions: SmoothSelectOption[] = [
    { label: 'Created Date', value: 'CreatedAt' },
    { label: 'Year', value: 'Year' },
    { label: 'Plate Number', value: 'Plantnumber' },
  ];
  readonly orderDirectionFilterOptions: SmoothSelectOption[] = [
    { label: 'Descending', value: 'DESC' },
    { label: 'Ascending', value: 'ASC' },
  ];
  branchFilterOptions = computed<SmoothSelectOption[]>(() => [
    { label: 'All branches', value: '' },
    ...this.branches().map(branch => ({
      label: this.getBranchOptionLabel(branch),
      value: Number(branch.id),
    })),
  ]);
  categoryFilterOptions = computed<SmoothSelectOption[]>(() => [
    { label: 'All categories', value: '' },
    ...this.categories().map(category => ({
      label: this.getCategoryOptionLabel(category),
      value: String(category.id),
    })),
  ]);

  ngOnInit(): void {
    this.loadReferenceData();
    this.load();
  }

  getVehicleImage(vehicle: Vehicle): string {
    const resolved = resolveMediaUrl(vehicle.imageUrl);
    if (!resolved || this.shouldUseImmediateFallback(resolved)) {
      return this.vehicleFallbackImage;
    }

    return resolved;
  }

  onVehicleImageError(event: Event): void {
    const target = event.target as HTMLImageElement | null;
    if (target && target.getAttribute('src') !== this.vehicleFallbackImage) {
      target.setAttribute('src', this.vehicleFallbackImage);
    }
  }

  getVehicleTitle(vehicle: Vehicle): string {
    return `${vehicle.make} ${vehicle.model} (${vehicle.year})`;
  }

  getBranchName(vehicle: Vehicle): string {
    if (vehicle.branchName?.trim()) {
      return vehicle.branchName;
    }

    const branchId = Number(vehicle.branchId ?? 0);
    if (!branchId) {
      return '-';
    }

    const matchedBranch = this.branches().find(branch => Number(branch.id) === branchId);
    if (!matchedBranch) {
      return '-';
    }

    return this.isArabicUi()
      ? matchedBranch.nameAr || matchedBranch.nameEn || '-'
      : matchedBranch.nameEn || matchedBranch.nameAr || '-';
  }

  getCategoryName(vehicle: Vehicle): string {
    const matchedCategory = this.getCategoryByVehicle(vehicle);
    if (matchedCategory) {
      return this.isArabicUi()
        ? matchedCategory.nameAr || matchedCategory.nameEn || '-'
        : matchedCategory.nameEn || matchedCategory.nameAr || '-';
    }

    return vehicle.categoryName || '-';
  }

  getDailyRateText(vehicle: Vehicle): string {
    const resolvedRate = this.resolveDailyRate(vehicle);
    if (resolvedRate <= 0) {
      return '-';
    }

    return new Intl.NumberFormat(this.translate.currentLang || this.translate.getDefaultLang() || 'en', {
      maximumFractionDigits: 0,
    }).format(resolvedRate);
  }

  getStatusTone(status: VehicleStatus): 'success' | 'warning' | 'danger' | 'secondary' {
    if (status === 'Available') {
      return 'success';
    }

    if (status === 'Booked') {
      return 'warning';
    }

    if (status === 'Maintenance') {
      return 'danger';
    }

    return 'secondary';
  }

  getBranchOptionLabel(branch: Branch): string {
    return this.isArabicUi()
      ? branch.nameAr || branch.nameEn || '-'
      : branch.nameEn || branch.nameAr || '-';
  }

  getCategoryOptionLabel(category: CategoryVehicle): string {
    return this.isArabicUi()
      ? category.nameAr || category.nameEn || '-'
      : category.nameEn || category.nameAr || '-';
  }

  onSearchSubmit(): void {
    this.pageNumber.set(1);
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.vehicleService
      .getPaginated({
        fleetId: this.authState.fleetId() || undefined,
        pageNumber: this.pageNumber(),
        pageSize: this.pageSize(),
        search: this.search() || undefined,
        status: this.status(),
        orderBy: this.orderBy(),
        orderByDirection: this.orderByDirection(),
      })
      .subscribe({
        next: page => {
          this.vehicles.set(page.items ?? []);
          this.totalCount.set(page.totalCount ?? page.items?.length ?? 0);
          this.totalPages.set(page.totalPages ?? 0);
          this.pageNumber.set(page.pageNumber ?? this.pageNumber());
          this.pageSize.set(page.pageSize ?? this.pageSize());
        },
        error: err => this.toast.error(err?.message ?? this.translate.instant('Failed to load vehicles')),
        complete: () => this.loading.set(false),
      });
  }

  goToPage(page: number): void {
    if (page < 1 || page === this.pageNumber()) {
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

  private loadReferenceData(): void {
    const fleetId = this.authState.fleetId() || undefined;

    this.branchService
      .getPaginated({
        fleetId,
        pageNumber: 1,
        pageSize: 500,
        search: undefined,
      })
      .subscribe({
        next: page => this.branches.set(page.items ?? []),
        error: () => this.branches.set([]),
      });

    this.categoryVehicleService
      .getPaginated({
        fleetId,
        pageNumber: 1,
        pageSize: 500,
        search: undefined,
      })
      .subscribe({
        next: page => this.categories.set(page.items ?? []),
        error: () => this.categories.set([]),
      });
  }

  private isArabicUi(): boolean {
    const lang = (this.translate.currentLang || this.translate.getDefaultLang() || 'en').toLowerCase();
    return lang.startsWith('ar');
  }

  private applyClientSort(items: Vehicle[]): Vehicle[] {
    const directionFactor = this.orderByDirection() === 'ASC' ? 1 : -1;
    const orderBy = this.orderBy();

    return [...items].sort((left, right) => {
      const leftValue = this.resolveSortValue(left, orderBy);
      const rightValue = this.resolveSortValue(right, orderBy);

      if (leftValue < rightValue) {
        return -1 * directionFactor;
      }

      if (leftValue > rightValue) {
        return 1 * directionFactor;
      }

      return 0;
    });
  }

  private applyClientFilters(items: Vehicle[]): Vehicle[] {
    const selectedStatus = this.status();
    const selectedBranchId = Number(this.branchId() || 0);
    const selectedCategoryId = (this.categoryId() || '').trim();
    const searchText = (this.search() || '').trim().toLowerCase();

    return items.filter(vehicle => {
      if (selectedStatus && vehicle.status !== selectedStatus) {
        return false;
      }

      if (selectedBranchId && Number(vehicle.branchId ?? 0) !== selectedBranchId) {
        return false;
      }

      if (selectedCategoryId && !this.matchVehicleCategory(vehicle, selectedCategoryId)) {
        return false;
      }

      if (!searchText) {
        return true;
      }

      const searchableText = [
        vehicle.make,
        vehicle.model,
        vehicle.plateNumber,
        vehicle.serialNumber,
        vehicle.engine,
        vehicle.color,
        vehicle.status,
        this.getBranchName(vehicle),
        this.getCategoryName(vehicle),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return searchableText.includes(searchText);
    });
  }

  private resolveDailyRate(vehicle: Vehicle): number {
    const directRate = Number(vehicle.dailyRate ?? 0);
    if (directRate > 0) {
      return directRate;
    }

    const matchedCategory = this.getCategoryByVehicle(vehicle);
    const categoryRate = Number(matchedCategory?.price_day_low ?? 0);
    if (categoryRate > 0) {
      return categoryRate;
    }

    return 0;
  }

  private getCategoryByVehicle(vehicle: Vehicle): CategoryVehicle | undefined {
    const categoryId = String(vehicle.categoryVehicleId ?? '').trim();
    if (categoryId) {
      const matchedById = this.categories().find(category => String(category.id) === categoryId);
      if (matchedById) {
        return matchedById;
      }
    }

    const categoryName = (vehicle.categoryName ?? '').trim().toLowerCase();
    if (!categoryName) {
      return undefined;
    }

    return this.categories().find(category => {
      const nameAr = (category.nameAr ?? '').trim().toLowerCase();
      const nameEn = (category.nameEn ?? '').trim().toLowerCase();
      return nameAr === categoryName || nameEn === categoryName;
    });
  }

  private matchVehicleCategory(vehicle: Vehicle, selectedCategoryId: string): boolean {
    const directCategoryId = String(vehicle.idCategoryVehicle ?? vehicle.categoryVehicleId ?? '').trim();
    if (directCategoryId) {
      return directCategoryId === selectedCategoryId;
    }

    const matchedCategory = this.getCategoryByVehicle(vehicle);
    if (!matchedCategory) {
      return false;
    }

    return String(matchedCategory.id) === selectedCategoryId;
  }

  private resolveSortValue(vehicle: Vehicle, orderBy: VehicleOrderBy): number | string {
    if (orderBy === 'CreatedAt') {
      return this.toTimestamp(vehicle.createdAt);
    }

    if (orderBy === 'Year') {
      return Number(vehicle.year || vehicle.yearMake || 0);
    }

    if (orderBy === 'Plantnumber') {
      return (vehicle.plateNumber ?? '').toLowerCase();
    }
    return 0;
  }

  private toTimestamp(value?: string): number {
    if (!value) {
      return 0;
    }

    const date = new Date(value);
    const timestamp = date.getTime();
    return Number.isNaN(timestamp) ? 0 : timestamp;
  }

  private shouldUseImmediateFallback(url: string): boolean {
    const normalizedUrl = (url || '').trim();
    if (!normalizedUrl) {
      return true;
    }

    // Seed/demo APIs often return non-routable media hosts (e.g. http://files/...),
    // which can block image rendering for several seconds before onerror fires.
    return /^https?:\/\/files(?:[:/]|$)/i.test(normalizedUrl);
  }
}






