import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';

import {
  loadCheckpoint,
  saveCheckpoint,
} from '../src/checkpoints/checkpoint-store.js';

interface FakeResult {
  data: unknown;
  error: { message: string } | null;
}

function createFakeSupabase(result: FakeResult) {
  const calls: string[] = [];
  const payloads: unknown[] = [];

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
    maybeSingle: () => {
      calls.push('maybeSingle');
      return Promise.resolve(result);
    },
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

describe('loadCheckpoint', () => {
  it('returns null when no checkpoint has been stored', async () => {
    const fake = createFakeSupabase({ data: null, error: null });

    await expect(loadCheckpoint(fake.client, 'stream-1')).resolves.toBeNull();
    expect(fake.calls).toContain('from(indexer_checkpoints)');
    expect(fake.calls).toContain('eq(stream,stream-1)');
  });

  it('maps a stored row and coerces a string last_ledger', async () => {
    const fake = createFakeSupabase({
      data: { stream: 'stream-1', cursor: '12345', last_ledger: '900' },
      error: null,
    });

    await expect(loadCheckpoint(fake.client, 'stream-1')).resolves.toEqual({
      stream: 'stream-1',
      cursor: '12345',
      lastLedger: 900,
    });
  });

  it('defaults a missing last_ledger to zero', async () => {
    const fake = createFakeSupabase({
      data: { stream: 'stream-1', cursor: null, last_ledger: null },
      error: null,
    });

    await expect(loadCheckpoint(fake.client, 'stream-1')).resolves.toEqual({
      stream: 'stream-1',
      cursor: null,
      lastLedger: 0,
    });
  });

  it('throws with context when the query fails', async () => {
    const fake = createFakeSupabase({
      data: null,
      error: { message: 'relation does not exist' },
    });

    await expect(loadCheckpoint(fake.client, 'stream-1')).rejects.toThrow(
      'Failed to load checkpoint "stream-1": relation does not exist',
    );
  });
});

describe('saveCheckpoint', () => {
  it('upserts the cursor keyed on the stream', async () => {
    const fake = createFakeSupabase({ data: null, error: null });

    await saveCheckpoint(fake.client, {
      stream: 'stream-1',
      cursor: 'cursor-9',
      lastLedger: 99,
    });

    expect(fake.calls).toContain('from(indexer_checkpoints)');
    expect(fake.calls).toContain('upsert({"onConflict":"stream"})');

    const payload = fake.payloads[0] as Record<string, unknown>;
    expect(payload.stream).toBe('stream-1');
    expect(payload.cursor).toBe('cursor-9');
    expect(payload.last_ledger).toBe(99);
    expect(typeof payload.updated_at).toBe('string');
    expect(Number.isNaN(Date.parse(payload.updated_at as string))).toBe(false);
  });

  it('throws with context when the write fails', async () => {
    const fake = createFakeSupabase({
      data: null,
      error: { message: 'permission denied' },
    });

    await expect(
      saveCheckpoint(fake.client, {
        stream: 'stream-1',
        cursor: null,
        lastLedger: 0,
      }),
    ).rejects.toThrow(
      'Failed to save checkpoint "stream-1": permission denied',
    );
  });
});
