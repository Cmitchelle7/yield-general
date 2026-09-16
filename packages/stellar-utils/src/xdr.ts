import { xdr, scValToNative } from '@stellar/stellar-sdk';

/**
 * Defensive decoding of Soroban `ScVal`s.
 *
 * RPC output is external input: it can be malformed, and it can carry a type
 * the caller did not expect. Every helper here returns `null` (or an empty
 * list) instead of throwing, so one bad value in a batch cannot abort a whole
 * ingest, and no unexpected value can be coerced into a plausible-looking
 * amount.
 */

/** Convert an `ScVal` to native JS, treating hostile or unknown data as absent. */
export function scValToNativeSafe(
  value: xdr.ScVal | undefined | null,
): unknown {
  if (!value) {
    return null;
  }
  try {
    return scValToNative(value);
  } catch {
    return null;
  }
}

/** Non-empty string, or `null`. */
export function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/** Integer, or `null`. Accepts `bigint` and safe-integer `number`. */
export function asBigInt(value: unknown): bigint | null {
  if (typeof value === 'bigint') {
    return value;
  }
  if (typeof value === 'number' && Number.isSafeInteger(value)) {
    return BigInt(value);
  }
  return null;
}

/**
 * Safe-integer number, or `null`.
 *
 * Refuses values that would not survive the conversion, so a huge `i128` can
 * never silently become a wrong ledger sequence.
 */
export function asSafeInteger(value: unknown): number | null {
  const bigintValue = asBigInt(value);
  if (bigintValue === null) {
    return null;
  }
  const num = Number(bigintValue);
  return Number.isSafeInteger(num) ? num : null;
}

/** Array elements, or an empty list when the value is not an array. */
export function asItems(value: unknown): unknown[] {
  return Array.isArray(value) ? (value as unknown[]) : [];
}

/** Decode a topic list into strings, dropping anything that is not a string. */
export function decodeTopics(
  topics: readonly (xdr.ScVal | undefined)[],
): string[] {
  return topics
    .map((topic) => asString(scValToNativeSafe(topic)))
    .filter((topic): topic is string => topic !== null);
}
