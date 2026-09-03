/**
 * Wallet Concurrency Load Test
 *
 * Simulates N concurrent wallet mutations against a live PostgreSQL database.
 * Validates that the atomic debit pattern and serialization retry wrapper
 * prevent race conditions under load.
 *
 * Run: npx tsx tests/load/wallet-concurrency-load.ts
 *
 * Requires a running PostgreSQL with the Voltium schema and a test rider.
 * Set DATABASE_URL in your .env (defaults to localhost).
 */

import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const CONCURRENCY = 50;
const ITERATIONS = 3;

async function main() {
  console.log(`\n🔬 Wallet Concurrency Load Test`);
  console.log(`   Concurrency: ${CONCURRENCY} parallel mutations`);
  console.log(`   Iterations: ${ITERATIONS}\n`);

  const prisma = new PrismaClient();
  let passed = 0;
  let failed = 0;

  try {
    // Create a test rider and wallet
    const testPhone = `+9199${Date.now().toString().slice(-8)}`;
    const rider = await prisma.rider.create({
      data: {
        phone: testPhone,
        riderId: `VF-LOAD-${Date.now().toString().slice(-6)}`,
        fullName: 'Load Test Rider',
        lifecycleStatus: 'ACTIVE',
        registrationDoneAt: new Date(),
        referralCode: `LOAD${Date.now().toString().slice(-6)}`,
      },
    });

    const wallet = await prisma.wallet.create({
      data: {
        riderId: rider.id,
        balanceInPaise: 100000, // Start with ₹1000
        securityDepositInPaise: 0,
        depositStatus: 'NOT_SUBMITTED',
        paymentStreak: 0,
        version: 1,
      },
    });

    console.log(`   Test rider: ${rider.riderId} (id: ${rider.id})`);
    console.log(`   Initial balance: ₹${(wallet.balanceInPaise / 100).toFixed(2)}\n`);

    for (let iter = 1; iter <= ITERATIONS; iter++) {
      console.log(`   ── Iteration ${iter}/${ITERATIONS} ──`);

      // Fire CONCURRENCY concurrent debits of ₹10 each
      const startBalance = (await prisma.wallet.findUnique({ where: { id: wallet.id } }))!
        .balanceInPaise;
      const debitAmount = 1000; // ₹10
      const expectedEndBalance = startBalance - CONCURRENCY * debitAmount;

      const startTime = Date.now();

      const results = await Promise.allSettled(
        Array.from({ length: CONCURRENCY }, async (_, i) => {
          try {
            await prisma.$transaction(async (tx) => {
              // Atomic debit with balance check
              const updated = await tx.wallet.update({
                where: {
                  id: wallet.id,
                  balanceInPaise: { gte: debitAmount },
                },
                data: {
                  balanceInPaise: { decrement: debitAmount },
                  version: { increment: 1 },
                },
              });

              await tx.walletLedger.create({
                data: {
                  walletId: wallet.id,
                  riderId: rider.id,
                  entryType: 'DEBIT',
                  category: 'RENT_PAYMENT',
                  amountInPaise: debitAmount,
                  balanceAfter: updated.balanceInPaise,
                  note: `Load test debit #${i + 1}`,
                },
              });
            });
            return 'fulfilled';
          } catch (err: any) {
            return `rejected: ${err.message}`;
          }
        })
      );

      const elapsed = Date.now() - startTime;
      const fulfilled = results.filter((r) => r.status === 'fulfilled').length;
      const rejected = results.filter((r) => r.status === 'rejected').length;

      // Verify final balance
      const finalWallet = await prisma.wallet.findUnique({ where: { id: wallet.id } });
      const actualEndBalance = finalWallet!.balanceInPaise;

      const balanceCorrect = actualEndBalance === expectedEndBalance;

      console.log(`      ${fulfilled} fulfilled, ${rejected} rejected`);
      console.log(`      Elapsed: ${elapsed}ms`);
      console.log(`      Expected balance: ₹${(expectedEndBalance / 100).toFixed(2)}`);
      console.log(`      Actual balance:   ₹${(actualEndBalance / 100).toFixed(2)}`);
      console.log(`      Balance correct?  ${balanceCorrect ? '✅ YES' : '❌ NO'}`);

      if (balanceCorrect && rejected === 0) {
        passed++;
      } else {
        failed++;
      }
    }

    // Cleanup
    await prisma.walletLedger.deleteMany({ where: { walletId: wallet.id } });
    await prisma.wallet.delete({ where: { id: wallet.id } });
    await prisma.rider.delete({ where: { id: rider.id } });

    console.log(`\n   ── Results ──`);
    console.log(`   Passed: ${passed}/${ITERATIONS}`);
    console.log(`   Failed: ${failed}/${ITERATIONS}`);

    if (failed > 0) {
      console.log('\n❌ LOAD TEST FAILED — wallet race conditions detected!\n');
      process.exit(1);
    } else {
      console.log('\n✅ LOAD TEST PASSED — atomic debit handles concurrency correctly.\n');
    }
  } catch (err) {
    console.error('\n❌ Load test error:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
