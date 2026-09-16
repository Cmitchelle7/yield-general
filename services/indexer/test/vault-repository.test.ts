import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';

import type { DecodedVaultEvent, VaultMetadata } from '../src/decoder.js';
import {
  insertVaultEvents,
  toVaultEventRow,
  toVaultRow,
  upsertVault,
} from '../src/repositories/vault-repository.js';

const I128_MAX = 170141183460469231731687303715884105727n;

interface FakeResult {
  error: { message: string } | null;
}

function createFakeSupabase(result: FakeResult = { error: null }) {
  const calls: string[] = [];
  const payloads: unknown[] = [];

  const chain: Record<string, unknown> = {};
  Object.assign(chain, {
    upsert: (values: unknown, options?: unknown) => {
      payloads.push(values);
      calls.push(`upsert(${JSON.stringify(options ?? null)})`);
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

  return { client: client as unknown as SupabaseClient, calls, payloads };
}

const VAULT: VaultMetadata = {
  contractId: 'CABCDEF',
  admin: 'GADMIN',
  asset: 'GASSET',
  name: 'YieldAnchor Vault',
  symbol: 'yVAULT',
  decimals: 6,
  simulatedYield: true,
};

function decodedEvent(
  overrides: Partial<DecodedVaultEvent> = {},
): DecodedVaultEvent {
  return {
    eventId: 'event-1',
    vaultId: 'CABCDEF',
    eventType: 'deposit',
    userAddress: 'GUSER',
    assets: 500n,
    shares: 495n,
    ledger: 1000,
    txHash: 'deadbeef',
    ledgerClosedAt: '2026-01-01T00:00:00Z',
    vault: null,
    ...overrides,
  };
}

describe('toVaultRow', () => {
  it('maps decoded metadata onto the vaults table columns', () => {
    expect(toVaultRow(VAULT, 1234)).toEqual({
      contract_id: 'CABCDEF',
      admin: 'GADMIN',
      asset: 'GASSET',
      name: 'YieldAnchor Vault',
      symbol: 'yVAULT',
      decimals: 6,
      simulated_yield: true,
      created_ledger: 1234,
    });
  });
});

describe('toVaultEventRow', () => {
  it('writes amounts as exact decimal strings', () => {
    const row = toVaultEventRow(
      decodedEvent({ assets: I128_MAX, shares: I128_MAX }),
    );

    expect(row.assets).toBe('170141183460469231731687303715884105727');
    expect(row.shares).toBe('170141183460469231731687303715884105727');
  });

  it('writes null for amounts the event does not carry', () => {
    const row = toVaultEventRow(
      decodedEvent({
        eventType: 'pause',
        userAddress: null,
        assets: null,
        shares: null,
      }),
    );

    expect(row.assets).toBeNull();
    expect(row.shares).toBeNull();
    expect(row.user_address).toBeNull();
  });

  it('carries the dedup identity through unchanged', () => {
    const row = toVaultEventRow(decodedEvent());

    expect(row.event_id).toBe('event-1');
    expect(row.vault_id).toBe('CABCDEF');
    expect(row.tx_hash).toBe('deadbeef');
    expect(row.ledger).toBe(1000);
  });
});

describe('upsertVault', () => {
  it('upserts into vaults keyed on the contract id', async () => {
    const fake = createFakeSupabase();

    await upsertVault(fake.client, VAULT, 1234);

    expect(fake.calls).toContain('from(vaults)');
    expect(fake.calls).toContain('upsert({"onConflict":"contract_id"})');
    expect((fake.payloads[0] as Record<string, unknown>).contract_id).toBe(
      'CABCDEF',
    );
  });

  it('throws with the contract id when the write fails', async () => {
    const fake = createFakeSupabase({
      error: { message: 'foreign key violation' },
    });

    await expect(upsertVault(fake.client, VAULT, 1234)).rejects.toThrow(
      'Failed to upsert vault "CABCDEF": foreign key violation',
    );
  });
});

describe('insertVaultEvents', () => {
  it('ignores duplicates on the Soroban event id so replays are idempotent', async () => {
    const fake = createFakeSupabase();

    const inserted = await insertVaultEvents(fake.client, [
      decodedEvent(),
      decodedEvent({ eventId: 'event-2' }),
    ]);

    expect(inserted).toBe(2);
    expect(fake.calls).toContain('from(vault_events)');
    expect(fake.calls).toContain(
      'upsert({"onConflict":"event_id","ignoreDuplicates":true})',
    );
  });

  it('does not touch the database for an empty batch', async () => {
    const fake = createFakeSupabase();

    await expect(insertVaultEvents(fake.client, [])).resolves.toBe(0);
    expect(fake.calls).toEqual([]);
  });

  it('throws with the batch size when the write fails', async () => {
    const fake = createFakeSupabase({ error: { message: 'invalid input' } });

    await expect(
      insertVaultEvents(fake.client, [decodedEvent()]),
    ).rejects.toThrow('Failed to insert 1 vault event(s): invalid input');
  });
});
