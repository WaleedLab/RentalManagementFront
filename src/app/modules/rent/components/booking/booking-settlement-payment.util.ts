/** Shared settlement / mixed-payment helpers for finish & suspend screens. */

export function roundSettlementMoney(value: number): number {
  return Math.max(0, Math.round(value * 100) / 100);
}

export function parseSettlementMoneyInput(value: string): number {
  const raw = String(value ?? '').trim().replace(',', '.');
  if (!raw) {
    return 0;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? roundSettlementMoney(parsed) : 0;
}

/** Empty string for zero so number inputs do not show "." in RTL/locale quirks. */
export function settlementMoneyInputDisplay(value: number | null | undefined): string | number {
  const n = Math.max(0, Number(value) || 0);
  return n > 0 ? n : '';
}

export function distributeSettlementByPaymentType(
  amount: number,
  type: number,
  prevCash: number,
  prevBank: number,
): { paidCash: number; paidBank: number } {
  const n = roundSettlementMoney(amount);
  if (type === 1) {
    return { paidCash: n, paidBank: 0 };
  }
  if ([2, 3, 4].includes(type)) {
    return { paidCash: 0, paidBank: n };
  }
  const cash = Math.max(0, Number(prevCash) || 0);
  const bank = Math.max(0, Number(prevBank) || 0);
  const prevTotal = roundSettlementMoney(cash + bank);
  if (prevTotal > 0.001 && cash > 0.001 && bank > 0.001) {
    const nextCash = roundSettlementMoney((n * cash) / prevTotal);
    return { paidCash: nextCash, paidBank: roundSettlementMoney(n - nextCash) };
  }
  const half = roundSettlementMoney(n / 2);
  return { paidCash: half, paidBank: roundSettlementMoney(n - half) };
}

export function settlementTotalsMatch(a: number, b: number, epsilon = 0.009): boolean {
  return Math.abs(roundSettlementMoney(a) - roundSettlementMoney(b)) <= epsilon;
}

/** Resolve cash/bank split from settlement amount — use before API submit. */
export function resolveSettlementPaidAmounts(
  settlementAmount: number,
  paymentType: number,
  prevCash: number,
  prevBank: number,
): { paidCash: number; paidBank: number; paidTotal: number; settlementTotal: number } {
  const settlementTotal = roundSettlementMoney(settlementAmount);
  const split = distributeSettlementByPaymentType(
    settlementTotal,
    paymentType,
    prevCash,
    prevBank,
  );
  const paidTotal = roundSettlementMoney(split.paidCash + split.paidBank);
  return {
    paidCash: split.paidCash,
    paidBank: split.paidBank,
    paidTotal,
    settlementTotal,
  };
}
