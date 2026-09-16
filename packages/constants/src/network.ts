/**
 * Stellar network parameters shared by the contract clients, the indexer, and
 * the API.
 *
 * The passphrases are literals rather than values imported from
 * `@stellar/stellar-sdk` so this package stays dependency-free and usable from
 * any workspace, including ones that do not link the SDK.
 */

export const STELLAR_NETWORK_PASSPHRASES = {
  testnet: 'Test SDF Network ; September 2015',
  mainnet: 'Public Global Stellar Network ; September 2015',
} as const;

export type StellarNetworkName = keyof typeof STELLAR_NETWORK_PASSPHRASES;

/**
 * Default Soroban RPC endpoints.
 *
 * Only Testnet has a default: the protocol is deliberately Testnet-only until
 * a production yield source is designed and reviewed, and public Mainnet RPC
 * endpoints are operated by several providers rather than one canonical
 * address.
 */
export const DEFAULT_SOROBAN_RPC_URLS: Record<
  StellarNetworkName,
  string | null
> = {
  testnet: 'https://soroban-testnet.stellar.org:443',
  mainnet: null,
};

export const DEFAULT_NETWORK: StellarNetworkName = 'testnet';

/** Horizon endpoints, used for account and transaction lookups. */
export const HORIZON_URLS: Record<StellarNetworkName, string> = {
  testnet: 'https://horizon-testnet.stellar.org',
  mainnet: 'https://horizon.stellar.org',
};

export function networkPassphrase(network: StellarNetworkName): string {
  return STELLAR_NETWORK_PASSPHRASES[network];
}
