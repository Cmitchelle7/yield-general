/**
 * Ledger-time helpers.
 *
 * Soroban exposes a ledger timestamp and a ledger sequence, but not the close
 * time of a ledger that has not closed yet. Anything that needs to reason about
 * "when" must be explicit about which of the two it means.
 */

/**
 * Assumed ledger close interval, in seconds.
 *
 * This is an estimate for display and scheduling only. Stellar does not
 * guarantee a close rate, so nothing that affects accounting may depend on it —
 * the contract reads `env.ledger().timestamp()` instead.
 */
export const LEDGER_CLOSE_SECONDS = 5;

/** Convert a span in ledgers to seconds, using the assumed close interval. */
export function ledgersToSeconds(ledgers: number): number {
  return ledgers * LEDGER_CLOSE_SECONDS;
}

/** Convert a span in seconds to an approximate number of ledgers. */
export function secondsToLedgers(seconds: number): number {
  return Math.floor(seconds / LEDGER_CLOSE_SECONDS);
}

/** Estimate the timestamp of a future ledger, given a closed ledger's timestamp. */
export function estimateTimestampAtLedger(
  fromLedger: number,
  fromTimestamp: number,
  targetLedger: number,
): number {
  return fromTimestamp + ledgersToSeconds(targetLedger - fromLedger);
}

/**
 * Seconds between two ledger timestamps, floored at zero.
 *
 * The contract clamps the same way: a timestamp that appears to move backwards
 * must not un-accrue or double-accrue yield.
 */
export function elapsedSeconds(from: number, to: number): number {
  return to > from ? to - from : 0;
}
