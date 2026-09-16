import { StrKey } from '@stellar/stellar-sdk';
import { describe, expect, it } from 'vitest';

import {
  isValidAccountId,
  isValidContractId,
  isValidStellarAddress,
  shortenAddress,
} from '../src/index.js';

// Generated rather than hard-coded so the fixtures are always checksum-valid.
const ACCOUNT = StrKey.encodeEd25519PublicKey(Buffer.alloc(32, 7));
const CONTRACT = StrKey.encodeContract(Buffer.alloc(32, 9));

describe('account validation', () => {
  it('accepts a checksum-valid account address', () => {
    expect(isValidAccountId(ACCOUNT)).toBe(true);
  });

  it('rejects a contract id where an account is expected', () => {
    expect(isValidAccountId(CONTRACT)).toBe(false);
  });

  it('rejects prefix-only and corrupted values', () => {
    // A single flipped payload character must break the checksum. (The final
    // character is not a reliable target: base32 decoding discards its
    // remainder bits.)
    const corrupted = `${ACCOUNT.slice(0, 10)}${ACCOUNT[10] === 'A' ? 'B' : 'A'}${ACCOUNT.slice(11)}`;

    expect(isValidAccountId('G')).toBe(false);
    expect(isValidAccountId(corrupted)).toBe(false);
    expect(isValidAccountId('')).toBe(false);
    expect(isValidAccountId(ACCOUNT.toLowerCase())).toBe(false);
  });
});

describe('contract validation', () => {
  it('accepts a checksum-valid contract id', () => {
    expect(isValidContractId(CONTRACT)).toBe(true);
  });

  it('rejects an account address and a truncated contract id', () => {
    expect(isValidContractId(ACCOUNT)).toBe(false);
    expect(isValidContractId(CONTRACT.slice(0, 20))).toBe(false);
    expect(isValidContractId('C')).toBe(false);
  });
});

describe('isValidStellarAddress', () => {
  it('accepts either form and rejects everything else', () => {
    expect(isValidStellarAddress(ACCOUNT)).toBe(true);
    expect(isValidStellarAddress(CONTRACT)).toBe(true);
    expect(isValidStellarAddress('GABC')).toBe(false);
    expect(isValidStellarAddress('not an address')).toBe(false);
  });
});

describe('shortenAddress', () => {
  it('abbreviates a long address', () => {
    expect(shortenAddress(ACCOUNT)).toBe(
      `${ACCOUNT.slice(0, 4)}...${ACCOUNT.slice(-4)}`,
    );
  });

  it('leaves short values alone', () => {
    expect(shortenAddress('GABC')).toBe('GABC');
  });

  it('honours a custom visible length', () => {
    expect(shortenAddress(ACCOUNT, 6)).toBe(
      `${ACCOUNT.slice(0, 6)}...${ACCOUNT.slice(-6)}`,
    );
  });

  it('rejects a nonsensical visible length', () => {
    expect(() => shortenAddress(ACCOUNT, 0)).toThrow(RangeError);
  });
});
