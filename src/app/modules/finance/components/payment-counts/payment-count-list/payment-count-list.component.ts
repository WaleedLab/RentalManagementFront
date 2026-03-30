import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateService } from '@ngx-translate/core';

import { AuthStateService } from '../../../../../core/auth/auth-state.service';
import { ToastService } from '../../../../../shared/services/toast.service';
import { PaymentCount } from '../../../models/payment-counts/payment-count.model';
import { FinanceListColumn, FinanceListRow } from '../../../models/shared/finance-list.model';
import { PaymentCountService } from '../../../services/payment-counts/payment-count.service';
import { FinanceListShellComponent } from '../../shared/finance-list-shell/finance-list-shell.component';
import { formatFinanceNumber } from '../../shared/finance-list-formatters';

@Component({
  selector: 'app-payment-count-list',
  standalone: true,
  imports: [FinanceListShellComponent],
  templateUrl: './payment-count-list.component.html',
  styleUrl: './payment-count-list.component.scss',
})
export class PaymentCountListComponent implements OnInit {
  private authState = inject(AuthStateService);
  private paymentCountService = inject(PaymentCountService);
  private toast = inject(ToastService);
  private translate = inject(TranslateService);
  private destroyRef = inject(DestroyRef);

  items = signal<PaymentCount[]>([]);
  loading = signal(false);
  loadError = signal<string | null>(null);
  private languageTick = signal(0);

  readonly columns: FinanceListColumn[] = [
    { key: 'bookingId', label: 'Booking ID', align: 'end' },
    { key: 'customerId', label: 'Customer', align: 'end' },
    { key: 'amount', label: 'Amount', align: 'end' },
    { key: 'paymentType', label: 'Payment Type' },
    { key: 'status', label: 'Payment Status' },
  ];

  readonly rows = computed<FinanceListRow[]>(() => {
    this.languageTick();
    return this.items().map(item => ({
      bookingId: formatFinanceNumber(item.idBooking, this.translate),
      customerId: formatFinanceNumber(item.idCustomer, this.translate),
      amount: formatFinanceNumber(item.paid, this.translate),
      paymentType: item.paymentType === 2 ? this.translate.instant('Bank') : this.translate.instant('Cash'),
      status:
        item.status === 1
          ? this.translate.instant('Confirmed')
          : item.status === 2
            ? this.translate.instant('Pending')
            : this.translate.instant('Unknown'),
    }));
  });

  ngOnInit(): void {
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.languageTick.update(value => value + 1);
    });
    this.load();
  }

  private load(): void {
    const fleetId = this.authState.fleetId();
    if (!fleetId) {
      const message = this.translate.instant('FleetId is required');
      this.loadError.set(message);
      this.toast.error(message);
      return;
    }

    this.loading.set(true);
    this.loadError.set(null);

    this.paymentCountService.getList(fleetId, this.authState.branchId()).subscribe({
      next: items => this.items.set(items),
      error: err => {
        const message = err?.message ?? this.translate.instant('No records found');
        this.loadError.set(message);
        this.toast.error(message);
        this.loading.set(false);
      },
      complete: () => this.loading.set(false),
    });
  }
}

