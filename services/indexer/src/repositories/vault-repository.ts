import type { SupabaseClient } from '@supabase/supabase-js';

import type { DecodedVaultEvent, VaultMetadata } from '../decoder.js';
import { toNumericString } from '../utils/numeric.js';

/**
 * Write-side repository for the vault projection.
 *
 * Amounts are sent as decimal strings so an `i128` never round-trips through a
 * JavaScript number on its way into a `numeric` column.
 */

export interface VaultRow {
  contract_id: string;
  admin: string;
  asset: string;
  name: string;
  symbol: string;
  decimals: number;
  simulated_yield: boolean;
  created_ledger: number;
}

export interface VaultEventRow {
  event_id: string;
  vault_id: string;
  event_type: string;
  user_address: string | null;
  assets: string | null;
  shares: string | null;
  ledger: number;
  tx_hash: string;
  ledger_closed_at: string | null;
}

export function toVaultRow(vault: VaultMetadata, ledger: number): VaultRow {
  return {
    contract_id: vault.contractId,
    admin: vault.admin,
    asset: vault.asset,
    name: vault.name,
    symbol: vault.symbol,
    decimals: vault.decimals,
    simulated_yield: vault.simulatedYield,
    created_ledger: ledger,
  };
}

export function toVaultEventRow(event: DecodedVaultEvent): VaultEventRow {
  return {
    event_id: event.eventId,
    vault_id: event.vaultId,
    event_type: event.eventType,
    user_address: event.userAddress,
    assets: toNumericString(event.assets),
    shares: toNumericString(event.shares),
    ledger: event.ledger,
    tx_hash: event.txHash,
    ledger_closed_at: event.ledgerClosedAt,
  };
}

export async function upsertVault(
  supabase: SupabaseClient,
  vault: VaultMetadata,
  ledger: number,
): Promise<void> {
  const { error } = await supabase
    .from('vaults')
    .upsert(toVaultRow(vault, ledger), { onConflict: 'contract_id' });

  if (error) {
    throw new Error(
      `Failed to upsert vault "${vault.contractId}": ${error.message}`,
    );
  }
}

/**
 * Append decoded events, ignoring ones already stored.
 *
 * `event_id` is the Soroban event id, so replaying an overlapping ledger range
 * after a restart is idempotent rather than duplicating the log.
 */
export async function insertVaultEvents(
  supabase: SupabaseClient,
  events: DecodedVaultEvent[],
): Promise<number> {
  if (events.length === 0) {
    return 0;
  }

  const rows = events.map(toVaultEventRow);
  const { error } = await supabase.from('vault_events').upsert(rows, {
    onConflict: 'event_id',
    ignoreDuplicates: true,
  });

  if (error) {
    throw new Error(
      `Failed to insert ${rows.length} vault event(s): ${error.message}`,
    );
  }
  return rows.length;
}
