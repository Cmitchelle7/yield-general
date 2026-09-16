/**
 * Helpers for moving decoded integer amounts between the SDK, Postgres and
 * JSON.
 *
 * The Phase 1 contract accounts in `i128` base units. `numeric(40,0)` columns
 * are written and read as decimal strings so a 128-bit amount never passes
 * through a JavaScript `number` and loses precision.
 */

/** Largest value representable in the contract's `i128` accounting. */
export const I128_MAX = 170141183460469231731687303715884105727n;

/** Smallest value representable in the contract's `i128` accounting. */
export const I128_MIN = -170141183460469231731687303715884105728n;

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

/** Whether a value fits the contract's `i128` range. */
export function isI128(value: bigint): boolean {
  return value >= I128_MIN && value <= I128_MAX;
}

export class IntegerRangeError extends RangeError {
  constructor(message: string) {
    super(message);
    this.name = 'IntegerRangeError';
  }
}

/** Throw unless the value fits `i128`. */
export function assertI128(value: bigint, label = 'value'): bigint {
  if (!isI128(value)) {
    throw new IntegerRangeError(`${label} does not fit in i128: ${value}`);
  }
  return value;
}

/**
 * `(a * b) / denominator` using arbitrary-precision integers.
 *
 * TypeScript has no fixed-width overflow at runtime, so this cannot wrap the
 * way the contract's checked arithmetic can. It is for previewing what the
 * contract will compute, not a substitute for it: the result is not itself
 * range-checked, and division truncates toward zero, matching Rust's integer
 * division for the non-negative operands the vault accepts.
 */
export function mulDivTrunc(a: bigint, b: bigint, denominator: bigint): bigint {
  if (denominator === 0n) {
    throw new IntegerRangeError('Division by zero');
  }
  return (a * b) / denominator;
}
