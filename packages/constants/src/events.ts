/**
 * Event topics published by the Phase 1 `YieldVault` contract.
 *
 * These strings are the wire format: they are the first topic of each event, so
 * a typo silently stops the indexer from projecting an event. Keep them in sync
 * with the `env.events().publish(...)` calls in `contracts/yield_vault`.
 *
 * The keys are the readable names used in TypeScript; the values are the exact
 * on-chain topic strings.
 */
export const VAULT_EVENT_TOPICS = {
  initialize: 'initialize',
  deposit: 'deposit',
  withdraw: 'withdraw',
  shareMint: 'share_mint',
  shareBurn: 'share_burn',
  /** Crystallized simulated yield. Not real RWA yield. */
  yieldAccrued: 'yield',
  pause: 'pause',
  unpause: 'unpause',
} as const;

export type VaultEventTopic =
  (typeof VAULT_EVENT_TOPICS)[keyof typeof VAULT_EVENT_TOPICS];

/** Every topic as a tuple, for runtime membership checks. */
export const VAULT_EVENT_TOPIC_VALUES = [
  'initialize',
  'deposit',
  'withdraw',
  'share_mint',
  'share_burn',
  'yield',
  'pause',
  'unpause',
] as const satisfies readonly VaultEventTopic[];

export function isVaultEventTopic(value: unknown): value is VaultEventTopic {
  return (
    typeof value === 'string' &&
    (VAULT_EVENT_TOPIC_VALUES as readonly string[]).includes(value)
  );
}

/**
 * Checkpoint stream id for the observed vault's event log.
 *
 * The stream name is the primary key in `indexer_checkpoints`, so changing it
 * resets ingestion from that point.
 */
export const INDEXER_EVENTS_STREAM = 'yield_vault_events';
