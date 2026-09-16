import { StrKey } from '@stellar/stellar-sdk';
import { describe, expect, it } from 'vitest';

import {
  baseUnitAmountSchema,
  contractIdSchema,
  decimalAmountSchema,
  decimalsSchema,
  nonNegativeBaseUnitAmountSchema,
  positiveBaseUnitAmountSchema,
  stellarAccountIdSchema,
  stellarAddressSchema,
} from '../src/index.js';

const ACCOUNT = StrKey.encodeEd25519PublicKey(Buffer.alloc(32, 7));
const CONTRACT = StrKey.encodeContract(Buffer.alloc(32, 9));

describe('stellarAccountIdSchema', () => {
  it('accepts a checksum-valid account address', () => {
    expect(stellarAccountIdSchema.parse(ACCOUNT)).toBe(ACCOUNT);
  });

  it('rejects a contract id, a truncated address, and a fake prefix', () => {
    expect(stellarAccountIdSchema.safeParse(CONTRACT).success).toBe(false);
    expect(stellarAccountIdSchema.safeParse('GABC').success).toBe(false);
    expect(stellarAccountIdSchema.safeParse(ACCOUNT.slice(0, 30)).success).toBe(
      false,
    );
  });

  it('explains the failure', () => {
    const result = stellarAccountIdSchema.safeParse('nope');

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(
      'Not a valid Stellar account address',
    );
  });
});

describe('contractIdSchema', () => {
  it('accepts a contract id and rejects an account address', () => {
    expect(contractIdSchema.safeParse(CONTRACT).success).toBe(true);
    expect(contractIdSchema.safeParse(ACCOUNT).success).toBe(false);
  });
});

describe('stellarAddressSchema', () => {
  it('accepts both address forms', () => {
    expect(stellarAddressSchema.safeParse(ACCOUNT).success).toBe(true);
    expect(stellarAddressSchema.safeParse(CONTRACT).success).toBe(true);
  });
});

describe('decimalsSchema', () => {
  it('accepts the contract range and rejects everything outside it', () => {
    expect(decimalsSchema.parse(0)).toBe(0);
    expect(decimalsSchema.parse(18)).toBe(18);
    expect(decimalsSchema.safeParse(19).success).toBe(false);
    expect(decimalsSchema.safeParse(-1).success).toBe(false);
    expect(decimalsSchema.safeParse(6.5).success).toBe(false);
  });
});

describe('baseUnitAmountSchema', () => {
  it('normalises an integer string to a bigint', () => {
    expect(baseUnitAmountSchema.parse('500')).toBe(500n);
    expect(baseUnitAmountSchema.parse(500n)).toBe(500n);
  });

  it('keeps an i128 exact through the transform', () => {
    const i128Max = '170141183460469231731687303715884105727';

    expect(baseUnitAmountSchema.parse(i128Max)).toBe(
      170141183460469231731687303715884105727n,
    );
  });

  it('refuses fractional, malformed and float input', () => {
    expect(baseUnitAmountSchema.safeParse('1.5').success).toBe(false);
    expect(baseUnitAmountSchema.safeParse('abc').success).toBe(false);
    expect(baseUnitAmountSchema.safeParse(1.5).success).toBe(false);
    expect(baseUnitAmountSchema.safeParse(null).success).toBe(false);
  });
});

describe('positive and non-negative amounts', () => {
  it('requires strictly positive amounts for deposits and redemptions', () => {
    expect(positiveBaseUnitAmountSchema.parse('1')).toBe(1n);
    expect(positiveBaseUnitAmountSchema.safeParse('0').success).toBe(false);
    expect(positiveBaseUnitAmountSchema.safeParse('-1').success).toBe(false);
  });

  it('allows zero where only negativity is invalid', () => {
    expect(nonNegativeBaseUnitAmountSchema.parse('0')).toBe(0n);
    expect(nonNegativeBaseUnitAmountSchema.safeParse('-1').success).toBe(false);
  });
});

describe('decimalAmountSchema', () => {
  it('converts a user-typed amount into base units', () => {
    const schema = decimalAmountSchema(6);

    expect(schema.parse('1.5')).toBe(1_500_000n);
    expect(schema.parse('0.000001')).toBe(1n);
    expect(schema.parse('42')).toBe(42_000_000n);
  });

  it('rejects more precision than the asset supports', () => {
    const schema = decimalAmountSchema(6);

    expect(schema.safeParse('0.1234567').success).toBe(false);
    expect(schema.safeParse('abc').success).toBe(false);
  });
});
