import type { SupabaseClient } from '@supabase/supabase-js';
import {
  DATABASE_TABLES,
  VAULT_COLUMNS,
  VAULT_EVENT_COLUMNS,
} from '@yieldanchor/constants';
import type {
  VaultEventRecord,
  VaultEventRow,
  VaultRow,
  VaultSummary,
} from '@yieldanchor/shared-types';

/**
 * Read-side repository for the vault projection (Phase 2).
 *
 * These functions are the data-access boundary only; wiring them to routes is
 * Phase 5 ("read-only API projections").
 *
 * Amounts are exposed as decimal **strings**, not `bigint` or `number`:
 *   - `numeric(40,0)` holds signed 128-bit values, and PostgREST would turn
 *     those into lossy JavaScript numbers when serialised as JSON, so the
 *     queries below cast them to `text`.
 *   - `bigint` cannot be JSON-serialised at all, so a string is the correct
 *     shape for an HTTP boundary.
 *
 * The row shapes and the DTOs live in `@yieldanchor/shared-types` so the
 * indexer and the API cannot drift apart on a column name or an amount encoding.
 */

export type { VaultEventRecord, VaultSummary };

export function mapVaultRow(row: VaultRow): VaultSummary {
  return {
    contractId: row.contract_id,
    admin: row.admin,
    asset: row.asset,
    name: row.name,
    symbol: row.symbol,
    decimals: row.decimals,
    simulatedYield: row.simulated_yield,
    createdLedger: row.created_ledger ?? null,
  };
}

export function mapVaultEventRow(row: VaultEventRow): VaultEventRecord {
  return {
    eventId: row.event_id,
    vaultId: row.vault_id,
    eventType: row.event_type,
    userAddress: row.user_address,
    assets: row.assets,
    shares: row.shares,
    ledger: row.ledger,
    txHash: row.tx_hash,
    ledgerClosedAt: row.ledger_closed_at,
  };
}

export async function listVaults(
  supabase: SupabaseClient,
): Promise<VaultSummary[]> {
  const { data, error } = await supabase
    .from(DATABASE_TABLES.vaults)
    .select(VAULT_COLUMNS)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to list vaults: ${error.message}`);
  }
  return ((data ?? []) as VaultRow[]).map(mapVaultRow);
}

export async function getVault(
  supabase: SupabaseClient,
  contractId: string,
): Promise<VaultSummary | null> {
  const { data, error } = await supabase
    .from(DATABASE_TABLES.vaults)
    .select(VAULT_COLUMNS)
    .eq('contract_id', contractId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load vault "${contractId}": ${error.message}`);
  }
  return data ? mapVaultRow(data as VaultRow) : null;
}

export async function listVaultEvents(
  supabase: SupabaseClient,
  vaultId: string,
  limit = 100,
): Promise<VaultEventRecord[]> {
  const { data, error } = await supabase
    .from(DATABASE_TABLES.vaultEvents)
    .select(VAULT_EVENT_COLUMNS)
    .eq('vault_id', vaultId)
    .order('ledger', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(
      `Failed to list events for vault "${vaultId}": ${error.message}`,
    );
  }
  return ((data ?? []) as VaultEventRow[]).map(mapVaultEventRow);
}

export async function listUserEvents(
  supabase: SupabaseClient,
  userAddress: string,
  limit = 100,
): Promise<VaultEventRecord[]> {
  const { data, error } = await supabase
    .from(DATABASE_TABLES.vaultEvents)
    .select(VAULT_EVENT_COLUMNS)
    .eq('user_address', userAddress)
    .order('ledger', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(
      `Failed to list events for "${userAddress}": ${error.message}`,
    );
  }
  return ((data ?? []) as VaultEventRow[]).map(mapVaultEventRow);
}
