import { CommonModule } from '@angular/common';
import { Component, ElementRef, EventEmitter, HostListener, Input, Output, computed, forwardRef, inject, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

export type SmoothSelectValue = string | number | '' | null;

export interface SmoothSelectOption {
  label: string;
  value: SmoothSelectValue;
}

@Component({
  selector: 'app-smooth-select',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './smooth-select.component.html',
  styleUrl: './smooth-select.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SmoothSelectComponent),
      multi: true,
    },
  ],
})
export class SmoothSelectComponent implements ControlValueAccessor {
  private elementRef = inject(ElementRef<HTMLElement>);

  @Input() options: SmoothSelectOption[] = [];
  @Input() set value(nextValue: SmoothSelectValue) {
    this.internalValue.set(nextValue ?? '');
  }
  get value(): SmoothSelectValue {
    return this.internalValue();
  }
  @Input() disabled = false;
  @Input() placeholder = '';
  @Input() ariaLabel = 'Select option';
  @Input() menuMaxHeight = 280;

  @Output() valueChange = new EventEmitter<SmoothSelectValue>();

  isOpen = signal(false);
  private internalValue = signal<SmoothSelectValue>('');
  private disabledFromControl = signal(false);
  private onChange: (value: SmoothSelectValue) => void = () => {};
  private onTouched: () => void = () => {};

  readonly isDisabled = computed(() => this.disabled || this.disabledFromControl());

  selectedLabel = computed(() => {
    const selectedOption = this.options.find(option => this.areValuesEqual(option.value, this.internalValue()));
    if (selectedOption) {
      return selectedOption.label;
    }

    if (this.placeholder) {
      return this.placeholder;
    }

    return this.options[0]?.label ?? '';
  });

  toggle(event: Event): void {
    event.stopPropagation();
    if (this.isDisabled()) {
      return;
    }

    this.onTouched();
    this.isOpen.update(open => !open);
  }

  selectOption(value: SmoothSelectValue, event: Event): void {
    event.stopPropagation();
    if (this.isDisabled()) {
      return;
    }

    if (!this.areValuesEqual(this.internalValue(), value)) {
      this.internalValue.set(value);
      this.valueChange.emit(value);
      this.onChange(value);
    }

    this.onTouched();
    this.close();
  }

  isSelected(value: SmoothSelectValue): boolean {
    return this.areValuesEqual(this.internalValue(), value);
  }

  close(): void {
    this.isOpen.set(false);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    if (!this.isOpen()) {
      return;
    }

    const target = event.target as Node | null;
    if (target && !this.elementRef.nativeElement.contains(target)) {
      this.close();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close();
  }

  writeValue(value: SmoothSelectValue): void {
    this.internalValue.set(value ?? '');
  }

  registerOnChange(fn: (value: SmoothSelectValue) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabledFromControl.set(isDisabled);
  }

  private areValuesEqual(left: SmoothSelectValue, right: SmoothSelectValue): boolean {
    if (left === right) {
      return true;
    }

    if (left === '' || right === '') {
      return false;
    }

    return String(left) === String(right);
  }
}
