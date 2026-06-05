import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';

import { catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { AuthStateService } from '../../../../../core/auth/auth-state.service';
import { ConfirmService } from '../../../../../shared/services/confirm.service';
import { ToastService } from '../../../../../shared/services/toast.service';
import { EmptyStateComponent } from '../../../../../shared/ui/empty-state/empty-state.component';
import { ListCommandBarComponent } from '../../../../../shared/ui/list-command-bar/list-command-bar.component';
import { ListContentShellComponent } from '../../../../../shared/ui/list-content-shell/list-content-shell.component';
import { ListSearchFieldComponent } from '../../../../../shared/ui/list-search-field/list-search-field.component';
import { PaginationBarComponent } from '../../../../../shared/ui/pagination-bar/pagination-bar.component';
import { TrafficViolation } from '../../../models/traffic-violations/traffic-violation.model';
import { TrafficViolationService } from '../../../services/traffic-violations/traffic-violation.service';
import { VehicleService } from '../../../services/vehicles/vehicle.service';

@Component({
  selector: 'app-traffic-violation-list',
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
  templateUrl: './traffic-violation-list.component.html',
  styleUrl: './traffic-violation-list.component.scss',
})
export class TrafficViolationListComponent implements OnInit {
  private authState = inject(AuthStateService);
  private api = inject(TrafficViolationService);
  private vehicleService = inject(VehicleService);
  private toast = inject(ToastService);
  private translate = inject(TranslateService);
  private confirm = inject(ConfirmService);

  rows = signal<TrafficViolation[]>([]);
  loading = signal(false);
  loadFailed = signal(false);
  totalCount = signal(0);
  totalPages = signal(0);
  pageNumber = signal(1);
  pageSize = signal(10);
  search = signal('');
  deletingIds = signal<string[]>([]);
  private vehiclePlateById = signal(new Map<number, string>());
  /** Cached plates from prior `GetVehicleById` (`Vehicle/{id}/{fleetId}`) calls. */
  private readonly vehiclePlateCache = new Map<number, string>();

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadFailed.set(false);
    const fleetId = this.authState.fleetId()?.trim();

    this.api
      .getPaginated({
        fleetId: fleetId || undefined,
        search: this.search() || undefined,
        pageNumber: this.pageNumber(),
        pageSize: this.pageSize(),
      })
      .pipe(
        switchMap(page =>
          this.resolveVehiclePlates(page.items ?? [], fleetId).pipe(map(plateMap => ({ page, plateMap }))),
        ),
      )
      .subscribe({
        next: ({ page, plateMap }) => {
          this.vehiclePlateById.set(plateMap);
          this.rows.set((page.items ?? []).map(row => this.enrichVehiclePlate(row, plateMap)));
          this.totalCount.set(page.totalCount ?? 0);
          this.totalPages.set(page.totalPages ?? 0);
        },
        error: err => {
          this.loadFailed.set(true);
          this.loading.set(false);
          this.toast.error(err?.message ?? this.translate.instant('trafficViolations.loadFailed'));
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

  deleteRow(row: TrafficViolation): void {
    const fleetId = this.authState.fleetId()?.trim();
    if (!fleetId) {
      this.toast.error(this.translate.instant('FleetId is required'));
      return;
    }

    const label = row.nameViolation || `#${row.id}`;
    this.confirm
      .confirm(
        this.translate.instant('trafficViolations.deleteTitle'),
        `${this.translate.instant('trafficViolations.deleteConfirm')} ${label}`,
      )
      .subscribe(confirmed => {
        if (!confirmed) {
          return;
        }

        this.deletingIds.update(ids => [...ids, row.id]);
        this.api.softDelete(row.id, fleetId).subscribe({
          next: () => {
            this.toast.success(this.translate.instant('trafficViolations.deleteSuccess'));
            this.load();
          },
          error: err =>
            this.toast.error(err?.message ?? this.translate.instant('trafficViolations.deleteFailed')),
          complete: () =>
            this.deletingIds.update(ids => ids.filter(id => id !== row.id)),
        });
      });
  }

  formatMoney(value: number): string {
    return new Intl.NumberFormat(this.getLocale(), {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value);
  }

  formatDate(value: string): string {
    if (!value?.trim()) {
      return '-';
    }
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) {
      return value;
    }
    return d.toLocaleString(this.getLocale(), { dateStyle: 'short', timeStyle: 'short' });
  }

  bookingCell(row: TrafficViolation): string {
    if (row.bookingLabel) {
      return row.bookingLabel;
    }
    if (row.idBooking != null && row.idBooking > 0) {
      return String(row.idBooking);
    }
    return '-';
  }

  vehicleCell(row: TrafficViolation): string {
    const fromRow = row.vehiclePlate?.trim();
    if (fromRow) {
      return fromRow;
    }
    const fromFleet = this.vehiclePlateById().get(row.idVehicle)?.trim();
    if (fromFleet) {
      return fromFleet;
    }
    return '-';
  }

  private resolveVehiclePlates(items: TrafficViolation[], fleetId?: string) {
    if (!fleetId) {
      return of(new Map(this.vehiclePlateCache));
    }

    const missingIds = [
      ...new Set(
        items
          .filter(row => !row.vehiclePlate?.trim() && row.idVehicle > 0)
          .map(row => row.idVehicle)
          .filter(id => !this.vehiclePlateCache.has(id)),
      ),
    ];

    if (!missingIds.length) {
      return of(new Map(this.vehiclePlateCache));
    }

    return forkJoin(
      missingIds.map(id =>
        this.vehicleService.getById(String(id), fleetId).pipe(
          catchError(() => of(null)),
          map(vehicle => ({
            id,
            plate: vehicle?.plateNumber?.trim() ?? '',
          })),
        ),
      ),
    ).pipe(
      map(results => {
        for (const { id, plate } of results) {
          if (plate) {
            this.vehiclePlateCache.set(id, plate);
          }
        }
        return new Map(this.vehiclePlateCache);
      }),
    );
  }

  private enrichVehiclePlate(row: TrafficViolation, plateMap: Map<number, string>): TrafficViolation {
    if (row.vehiclePlate?.trim()) {
      return row;
    }
    const plate = plateMap.get(row.idVehicle);
    return plate ? { ...row, vehiclePlate: plate } : row;
  }

  isDeleting(id: string): boolean {
    return this.deletingIds().includes(id);
  }

  private getLocale(): string {
    const lang = (
      this.translate.currentLang ||
      this.translate.getDefaultLang() ||
      'en'
    ).toLowerCase();
    return lang.startsWith('ar') ? 'ar-SA' : 'en-US';
  }
}
