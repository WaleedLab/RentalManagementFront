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
    let httpParams = new HttpParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          httpParams = httpParams.set(key, String(value));
        }
      });
    }
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
    let httpParams = new HttpParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          httpParams = httpParams.set(key, String(value));
        }
      });
    }
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

  delete<T>(endpoint: string): Observable<ApiResponse<T>> {
    return this.http.delete<ApiResponse<T> | T>(`${this.baseUrl}/${endpoint}`).pipe(
      map(response => this.normalizeResponse<T>(response)),
    );
  }

  /** Returns only the data part of ApiResponse; throws if !succeeded */
  getData<T>(
    endpoint: string,
    params?: Record<string, string | number | boolean | undefined>,
    options?: BaseRequestOptions,
  ): Observable<T> {
    return this.get<T>(endpoint, params, options).pipe(
      map(res => {
        if (!res.succeeded) {
          throw new Error(this.getErrorMessage(endpoint, res));
        }
        return res.data;
      }),
    );
  }

  postData<T>(endpoint: string, body: unknown): Observable<T> {
    return this.post<T>(endpoint, body).pipe(
      map(res => {
        if (!res.succeeded) {
          throw new Error(this.getErrorMessage(endpoint, res));
        }
        return res.data;
      }),
    );
  }

  putData<T>(endpoint: string, body: unknown): Observable<T> {
    return this.put<T>(endpoint, body).pipe(
      map(res => {
        if (!res.succeeded) {
          throw new Error(this.getErrorMessage(endpoint, res));
        }
        return res.data;
      }),
    );
  }

  patchData<T>(endpoint: string, body: unknown): Observable<T> {
    return this.patch<T>(endpoint, body).pipe(
      map(res => {
        if (!res.succeeded) {
          throw new Error(this.getErrorMessage(endpoint, res));
        }
        return res.data;
      }),
    );
  }

  deleteData<T>(endpoint: string): Observable<T> {
    return this.delete<T>(endpoint).pipe(
      map(res => {
        if (!res.succeeded) {
          throw new Error(this.getErrorMessage(endpoint, res));
        }
        return res.data;
      }),
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
      return response;
    }

    return {
      data: response as T,
      succeeded: true,
      errors: [],
      propertyErrors: {},
      httpStatusCode: 200,
    };
  }

  private isApiResponse<T>(value: ApiResponse<T> | T): value is ApiResponse<T> {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const candidate = value as Record<string, unknown>;
    return 'succeeded' in candidate || 'data' in candidate || 'httpStatusCode' in candidate;
  }

  private buildHttpContext(options?: BaseRequestOptions): HttpContext {
    let context = new HttpContext();

    if (options?.suppressErrorToast) {
      context = context.set(SUPPRESS_ERROR_TOAST, true);
    }

    return context;
  }
}
