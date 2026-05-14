import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

import { AuthStateService } from '../../../../../core/auth/auth-state.service';
import { resolveMediaUrl } from '../../../../../shared/utils/media-url.utils';
import { Branch, CategoryVehicle, Vehicle, VehicleOrderBy, VehicleOrderDirection, VehicleStatus } from '../../../models';
import { BranchService } from '../../../services/branches/branch.service';
import { CategoryVehicleService } from '../../../services/category-vehicles/category-vehicle.service';
import { ConfirmService } from '../../../../../shared/services/confirm.service';
import { ToastService } from '../../../../../shared/services/toast.service';
import { VehicleService, VehicleStatusCountItem } from '../../../services/vehicles/vehicle.service';
import { EmptyStateComponent } from '../../../../../shared/ui/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../../../../shared/ui/page-header/page-header.component';
import { PaginationBarComponent } from '../../../../../shared/ui/pagination-bar/pagination-bar.component';
import { SmoothSelectOption, SmoothSelectComponent } from '../../../../../shared/ui/smooth-select/smooth-select.component';
import { StatusBadgeComponent } from '../../../../../shared/ui/status-badge/status-badge.component';
import { VehicleStatusDialogComponent } from '../../../../../shared/component/vehicle-status-dialog/vehicle-status-dialog.component';

@Component({
  selector: 'app-vehicle-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TranslateModule, PageHeaderComponent, EmptyStateComponent, PaginationBarComponent, SmoothSelectComponent, StatusBadgeComponent],
  templateUrl: './vehicle-list.component.html',
  styleUrl: './vehicle-list.component.scss',
})
export class VehicleListComponent implements OnInit {
  private static readonly DEFAULT_PAGE_SIZE = 10;

  private vehicleService = inject(VehicleService);
  private branchService = inject(BranchService);
  private categoryVehicleService = inject(CategoryVehicleService);
  private authState = inject(AuthStateService);
  private confirm = inject(ConfirmService);
  private modal = inject(NgbModal);
  private toast = inject(ToastService);
  private translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly languageTick = signal(0);
  private readonly vehicleFallbackImage = 'assets/images/rent_icon/car_defulte.png';

  vehicles = signal<Vehicle[]>([]);
  branches = signal<Branch[]>([]);
  categories = signal<CategoryVehicle[]>([]);
  totalCount = signal(0);
  totalPages = signal(0);
  pageNumber = signal(1);
  pageSize = signal(VehicleListComponent.DEFAULT_PAGE_SIZE);
  search = signal('');
  status = signal<VehicleStatus | ''>('');
  branchId = signal<number | ''>('');
  categoryId = signal<string>('');
  orderBy = signal<VehicleOrderBy>('CreatedAt');
  orderByDirection = signal<VehicleOrderDirection>('DESC');
  loading = signal(false);
  /** True after the main list request failed; keeps the list area on a spinner until the next successful load. */
  loadFailed = signal(false);
  deletingIds = signal<Array<string | number>>([]);
  changingStatusIds = signal<Array<string | number>>([]);
  vehicleStatusCounts = signal<VehicleStatusCountItem[]>([]);
  vehicleStatusTotalCount = signal(0);
  private readonly vehicleStatusLegendConfig = [
    { key: 'IsAvalible', labelAr: 'متاحة', labelEn: 'Available', iconClass: 'fa-solid fa-circle-check', iconColor: '#16A34A' },
    { key: 'IsBooking', labelAr: 'محجوزة', labelEn: 'Booked', iconClass: 'fa-solid fa-calendar-check', iconColor: '#F59E0B' },
    { key: 'IsMaintanes', labelAr: 'صيانة', labelEn: 'Maintenance', iconClass: 'fa-solid fa-screwdriver-wrench', iconColor: '#DC2626' },
    { key: 'IsMangament', labelAr: 'إدارة', labelEn: 'Management', iconClass: 'fa-solid fa-briefcase', iconColor: '#6366F1' },
    { key: 'IsSold', labelAr: 'مباعة', labelEn: 'Sold', iconClass: 'fa-solid fa-tags', iconColor: '#374151' },
  ] as const;
  readonly statusFilterOptions = computed<SmoothSelectOption[]>(() => {
    this.languageTick();
    const t = (key: string) => this.translate.instant(key);
    return [
      { label: t('All statuses'), value: '' },
      { label: t('Available'), value: 'Available' },
      { label: t('Booked'), value: 'Booked' },
      { label: t('Maintenance'), value: 'Maintenance' },
      { label: t('Management'), value: 'Inactive' },
      { label: t('Sold'), value: 'Sold' },
    ];
  });
  readonly orderByFilterOptions = computed<SmoothSelectOption[]>(() => {
    this.languageTick();
    const t = (key: string) => this.translate.instant(key);
    return [
      { label: t('Created Date'), value: 'CreatedAt' },
      { label: t('Year'), value: 'Year' },
      { label: t('Plate Number'), value: 'Plantnumber' },
    ];
  });
  readonly orderDirectionFilterOptions = computed<SmoothSelectOption[]>(() => {
    this.languageTick();
    const t = (key: string) => this.translate.instant(key);
    return [
      { label: t('Descending'), value: 'DESC' },
      { label: t('Ascending'), value: 'ASC' },
    ];
  });
  branchFilterOptions = computed<SmoothSelectOption[]>(() => {
    this.languageTick();
    const t = (key: string) => this.translate.instant(key);
    return [
      { label: t('All branches'), value: '' },
      ...this.branches().map(branch => ({
        label: this.getBranchOptionLabel(branch),
        value: Number(branch.id),
      })),
    ];
  });
  categoryFilterOptions = computed<SmoothSelectOption[]>(() => {
    this.languageTick();
    const t = (key: string) => this.translate.instant(key);
    return [
      { label: t('All categories'), value: '' },
      ...this.categories().map(category => ({
        label: this.getCategoryOptionLabel(category),
        value: String(category.id),
      })),
    ];
  });
  vehicleLegendItems = computed(() => {
    const counts = this.vehicleStatusCounts();
    const items = this.vehicleStatusLegendConfig.map(item => ({
      key: item.key,
      label: this.isArabicUi() ? item.labelAr : item.labelEn,
      iconClass: item.iconClass,
      iconColor: item.iconColor,
      count:
        counts.find(x =>
          (x.status ?? '').toLowerCase() === item.key.toLowerCase() ||
          (x.includedStatuses ?? []).some(s => s.toLowerCase() === item.key.toLowerCase()),
        )?.count ?? 0,
    }));
    const unknownCount = counts
      .filter(item =>
        !this.vehicleStatusLegendConfig.some(cfg =>
          (item.status ?? '').toLowerCase() === cfg.key.toLowerCase() ||
          (item.includedStatuses ?? []).some(s => s.toLowerCase() === cfg.key.toLowerCase()),
        ),
      )
      .reduce((sum, item) => sum + (item.count ?? 0), 0);

    return [
      {
        key: 'total',
        label: this.translate.instant('Total Vehicles'),
        iconClass: 'fa-solid fa-list-check',
        iconColor: '#2563EB',
        count: this.vehicleStatusTotalCount(),
      },
      ...items,
      {
        key: 'unknown',
        label: this.translate.instant('Unknown'),
        iconClass: 'fa-solid fa-circle-question',
        iconColor: '#64748B',
        count: unknownCount,
      },
    ];
  });

  ngOnInit(): void {
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.languageTick.update(v => v + 1);
    });
    this.loadReferenceData();
    this.loadStatusCounts();
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

  /** Card title: serial only (year & engine appear on the card badges). */
  getVehicleTitle(vehicle: Vehicle): string {
    const serial = vehicle.serialNumber?.trim();
    if (serial) {
      return serial;
    }
    const plate = vehicle.plateNumber?.trim();
    if (plate) {
      return plate;
    }
    return [vehicle.make, vehicle.model].filter(Boolean).join(' ').trim() || '-';
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

  getStatusLabel(status: VehicleStatus): string {
    if (status === 'Inactive') {
      return this.translate.instant('Management');
    }

    return this.translate.instant(status);
  }

  getVehicleCardStatusClass(status: VehicleStatus): string {
    switch (status) {
      case 'Available':
        return 'vehicle-card--status-success';
      case 'Booked':
        return 'vehicle-card--status-warning';
      case 'Maintenance':
        return 'vehicle-card--status-danger';
      default:
        return 'vehicle-card--status-neutral';
    }
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

  onStatusFilterChange(value: VehicleStatus | ''): void {
    this.status.set(value);
    if (!value) {
      // Reset mode: All statuses.
      this.pageNumber.set(1);
      this.pageSize.set(VehicleListComponent.DEFAULT_PAGE_SIZE);
    } else {
      this.pageNumber.set(1);
    }
    this.loadStatusCounts();
    this.load();
  }

  onBranchFilterChange(value: number | ''): void {
    this.branchId.set(value);
    if (!value) {
      // Reset mode: All branches.
      this.pageNumber.set(1);
      this.pageSize.set(VehicleListComponent.DEFAULT_PAGE_SIZE);
    } else {
      this.pageNumber.set(1);
    }
    this.loadStatusCounts();
    this.load();
  }

  onCategoryFilterChange(value: string): void {
    this.categoryId.set(value);
    if (!value) {
      // Reset mode: All categories.
      this.pageNumber.set(1);
      this.pageSize.set(VehicleListComponent.DEFAULT_PAGE_SIZE);
    } else {
      this.pageNumber.set(1);
    }
    this.load();
  }

  onOrderByChange(value: VehicleOrderBy): void {
    this.orderBy.set(value);
    this.pageNumber.set(1);
    this.load();
  }

  onOrderDirectionChange(value: VehicleOrderDirection): void {
    this.orderByDirection.set(value);
    this.pageNumber.set(1);
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadFailed.set(false);
    this.vehicleService
      .getPaginated({
        fleetId: this.authState.fleetId() || undefined,
        pageNumber: this.pageNumber(),
        pageSize: this.pageSize(),
        search: this.search() || undefined,
        status: this.status(),
        branchId: Number(this.branchId() || 0) || undefined,
        categoryId: this.categoryId() || undefined,
        orderBy: this.orderBy(),
        orderByDirection: this.orderByDirection(),
      })
      .subscribe({
        next: page => {
          const items = page.items ?? [];
          this.vehicles.set(this.sortVehiclesForStableDisplay(items));
          this.totalCount.set(page.totalCount ?? page.items?.length ?? 0);
          this.totalPages.set(page.totalPages ?? 0);
          this.pageNumber.set(page.pageNumber ?? this.pageNumber());
        },
        error: err => {
          this.loadFailed.set(true);
          this.loading.set(false);
          this.toast.error(err?.message ?? this.translate.instant('Failed to load vehicles'));
        },
        complete: () => this.loading.set(false),
      });
  }

  private loadStatusCounts(): void {
    this.vehicleService
      .getStatusCounts({
        fleetId: this.authState.fleetId() || undefined,
        branchId: Number(this.branchId() || 0) || undefined,
      })
      .subscribe({
        next: response => {
          this.vehicleStatusCounts.set(response.statusCounts ?? []);
          this.vehicleStatusTotalCount.set(response.totalCount ?? 0);
          if (!this.search().trim() && !this.status()) {
            this.totalCount.set(response.totalCount ?? 0);
          }
        },
        error: () => {
          this.vehicleStatusCounts.set([]);
          this.vehicleStatusTotalCount.set(0);
        },
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

  isDeleting(id: string | number): boolean {
    const target = String(id);
    return this.deletingIds().some(currentId => String(currentId) === target);
  }

  isChangingStatus(id: string | number): boolean {
    const target = String(id);
    return this.changingStatusIds().some(currentId => String(currentId) === target);
  }

  openChangeStatusDialog(vehicle: Vehicle): void {
    const modalRef = this.modal.open(VehicleStatusDialogComponent, {
      centered: true,
      windowClass: 'vehicle-status-modal',
    });
    const vehicleName = this.getVehicleTitle(vehicle);
    const plate = vehicle.plateNumber || '-';
    modalRef.componentInstance.title = this.translate.instant('Change Vehicle Status');
    modalRef.componentInstance.message = this.translate.instant('Change status for {{vehicle}}', {
      vehicle: vehicleName,
    });
    modalRef.componentInstance.currentStatus = vehicle.status;
    modalRef.componentInstance.vehicleName = vehicleName;
    modalRef.componentInstance.plateNumber = plate;

    modalRef.componentInstance.result.subscribe((selectedStatus: VehicleStatus | null) => {
      if (!selectedStatus || selectedStatus === vehicle.status) {
        return;
      }

      this.changingStatusIds.update(ids => [...ids, vehicle.id]);
      this.vehicleService.changeStatus(vehicle.id, selectedStatus).subscribe({
        next: () => {
          this.toast.success(this.translate.instant('Vehicle status updated successfully'));
          this.vehicles.update(items =>
            items.map(item =>
              String(item.id) === String(vehicle.id) ? { ...item, status: selectedStatus } : item,
            ),
          );
        },
        error: err =>
          this.toast.error(err?.message ?? this.translate.instant('Failed to update vehicle status')),
        complete: () =>
          this.changingStatusIds.update(ids => ids.filter(currentId => String(currentId) !== String(vehicle.id))),
      });
    });
  }

  deleteVehicle(vehicle: Vehicle): void {
    const vehicleName = this.getVehicleTitle(vehicle);
    this.confirm
      .confirm(
        this.translate.instant('Delete Vehicle'),
        `${this.translate.instant('Are you sure you want to delete this vehicle?')} ${vehicleName}`,
      )
      .subscribe(confirmed => {
        if (!confirmed) {
          return;
        }

        this.deletingIds.update(ids => [...ids, vehicle.id]);
        this.vehicleService.softDelete(vehicle.id).subscribe({
          next: () => {
            this.toast.success(this.translate.instant('Vehicle deleted successfully'));
            this.vehicles.update(items => items.filter(item => String(item.id) !== String(vehicle.id)));
            this.totalCount.update(count => Math.max(0, count - 1));
          },
          error: err =>
            this.toast.error(err?.message ?? this.translate.instant('Failed to delete vehicle')),
          complete: () =>
            this.deletingIds.update(ids => ids.filter(currentId => String(currentId) !== String(vehicle.id))),
        });
      });
  }

  private loadReferenceData(): void {
    const fleetId = this.authState.fleetId() || undefined;

    this.branchService
      .getPaginated({
        fleetId,
        pageNumber: 1,
        pageSize: 1000,
      })
      .subscribe({
        next: response => this.branches.set(response.items ?? []),
        error: () => this.branches.set([]),
      });

    this.categoryVehicleService
      .getPaginated({
        fleetId,
        pageNumber: 1,
        pageSize: 1000,
      })
      .subscribe({
        next: response => this.categories.set(response.items ?? []),
        error: () => this.categories.set([]),
      });
  }

  private isArabicUi(): boolean {
    const lang = (this.translate.currentLang || this.translate.getDefaultLang() || 'en').toLowerCase();
    return lang.startsWith('ar');
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

  private shouldUseImmediateFallback(url: string): boolean {
    const normalizedUrl = (url || '').trim();
    if (!normalizedUrl) {
      return true;
    }

    // Seed/demo APIs often return non-routable media hosts (e.g. http://files/...),
    // which can block image rendering for several seconds before onerror fires.
    return /^https?:\/\/files(?:[:/]|$)/i.test(normalizedUrl);
  }

  private sortVehiclesForStableDisplay(items: Vehicle[]): Vehicle[] {
    return [...items].sort((a, b) => {
      if (this.orderBy() === 'Year') {
        const yearDiff = (Number(a.yearMake ?? a.year ?? 0) - Number(b.yearMake ?? b.year ?? 0));
        if (yearDiff !== 0) {
          return this.orderByDirection() === 'ASC' ? yearDiff : -yearDiff;
        }
      } else if (this.orderBy() === 'Plantnumber') {
        const plateA = String(a.plateNumber ?? '');
        const plateB = String(b.plateNumber ?? '');
        const plateDiff = plateA.localeCompare(plateB, undefined, { sensitivity: 'base', numeric: true });
        if (plateDiff !== 0) {
          return this.orderByDirection() === 'ASC' ? plateDiff : -plateDiff;
        }
      } else {
        const aDate = new Date(a.createdAt ?? '').getTime();
        const bDate = new Date(b.createdAt ?? '').getTime();
        const safeADate = Number.isFinite(aDate) ? aDate : 0;
        const safeBDate = Number.isFinite(bDate) ? bDate : 0;
        const dateDiff = safeADate - safeBDate;
        if (dateDiff !== 0) {
          return this.orderByDirection() === 'ASC' ? dateDiff : -dateDiff;
        }
      }

      const idA = Number(a.id);
      const idB = Number(b.id);
      if (Number.isFinite(idA) && Number.isFinite(idB) && idA !== idB) {
        return this.orderByDirection() === 'ASC' ? idA - idB : idB - idA;
      }

      return String(a.id).localeCompare(String(b.id));
    });
  }
}






