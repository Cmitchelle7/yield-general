import { INDEXER_DEFAULTS } from '@yieldanchor/constants';
import { describe, expect, it } from 'vitest';

import { buildEventsRequest, EVENTS_STREAM } from '../src/watcher.js';

const CONTRACT = 'CB4RKPI55DQOZUPQGVOO4ZUGZ7EPVUZZTR6D7F7F7CYM5OFWOMC3J2IA';

describe('buildEventsRequest', () => {
  it('starts from an explicit ledger when there is no cursor', () => {
    const request = buildEventsRequest(null, 4_706_400, CONTRACT);

    expect(request).toEqual({
      startLedger: 4_706_400,
      filters: [
        { type: INDEXER_DEFAULTS.contractEventType, contractIds: [CONTRACT] },
      ],
      limit: INDEXER_DEFAULTS.pageLimit,
    });
  });

  it('never falls back to the "now" cursor the RPC rejects', () => {
    // The previous cold start sent `cursor: 'now'`, which the Soroban RPC
    // answers with `invalid event id now`. A regression here means a fresh
    // indexer silently ingests nothing.
    const request = buildEventsRequest(null, 4_706_400, CONTRACT);

    expect(request).not.toHaveProperty('cursor');
    expect(JSON.stringify(request)).not.toContain('now');
    expect(request.startLedger).toBe(4_706_400);
  });

  it('pages from the cursor once one exists', () => {
    const request = buildEventsRequest(
      '000004706400-00001',
      4_706_400,
      CONTRACT,
    );

    expect(request).toEqual({
      cursor: '000004706400-00001',
      filters: [
        { type: INDEXER_DEFAULTS.contractEventType, contractIds: [CONTRACT] },
      ],
      limit: INDEXER_DEFAULTS.pageLimit,
    });
    // cursor and startLedger are mutually exclusive on the RPC.
    expect(request).not.toHaveProperty('startLedger');
  });

  it('always scopes the query to the observed contract', () => {
    for (const cursor of [null, 'page-2']) {
      const request = buildEventsRequest(cursor, 1, CONTRACT);
      expect(request.filters).toHaveLength(1);
      expect(request.filters[0]?.contractIds).toEqual([CONTRACT]);
      expect(request.filters[0]?.type).toBe('contract');
    }
  });
});

describe('EVENTS_STREAM', () => {
  it('names the vault event stream', () => {
    expect(EVENTS_STREAM).toBe('yield_vault_events');
  });
});
