import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { environment } from '../../../../environments/environment';
import { SUPPRESS_ERROR_TOAST } from '../../http-interceptors/http-context.tokens';
import { ApiResponse } from '../../models';

export interface BaseRequestOptions {
  suppressErrorToast?: boolean;
}

/**
 * Base API service: all requests go to environment.apiBaseUrl (Api/V1/CarRentalManagament).
 * Response shape matches backend Result<T>: data, succeeded, errors, propertyErrors.
 */
@Injectable({
  providedIn: 'root',
})
export class BaseService {
  private readonly baseUrl = environment.apiBaseUrl;

  constructor(private http: HttpClient) {}

  get<T>(
    endpoint: string,
    params?: Record<string, string | number | boolean | undefined>,
    options?: BaseRequestOptions,
  ): Observable<ApiResponse<T>> {
    const httpParams = this.buildHttpParams(params);
    return this.http.get<ApiResponse<T> | T>(`${this.baseUrl}/${endpoint}`, {
      params: httpParams,
      context: this.buildHttpContext(options),
    }).pipe(
      map(response => this.normalizeResponse<T>(response)),
    );
  }

  /**
   * GET for endpoints التي لا تُرجع Result<T>، بل T مباشرة (مثل PaginatedList<User>).
   */
  getPlain<T>(
    endpoint: string,
    params?: Record<string, string | number | boolean | undefined>,
    options?: BaseRequestOptions,
  ): Observable<T> {
    const httpParams = this.buildHttpParams(params);
    return this.http.get<T>(`${this.baseUrl}/${endpoint}`, {
      params: httpParams,
      context: this.buildHttpContext(options),
    });
  }

  post<T>(endpoint: string, body: unknown): Observable<ApiResponse<T>> {
    return this.http.post<ApiResponse<T> | T>(`${this.baseUrl}/${endpoint}`, body).pipe(
      map(response => this.normalizeResponse<T>(response)),
    );
  }

  put<T>(endpoint: string, body: unknown): Observable<ApiResponse<T>> {
    return this.http.put<ApiResponse<T> | T>(`${this.baseUrl}/${endpoint}`, body).pipe(
      map(response => this.normalizeResponse<T>(response)),
    );
  }

  patch<T>(endpoint: string, body: unknown): Observable<ApiResponse<T>> {
    return this.http.patch<ApiResponse<T> | T>(`${this.baseUrl}/${endpoint}`, body).pipe(
      map(response => this.normalizeResponse<T>(response)),
    );
  }

  delete<T>(
    endpoint: string,
    params?: Record<string, string | number | boolean | undefined>,
    options?: BaseRequestOptions,
  ): Observable<ApiResponse<T>> {
    const httpParams = this.buildHttpParams(params);
    return this.http.delete<ApiResponse<T> | T>(`${this.baseUrl}/${endpoint}`, {
      params: httpParams,
      context: this.buildHttpContext(options),
    }).pipe(
      map(response => this.normalizeResponse<T>(response)),
    );
  }

  /** Returns only the data part of ApiResponse; throws on explicit failure or validation errors. */
  getData<T>(
    endpoint: string,
    params?: Record<string, string | number | boolean | undefined>,
    options?: BaseRequestOptions,
  ): Observable<T> {
    return this.get<T>(endpoint, params, options).pipe(
      map(res => this.unwrapDataOrThrow(endpoint, res)),
    );
  }

  postData<T>(endpoint: string, body: unknown): Observable<T> {
    return this.post<T>(endpoint, body).pipe(
      map(res => this.unwrapDataOrThrow(endpoint, res)),
    );
  }

  putData<T>(endpoint: string, body: unknown): Observable<T> {
    return this.put<T>(endpoint, body).pipe(
      map(res => this.unwrapDataOrThrow(endpoint, res)),
    );
  }

  patchData<T>(endpoint: string, body: unknown): Observable<T> {
    return this.patch<T>(endpoint, body).pipe(
      map(res => this.unwrapDataOrThrow(endpoint, res)),
    );
  }

  deleteData<T>(
    endpoint: string,
    params?: Record<string, string | number | boolean | undefined>,
    options?: BaseRequestOptions,
  ): Observable<T> {
    return this.delete<T>(endpoint, params, options).pipe(
      map(res => this.unwrapDataOrThrow(endpoint, res)),
    );
  }

  private getErrorMessage<T>(endpoint: string, response: ApiResponse<T>): string {
    const errors = response.errors?.filter(Boolean) ?? [];
    if (errors.length > 0) {
      return `${endpoint}: ${errors.join(' ')}`;
    }

    const propertyErrors = Object.values(response.propertyErrors ?? {})
      .flat()
      .filter(Boolean);
    if (propertyErrors.length > 0) {
      return `${endpoint}: ${propertyErrors.join(' ')}`;
    }

    return `${endpoint}: Request failed`;
  }

  private normalizeResponse<T>(response: ApiResponse<T> | T): ApiResponse<T> {
    if (this.isApiResponse<T>(response)) {
      return this.coerceResultEnvelope(response);
    }

    return {
      data: response as T,
      succeeded: true,
      errors: [],
      propertyErrors: {},
      httpStatusCode: 200,
    };
  }

  /**
   * ASP.NET often serializes `Result<T>` as `Succeeded` / `Data` / `Errors` / `PropertyErrors`.
   * Also: omitting `succeeded` must not be treated as failure (`!undefined` is true in JS).
   */
  private coerceResultEnvelope<T>(raw: ApiResponse<T> | T): ApiResponse<T> {
    const r = raw as Record<string, unknown>;
    const rawSucceeded = r['succeeded'] ?? r['Succeeded'];
    const succeeded =
      rawSucceeded === false || rawSucceeded === 'false' || rawSucceeded === 'False'
        ? false
        : rawSucceeded === true || rawSucceeded === 'true' || rawSucceeded === 'True'
          ? true
          : true;
    const data = (r['data'] ?? r['Data']) as T;
    const errorsRaw = r['errors'] ?? r['Errors'];
    const errors = Array.isArray(errorsRaw)
      ? (errorsRaw as unknown[]).map(e => String(e)).filter(Boolean)
      : [];
    const peRaw = r['propertyErrors'] ?? r['PropertyErrors'];
    const propertyErrors =
      peRaw && typeof peRaw === 'object' && !Array.isArray(peRaw)
        ? (peRaw as Record<string, string[]>)
        : {};
    const httpRaw = r['httpStatusCode'] ?? r['HttpStatusCode'];
    const httpStatusCode =
      typeof httpRaw === 'number' && Number.isFinite(httpRaw) ? httpRaw : Number(httpRaw) || 200;

    return {
      data,
      succeeded,
      errors,
      propertyErrors,
      httpStatusCode,
    };
  }

  private unwrapDataOrThrow<T>(endpoint: string, res: ApiResponse<T>): T {
    if (this.shouldTreatResultAsFailure(res)) {
      throw new Error(this.getErrorMessage(endpoint, res));
    }
    return res.data;
  }

  /**
   * Prefer trusting a non-null `data` payload (e.g. created `BookingDto`) as success even when
   * some APIs still set `succeeded: false` or echo `errors` after a successful insert — avoids a
   * false error in the UI when the row already exists. Empty `data` + `succeeded: false` or
   * validation messages still fails. **HTTP 4xx** is handled separately (throws before unwrap).
   */
  private shouldTreatResultAsFailure<T>(res: ApiResponse<T>): boolean {
    const hasPayload = res.data !== null && res.data !== undefined;
    if (hasPayload) {
      return false;
    }
    if (res.succeeded === false) {
      return true;
    }
    const errs = res.errors?.filter(Boolean) ?? [];
    const flatPe = Object.values(res.propertyErrors ?? {})
      .flat()
      .filter(Boolean);
    return errs.length > 0 || flatPe.length > 0;
  }

  private isApiResponse<T>(value: ApiResponse<T> | T): value is ApiResponse<T> {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const candidate = value as Record<string, unknown>;
    return (
      'succeeded' in candidate ||
      'Succeeded' in candidate ||
      'data' in candidate ||
      'Data' in candidate ||
      'httpStatusCode' in candidate ||
      'HttpStatusCode' in candidate
    );
  }

  private buildHttpContext(options?: BaseRequestOptions): HttpContext {
    let context = new HttpContext();

    if (options?.suppressErrorToast) {
      context = context.set(SUPPRESS_ERROR_TOAST, true);
    }

    return context;
  }

  private buildHttpParams(
    params?: Record<string, string | number | boolean | undefined>,
  ): HttpParams {
    let httpParams = new HttpParams();
    if (!params) {
      return httpParams;
    }

    const seenKeys = new Set<string>();
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') {
        return;
      }

      const normalizedKey = key.toLowerCase();
      if (seenKeys.has(normalizedKey)) {
        return;
      }

      seenKeys.add(normalizedKey);
      httpParams = httpParams.set(key, String(value));
    });

    return httpParams;
  }
}
