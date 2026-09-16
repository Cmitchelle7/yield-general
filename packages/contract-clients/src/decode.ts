import type {
  Amount,
  StellarAddress,
  VaultState,
} from '@yieldanchor/shared-types';
import { asBigInt, asSafeInteger, asString } from '@yieldanchor/stellar-utils';

import { VaultClientError } from './errors.js';

/**
 * Contract return values arrive as native JS values with no type information.
 *
 * Every field is therefore checked rather than cast: a malformed or unexpected
 * response must raise a clear error instead of producing a plausible-looking
 * balance. Unknown fields are ignored so a contract addition does not break
 * older clients.
 */

function field(source: Record<string, unknown>, label: string): unknown {
  return source[label];
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new VaultClientError(
      `Expected ${label} to decode to an object, received ${typeof value}`,
    );
  }
  return value as Record<string, unknown>;
}

export function decodeAddress(value: unknown, label: string): StellarAddress {
  const decoded = asString(value);
  if (decoded === null) {
    throw new VaultClientError(`Expected ${label} to be an address`);
  }
  return decoded;
}

export function decodeAmount(value: unknown, label: string): Amount {
  const decoded = asBigInt(value);
  if (decoded === null) {
    throw new VaultClientError(`Expected ${label} to be an integer amount`);
  }
  return decoded;
}

export function decodeBoolean(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') {
    throw new VaultClientError(`Expected ${label} to be a boolean`);
  }
  return value;
}

export function decodeText(value: unknown, label: string): string {
  const decoded = asString(value);
  if (decoded === null) {
    throw new VaultClientError(`Expected ${label} to be a string`);
  }
  return decoded;
}

export function decodeDecimals(value: unknown, label: string): number {
  const decoded = asSafeInteger(value);
  if (decoded === null || decoded < 0) {
    throw new VaultClientError(
      `Expected ${label} to be a small non-negative integer`,
    );
  }
  return decoded;
}

/** Decode `get_vault_state` into the domain shape the rest of the stack uses. */
export function decodeVaultState(native: unknown): VaultState {
  const source = asRecord(native, 'vault state');

  return {
    admin: decodeAddress(field(source, 'admin'), 'vault state admin'),
    asset: decodeAddress(field(source, 'asset'), 'vault state asset'),
    name: decodeText(field(source, 'name'), 'vault state name'),
    symbol: decodeText(field(source, 'symbol'), 'vault state symbol'),
    decimals: decodeDecimals(field(source, 'decimals'), 'vault state decimals'),
    simulation: decodeBoolean(
      field(source, 'simulation'),
      'vault state simulation flag',
    ),
    principal: decodeAmount(
      field(source, 'principal'),
      'vault state principal',
    ),
    accrued: decodeAmount(field(source, 'accrued'), 'vault state accrued'),
    assets: decodeAmount(field(source, 'assets'), 'vault state assets'),
    shares: decodeAmount(field(source, 'shares'), 'vault state shares'),
    price: decodeAmount(field(source, 'price'), 'vault state price'),
    lastTs: decodeDecimals(field(source, 'last_ts'), 'vault state last_ts'),
    paused: decodeBoolean(field(source, 'paused'), 'vault state paused flag'),
  };
}
