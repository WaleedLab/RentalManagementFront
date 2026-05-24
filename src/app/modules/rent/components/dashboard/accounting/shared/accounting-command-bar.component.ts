import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { AccountingFilterOption } from '../../../../models/dashboard/accounting-summary.model';

export type DatePresetKey = '7d' | 'month' | 'quarter';

@Component({
  selector: 'accounting-command-bar',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule],
  templateUrl: './accounting-command-bar.component.html',
  styleUrl: './accounting-command-bar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountingCommandBarComponent {
  @Input({ required: true }) form!: FormGroup;
  @Input() financialYears: AccountingFilterOption[] = [];
  @Input() fleets: AccountingFilterOption[] = [];
  @Input() branches: AccountingFilterOption[] = [];
  @Input() loading = false;

  @Output() apply = new EventEmitter<void>();
  @Output() reset = new EventEmitter<void>();
  @Output() preset = new EventEmitter<DatePresetKey>();

  readonly presets: { key: DatePresetKey; label: string }[] = [
    { key: '7d', label: 'Last 7 days' },
    { key: 'month', label: 'This month' },
    { key: 'quarter', label: 'This quarter' },
  ];
}
