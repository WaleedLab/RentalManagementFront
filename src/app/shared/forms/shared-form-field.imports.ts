import { FieldValueStateDirective } from '../directives/field-value-state.directive';
import { MobileNumberInputDirective } from '../directives/mobile-number-input.directive';
import { NumericInputPlaceholderDirective } from '../directives/numeric-input-placeholder.directive';

export const SHARED_FORM_FIELD_DIRECTIVES = [
  FieldValueStateDirective,
  MobileNumberInputDirective,
  NumericInputPlaceholderDirective,
] as const;
