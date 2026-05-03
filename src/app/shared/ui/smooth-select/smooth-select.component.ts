import { CommonModule } from '@angular/common';
import {
  Component,
  DestroyRef,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnInit,
  Output,
  ViewChild,
  computed,
  forwardRef,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { NavigationStart, Router } from '@angular/router';
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
export class SmoothSelectComponent implements ControlValueAccessor, OnInit {
  private elementRef = inject(ElementRef<HTMLElement>);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router, { optional: true });
  @ViewChild('triggerBtn') private triggerRef?: ElementRef<HTMLButtonElement>;

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
  @Input() searchable = false;
  @Input() searchPlaceholder = 'Search...';

  @Output() valueChange = new EventEmitter<SmoothSelectValue>();
  @Output() searchChange = new EventEmitter<string>();

  isOpen = signal(false);
  searchTerm = signal('');
  menuStyles = signal<Record<string, string>>({});
  private internalValue = signal<SmoothSelectValue>('');
  private disabledFromControl = signal(false);
  private onChange: (value: SmoothSelectValue) => void = () => {};
  private onTouched: () => void = () => {};

  readonly isDisabled = computed(() => this.disabled || this.disabledFromControl());
  readonly filteredOptions = computed(() => {
    const query = this.searchTerm().trim().toLowerCase();
    if (!this.searchable || !query) {
      return this.options;
    }

    return this.options.filter(option => {
      const label = String(option.label).toLowerCase();
      const value = String(option.value ?? '').toLowerCase();
      return label.includes(query) || value.includes(query);
    });
  });

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

  ngOnInit(): void {
    // Defensive reset to avoid stale open state on hot reload/component reuse.
    this.close();

    this.router?.events.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(event => {
      if (event instanceof NavigationStart) {
        this.close();
      }
    });
  }

  toggle(): void {
    if (this.isDisabled()) {
      return;
    }

    this.onTouched();
    const nextOpen = !this.isOpen();
    this.isOpen.set(nextOpen);
    if (!nextOpen) {
      this.searchTerm.set('');
      return;
    }
    this.updateMenuPosition();
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

  onSearchInput(value: string): void {
    const normalized = value ?? '';
    this.searchTerm.set(normalized);
    this.searchChange.emit(normalized);
  }

  isSelected(value: SmoothSelectValue): boolean {
    return this.areValuesEqual(this.internalValue(), value);
  }

  close(): void {
    this.isOpen.set(false);
    this.searchTerm.set('');
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.updateMenuPosition();
  }

  @HostListener('window:scroll')
  onWindowScroll(): void {
    this.updateMenuPosition();
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

  @HostListener('window:blur')
  onWindowBlur(): void {
    this.close();
  }

  @HostListener('document:visibilitychange')
  onVisibilityChange(): void {
    if (typeof document !== 'undefined' && document.hidden) {
      this.close();
    }
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

  private updateMenuPosition(): void {
    if (!this.isOpen()) {
      return;
    }

    const triggerEl = this.triggerRef?.nativeElement;
    if (!triggerEl) {
      return;
    }

    const rect = triggerEl.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const gap = 6;
    const edgePadding = 8;
    const spaceBelow = Math.max(0, viewportHeight - rect.bottom - edgePadding);
    const spaceAbove = Math.max(0, rect.top - edgePadding);
    const preferUp = spaceBelow < 220 && spaceAbove > spaceBelow;
    const availableHeight = Math.max(120, preferUp ? spaceAbove - gap : spaceBelow - gap);
    const maxHeight = Math.min(this.menuMaxHeight, availableHeight);

    const top = preferUp ? rect.top - maxHeight - gap : rect.bottom + gap;
    this.menuStyles.set({
      position: 'fixed',
      top: `${Math.max(edgePadding, top)}px`,
      left: `${Math.max(edgePadding, rect.left)}px`,
      width: `${rect.width}px`,
      maxHeight: `${maxHeight}px`,
    });
  }
}
