import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  BPS_DENOM,
  INDEXER_DEFAULTS,
  INDEXER_EVENTS_STREAM,
  MAX_VAULT_DECIMALS,
  PLACEHOLDER_ENV_VALUES,
  PRICE_SCALE,
  SIMULATED_YIELD,
  SIM_APY_BPS,
  SIM_YEAR_SECONDS,
  STELLAR_NETWORK_PASSPHRASES,
  VAULT_ERROR_CODES,
  VAULT_EVENT_TOPIC_VALUES,
  VAULT_EVENT_TOPICS,
  YIELD_DENOM,
  isVaultEventTopic,
  vaultErrorName,
} from '../src/index.js';

/**
 * The contract crate is the source of truth for the event topics, the error
 * codes, and the protocol parameters. Reading it here turns "keep these in
 * sync" from a comment into a failing test.
 */
const CONTRACT_SOURCE = readFileSync(
  fileURLToPath(
    new URL('../../../contracts/yield_vault/src/lib.rs', import.meta.url),
  ),
  'utf8',
);

/**
 * Read a numeric `pub const` out of the crate, with Rust's `_` separators
 * removed so the value can be compared directly.
 */
function contractConst(name: string): string | null {
  const match = new RegExp(`const ${name}: [a-z0-9]+ = ([^;]+);`).exec(
    CONTRACT_SOURCE,
  );
  return match ? match[1].replace(/_/g, '').trim() : null;
}

describe('vault event topics', () => {
  it('matches every topic the contract publishes', () => {
    const published = Array.from(
      CONTRACT_SOURCE.matchAll(/publish\(\s*\(\s*"([a-z_]+)"/g),
    ).map((match) => match[1]);

    expect(published.length).toBeGreaterThan(0);
    expect([...new Set(published)].sort()).toEqual(
      [...VAULT_EVENT_TOPIC_VALUES].sort(),
    );
  });

  it('exposes the readable key for each wire topic', () => {
    expect(VAULT_EVENT_TOPICS.yieldAccrued).toBe('yield');
    expect(VAULT_EVENT_TOPICS.shareMint).toBe('share_mint');
    expect(VAULT_EVENT_TOPICS.shareBurn).toBe('share_burn');
  });

  it('recognises only known topics', () => {
    expect(isVaultEventTopic('deposit')).toBe(true);
    expect(isVaultEventTopic('withdraw')).toBe(true);
    expect(isVaultEventTopic('transfer')).toBe(false);
    expect(isVaultEventTopic('')).toBe(false);
    expect(isVaultEventTopic(undefined)).toBe(false);
    expect(isVaultEventTopic('DEPOSIT')).toBe(false);
  });
});

describe('vault error codes', () => {
  it('matches the Rust VaultError enum exactly', () => {
    const declared = Object.fromEntries(
      Array.from(CONTRACT_SOURCE.matchAll(/^\s{4}([A-Za-z]+) = (\d+),$/gm)).map(
        (match) => [match[1], Number(match[2])],
      ),
    );

    expect(declared).toEqual({ ...VAULT_ERROR_CODES });
  });

  it('numbers the codes without gaps or duplication', () => {
    const codes = Object.values(VAULT_ERROR_CODES).sort((a, b) => a - b);

    expect(codes).toEqual(
      Array.from({ length: codes.length }, (_, index) => index + 1),
    );
  });

  it('resolves a code back to its name', () => {
    expect(vaultErrorName(VAULT_ERROR_CODES.Paused)).toBe('Paused');
    expect(vaultErrorName(VAULT_ERROR_CODES.NoShares)).toBe('NoShares');
    expect(vaultErrorName(999)).toBeNull();
  });
});

describe('protocol parameters', () => {
  it('keeps the simulated-yield denominators consistent', () => {
    expect(SIMULATED_YIELD).toBe(true);
    expect(BPS_DENOM).toBe(10_000);
    expect(SIM_APY_BPS).toBe(800);
    expect(SIM_YEAR_SECONDS).toBe(31_536_000);
    expect(YIELD_DENOM).toBe(BPS_DENOM * SIM_YEAR_SECONDS);
  });

  it('scales the share price by 1e18', () => {
    expect(PRICE_SCALE).toBe(10n ** 18n);
  });

  it('mirrors the contract constants', () => {
    expect(SIM_YEAR_SECONDS).toBe(31_536_000);
    expect(contractConst('SIM_APY_BPS')).toBe(String(SIM_APY_BPS));
    expect(contractConst('BPS_DENOM')).toBe(String(BPS_DENOM));
    expect(contractConst('SIM_YEAR')).toBe(String(SIM_YEAR_SECONDS));
    expect(contractConst('MAX_DECIMALS')).toBe(String(MAX_VAULT_DECIMALS));
    expect(contractConst('PRICE_SCALE')).toBe(PRICE_SCALE.toString());
  });
});

describe('network parameters', () => {
  it('uses the published passphrases', () => {
    expect(STELLAR_NETWORK_PASSPHRASES.testnet).toBe(
      'Test SDF Network ; September 2015',
    );
    expect(STELLAR_NETWORK_PASSPHRASES.mainnet).toBe(
      'Public Global Stellar Network ; September 2015',
    );
  });
});

describe('ingestion defaults', () => {
  it('keeps the checkpoint stream id stable', () => {
    expect(INDEXER_EVENTS_STREAM).toBe('yield_vault_events');
  });

  it('scopes event queries to a single contract', () => {
    expect(INDEXER_DEFAULTS.contractEventType).toBe('contract');
    expect(INDEXER_DEFAULTS.pageLimit).toBeGreaterThan(0);
    expect(INDEXER_DEFAULTS.pollIntervalMs).toBeGreaterThan(0);
  });

  it('lists the placeholder values that must never be treated as config', () => {
    expect(PLACEHOLDER_ENV_VALUES).toContain('your_supabase_url_here');
    expect(PLACEHOLDER_ENV_VALUES).toContain('your_supabase_key_here');
  });
});
