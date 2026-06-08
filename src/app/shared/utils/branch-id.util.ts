/** Branch id from JWT login session; `0` when missing or invalid. */
export function loginBranchId(loginBranchIdClaim: string | number | null | undefined): number {
  const n = Number(String(loginBranchIdClaim ?? '').trim());
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0;
}

/** Branch id from JWT; `null` when missing (e.g. admin without branch claim). */
export function loginBranchIdOrNull(
  loginBranchIdClaim: string | number | null | undefined,
): number | null {
  const n = Number(String(loginBranchIdClaim ?? '').trim());
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

/** Positive branch id or `0`. */
export function normalizeBranchId(value: string | number | null | undefined): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0;
}

/**
 * Contract payment branch: selected vehicle branch first, then booking branch, then login branch.
 */
export function resolveContractPaymentBranch(params: {
  vehicleBranchId?: number | null;
  bookingBranchId?: number | null;
  loginBranchId?: string | number | null;
}): number {
  const fromVehicle = normalizeBranchId(params.vehicleBranchId);
  if (fromVehicle > 0) {
    return fromVehicle;
  }
  const fromBooking = normalizeBranchId(params.bookingBranchId);
  if (fromBooking > 0) {
    return fromBooking;
  }
  return loginBranchId(params.loginBranchId);
}

/** Resolves branch for create/update payloads: positive id or `null` (never `0`). */
export function resolveBranchIdForPayload(
  idBranch: number | null | undefined,
): number | null {
  if (idBranch === null || idBranch === undefined) {
    return null;
  }
  const normalized = normalizeBranchId(idBranch);
  return normalized > 0 ? normalized : null;
}

/** Payload keys for ASP.NET commands expecting both casings. */
export function withBranchIdPayload<T extends object>(
  payload: T,
  idBranch: number | null | undefined,
): T & { idBranch: number | null; IdBranch: number | null } {
  const branch = resolveBranchIdForPayload(idBranch);
  return {
    ...payload,
    idBranch: branch,
    IdBranch: branch,
  };
}

/** Query params for list endpoints (`GetCashsQuery`, etc.). */
export function buildBranchQueryParams(idBranch: number | null | undefined): Record<string, string> {
  const branch = idBranch === null || idBranch === undefined ? 0 : normalizeBranchId(idBranch);
  return {
    IdBranch: String(branch),
    idBranch: String(branch),
    BranchId: String(branch),
  };
}
