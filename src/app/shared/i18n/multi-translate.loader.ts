import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { TranslateLoader } from '@ngx-translate/core';
import { catchError, forkJoin, map, Observable, of } from 'rxjs';

function mergeDeep(target: any, source: any): any {
  if (typeof target !== 'object' || target === null) return source;
  if (typeof source !== 'object' || source === null) return target;
  for (const key of Object.keys(source)) {
    const tVal = target[key];
    const sVal = source[key];
    if (Array.isArray(sVal)) {
      target[key] = sVal.slice();
    } else if (typeof sVal === 'object' && sVal !== null) {
      target[key] = mergeDeep(typeof tVal === 'object' && tVal !== null ? { ...tVal } : {}, sVal);
    } else {
      target[key] = sVal;
    }
  }
  return target;
}

@Injectable()
export class MultiTranslateLoader implements TranslateLoader {
  constructor(private http: HttpClient) {}

  getTranslation(lang: string): Observable<any> {
    const l = (lang || 'en').toLowerCase();
    const rentModules = [
      'dashboard',
      'users',
      'roles',
      'privileges',
      'fleet',
      'branches',
      'vehicles',
      'category-vehicles',
      'customers',
      'subscriptions',
      'booking',
      'traffic-violations',
      'maintenance',
      'security',
      'settings',
    ];
    const financeModules = [
      'common',
      'banks',
      'cash',
      'counting',
      'financial-years',
      'journals',
      'payment-counts',
    ];

    const paths = [
      `./assets/i18n/common/${l}.json`,
      ...rentModules.map(moduleName => `./assets/i18n/modules/rent/${moduleName}/${l}.json`),
      ...financeModules.map(moduleName => `./assets/i18n/modules/finance/${moduleName}/${l}.json`),
    ];

    const requests = paths.map(p =>
      this.http.get<any>(p).pipe(
        // If a module file doesn't exist yet, treat as empty.
        // (This keeps the app working while you add translations gradually.)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        map(res => res ?? {}),
        catchError(() => of({})),
      ),
    );

    return forkJoin(requests).pipe(
      map(list => list.reduce((acc, cur) => mergeDeep(acc, cur), {} as any)),
    );
  }
}

