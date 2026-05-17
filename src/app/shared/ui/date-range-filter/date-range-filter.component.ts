import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

import { DatePickerComponent } from '../date-picker/date-picker.component';

export interface DateRangeValue {
  from: string;
  to: string;
}

@Component({
  selector: 'app-date-range-filter',
  standalone: true,
  imports: [CommonModule, TranslateModule, DatePickerComponent],
  templateUrl: './date-range-filter.component.html',
  styleUrl: './date-range-filter.component.scss',
})
export class DateRangeFilterComponent {
  @Input() from = '';
  @Input() to = '';
  @Input() fromLabel = 'From';
  @Input() toLabel = 'To';
  @Input() fromPlaceholder = 'Date from';
  @Input() toPlaceholder = 'Date to';
  @Input() disabled = false;

  @Output() rangeChange = new EventEmitter<DateRangeValue>();

  onFromChange(value: string | null): void {
    this.rangeChange.emit({
      from: value ?? '',
      to: this.to ?? '',
    });
  }

  onToChange(value: string | null): void {
    this.rangeChange.emit({
      from: this.from ?? '',
      to: value ?? '',
    });
  }
}
