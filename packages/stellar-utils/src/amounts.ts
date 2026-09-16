import { PRICE_SCALE } from '@yieldanchor/constants';

/**
 * Exact conversion between integer base units and human-decimal amounts.
 *
 * Everything here is `string` in and `string` or `bigint` out. Nothing uses
 * `parseFloat`, so an amount larger than 2^53 survives the round trip.
 */

/** Matches an optionally signed decimal number: `12`, `-12.5`, `.5`, `12.`. */
const DECIMAL_PATTERN = /^-?(?:\d+(?:\.\d*)?|\.\d+)$/;

/** Render integer base units as a decimal string, e.g. `12345n, 6 -> "0.012345"`. */
export function formatUnits(value: bigint, decimals: number): string {
  if (!Number.isInteger(decimals) || decimals < 0) {
    throw new RangeError(
      `decimals must be a non-negative integer: ${decimals}`,
    );
  }

  const negative = value < 0n;
  const digits = (negative ? -value : value)
    .toString()
    .padStart(decimals + 1, '0');
  const whole = digits.slice(0, digits.length - decimals);
  const fraction = decimals === 0 ? '' : digits.slice(digits.length - decimals);
  const rendered = fraction.length > 0 ? `${whole}.${fraction}` : whole;

  return negative ? `-${rendered}` : rendered;
}

/**
 * Parse a decimal amount into integer base units.
 *
 * Extra decimal places are **rejected** rather than rounded: silently truncating
 * a user's input would move a different amount than they typed.
 */
export function parseUnits(value: string, decimals: number): bigint {
  if (!Number.isInteger(decimals) || decimals < 0) {
    throw new RangeError(
      `decimals must be a non-negative integer: ${decimals}`,
    );
  }
  const trimmed = value.trim();
  if (!DECIMAL_PATTERN.test(trimmed)) {
    throw new SyntaxError(`Not a decimal amount: "${value}"`);
  }

  const negative = trimmed.startsWith('-');
  const unsigned = negative ? trimmed.slice(1) : trimmed;
  const [whole, fraction = ''] = unsigned.split('.');

  if (fraction.length > decimals) {
    throw new SyntaxError(
      `Amount "${value}" has more than ${decimals} decimal places`,
    );
  }

  const padded = fraction.padEnd(decimals, '0');
  const units = BigInt(`${whole || '0'}${padded}`);

  return negative ? -units : units;
}

/** Render a contract share price (scaled by `PRICE_SCALE`) as a decimal string. */
export function formatSharePrice(price: bigint): string {
  return formatUnits(price, 18);
}

/** Whether a string parses as a decimal amount with at most `decimals` places. */
export function isValidAmountString(value: string, decimals: number): boolean {
  try {
    parseUnits(value, decimals);
    return true;
  } catch {
    return false;
  }
}

export { PRICE_SCALE };
