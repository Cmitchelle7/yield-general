import { scValToNative, xdr } from '@stellar/stellar-sdk';
import type { Api } from '@stellar/stellar-sdk/rpc';

/**
 * Decode the Phase 1 `YieldVault` contract's events into a projection-friendly
 * shape.
 *
 * The contract publishes these topics, matching `contracts/yield_vault`:
 *
 * | topic | value |
 * | --- | --- |
 * | `initialize` | `(admin, asset, name, symbol, decimals, simulation)` |
 * | `deposit`, user | `(assets, shares)` |
 * | `withdraw`, user | `(assets, shares)` |
 * | `share_mint`, user | `shares` |
 * | `share_burn`, user | `shares` |
 * | `yield` | `(yield_amount, timestamp)` |
 * | `pause` | admin |
 * | `unpause` | admin |
 *
 * This is deliberately a decoder, not an interpreter: it performs no protocol
 * accounting and stores no derived balances. Positions are derived from the
 * append-only event log.
 */

export const VAULT_EVENT_TYPES = [
  'initialize',
  'deposit',
  'withdraw',
  'share_mint',
  'share_burn',
  'yield',
  'pause',
  'unpause',
] as const;

export type VaultEventType = (typeof VAULT_EVENT_TYPES)[number];

export interface VaultMetadata {
  contractId: string;
  admin: string;
  asset: string;
  name: string;
  symbol: string;
  decimals: number;
  /** Mirrors `Config.simulation`: always true for the Phase 1 Testnet simulation. */
  simulatedYield: boolean;
}

export interface DecodedVaultEvent {
  eventId: string;
  vaultId: string;
  eventType: VaultEventType;
  userAddress: string | null;
  /**
   * For `deposit`/`withdraw` this is the underlying amount moved. For `yield`
   * it is the crystallized simulated yield, which raises total assets without
   * a matching token transfer.
   */
  assets: bigint | null;
  shares: bigint | null;
  ledger: number;
  txHash: string;
  ledgerClosedAt: string | null;
  /** Present only on `initialize`, which creates the vault's metadata row. */
  vault: VaultMetadata | null;
}

/** Convert an `ScVal` to native JS, treating hostile or unknown data as absent. */
function toNative(scv: xdr.ScVal | undefined): unknown {
  if (!scv) {
    return null;
  }
  try {
    return scValToNative(scv);
  } catch {
    // A malformed or unsupported ScVal must not abort indexing of the batch.
    return null;
  }
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function asBigInt(value: unknown): bigint | null {
  if (typeof value === 'bigint') {
    return value;
  }
  if (typeof value === 'number' && Number.isSafeInteger(value)) {
    return BigInt(value);
  }
  return null;
}

function asNumber(value: unknown): number | null {
  const asInt = asBigInt(value);
  if (asInt === null) {
    return null;
  }
  const num = Number(asInt);
  return Number.isSafeInteger(num) ? num : null;
}

function asItems(value: unknown): unknown[] {
  return Array.isArray(value) ? (value as unknown[]) : [];
}

function isVaultEventType(value: string | null): value is VaultEventType {
  return (
    value !== null && (VAULT_EVENT_TYPES as readonly string[]).includes(value)
  );
}

/**
 * Decode one RPC event. Returns `null` for anything that is not a recognised
 * vault event, so unrelated events can never enter the projection.
 */
export function decodeVaultEvent(
  event: Api.EventResponse,
): DecodedVaultEvent | null {
  const vaultId = event.contractId?.toString() ?? null;
  if (!vaultId || event.topic.length === 0) {
    return null;
  }

  const eventType = asString(toNative(event.topic[0]));
  if (!isVaultEventType(eventType)) {
    return null;
  }

  const payload = toNative(event.value);
  const userAddress =
    event.topic.length > 1 ? asString(toNative(event.topic[1])) : null;

  let assets: bigint | null = null;
  let shares: bigint | null = null;
  let vault: VaultMetadata | null = null;

  switch (eventType) {
    case 'deposit':
    case 'withdraw': {
      const [assetsValue, sharesValue] = asItems(payload);
      assets = asBigInt(assetsValue);
      shares = asBigInt(sharesValue);
      break;
    }
    case 'share_mint':
    case 'share_burn':
      shares = asBigInt(payload);
      break;
    case 'yield': {
      const [yieldAmount] = asItems(payload);
      assets = asBigInt(yieldAmount);
      break;
    }
    case 'initialize': {
      const [admin, asset, name, symbol, decimals, simulation] =
        asItems(payload);
      const adminAddress = asString(admin);
      const assetAddress = asString(asset);
      const vaultName = asString(name);
      const vaultSymbol = asString(symbol);
      const vaultDecimals = asNumber(decimals);
      if (
        !adminAddress ||
        !assetAddress ||
        !vaultName ||
        !vaultSymbol ||
        vaultDecimals === null
      ) {
        // Incomplete metadata: skip rather than write a misleading vault row.
        return null;
      }
      vault = {
        contractId: vaultId,
        admin: adminAddress,
        asset: assetAddress,
        name: vaultName,
        symbol: vaultSymbol,
        decimals: vaultDecimals,
        simulatedYield: simulation === true,
      };
      break;
    }
    case 'pause':
    case 'unpause':
      // The value is the admin address; authorization is already enforced
      // on-chain, so nothing further is projected here.
      break;
  }

  return {
    eventId: event.id,
    vaultId,
    eventType,
    userAddress,
    assets,
    shares,
    ledger: event.ledger,
    txHash: event.txHash,
    ledgerClosedAt: event.ledgerClosedAt ?? null,
    vault,
  };
}
