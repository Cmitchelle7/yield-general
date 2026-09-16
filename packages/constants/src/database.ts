/**
 * Table names and ingestion defaults shared by the indexer and the API.
 *
 * Table names are constants so a rename is a compile-time change in one place
 * rather than a string literal hunted across services.
 */
export const DATABASE_TABLES = {
  vaults: 'vaults',
  vaultEvents: 'vault_events',
  indexerCheckpoints: 'indexer_checkpoints',
  /** Phase 0 scaffold table, still read by the dashboard. */
  poolSnapshots: 'pool_snapshots',
  /** Phase 0 scaffold table, still read by the dashboard. */
  transactionLogs: 'transaction_logs',
} as const;

export type DatabaseTable =
  (typeof DATABASE_TABLES)[keyof typeof DATABASE_TABLES];

/** Column and payload types the indexer relies on. */
export const VAULT_COLUMNS =
  'contract_id, admin, asset, name, symbol, decimals, simulated_yield, created_ledger' as const;

/**
 * Event columns. The amount columns are `numeric(40,0)`, so they are cast to
 * `text`: PostgREST would otherwise hand back lossy JavaScript numbers and
 * silently truncate a 128-bit amount.
 */
export const VAULT_EVENT_COLUMNS =
  'event_id, vault_id, event_type, user_address, assets::text, shares::text, ledger, tx_hash, ledger_closed_at' as const;

export const INDEXER_DEFAULTS = {
  /** How often the poller asks the RPC for new events. */
  pollIntervalMs: 15_000,
  /** Events requested per `getEvents` page. */
  pageLimit: 50,
  /** Server-side event filter type used to scope the query to one contract. */
  contractEventType: 'contract' as const,
};

/**
 * Environment values that appear in `.env.example` and must never be treated as
 * real configuration.
 */
export const PLACEHOLDER_ENV_VALUES = [
  'your_supabase_url_here',
  'your_supabase_key_here',
] as const;
