import {
  describeVaultError,
  type VaultErrorName,
} from '@yieldanchor/shared-types';
import { vaultErrorName } from '@yieldanchor/constants';

/**
 * Errors raised by this client.
 *
 * The contract's own error codes are surfaced as {@link VaultContractError} so
 * callers can branch on the code instead of matching message text.
 */

/** Base class for every failure raised by the client. */
export class VaultClientError extends Error {
  readonly method: string | null;

  constructor(message: string, method: string | null = null) {
    super(message);
    this.name = 'VaultClientError';
    this.method = method;
  }
}

/** A contract call was rejected by the contract itself. */
export class VaultContractError extends VaultClientError {
  readonly code: number;
  readonly errorName: VaultErrorName | null;

  constructor(code: number, method: string | null = null) {
    const name = vaultErrorName(code);
    super(
      method
        ? `${describeVaultError(code)} (${method}, code ${code})`
        : `${describeVaultError(code)} (code ${code})`,
      method,
    );
    this.name = 'VaultContractError';
    this.code = code;
    this.errorName = name;
  }
}

/** Simulation failed before the transaction could be assembled. */
export class VaultSimulationError extends VaultClientError {
  readonly simulationError: string;
  readonly contractError: VaultContractError | null;

  constructor(method: string, simulationError: string) {
    const code = parseContractErrorCode(simulationError);
    super(
      code === null
        ? `Simulating "${method}" failed: ${simulationError}`
        : `Simulating "${method}" failed: ${describeVaultError(code)}`,
      method,
    );
    this.name = 'VaultSimulationError';
    this.simulationError = simulationError;
    this.contractError =
      code === null ? null : new VaultContractError(code, method);
  }
}

/** The network rejected or failed a submitted transaction. */
export class VaultSubmissionError extends VaultClientError {
  readonly hash: string;
  readonly status: string;

  constructor(method: string, hash: string, status: string, detail?: string) {
    super(
      detail
        ? `Submitting "${method}" failed with status ${status}: ${detail}`
        : `Submitting "${method}" failed with status ${status}`,
      method,
    );
    this.name = 'VaultSubmissionError';
    this.hash = hash;
    this.status = status;
  }
}

/**
 * Extract a contract error code from a Soroban diagnostic message.
 *
 * The host formats a failed contract call as `Error(Contract, #14)`, which is
 * the only place the code appears once the simulation has failed.
 */
export function parseContractErrorCode(message: string): number | null {
  const match = /Error\(Contract,\s*#(\d+)\)/.exec(message);
  if (!match) {
    return null;
  }
  const code = Number(match[1]);
  return Number.isInteger(code) ? code : null;
}
