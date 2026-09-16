import type { AmountString, StellarAddress } from './vault.js';

/**
 * Row shapes for the Phase 2 tables defined in
 * `database/migrations/002_create_protocol_tables.sql` (and the Phase 0
 * scaffold migration before it).
 *
 * These mirror the columns rather than the domain: names are `snake_case`, and
 * amount columns are decimal **strings**, because `numeric(40,0)` holds a
 * signed 128-bit value that neither `number` nor JSON can carry exactly.
 */

/** A row of `vaults`. */
export interface VaultRow {
  contract_id: StellarAddress;
  admin: StellarAddress;
  asset: StellarAddress;
  name: string;
  symbol: string;
  decimals: number;
  simulated_yield: boolean;
  created_ledger: number | null;
}

/** A row of `vault_events`. */
export interface VaultEventRow {
  /** Soroban event id; the dedup key. */
  event_id: string;
  vault_id: StellarAddress;
  event_type: string;
  user_address: StellarAddress | null;
  assets: AmountString | null;
  shares: AmountString | null;
  ledger: number;
  tx_hash: string;
  ledger_closed_at: string | null;
}

/** A row of `indexer_checkpoints`. */
export interface IndexerCheckpointRow {
  /** Checkpoint stream id. */
  stream: string;
  /** Opaque RPC cursor; `null` before the first page is read. */
  cursor: string | null;
  last_ledger: number | string | null;
}

/**
 * A row of the Phase 0 scaffold's `pool_snapshots`.
 *
 * Still written by the watcher and read by the existing dashboard. It holds
 * placeholder values, not vault accounting.
 */
export interface PoolSnapshotRow {
  tvl: number;
  dynamic_apy: number;
  timestamp: string;
}
