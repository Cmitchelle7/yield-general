import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const DEFAULT_RPC_URL = 'https://soroban-testnet.stellar.org:443';
const PLACEHOLDER_VALUES = new Set([
  'your_supabase_url_here',
  'your_supabase_key_here',
]);

export interface IndexerConfig {
  rpcUrl: string;
  contractId: string;
  supabaseUrl: string | null;
  supabaseKey: string | null;
}

function readSecret(raw: string | undefined): string | null {
  const value = raw?.trim() ?? '';
  if (value.length === 0 || PLACEHOLDER_VALUES.has(value)) {
    return null;
  }
  return value;
}

/**
 * Read indexer configuration from an environment-like object.
 *
 * Taking the environment as an argument keeps this testable without mutating
 * `process.env` globally.
 */
export function loadConfig(
  env: NodeJS.ProcessEnv = process.env,
): IndexerConfig {
  return {
    rpcUrl: env.SOROBAN_RPC?.trim() || DEFAULT_RPC_URL,
    contractId: env.CONTRACT_ID?.trim() ?? '',
    supabaseUrl: readSecret(env.SUPABASE_URL),
    supabaseKey: readSecret(env.SUPABASE_KEY),
  };
}

/**
 * Create a Supabase client, or return `null` when persistence is not
 * configured. The indexer degrades to observation-only in that case.
 */
export function createSupabaseClient(
  config: IndexerConfig,
): SupabaseClient | null {
  if (!config.supabaseUrl || !config.supabaseKey) {
    return null;
  }
  return createClient(config.supabaseUrl, config.supabaseKey);
}
