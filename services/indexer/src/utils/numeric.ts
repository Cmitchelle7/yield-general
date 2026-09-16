/**
 * Helpers for moving decoded integer amounts between the SDK and Postgres.
 *
 * The Phase 1 contract accounts in `i128` base units. `numeric(40,0)` columns
 * are written and read as decimal strings so a 128-bit amount never passes
 * through a JavaScript `number` and loses precision.
 */

/** Convert a decoded integer amount into the string form stored in `numeric` columns. */
export function toNumericString(
  value: bigint | number | null | undefined,
): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'bigint') {
    return value.toString();
  }
  if (!Number.isFinite(value)) {
    return null;
  }
  return String(Math.trunc(value));
}

/** Read a `numeric` column back into a `bigint` without going through a float. */
export function fromNumericString(
  value: string | number | null,
): bigint | null {
  if (value === null) {
    return null;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? BigInt(Math.trunc(value)) : null;
  }
  const trimmed = value.trim();
  if (!/^-?\d+$/.test(trimmed)) {
    return null;
  }
  return BigInt(trimmed);
}

/**
 * Narrow a decoded integer to a JS number for columns that are genuinely small
 * (ledgers, timestamps, decimals). Returns `null` when the value would not be
 * represented exactly, so a corrupted ScVal can never become a wrong ledger.
 */
export function toSafeNumber(value: bigint | number | null): number | null {
  if (value === null) {
    return null;
  }
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) ? value : null;
  }
  const num = Number(value);
  return Number.isSafeInteger(num) ? num : null;
}
