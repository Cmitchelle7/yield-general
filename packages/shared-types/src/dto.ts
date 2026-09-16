import type { AmountString, StellarAddress } from './vault.js';

/**
 * Response shapes for the read API.
 *
 * Amounts cross the HTTP boundary as decimal **strings**: `bigint` cannot be
 * JSON-serialised at all, and a `numeric(40,0)` handed to a JSON encoder as a
 * number would be truncated. String encoding keeps a 128-bit amount exact.
 */

export interface VaultSummary {
  contractId: StellarAddress;
  admin: StellarAddress;
  asset: StellarAddress;
  name: string;
  symbol: string;
  decimals: number;
  /** Always true for the Phase 1 Testnet simulation. */
  simulatedYield: boolean;
  createdLedger: number | null;
}

export interface VaultEventRecord {
  eventId: string;
  vaultId: StellarAddress;
  eventType: string;
  userAddress: StellarAddress | null;
  /** Decimal string; `null` when the event carries no underlying amount. */
  assets: AmountString | null;
  /** Decimal string; `null` when the event carries no share amount. */
  shares: AmountString | null;
  ledger: number;
  txHash: string;
  ledgerClosedAt: string | null;
}

/**
 * Ingestion cursor as stored in `indexer_checkpoints`.
 *
 * Without this the poller restarts from `now` on every boot and silently skips
 * everything that happened while it was down.
 */
export interface IndexerCheckpoint {
  stream: string;
  cursor: string | null;
  lastLedger: number;
}
