import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Ingestion cursor persistence.
 *
 * Without a stored cursor the poller restarts from `now` on every boot and
 * silently skips everything that happened while it was down. The checkpoint is
 * what makes resume-after-restart possible.
 */

export interface IndexerCheckpoint {
  stream: string;
  cursor: string | null;
  lastLedger: number;
}

interface CheckpointRow {
  stream: string;
  cursor: string | null;
  last_ledger: number | string | null;
}

export async function loadCheckpoint(
  supabase: SupabaseClient,
  stream: string,
): Promise<IndexerCheckpoint | null> {
  const { data, error } = await supabase
    .from('indexer_checkpoints')
    .select('stream, cursor, last_ledger')
    .eq('stream', stream)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load checkpoint "${stream}": ${error.message}`);
  }
  if (!data) {
    return null;
  }

  const row = data as CheckpointRow;
  return {
    stream: row.stream,
    cursor: row.cursor,
    lastLedger: Number(row.last_ledger ?? 0),
  };
}

export async function saveCheckpoint(
  supabase: SupabaseClient,
  checkpoint: IndexerCheckpoint,
): Promise<void> {
  const { error } = await supabase.from('indexer_checkpoints').upsert(
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
