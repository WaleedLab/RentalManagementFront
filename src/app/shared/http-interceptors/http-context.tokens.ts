import { HttpContextToken } from '@angular/common/http';

export const SUPPRESS_ERROR_TOAST = new HttpContextToken<boolean>(() => false);
