import { CommonModule } from '@angular/common';
import {
  Component,
  DestroyRef,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
  ViewChild,
  computed,
  forwardRef,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { NavigationStart, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

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
  host: {
    '[class.app-smooth-select-host--open]': 'isOpen()',
  },
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SmoothSelectComponent),
      multi: true,
    },
  ],
})
export class SmoothSelectComponent implements ControlValueAccessor, OnInit, OnChanges {
  private elementRef = inject(ElementRef<HTMLElement>);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router, { optional: true });
  private readonly translate = inject(TranslateService);
  @ViewChild('triggerBtn') private triggerRef?: ElementRef<HTMLButtonElement>;

  @Input() options: SmoothSelectOption[] = [];
  @Input() set value(nextValue: SmoothSelectValue) {
    this.internalValue.set(nextValue ?? '');
  }
  get value(): SmoothSelectValue {
    return this.internalValue();
  }
  @Input() set disabled(value: boolean | string | null | undefined) {
    const next = value === true || value === '' || value === 'true';
    this.disabledInput.set(next);
    if (next) {
      this.close();
    }
  }
  get disabled(): boolean {
    return this.disabledInput();
  }
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
  private disabledInput = signal(false);
  private disabledFromControl = signal(false);
  /** Bumps when `options` @Input changes so computeds refresh (e.g. language switch). */
  private readonly optionsVersion = signal(0);
  private onChange: (value: SmoothSelectValue) => void = () => {};
  private onTouched: () => void = () => {};

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['options'] && !changes['options'].firstChange) {
      this.optionsVersion.update(v => v + 1);
    }
  }

  readonly isDisabled = computed(() => this.disabledInput() || this.disabledFromControl());
  readonly filteredOptions = computed(() => {
    this.optionsVersion();
    const query = this.searchTerm().trim().toLowerCase();
    if (!this.searchable || !query) {
      return this.options;
    }

    return this.options.filter(option => {
      const label = this.optionLabelText(option).toLowerCase();
      const value = String(option.value ?? '').toLowerCase();
      return label.includes(query) || value.includes(query);
    });
  });

  /** نص العرض للخيار — دون الاعتماد على أن يكون مفتاح ترجمة. */
  optionLabelText(option: SmoothSelectOption): string {
    const raw = option?.label;
    if (raw === null || raw === undefined) {
      return String(option?.value ?? '');
    }
    const s = String(raw).trim();
    return s.length > 0 ? s : String(option?.value ?? '');
  }

  selectedLabel = computed(() => {
    this.optionsVersion();
    const selectedOption = this.options.find(option => this.areValuesEqual(option.value, this.internalValue()));
    if (selectedOption) {
      return this.optionLabelText(selectedOption);
    }

    if (this.placeholder) {
      return this.translate.instant(this.placeholder);
    }

    const first = this.options[0];
    return first ? this.optionLabelText(first) : '';
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
    // Re-measure after DOM paints (caret/layout) so fixed coords stay aligned to the trigger.
    requestAnimationFrame(() => this.updateMenuPosition());
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
    const vh = window.innerHeight;
    const gap = 6;
    const pad = 8;
    const minMenuH = 120;

    const spaceBelow = Math.max(0, vh - rect.bottom - pad);
    const spaceAbove = Math.max(0, rect.top - pad);

    // Open upward only when there is almost no room below the trigger. A loose threshold
    // caused menus to flip up inside filter toolbars and sit under the previous row (e.g. Sort by).
    const criticalBelow = 40;
    const openUp = spaceBelow < criticalBelow && spaceAbove > spaceBelow + criticalBelow;

    let maxHeight: number;

    if (openUp) {
      maxHeight = Math.min(this.menuMaxHeight, Math.max(minMenuH, spaceAbove - gap));
      if (rect.top - maxHeight - gap < pad) {
        maxHeight = Math.max(minMenuH, rect.top - pad - gap);
        maxHeight = Math.min(maxHeight, this.menuMaxHeight);
      }
    } else {
      maxHeight = Math.min(this.menuMaxHeight, Math.max(minMenuH, spaceBelow - gap));
      const bottomPx = rect.bottom + gap + maxHeight;
      if (bottomPx > vh - pad) {
        maxHeight = Math.max(minMenuH, vh - pad - rect.bottom - gap);
      }
    }

    // Anchor to trigger via absolute positioning inside .app-soft-select (avoids fixed + transform bugs).
    const base = {
      position: 'absolute' as const,
      left: '0',
      right: '0',
      width: 'auto',
      maxHeight: `${maxHeight}px`,
    };

    this.menuStyles.set(
      openUp
        ? { ...base, top: 'auto', bottom: 'calc(100% + 6px)' }
        : { ...base, top: 'calc(100% + 6px)', bottom: 'auto' },
    );
  }
}
