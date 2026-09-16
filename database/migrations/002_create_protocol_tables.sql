-- Migration: create the Phase 2 vault projection and indexer checkpoint tables.
--
-- These tables are a DERIVED READ MODEL. The Soroban contract is authoritative
-- for protocol state; everything here is rebuilt from observed chain events and
-- must never be treated as the source of truth.
--
-- Amount columns use numeric(40,0) because the Phase 1 contract accounts in
-- i128 integer base units. Values are written and read as decimal strings so a
-- 128-bit amount never passes through a JavaScript number.

-- One row per deployed YieldVault contract, derived from its `initialize` event.
create table if not exists vaults (
  contract_id text primary key,
  admin text not null,
  asset text not null,
  name text not null,
  symbol text not null,
  decimals smallint not null,
  simulated_yield boolean not null default false,
  created_ledger bigint,
  created_at timestamptz not null default now()
);

-- Append-only projection of decoded vault events.
-- event_id is the Soroban event id, which is globally unique, so re-indexing a
-- ledger range is idempotent.
-- vault_id is intentionally NOT a foreign key. The indexer can start from
-- `now`, so it may observe deposits for a vault whose `initialize` predates its
-- cursor; a FK would reject and silently drop that whole batch.
create table if not exists vault_events (
  event_id text primary key,
  vault_id text not null,
  event_type text not null,
  user_address text,
  assets numeric(40,0),
  shares numeric(40,0),
  ledger bigint not null,
  tx_hash text not null,
  ledger_closed_at timestamptz,
  ingested_at timestamptz not null default now()
);

create index if not exists vault_events_vault_ledger_idx
  on vault_events (vault_id, ledger desc);

create index if not exists vault_events_user_idx
  on vault_events (user_address)
  where user_address is not null;

-- Per-stream ingestion cursor. One row per observed stream so the indexer can
-- resume after a restart instead of replaying or skipping ledgers.
create table if not exists indexer_checkpoints (
  stream text primary key,
  cursor text,
  last_ledger bigint not null default 0,
  updated_at timestamptz not null default now()
);
