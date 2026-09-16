#!/usr/bin/env tsx
/**
 * YieldAnchor Protocol — live Testnet round trip.
 *
 * Exercises the deployed vault against real Testnet state through
 * `@yieldanchor/contract-clients`: deposit, yield accrual, and redemption,
 * checking the underlying asset actually moves in and out of the vault rather
 * than trusting the vault's own accounting.
 *
 * It is written to run against a vault that already holds a position, so it can
 * be re-run without redeploying. Exact assertions are therefore about deltas
 * (what changed) and about invariants that hold regardless of prior state.
 *
 * The last step asserts the defining Phase 1 limitation: simulated yield is not
 * backed by tokens, so a vault that has accrued yield cannot honour a redemption
 * of every share. See the README for why that is deliberate.
 *
 * This is a smoke test for a Testnet deployment, not a replacement for the
 * Soroban unit tests under `contracts/`. It spends a little Testnet XLM on fees.
 *
 *   pnpm run testnet:round-trip
 *
 * Environment: CONTRACT_ID (defaults to scripts/.contract_id),
 * DEPOSIT_AMOUNT (base units, default 1000 XLM at 7 decimals), WAIT_SECONDS.
 *
 * WARNING: Phase 1 yield is a deterministic TESTNET SIMULATION keyed on ledger
 * time. It is NOT real T-Bill or RWA yield; the rate below is fabricated.
 */
import {
  Account,
  Address,
  BASE_FEE,
  Contract,
  Keypair,
  TransactionBuilder,
  rpc,
  scValToNative,
} from '@stellar/stellar-sdk';

import {
  PRICE_SCALE,
  SIM_APY_BPS,
  YIELD_DENOM,
  networkPassphrase,
} from '@yieldanchor/constants';
import { YieldVaultClient, localSigner } from '@yieldanchor/contract-clients';

import {
  ensureFunded,
  loadDeployer,
  readRecordedContractId,
  readSettings,
} from '../lib/testnet.js';

/** One XLM in base units at the vault's default 7 decimals. */
const ONE_XLM = 10_000_000n;
const DEFAULT_DEPOSIT = 1_000n * ONE_XLM;
/** Fees are fractions of a stroop; this is slack for the assertion only. */
const FEE_ALLOWANCE = 1n * ONE_XLM;
/** The contract floors every accrual and carries the remainder, so allow ±2. */
const YIELD_TOLERANCE = 2n;

let failures = 0;

function check(label: string, condition: boolean, detail = ''): void {
  if (!condition) {
    failures += 1;
  }
  console.log(
    `  ${condition ? '✓' : '✗'} ${label}${detail ? `  (${detail})` : ''}`,
  );
}

function sleep(seconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1_000));
}

function absDiff(a: bigint, b: bigint): bigint {
  return a > b ? a - b : b - a;
}

/** Yield the contract should have accrued for `elapsed` seconds, floored. */
function expectedYield(principal: bigint, elapsed: bigint): bigint {
  return (principal * BigInt(SIM_APY_BPS) * elapsed) / BigInt(YIELD_DENOM);
}

/**
 * Read the Stellar Asset Contract balance of an account or contract.
 *
 * The vault's own `total_assets` is reported *by the vault*, so it cannot prove
 * the tokens moved. Reading the same balance from the asset contract is an
 * independent check.
 */
async function assetBalance(
  server: rpc.Server,
  asset: string,
  holder: string,
  passphrase: string,
): Promise<bigint> {
  const transaction = new TransactionBuilder(
    new Account(Keypair.random().publicKey(), '0'),
    { fee: BASE_FEE, networkPassphrase: passphrase },
  )
    .addOperation(
      new Contract(asset).call('balance', Address.fromString(holder).toScVal()),
    )
    .setTimeout(30)
    .build();

  const simulation = await server.simulateTransaction(transaction);
  if (rpc.Api.isSimulationError(simulation)) {
    throw new Error(
      `Reading the asset balance of ${holder} failed: ${simulation.error}`,
    );
  }
  const retval = simulation.result?.retval;
  if (!retval) {
    throw new Error(`Reading the asset balance of ${holder} returned nothing`);
  }
  return BigInt(scValToNative(retval) as bigint);
}

async function main(): Promise<void> {
  const settings = readSettings();
  const server = new rpc.Server(settings.rpcUrl);
  const passphrase = networkPassphrase(settings.network);
  const deposit = BigInt(process.env.DEPOSIT_AMOUNT ?? DEFAULT_DEPOSIT);
  const waitSeconds = Number(process.env.WAIT_SECONDS ?? 30);

  const deployer = loadDeployer();
  await ensureFunded(server, deployer);
  const user = deployer.publicKey();

  const contractId = process.env.CONTRACT_ID ?? readRecordedContractId();
  if (!contractId) {
    throw new Error(
      'No contract id. Run `pnpm run contract:deploy:ts` first, or set CONTRACT_ID.',
    );
  }

  const client = new YieldVaultClient({
    contractId,
    network: settings.network,
    rpcUrl: settings.rpcUrl,
    publicKey: user,
    signTransaction: localSigner(deployer, passphrase),
  });

  const asset = await client.asset();
  const balanceOf = (holder: string) =>
    assetBalance(server, asset, holder, passphrase);

  console.log(
    '\n── testnet round trip ──────────────────────────────────────────',
  );
  console.log(`  vault   : ${contractId}`);
  console.log(`  asset   : ${asset}`);
  console.log(`  user    : ${user}`);
  console.log(`  deposit : ${deposit} base units`);

  console.log('\n[0] starting state');
  const start = await client.getVaultState();
  const holdingsStart = await balanceOf(contractId);
  const userStart = await balanceOf(user);
  console.log(
    `  accounting: principal=${start.principal} accrued=${start.accrued} shares=${start.shares} price=${start.price}`,
  );
  console.log(`  tokens held by vault=${holdingsStart}, user=${userStart}`);
  // Yield is simulated, so the vault always claims at least as much as it
  // holds. When these are equal nothing has accrued yet.
  check(
    'the vault claims at least the tokens it holds',
    start.assets >= holdingsStart,
    `claims ${start.assets}, holds ${holdingsStart}`,
  );

  console.log('\n[1] deposit');
  const depositResult = await client
    .deposit({ vaultId: contractId, user, assets: deposit })
    .then((transaction) => transaction.signAndSend());
  console.log(
    `  tx      : ${depositResult.hash} (ledger ${depositResult.ledger})`,
  );

  const afterDeposit = await client.getVaultState();
  const holdingsAfterDeposit = await balanceOf(contractId);
  const userAfterDeposit = await balanceOf(user);
  const minted = depositResult.value ?? 0n;
  console.log(`  minted  : ${minted} shares`);

  check('shares were minted', minted > 0n, `minted ${minted}`);
  check(
    'minted shares match the share delta',
    afterDeposit.shares - start.shares === minted,
    `${start.shares} + ${minted} = ${afterDeposit.shares}`,
  );
  check(
    'principal grew by exactly the deposit',
    afterDeposit.principal === start.principal + deposit,
    `${start.principal} + ${deposit} = ${afterDeposit.principal}`,
  );
  // The strongest evidence the transfer settled: an independent read of the
  // asset contract shows the tokens arrived.
  check(
    'the vault actually received the tokens',
    holdingsAfterDeposit === holdingsStart + deposit,
    `${holdingsStart} + ${deposit} = ${holdingsAfterDeposit}`,
  );
  check(
    'the deposit left the user account',
    userStart - userAfterDeposit >= deposit,
    `delta=${userStart - userAfterDeposit}`,
  );
  check(
    'share price is at least 1:1',
    afterDeposit.price >= PRICE_SCALE,
    `price=${afterDeposit.price}`,
  );
  if (start.shares === 0n) {
    // Only meaningful for the very first deposit into an empty vault.
    check('a first deposit mints shares 1:1', minted === deposit);
  }

  console.log(`\n[2] waiting ${waitSeconds}s for ledger time to pass`);
  await sleep(waitSeconds);

  console.log('\n[3] accrue yield');
  const accruedBefore = afterDeposit.accrued;
  const principal = afterDeposit.principal;
  const t0 = BigInt(afterDeposit.lastTs);
  const first = await client
    .accrueYield()
    .then((transaction) => transaction.signAndSend());
  const state1 = await client.getVaultState();
  const increment1 = state1.accrued - accruedBefore;
  const elapsed1 = BigInt(state1.lastTs) - t0;
  const expected1 = expectedYield(principal, elapsed1);

  console.log(`  tx      : ${first.hash} (ledger ${first.ledger})`);
  console.log(
    `  accrued ${increment1} over ${elapsed1}s (expected ~${expected1})`,
  );

  check('yield accrued on-chain', increment1 > 0n, `+${increment1}`);
  check(
    'accrued matches the simulated rate',
    absDiff(increment1, expected1) <= YIELD_TOLERANCE,
    `expected ~${expected1}`,
  );
  check(
    'total assets equal principal plus accrued',
    state1.assets === state1.principal + state1.accrued,
    `${state1.assets} = ${state1.principal} + ${state1.accrued}`,
  );

  console.log('\n[4] accrue again (no double counting)');
  await sleep(15);
  await client.accrueYield().then((transaction) => transaction.signAndSend());
  const state2 = await client.getVaultState();
  const increment2 = state2.accrued - state1.accrued;
  const elapsed2 = BigInt(state2.lastTs) - BigInt(state1.lastTs);
  const expected2 = expectedYield(state2.principal, elapsed2);
  console.log(
    `  increment ${increment2} over ${elapsed2}s (expected ~${expected2})`,
  );
  // The guard: the second call accrues only for the time since the first. A
  // double-counting bug would re-apply the whole period since the deposit.
  check(
    'the second accrual covers only the new interval',
    absDiff(increment2, expected2) <= YIELD_TOLERANCE,
    `increment ${increment2} vs expected ~${expected2}`,
  );
  check(
    'share price rose as yield accrued',
    state2.price > PRICE_SCALE,
    `price=${state2.price}`,
  );

  console.log('\n[5] redeem');
  // The simulated yield has no tokens behind it: the vault owes
  // `principal + accrued` while holding only the principal it was given.
  // Redeeming every share therefore asks for more than the vault holds, and the
  // contract must refuse rather than overdraw.
  const liquidity = holdingsAfterDeposit;
  const totalAssets = state2.principal + state2.accrued;
  const unbacked = totalAssets - liquidity;
  console.log(
    `  accounting owes ${totalAssets}, vault holds ${liquidity} (unbacked ${unbacked})`,
  );

  let fullRedeemError: string | null = null;
  try {
    await client.redeem({ vaultId: contractId, user, shares: state2.shares });
  } catch (error) {
    fullRedeemError = (error as Error).message;
  }
  check(
    'redeeming every share is refused while the yield is unbacked',
    fullRedeemError !== null && /liquid|underlying/i.test(fullRedeemError),
    fullRedeemError ?? 'it unexpectedly succeeded',
  );

  // Redeem the largest share amount the vault can actually settle.
  //
  // Every state-changing call crystallizes pending yield *before* computing the
  // payout, so the assets owed for a given share count grow with time. Sizing a
  // redemption to exactly today's liquidity therefore races the ledger: the
  // simulation passes and the execution still fails, because the payout grew
  // past the balance in between. Leave a margin for the yield that can accrue
  // before the transaction lands.
  const assetsPerSecond =
    (state2.principal * BigInt(SIM_APY_BPS)) / BigInt(YIELD_DENOM);
  const marginAssets = assetsPerSecond * 300n + 1_000n;
  const marginShares = (marginAssets * state2.shares) / totalAssets + 2n;
  const redeemableShares =
    (liquidity * state2.shares) / totalAssets - marginShares;

  if (redeemableShares <= 0n) {
    throw new Error(
      `The vault holds only ${liquidity} base units, too little to redeem against. ` +
        'Deploy a fresh vault to run a full round trip.',
    );
  }

  const floorPayout = (redeemableShares * totalAssets) / state2.shares;
  console.log(
    `  redeeming ${redeemableShares} of ${state2.shares} shares for at least ${floorPayout}`,
  );

  const redeemResult = await client
    .redeem({ vaultId: contractId, user, shares: redeemableShares })
    .then((transaction) => transaction.signAndSend());
  console.log(
    `  tx      : ${redeemResult.hash} (ledger ${redeemResult.ledger})`,
  );

  const final = await client.getVaultState();
  const holdingsFinal = await balanceOf(contractId);
  const userFinal = await balanceOf(user);
  const payout = redeemResult.value ?? 0n;
  const residual = liquidity - payout;

  check(
    'tokens actually left the vault',
    holdingsFinal === residual,
    `${liquidity} - ${payout} = ${holdingsFinal}`,
  );
  check(
    'the payout is at least the pre-execution share price',
    payout >= floorPayout,
    `paid ${payout}, floor ${floorPayout}`,
  );
  check(
    'the redemption drained the vault',
    payout <= liquidity && residual < marginAssets + 1_000n,
    `residual ${residual}`,
  );
  check(
    'the redeemed shares were burned',
    final.shares === state2.shares - redeemableShares,
    `${state2.shares} - ${redeemableShares} = ${final.shares}`,
  );
  check(
    'the user was repaid',
    userFinal > userAfterDeposit,
    `${userAfterDeposit} -> ${userFinal}`,
  );
  check(
    'the user recovered the principal',
    userFinal + FEE_ALLOWANCE >= userStart,
    `before=${userStart} after=${userFinal}`,
  );

  console.log(
    '\n── result ──────────────────────────────────────────────────────',
  );
  if (failures > 0) {
    console.error(`  ${failures} check(s) FAILED`);
    process.exitCode = 1;
    return;
  }
  console.log('  all checks passed');
  console.log(`  principal deposited  : ${deposit}`);
  console.log(`  simulated yield      : ${unbacked} base units, unbacked`);
  console.log(
    `  unexercisable shares : ${final.shares} (a claim on yield with no tokens behind it)`,
  );
  console.log(
    '\n  Reminder: this yield is a TESTNET SIMULATION keyed on ledger time,\n' +
      '  not real T-Bill/RWA yield. It is unbacked, which is why the full\n' +
      '  share balance cannot be redeemed.\n',
  );
}

main().catch((error: unknown) => {
  console.error(`\nRound trip failed: ${(error as Error).message ?? error}`);
  process.exitCode = 1;
});
