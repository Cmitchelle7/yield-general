import { describe, expect, it } from 'vitest';

import {
  VaultClientError,
  decodeAddress,
  decodeAmount,
  decodeBoolean,
  decodeDecimals,
  decodeText,
  decodeVaultState,
} from '../src/index.js';

const I128_MAX = 170141183460469231731687303715884105727n;

/** The native shape `scValToNative` produces for the contract's struct. */
function nativeVaultState(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    admin: 'GADMIN',
    asset: 'CASSET',
    name: 'YieldAnchor Vault',
    symbol: 'yVAULT',
    decimals: 6,
    simulation: true,
    principal: 1_000_000n,
    accrued: 12_345n,
    assets: 1_012_345n,
    shares: 1_000_000n,
    price: 1_000_000_000_000_000_000n,
    last_ts: 1_700_000_000n,
    paused: false,
    ...overrides,
  };
}

describe('decodeVaultState', () => {
  it('maps the contract struct onto the domain shape', () => {
    expect(decodeVaultState(nativeVaultState())).toEqual({
      admin: 'GADMIN',
      asset: 'CASSET',
      name: 'YieldAnchor Vault',
      symbol: 'yVAULT',
      decimals: 6,
      simulation: true,
      principal: 1_000_000n,
      accrued: 12_345n,
      assets: 1_012_345n,
      shares: 1_000_000n,
      price: 1_000_000_000_000_000_000n,
      lastTs: 1_700_000_000,
      paused: false,
    });
  });

  it('keeps 128-bit amounts exact', () => {
    const state = decodeVaultState(
      nativeVaultState({ assets: I128_MAX, shares: I128_MAX }),
    );

    expect(state.assets).toBe(I128_MAX);
    expect(state.shares).toBe(I128_MAX);
  });

  it('rejects a non-object response', () => {
    expect(() => decodeVaultState(null)).toThrow(VaultClientError);
    expect(() => decodeVaultState([1, 2])).toThrow(/Expected vault state/);
    expect(() => decodeVaultState('nope')).toThrow(VaultClientError);
  });

  it('rejects a response with a missing field rather than defaulting it', () => {
    const withoutAssets = nativeVaultState();
    delete withoutAssets.assets;

    expect(() => decodeVaultState(withoutAssets)).toThrow(/vault state assets/);
  });

  it('rejects a response whose field has the wrong type', () => {
    expect(() =>
      decodeVaultState(nativeVaultState({ assets: '1012345' })),
    ).toThrow(/integer amount/);
    expect(() =>
      decodeVaultState(nativeVaultState({ paused: 'false' })),
    ).toThrow(/boolean/);
    expect(() =>
      decodeVaultState(nativeVaultState({ last_ts: I128_MAX })),
    ).toThrow(/small non-negative integer/);
  });
});

describe('scalar decoders', () => {
  it('decode the types the contract returns', () => {
    expect(decodeAddress('GADMIN', 'admin')).toBe('GADMIN');
    expect(decodeAmount(500n, 'assets')).toBe(500n);
    expect(decodeBoolean(true, 'paused')).toBe(true);
    expect(decodeText('yVAULT', 'symbol')).toBe('yVAULT');
    expect(decodeDecimals(6n, 'decimals')).toBe(6);
  });

  it('refuse values of the wrong type', () => {
    expect(() => decodeAddress('', 'admin')).toThrow(/address/);
    expect(() => decodeAmount('500', 'assets')).toThrow(/integer amount/);
    expect(() => decodeBoolean(0, 'paused')).toThrow(/boolean/);
    expect(() => decodeText(5, 'symbol')).toThrow(/string/);
    expect(() => decodeDecimals(-1, 'decimals')).toThrow(/non-negative/);
  });
});
