import { Directive, ElementRef, HostListener, inject, OnDestroy, OnInit } from '@angular/core';
import { NgControl } from '@angular/forms';
import { Subscription } from 'rxjs';

import { sanitizeMobileDigits } from '../utils/mobile-number.util';

/** Keeps mobile inputs at most 10 digits (local format). Works with reactive forms. */
@Directive({
  selector: 'input[appMobileNumberInput]',
  standalone: true,
})
export class MobileNumberInputDirective implements OnInit, OnDestroy {
  private el = inject(ElementRef<HTMLInputElement>);
  private ngControl = inject(NgControl, { optional: true, self: true });
  private sub?: Subscription;

  ngOnInit(): void {
    const input = this.el.nativeElement;
    input.setAttribute('maxlength', '10');
    input.setAttribute('inputmode', 'numeric');
    input.setAttribute('autocomplete', 'tel');

    if (this.ngControl?.control) {
      this.sub = this.ngControl.control.valueChanges.subscribe(value => {
        const sanitized = sanitizeMobileDigits(String(value ?? ''));
        if (String(value ?? '') !== sanitized) {
          this.ngControl?.control?.setValue(sanitized, { emitEvent: false });
        }
      });
    }
  }

  @HostListener('input', ['$event'])
  onInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const sanitized = sanitizeMobileDigits(input.value);
    if (input.value === sanitized) {
      return;
    }
    input.value = sanitized;
    this.ngControl?.control?.setValue(sanitized, { emitEvent: false });
    this.ngControl?.control?.updateValueAndValidity({ emitEvent: true });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }
}
