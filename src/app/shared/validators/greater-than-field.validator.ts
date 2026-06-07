import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

import { isEmptyNumericValue } from './required-number.validator';

/** High field must be strictly greater than its paired low field. */
export function greaterThanField(lowControlName: string): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const parent = control.parent;
    if (!parent) {
      return null;
    }

    const lowControl = parent.get(lowControlName);
    if (!lowControl || isEmptyNumericValue(control.value) || isEmptyNumericValue(lowControl.value)) {
      return null;
    }

    const low = Number(lowControl.value);
    const high = Number(control.value);
    if (!Number.isFinite(low) || !Number.isFinite(high)) {
      return null;
    }

    return high > low ? null : { greaterThanLow: { low, high } };
  };
}
