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
  forwardRef,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { NavigationStart, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

export type DatePickerMode = 'date' | 'datetime';
export type CalendarMode = 'gregorian' | 'hijri';
/** `iso` → yyyy-MM-dd; `hijri-slash` → dd/MM/yyyy (Islamic calendar, for API text fields). */
export type DatePickerValueFormat = 'iso' | 'hijri-slash';

const HIJRI_DATE_FORMAT = new Intl.DateTimeFormat('ar-SA-u-ca-islamic', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});

const HIJRI_MONTH_YEAR_FORMAT = new Intl.DateTimeFormat('ar-SA-u-ca-islamic', {
  year: 'numeric',
  month: 'long',
});

const HIJRI_DAY_FORMAT = new Intl.DateTimeFormat('ar-SA-u-ca-islamic', {
  day: 'numeric',
});

const HIJRI_NUMERIC_PARTS_FORMAT = new Intl.DateTimeFormat('en-u-ca-islamic', {
  day: 'numeric',
  month: 'numeric',
  year: 'numeric',
});

const GREGORIAN_MONTH_INDICES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const;
const HIJRI_MONTH_INDICES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
const YEAR_RANGE_PAST = 120;
const YEAR_RANGE_FUTURE = 15;

@Component({
  selector: 'app-date-picker',
  standalone: true,
  imports: [CommonModule, TranslateModule, FormsModule],
  templateUrl: './date-picker.component.html',
  styleUrl: './date-picker.component.scss',
  host: {
    '[class.date-picker-host--open]': 'isOpen()',
    '[class.date-picker-host--disabled]': 'isDisabled()',
  },
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DatePickerComponent),
      multi: true,
    },
  ],
})
export class DatePickerComponent implements ControlValueAccessor, OnInit, OnChanges {
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router, { optional: true });
  private readonly translate = inject(TranslateService);

  @Input() label = '';
  @Input() placeholder = '';
  @Input() mode: DatePickerMode = 'date';
  @Input() valueFormat: DatePickerValueFormat = 'iso';
  @Input() disabled = false;
  /** Compact layout for filter toolbars (hides calendar badge, tighter trigger). */
  @Input() compact = false;
  /**
   * When opening an empty picker, pre-fill with now (datetime) or today (date).
   * `null` → datetime only; set `false` on filters / optional dates (e.g. birth date).
   */
  @Input() defaultToNowOnOpen: boolean | null = null;

  @Input() set calendarMode(next: CalendarMode) {
    this.calendarModeState.set(next === 'hijri' ? 'hijri' : 'gregorian');
  }

  @Input() set value(next: string | Date | null) {
    this.writeValue(next);
  }

  /** Emits `yyyy-MM-dd` or `yyyy-MM-ddTHH:mm` (datetime-local compatible). */
  @Output() dateChange = new EventEmitter<string | null>();
  @Output() calendarModeChange = new EventEmitter<CalendarMode>();

  calendarModeState = signal<CalendarMode>('gregorian');

  isOpen = signal(false);
  selectedDate = signal<Date | null>(null);
  selectedHour = signal(0);
  selectedMinute = signal(0);
  currentYear = signal(new Date().getFullYear());
  currentMonth = signal(new Date().getMonth());
  daysInMonth = signal<number[]>([]);
  emptyDays = signal<number[]>([]);

  private disabledFromControl = signal(false);
  private onChange: (value: string | null) => void = () => {};
  private onTouched: () => void = () => {};

  readonly isDisabled = () => this.disabled || this.disabledFromControl();

  setCalendarMode(mode: CalendarMode): void {
    const normalized: CalendarMode = mode === 'hijri' ? 'hijri' : 'gregorian';
    if (this.calendarModeState() === normalized) {
      return;
    }
    this.calendarModeState.set(normalized);
    this.calendarModeChange.emit(normalized);
  }

  calendarModeBadge(): string {
    return this.calendarModeState() === 'hijri'
      ? this.translate.instant('datePicker.hijri')
      : this.translate.instant('datePicker.gregorian');
  }

  ngOnInit(): void {
    this.applyValueFormatDefaults();
    this.close();
    this.router?.events.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(event => {
      if (event instanceof NavigationStart) {
        this.close();
      }
    });
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      if (this.isOpen()) {
        this.buildCalendar();
      }
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['valueFormat'] && !changes['valueFormat'].firstChange) {
      this.applyValueFormatDefaults();
    }
    if (changes['mode'] && !changes['mode'].firstChange) {
      this.syncFromControlValue(this.lastWrittenValue);
    }
  }

  readonly lockCalendarMode = (): boolean => this.valueFormat === 'hijri-slash';

  private lastWrittenValue: string | Date | null = null;

  writeValue(value: string | Date | null): void {
    this.lastWrittenValue = value;
    this.syncFromControlValue(value);
  }

  registerOnChange(fn: (value: string | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabledFromControl.set(isDisabled);
    if (isDisabled) {
      this.close();
    }
  }

  toggle(): void {
    if (this.isDisabled()) {
      return;
    }
    this.onTouched();
    this.isOpen.update(open => !open);
    if (this.isOpen()) {
      this.ensureDefaultOnOpen();
      const selected = this.selectedDate();
      if (selected) {
        this.currentYear.set(selected.getFullYear());
        this.currentMonth.set(selected.getMonth());
      }
      this.buildCalendar();
    }
  }

  close(): void {
    this.isOpen.set(false);
  }

  weekDays(): string[] {
    const keys = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const start = this.weekStartsOn();
    const ordered = [...keys.slice(start), ...keys.slice(0, start)];
    return ordered.map(key => this.translate.instant(`datePicker.week.${key}`));
  }

  readonly gregorianMonthIndices = GREGORIAN_MONTH_INDICES;
  readonly hijriMonthIndices = HIJRI_MONTH_INDICES;

  monthLabel(): string {
    const anchor = new Date(this.currentYear(), this.currentMonth(), 1);
    if (this.calendarModeState() === 'hijri') {
      return this.formatHijriMonthYear(anchor);
    }
    const monthKey = `datePicker.month.${this.currentMonth()}`;
    const month = this.translate.instant(monthKey);
    return `${month} ${this.currentYear()}`;
  }

  gregorianYearOptions(): number[] {
    const now = new Date().getFullYear();
    const start = now - YEAR_RANGE_PAST;
    const end = now + YEAR_RANGE_FUTURE;
    return Array.from({ length: end - start + 1 }, (_, index) => end - index);
  }

  hijriYearOptions(): number[] {
    const current = this.viewHijriYear();
    const start = current - YEAR_RANGE_PAST;
    const end = current + YEAR_RANGE_FUTURE;
    return Array.from({ length: end - start + 1 }, (_, index) => end - index);
  }

  viewHijriMonth(): number {
    return this.getHijriNumericParts(this.calendarAnchorDate()).month;
  }

  viewHijriYear(): number {
    return this.getHijriNumericParts(this.calendarAnchorDate()).year;
  }

  hijriMonthLabel(month: number): string {
    const anchor =
      this.gregorianFromHijri(15, month, this.viewHijriYear()) ??
      new Date(this.currentYear(), this.currentMonth(), 15);
    const locale = this.translate.currentLang === 'ar' ? 'ar-SA-u-ca-islamic' : 'en-u-ca-islamic';
    return new Intl.DateTimeFormat(locale, { month: 'long' }).format(anchor);
  }

  onGregorianMonthChange(raw: string | number): void {
    const month = typeof raw === 'number' ? raw : Number.parseInt(raw, 10);
    if (!Number.isFinite(month) || month < 0 || month > 11) {
      return;
    }
    this.currentMonth.set(month);
    this.buildCalendar();
  }

  onGregorianYearChange(raw: string | number): void {
    const year = typeof raw === 'number' ? raw : Number.parseInt(raw, 10);
    if (!Number.isFinite(year)) {
      return;
    }
    this.currentYear.set(year);
    this.buildCalendar();
  }

  onHijriMonthChange(raw: string | number): void {
    const month = typeof raw === 'number' ? raw : Number.parseInt(raw, 10);
    if (!Number.isFinite(month) || month < 1 || month > 12) {
      return;
    }
    this.applyHijriAnchor(this.viewHijriYear(), month);
  }

  onHijriYearChange(raw: string | number): void {
    const year = typeof raw === 'number' ? raw : Number.parseInt(raw, 10);
    if (!Number.isFinite(year)) {
      return;
    }
    this.applyHijriAnchor(year, this.viewHijriMonth());
  }

  formatGregorianDate(date: Date): string {
    const locale = this.translate.currentLang === 'ar' ? 'ar-SA' : 'en-GB';
    return date.toLocaleDateString(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  formatHijriDate(date: Date): string {
    return HIJRI_DATE_FORMAT.format(date);
  }

  formatHijriMonthYear(date: Date): string {
    return HIJRI_MONTH_YEAR_FORMAT.format(date);
  }

  getHijriDayNumber(day: number): string {
    const date = new Date(this.currentYear(), this.currentMonth(), day);
    return HIJRI_DAY_FORMAT.format(date);
  }

  formatHijriSlash(date: Date): string {
    const { day, month, year } = this.getHijriNumericParts(date);
    return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${String(year).padStart(4, '0')}`;
  }

  prevMonth(): void {
    if (this.currentMonth() === 0) {
      this.currentMonth.set(11);
      this.currentYear.update(y => y - 1);
    } else {
      this.currentMonth.update(m => m - 1);
    }
    this.buildCalendar();
  }

  nextMonth(): void {
    if (this.currentMonth() === 11) {
      this.currentMonth.set(0);
      this.currentYear.update(y => y + 1);
    } else {
      this.currentMonth.update(m => m + 1);
    }
    this.buildCalendar();
  }

  selectDay(day: number): void {
    const next = new Date(
      this.currentYear(),
      this.currentMonth(),
      day,
      this.mode === 'datetime' ? this.selectedHour() : 0,
      this.mode === 'datetime' ? this.selectedMinute() : 0,
      0,
      0,
    );
    this.selectedDate.set(next);
    this.emitValue();
    this.close();
  }

  selectToday(): void {
    const today = new Date();
    this.selectedDate.set(today);
    this.currentYear.set(today.getFullYear());
    this.currentMonth.set(today.getMonth());
    if (this.mode === 'datetime') {
      this.selectedHour.set(today.getHours());
      this.selectedMinute.set(today.getMinutes());
    }
    this.buildCalendar();
    this.emitValue();
    this.close();
  }

  clear(): void {
    this.selectedDate.set(null);
    this.emitValue();
    this.close();
  }

  displayHour12(): number {
    return this.toHour12Parts(this.selectedHour()).hour12;
  }

  displayPeriod(): 'AM' | 'PM' {
    return this.toHour12Parts(this.selectedHour()).period;
  }

  onHour12Change(raw: string): void {
    const hour12 = Math.min(12, Math.max(1, Number.parseInt(raw, 10) || 12));
    this.selectedHour.set(this.toHour24(hour12, this.displayPeriod()));
    if (this.selectedDate()) {
      this.emitValue();
    }
  }

  onPeriodChange(raw: string): void {
    const period: 'AM' | 'PM' = raw === 'PM' ? 'PM' : 'AM';
    this.selectedHour.set(this.toHour24(this.displayHour12(), period));
    if (this.selectedDate()) {
      this.emitValue();
    }
  }

  onMinuteChange(raw: string): void {
    const minute = Math.min(59, Math.max(0, Number.parseInt(raw, 10) || 0));
    this.selectedMinute.set(minute);
    if (this.selectedDate()) {
      this.emitValue();
    }
  }

  isToday(day: number): boolean {
    const today = new Date();
    return (
      today.getFullYear() === this.currentYear() &&
      today.getMonth() === this.currentMonth() &&
      today.getDate() === day
    );
  }

  isSelected(day: number): boolean {
    const selected = this.selectedDate();
    if (!selected) {
      return false;
    }
    return (
      selected.getFullYear() === this.currentYear() &&
      selected.getMonth() === this.currentMonth() &&
      selected.getDate() === day
    );
  }

  displayValue(): string {
    const selected = this.selectedDate();
    if (!selected) {
      return '';
    }

    if (this.valueFormat === 'hijri-slash') {
      return this.formatHijriSlash(selected);
    }

    const dateLabel =
      this.calendarModeState() === 'hijri'
        ? this.formatHijriDate(selected)
        : this.formatGregorianDate(selected);

    if (this.mode === 'datetime') {
      return `${dateLabel} ${this.formatTime12Label(this.selectedHour(), this.selectedMinute())}`;
    }

    return dateLabel;
  }

  placeholderText(): string {
    if (this.placeholder) {
      return this.translate.instant(this.placeholder);
    }
    return this.translate.instant(
      this.mode === 'datetime' ? 'datePicker.selectDateTime' : 'datePicker.selectDate',
    );
  }

  labelText(): string {
    return this.label ? this.translate.instant(this.label) : '';
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    if (!this.isOpen()) {
      return;
    }
    const target = event.target as Node | null;
    if (target && this.elementRef.nativeElement.contains(target)) {
      return;
    }
    this.close();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close();
  }

  private ensureDefaultOnOpen(): void {
    if (this.selectedDate() || !this.shouldDefaultToNowOnOpen()) {
      return;
    }

    const now = new Date();
    if (this.mode === 'datetime') {
      this.selectedDate.set(now);
      this.selectedHour.set(now.getHours());
      this.selectedMinute.set(now.getMinutes());
    } else {
      this.selectedDate.set(new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0));
      this.selectedHour.set(0);
      this.selectedMinute.set(0);
    }

    this.currentYear.set(now.getFullYear());
    this.currentMonth.set(now.getMonth());
    this.emitValue();
  }

  private shouldDefaultToNowOnOpen(): boolean {
    if (this.defaultToNowOnOpen !== null) {
      return this.defaultToNowOnOpen;
    }
    return this.mode === 'datetime';
  }

  private formatTime12Label(hour24: number, minute: number): string {
    const { hour12, period } = this.toHour12Parts(hour24);
    const mm = String(minute).padStart(2, '0');
    const periodLabel = this.translate.instant(period === 'AM' ? 'datePicker.am' : 'datePicker.pm');
    return `${hour12}:${mm} ${periodLabel}`;
  }

  private toHour12Parts(hour24: number): { hour12: number; period: 'AM' | 'PM' } {
    const normalized = Math.min(23, Math.max(0, Number(hour24) || 0));
    const period: 'AM' | 'PM' = normalized >= 12 ? 'PM' : 'AM';
    let hour12 = normalized % 12;
    if (hour12 === 0) {
      hour12 = 12;
    }
    return { hour12, period };
  }

  private toHour24(hour12: number, period: 'AM' | 'PM'): number {
    const h = Math.min(12, Math.max(1, Number(hour12) || 12));
    if (period === 'AM') {
      return h === 12 ? 0 : h;
    }
    return h === 12 ? 12 : h + 12;
  }

  private calendarAnchorDate(): Date {
    return new Date(this.currentYear(), this.currentMonth(), 15);
  }

  private applyHijriAnchor(hijriYear: number, hijriMonth: number): void {
    const gregorian = this.gregorianFromHijri(1, hijriMonth, hijriYear);
    if (!gregorian) {
      return;
    }
    this.currentYear.set(gregorian.getFullYear());
    this.currentMonth.set(gregorian.getMonth());
    this.buildCalendar();
  }

  private gregorianFromHijri(day: number, month: number, year: number): Date | null {
    if (month < 1 || month > 12 || day < 1 || day > 30) {
      return null;
    }

    const cursor = new Date(1990, 0, 1);
    const end = new Date(2060, 11, 31);
    while (cursor <= end) {
      const parts = this.getHijriNumericParts(cursor);
      if (parts.day === day && parts.month === month && parts.year === year) {
        return new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate());
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    return null;
  }

  private buildCalendar(): void {
    const totalDays = new Date(this.currentYear(), this.currentMonth() + 1, 0).getDate();
    const firstJsDay = new Date(this.currentYear(), this.currentMonth(), 1).getDay();
    const offset = (firstJsDay - this.weekStartsOn() + 7) % 7;

    this.daysInMonth.set(Array.from({ length: totalDays }, (_, index) => index + 1));
    this.emptyDays.set(Array.from({ length: offset }, (_, index) => index));
  }

  private weekStartsOn(): number {
    return this.translate.currentLang === 'ar' ? 6 : 0;
  }

  private syncFromControlValue(value: string | Date | null | undefined): void {
    const parsed = this.parseIncoming(value);
    this.selectedDate.set(parsed.date);
    this.selectedHour.set(parsed.hour);
    this.selectedMinute.set(parsed.minute);
    if (parsed.date) {
      this.currentYear.set(parsed.date.getFullYear());
      this.currentMonth.set(parsed.date.getMonth());
    }
    this.buildCalendar();
  }

  private parseIncoming(value: string | Date | null | undefined): {
    date: Date | null;
    hour: number;
    minute: number;
  } {
    if (!value) {
      return { date: null, hour: 0, minute: 0 };
    }

    if (value instanceof Date) {
      if (Number.isNaN(value.getTime())) {
        return { date: null, hour: 0, minute: 0 };
      }
      return { date: value, hour: value.getHours(), minute: value.getMinutes() };
    }

    const raw = String(value).trim();
    if (!raw) {
      return { date: null, hour: 0, minute: 0 };
    }

    const hijriSlash = this.parseHijriSlash(raw);
    if (hijriSlash) {
      return { date: hijriSlash, hour: 0, minute: 0 };
    }

    const dateOnly = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateOnly) {
      const date = new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
      return { date: Number.isNaN(date.getTime()) ? null : date, hour: 0, minute: 0 };
    }

    const dateTime = raw.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
    if (dateTime) {
      const date = new Date(
        Number(dateTime[1]),
        Number(dateTime[2]) - 1,
        Number(dateTime[3]),
        Number(dateTime[4]),
        Number(dateTime[5]),
      );
      return {
        date: Number.isNaN(date.getTime()) ? null : date,
        hour: Number(dateTime[4]),
        minute: Number(dateTime[5]),
      };
    }

    const fallback = new Date(raw);
    if (Number.isNaN(fallback.getTime())) {
      return { date: null, hour: 0, minute: 0 };
    }
    return { date: fallback, hour: fallback.getHours(), minute: fallback.getMinutes() };
  }

  private emitValue(): void {
    const serialized = this.serializeValue();
    const outward = serialized ?? '';
    this.lastWrittenValue = outward;
    this.dateChange.emit(serialized);
    this.onChange(outward);
    this.onTouched();
  }

  private applyValueFormatDefaults(): void {
    if (this.valueFormat === 'hijri-slash') {
      this.calendarModeState.set('hijri');
    }
  }

  private getHijriNumericParts(date: Date): { day: number; month: number; year: number } {
    const parts = HIJRI_NUMERIC_PARTS_FORMAT.formatToParts(date);
    const read = (type: Intl.DateTimeFormatPart['type']): number =>
      Number(parts.find(part => part.type === type)?.value ?? Number.NaN);
    return {
      day: read('day'),
      month: read('month'),
      year: read('year'),
    };
  }

  private parseHijriSlash(raw: string): Date | null {
    const match = raw.trim().match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{3,4})$/);
    if (!match) {
      return null;
    }

    const targetDay = Number(match[1]);
    const targetMonth = Number(match[2]);
    let targetYear = Number(match[3]);
    if (!Number.isFinite(targetDay) || !Number.isFinite(targetMonth) || !Number.isFinite(targetYear)) {
      return null;
    }
    if (targetYear >= 400 && targetYear <= 999) {
      targetYear += 600;
    }

    return this.gregorianFromHijri(targetDay, targetMonth, targetYear);
  }

  private serializeValue(): string | null {
    const selected = this.selectedDate();
    if (!selected) {
      return null;
    }

    if (this.valueFormat === 'hijri-slash') {
      return this.formatHijriSlash(selected);
    }

    const y = selected.getFullYear();
    const m = String(selected.getMonth() + 1).padStart(2, '0');
    const d = String(selected.getDate()).padStart(2, '0');

    if (this.mode === 'date') {
      return `${y}-${m}-${d}`;
    }

    const hh = String(this.selectedHour()).padStart(2, '0');
    const mm = String(this.selectedMinute()).padStart(2, '0');
    return `${y}-${m}-${d}T${hh}:${mm}`;
  }
}
