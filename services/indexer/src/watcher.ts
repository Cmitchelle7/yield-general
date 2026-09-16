import type { SupabaseClient } from '@supabase/supabase-js';
import { Server } from '@stellar/stellar-sdk/rpc';

import {
  loadCheckpoint,
  saveCheckpoint,
} from './checkpoints/checkpoint-store.js';
import { createSupabaseClient, loadConfig } from './config.js';
import { decodeVaultEvent, type DecodedVaultEvent } from './decoder.js';
import {
  insertVaultEvents,
  upsertVault,
} from './repositories/vault-repository.js';

const POLL_INTERVAL_MS = 15_000;
const PAGE_LIMIT = 50;

/** Checkpoint stream id for the observed vault's event log. */
export const EVENTS_STREAM = 'yield_vault_events';

/**
 * Persist a decoded batch.
 *
 * `initialize` creates the vault metadata row, so those are applied before the
 * event rows to keep a batch that contains both of them coherent.
 */
async function projectEvents(
  supabase: SupabaseClient,
  events: DecodedVaultEvent[],
): Promise<void> {
  for (const event of events) {
    if (event.vault) {
      await upsertVault(supabase, event.vault, event.ledger);
    }
  }
  await insertVaultEvents(supabase, events);
}

/**
 * Scaffold-only behaviour retained from the Phase 0 poller: the read API and
 * web dashboard still consume `pool_snapshots`. Replacing this with real vault
 * state requires contract state reads, which are Phase 5 work.
 */
async function recordScaffoldSnapshot(supabase: SupabaseClient): Promise<void> {
  const tvl = Math.floor(Math.random() * 10_000_000) / 100;
  const dynamicApy = (5 + Math.random() * 5).toFixed(2);
  await supabase.from('pool_snapshots').insert([
    {
      tvl,
      dynamic_apy: Number(dynamicApy),
      timestamp: new Date().toISOString(),
    },
  ]);
}

export async function startWatcher(): Promise<void> {
  const config = loadConfig();
  const supabase = createSupabaseClient(config);
  const server = new Server(config.rpcUrl);

  if (!config.contractId) {
    console.warn(
      'CONTRACT_ID is not configured; there is nothing to observe. Set it in .env after deploying the contract.',
    );
    return;
  }

  if (!supabase) {
    console.warn(
      'Supabase is not configured; the indexer will observe events without persisting them.',
    );
  }

  const checkpoint = supabase
    ? await loadCheckpoint(supabase, EVENTS_STREAM)
    : null;
  let cursor = checkpoint?.cursor ?? 'now';
  let lastLedger = checkpoint?.lastLedger ?? 0;

  if (checkpoint) {
    console.log(
      `Resuming ${EVENTS_STREAM} from cursor ${cursor} (last ledger ${lastLedger}).`,
    );
  } else {
    console.log(
      `No checkpoint stored for ${EVENTS_STREAM}; starting from the current ledger.`,
    );
  }

  let inFlight = false;

  const poll = async (): Promise<void> => {
    // Guard against overlapping runs: two concurrent polls would race the
    // cursor and could write events out of order.
    if (inFlight) {
      return;
    }
    inFlight = true;

    try {
      const response = await server.getEvents({
        cursor,
        filters: [{ type: 'contract', contractIds: [config.contractId] }],
        limit: PAGE_LIMIT,
      });

      const decoded = response.events
        .map(decodeVaultEvent)
        .filter((event): event is DecodedVaultEvent => event !== null);

      if (decoded.length > 0 && supabase) {
        await projectEvents(supabase, decoded);
      }

      const batchMaxLedger = decoded.reduce(
        (max, event) => Math.max(max, event.ledger),
        lastLedger,
      );
      const observedLedger = Math.max(
        batchMaxLedger,
        response.latestLedger ?? 0,
      );

      if (response.cursor && response.cursor !== cursor) {
        cursor = response.cursor;
        if (supabase) {
          await saveCheckpoint(supabase, {
            stream: EVENTS_STREAM,
            cursor,
            lastLedger: observedLedger,
          });
        }
      }
      lastLedger = observedLedger;

      if (decoded.length > 0) {
        console.log(
          `Persisted ${decoded.length} vault event(s) through ledger ${observedLedger}.`,
        );
      }

      if (supabase) {
        await recordScaffoldSnapshot(supabase);
      }
    } catch (error) {
      console.error('Poller error', error);
    } finally {
      inFlight = false;
    }
  };

  await poll();
  setInterval(() => {
    void poll();
  }, POLL_INTERVAL_MS);
}
