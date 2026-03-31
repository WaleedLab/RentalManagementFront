import { Injectable } from '@angular/core';

const TOKEN_KEY = 'auth_token';
const SESSION_CLOSED_AT_KEY = 'auth_session_closed_at';
const FLEET_ID_KEY = 'fleetId';

@Injectable({
  providedIn: 'root',
})
export class TokenService {
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  setToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
    this.clearClosedAt();
  }

  removeToken(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('roles');
    localStorage.removeItem('privileges');
    localStorage.removeItem(FLEET_ID_KEY);
    this.clearClosedAt();
  }

  hasToken(): boolean {
    return !!this.getToken();
  }

  /**
   * Decode JWT payload safely (handles base64url).
   */
  decodePayload(token: string | null | undefined): any | null {
    if (!token) return null;
    try {
      const base64 = token.split('.')[1] ?? '';
      const base64Normalized = base64.replace(/-/g, '+').replace(/_/g, '/');
      const binary = atob(base64Normalized);
      const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
      const payloadJson = new TextDecoder('utf-8').decode(bytes);
      return JSON.parse(payloadJson || '{}');
    } catch {
      return null;
    }
  }

  getRoles(): string[] {
    return this.getArrayFromStorage('roles');
  }

  getPrivileges(): string[] {
    return this.getArrayFromStorage('privileges');
  }

  getFleetId(): string | null {
    const fleetId = localStorage.getItem(FLEET_ID_KEY);
    return fleetId?.trim() ? fleetId.trim() : null;
  }

  isTokenExpired(token: string | null | undefined): boolean {
    const payload = this.decodePayload(token) as Record<string, unknown> | null;
    const rawExp = payload?.['exp'];
    const exp = rawExp != null ? Number(rawExp) : NaN;

    if (!Number.isFinite(exp) || exp <= 0) {
      return false;
    }

    return Date.now() >= exp * 1000;
  }

  markClosedAt(timestamp: number = Date.now()): void {
    localStorage.setItem(SESSION_CLOSED_AT_KEY, String(timestamp));
  }

  getClosedAt(): number | null {
    const rawValue = localStorage.getItem(SESSION_CLOSED_AT_KEY);
    if (!rawValue) {
      return null;
    }

    const timestamp = Number(rawValue);
    return Number.isFinite(timestamp) ? timestamp : null;
  }

  clearClosedAt(): void {
    localStorage.removeItem(SESSION_CLOSED_AT_KEY);
  }

  private getArrayFromStorage(key: string): string[] {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map(v => String(v).trim()).filter(Boolean) : [];
    } catch {
      return [];
    }
  }
}
