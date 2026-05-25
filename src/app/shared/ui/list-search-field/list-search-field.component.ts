import { CommonModule } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-list-search-field',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  templateUrl: './list-search-field.component.html',
  styleUrl: './list-search-field.component.scss',
})
export class ListSearchFieldComponent {
  readonly label = input('Search');
  readonly placeholder = input('');
  readonly value = input('');
  readonly valueChange = output<string>();
  readonly search = output<void>();

  onInput(value: string): void {
    this.valueChange.emit(value ?? '');
  }

  onSubmit(): void {
    this.search.emit();
  }
}
