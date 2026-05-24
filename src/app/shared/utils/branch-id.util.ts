/** Branch id from JWT login session; `0` when missing or invalid. */
export function loginBranchId(loginBranchIdClaim: string | number | null | undefined): number {
  const n = Number(String(loginBranchIdClaim ?? '').trim());
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0;
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

/** Payload keys for ASP.NET commands expecting both casings. */
export function withBranchIdPayload<T extends object>(
  payload: T,
  idBranch: number,
): T & { idBranch: number; IdBranch: number } {
  const branch = normalizeBranchId(idBranch);
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
