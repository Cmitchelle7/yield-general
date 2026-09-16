import type { VaultEventTopic } from '@yieldanchor/constants';

import type { Amount, StellarAddress, VaultMetadata } from './vault.js';

/**
 * Wire name of a decoded vault event, matching the contract's published topics.
 * (`initialize`, `deposit`, `withdraw`, `share_mint`, `share_burn`, `yield`,
 * `pause`, `unpause`.)
 */
export type VaultEventType = VaultEventTopic;

export type { VaultEventTopic };

/**
 * One decoded contract event, shaped for the `vault_events` table.
 *
 * This is a decoder output, not an interpretation: no protocol accounting is
 * performed and no derived balances are attached. Positions are derived from
 * the append-only event log.
 */
export interface DecodedVaultEvent {
  /** Soroban event id, used as the dedup key on replay. */
  eventId: string;
  /** Contract that emitted the event. */
  vaultId: StellarAddress;
  eventType: VaultEventType;
  /** Absent for events the contract publishes without a user topic. */
  userAddress: StellarAddress | null;
  /**
   * For `deposit`/`withdraw`, the underlying amount moved. For `yield`, the
   * crystallized simulated yield, which raises total assets without a matching
   * token transfer.
   */
  assets: Amount | null;
  shares: Amount | null;
  ledger: number;
  txHash: string;
  ledgerClosedAt: string | null;
  /** Present only on `initialize`, which creates the vault's metadata row. */
  vault: VaultMetadata | null;
}

/** Events that move shares, as opposed to only reporting yield or control. */
export function isShareMovement(event: DecodedVaultEvent): boolean {
  return (
    event.eventType === 'deposit' ||
    event.eventType === 'withdraw' ||
    event.eventType === 'share_mint' ||
    event.eventType === 'share_burn'
  );
}
