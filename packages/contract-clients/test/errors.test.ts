import { VAULT_ERROR_CODES } from '@yieldanchor/constants';
import { describe, expect, it } from 'vitest';

import {
  VaultClientError,
  VaultContractError,
  VaultSimulationError,
  VaultSubmissionError,
  parseContractErrorCode,
} from '../src/index.js';

describe('parseContractErrorCode', () => {
  it('extracts the code from a Soroban host error', () => {
    expect(parseContractErrorCode('HostError: Error(Contract, #14)')).toBe(14);
    expect(parseContractErrorCode('HostError: Error(Contract, #8)')).toBe(8);
  });

  it('tolerates spacing and surrounding text', () => {
    expect(
      parseContractErrorCode(
        'Simulation failed: HostError: Error(Contract,  #9)\n  debug info',
      ),
    ).toBe(9);
  });

  it('returns null when there is no contract error', () => {
    expect(
      parseContractErrorCode('HostError: Error(WasmVm, MissingValue)'),
    ).toBeNull();
    expect(parseContractErrorCode('')).toBeNull();
    expect(parseContractErrorCode('Error(Contract, #abc)')).toBeNull();
  });
});

describe('VaultContractError', () => {
  it('names the error a caller can branch on', () => {
    const error = new VaultContractError(VAULT_ERROR_CODES.Paused, 'deposit');

    expect(error.code).toBe(14);
    expect(error.errorName).toBe('Paused');
    expect(error.method).toBe('deposit');
    expect(error.message).toContain('paused');
    expect(error.message).toContain('code 14');
    expect(error).toBeInstanceOf(VaultClientError);
  });

  it('reports an unknown code without inventing a name', () => {
    const error = new VaultContractError(999, 'redeem');

    expect(error.errorName).toBeNull();
    expect(error.message).toContain('unknown error code 999');
  });
});

describe('VaultSimulationError', () => {
  it('attaches the contract error when the host reports one', () => {
    const error = new VaultSimulationError(
      'deposit',
      'HostError: Error(Contract, #14)',
    );

    expect(error.contractError?.code).toBe(14);
    expect(error.contractError?.errorName).toBe('Paused');
    expect(error.method).toBe('deposit');
    expect(error.simulationError).toContain('Error(Contract, #14)');
  });

  it('stays usable when the failure is not a contract error', () => {
    const error = new VaultSimulationError(
      'deposit',
      'HostError: Error(WasmVm, MissingValue)',
    );

    expect(error.contractError).toBeNull();
    expect(error.message).toContain('Simulating "deposit" failed');
  });
});

describe('VaultSubmissionError', () => {
  it('carries the hash and the network status', () => {
    const error = new VaultSubmissionError('redeem', 'deadbeef', 'FAILED');

    expect(error.hash).toBe('deadbeef');
    expect(error.status).toBe('FAILED');
    expect(error.message).toContain('redeem');
    expect(error.message).toContain('FAILED');
  });
});
