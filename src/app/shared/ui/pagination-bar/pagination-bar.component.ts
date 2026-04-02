import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { SmoothSelectComponent, SmoothSelectOption } from '../smooth-select/smooth-select.component';

@Component({
  selector: 'app-pagination-bar',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, SmoothSelectComponent],
  templateUrl: './pagination-bar.component.html',
  styleUrl: './pagination-bar.component.scss',
})
export class PaginationBarComponent {
  @Input() pageNumber = 1;
  @Input() totalPages = 1;
  @Input() totalCount = 0;
  @Input() pageSize = 10;
  @Input() showPageSize = true;
  @Input() pageSizeOptions: number[] = [5, 10, 20, 50, 100];

  @Output() pageChange = new EventEmitter<number>();
  @Output() pageSizeChange = new EventEmitter<number>();

  get pageSizeSelectOptions(): SmoothSelectOption[] {
    return this.pageSizeOptions.map(size => ({
      label: String(size),
      value: size,
    }));
  }

  get normalizedTotalPages(): number {
    return Math.max(1, this.totalPages || 1);
  }

  get canGoPrevious(): boolean {
    return this.pageNumber > 1;
  }

  get canGoNext(): boolean {
    return this.pageNumber < this.normalizedTotalPages;
  }

  goPrevious(): void {
    if (!this.canGoPrevious) {
      return;
    }

    this.pageChange.emit(this.pageNumber - 1);
  }

  goNext(): void {
    if (!this.canGoNext) {
      return;
    }

    this.pageChange.emit(this.pageNumber + 1);
  }

  onPageSizeChange(value: number | string): void {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return;
    }

    this.pageSizeChange.emit(parsed);
  }
}
