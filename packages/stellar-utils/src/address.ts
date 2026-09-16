import { StrKey } from '@stellar/stellar-sdk';

/**
 * Stellar address validation.
 *
 * Validation is checksum-based (`StrKey`), not prefix-based: a string that
 * merely starts with `G` or `C` is not a usable address, and sending one to a
 * contract call fails on-chain after the user has already approved it.
 */

/** Whether the value is a valid Stellar account address (`G...`). */
export function isValidAccountId(value: string): boolean {
  return StrKey.isValidEd25519PublicKey(value);
}

/** Whether the value is a valid Soroban contract id (`C...`). */
export function isValidContractId(value: string): boolean {
  return StrKey.isValidContract(value);
}

/** Whether the value is either a valid account address or a contract id. */
export function isValidStellarAddress(value: string): boolean {
  return isValidAccountId(value) || isValidContractId(value);
}

/**
 * Shorten an address for display: `GABC...WXYZ`.
 *
 * This is a presentation helper only. Never pass a shortened address back to
 * the network.
 */
export function shortenAddress(value: string, visible = 4): string {
  if (!Number.isInteger(visible) || visible < 1) {
    throw new RangeError(`visible must be a positive integer: ${visible}`);
  }
  if (value.length <= visible * 2 + 3) {
    return value;
  }
  return `${value.slice(0, visible)}...${value.slice(-visible)}`;
}
