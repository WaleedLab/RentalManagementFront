import { AbstractControl, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';

/** Local Saudi mobile — digits only, max 10 (e.g. 0512345678). */
export const MOBILE_NUMBER_MAX_LENGTH = 10;

export const MOBILE_NUMBER_REGEX = /^\d{10}$/;

/** Strip non-digits and normalize common country-code prefixes to local 10 digits. */
export function sanitizeMobileDigits(value: string | null | undefined): string {
  let digits = String(value ?? '').replace(/\D/g, '');
  if (!digits) {
    return '';
  }

  if (digits.startsWith('00966') && digits.length >= 13) {
    digits = digits.slice(5);
  } else if (digits.startsWith('966') && digits.length >= 12) {
    digits = digits.slice(3);
  }

  if (digits.length === 9 && digits.startsWith('5')) {
    digits = `0${digits}`;
  }

  return digits.slice(0, MOBILE_NUMBER_MAX_LENGTH);
}

export function isValidMobileNumber(value: string | null | undefined): boolean {
  const digits = sanitizeMobileDigits(value);
  return MOBILE_NUMBER_REGEX.test(digits);
}

export function mobileNumberValidators(options?: { required?: boolean }): ValidatorFn[] {
  const validators: ValidatorFn[] = [
    Validators.maxLength(MOBILE_NUMBER_MAX_LENGTH),
    Validators.pattern(MOBILE_NUMBER_REGEX),
  ];
  if (options?.required) {
    validators.unshift(Validators.required);
  }
  return validators;
}

/** Optional mobile: empty OK, otherwise exactly 10 digits. */
export function optionalMobileNumberValidators(): ValidatorFn[] {
  return [
    Validators.maxLength(MOBILE_NUMBER_MAX_LENGTH),
    (control: AbstractControl): ValidationErrors | null => {
      const raw = String(control.value ?? '').trim();
      if (!raw) {
        return null;
      }
      return isValidMobileNumber(raw) ? null : { mobileInvalid: true };
    },
  ];
}
