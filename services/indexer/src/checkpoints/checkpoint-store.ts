import type { SupabaseClient } from '@supabase/supabase-js';
import { DATABASE_TABLES } from '@yieldanchor/constants';
import type {
  IndexerCheckpoint,
  IndexerCheckpointRow,
} from '@yieldanchor/shared-types';
import { fromNumericString, toSafeNumber } from '@yieldanchor/stellar-utils';

/**
 * Ingestion cursor persistence.
 *
 * Without a stored cursor the poller restarts from `now` on every boot and
 * silently skips everything that happened while it was down. The checkpoint is
 * what makes resume-after-restart possible.
 */

export type { IndexerCheckpoint };

export async function loadCheckpoint(
  supabase: SupabaseClient,
  stream: string,
): Promise<IndexerCheckpoint | null> {
  const { data, error } = await supabase
    .from(DATABASE_TABLES.indexerCheckpoints)
    .select('stream, cursor, last_ledger')
    .eq('stream', stream)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load checkpoint "${stream}": ${error.message}`);
  }
  if (!data) {
    return null;
  }

  const row = data as IndexerCheckpointRow;
  return {
    stream: row.stream,
    cursor: row.cursor,
    // `last_ledger` comes back as `numeric`; convert exactly and refuse a value
    // that would not survive the narrowing rather than reporting a wrong ledger.
    lastLedger: toSafeNumber(fromNumericString(row.last_ledger)) ?? 0,
  };
}

export async function saveCheckpoint(
  supabase: SupabaseClient,
  checkpoint: IndexerCheckpoint,
): Promise<void> {
  const { error } = await supabase
    .from(DATABASE_TABLES.indexerCheckpoints)
    .upsert(
      {
        stream: checkpoint.stream,
        cursor: checkpoint.cursor,
        last_ledger: checkpoint.lastLedger,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'stream' },
    );

  if (error) {
    throw new Error(
      `Failed to save checkpoint "${checkpoint.stream}": ${error.message}`,
    );
  }
}
