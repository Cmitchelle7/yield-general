import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';

import {
  getVault,
  listUserEvents,
  listVaultEvents,
  listVaults,
  mapVaultEventRow,
  mapVaultRow,
} from '../src/repositories/vault-repository.js';

interface FakeResult {
  data: unknown;
  error: { message: string } | null;
}

function createFakeSupabase(result: FakeResult) {
  const calls: string[] = [];

  const chain: Record<string, unknown> = {};
  Object.assign(chain, {
    select: (columns: string) => {
      calls.push(`select(${columns})`);
      return chain;
    },
    eq: (column: string, value: unknown) => {
      calls.push(`eq(${column},${String(value)})`);
      return chain;
    },
    order: (column: string) => {
      calls.push(`order(${column})`);
      return chain;
    },
    limit: (count: number) => {
      calls.push(`limit(${count})`);
      return chain;
    },
    maybeSingle: () => {
      calls.push('maybeSingle');
      return Promise.resolve(result);
    },
    then: (resolve: (value: FakeResult) => unknown) =>
      Promise.resolve(result).then(resolve),
  });

  const client = {
    from: (table: string) => {
      calls.push(`from(${table})`);
      return chain;
    },
  };

  return { client: client as unknown as SupabaseClient, calls };
}

describe('mapVaultRow', () => {
  it('maps database columns onto the API shape', () => {
    expect(
      mapVaultRow({
        contract_id: 'CABCDEF',
        admin: 'GADMIN',
        asset: 'GASSET',
        name: 'YieldAnchor Vault',
        symbol: 'yVAULT',
        decimals: 6,
        simulated_yield: true,
        created_ledger: 1234,
      }),
    ).toEqual({
      contractId: 'CABCDEF',
      admin: 'GADMIN',
      asset: 'GASSET',
      name: 'YieldAnchor Vault',
      symbol: 'yVAULT',
      decimals: 6,
      simulatedYield: true,
      createdLedger: 1234,
    });
  });

  it('normalises a missing created ledger to null', () => {
    const summary = mapVaultRow({
      contract_id: 'CABCDEF',
      admin: 'GADMIN',
      asset: 'GASSET',
      name: 'V',
      symbol: 'V',
      decimals: 6,
      simulated_yield: false,
      created_ledger: null,
    });

    expect(summary.createdLedger).toBeNull();
  });
});

describe('mapVaultEventRow', () => {
  it('keeps 128-bit amounts as exact strings for JSON transport', () => {
    const record = mapVaultEventRow({
      event_id: 'event-1',
      vault_id: 'CABCDEF',
      event_type: 'deposit',
      user_address: 'GUSER',
      assets: '170141183460469231731687303715884105727',
      shares: '170141183460469231731687303715884105727',
      ledger: 1000,
      tx_hash: 'deadbeef',
      ledger_closed_at: '2026-01-01T00:00:00Z',
    });

    expect(record.assets).toBe('170141183460469231731687303715884105727');
    expect(record.shares).toBe('170141183460469231731687303715884105727');
    expect(typeof record.assets).toBe('string');
  });

  it('passes null amounts through', () => {
    const record = mapVaultEventRow({
      event_id: 'event-2',
      vault_id: 'CABCDEF',
      event_type: 'pause',
      user_address: null,
      assets: null,
      shares: null,
      ledger: 1001,
      tx_hash: 'cafebabe',
      ledger_closed_at: null,
    });

    expect(record.assets).toBeNull();
    expect(record.shares).toBeNull();
    expect(record.userAddress).toBeNull();
    expect(record.ledgerClosedAt).toBeNull();
  });
});

describe('queries', () => {
  it('casts numeric columns to text so amounts cannot be lossily coerced', async () => {
    const fake = createFakeSupabase({ data: [], error: null });

    await listVaultEvents(fake.client, 'CABCDEF');

    const selectCall = fake.calls.find((call) => call.startsWith('select('));
    expect(selectCall).toContain('assets::text');
    expect(selectCall).toContain('shares::text');
    expect(fake.calls).toContain('eq(vault_id,CABCDEF)');
    expect(fake.calls).toContain('limit(100)');
  });

  it('filters user events by address', async () => {
    const fake = createFakeSupabase({ data: [], error: null });

    await listUserEvents(fake.client, 'GUSER', 25);

    expect(fake.calls).toContain('from(vault_events)');
    expect(fake.calls).toContain('eq(user_address,GUSER)');
    expect(fake.calls).toContain('limit(25)');
  });

  it('returns an empty list rather than null data', async () => {
    const fake = createFakeSupabase({ data: null, error: null });

    await expect(listVaults(fake.client)).resolves.toEqual([]);
  });

  it('returns null when a vault is not projected yet', async () => {
    const fake = createFakeSupabase({ data: null, error: null });

    await expect(getVault(fake.client, 'CMISSING')).resolves.toBeNull();
    expect(fake.calls).toContain('eq(contract_id,CMISSING)');
    expect(fake.calls).toContain('maybeSingle');
  });

  it('throws with context when a query fails', async () => {
    const fake = createFakeSupabase({
      data: null,
      error: { message: 'permission denied' },
    });

    await expect(listVaults(fake.client)).rejects.toThrow(
      'Failed to list vaults: permission denied',
    );
  });
});
