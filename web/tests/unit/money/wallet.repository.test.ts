import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { setupTestPostgres, teardownTestPostgres, testDb } from '../../_setup/test-postgres';
import { walletRepository } from '../../../src/server/modules/wallet/wallet.repository';
import { TransactionType, TransactionPurpose, TransactionStatus, LedgerEntryType, LedgerCategory } from '@prisma/client';

describe('walletRepository', () => {
  beforeAll(async () => {
    process.env.DATABASE_OFFLINE = 'false';
    await setupTestPostgres();
  });

  afterAll(async () => {
    await teardownTestPostgres();
  });

  let riderId: string;
  let riderDbId: string;
  
  beforeEach(async () => {
    riderId = `RD-${uuidv4().substring(0, 6)}`;
    riderDbId = uuidv4();
    const phone = Math.floor(Math.random() * 9000000000 + 1000000000).toString();
    const referralCode = `REF-${uuidv4().substring(0, 6)}`;
    
    await testDb.rider.create({
      data: {
        id: riderDbId,
        riderId: riderId,
        phone: phone,
        fullName: 'Test Rider',
        referralCode: referralCode,
      },
    });
  });

  it('should return undefined if wallet not found', async () => {
    const wallet = await walletRepository.findByRiderId('non-existent');
    expect(wallet).toBeNull();
  });

  it('should return 0 balance if wallet not found', async () => {
    const balance = await walletRepository.getBalance('non-existent');
    expect(balance).toBe(0);
  });

  it('should upsert balance correctly', async () => {
    let wallet = await walletRepository.updateBalance(riderDbId, 10000);
    expect(wallet.balanceInPaise).toBe(10000);
    expect(wallet.riderId).toBe(riderDbId);

    wallet = await walletRepository.updateBalance(riderDbId, 15000);
    expect(wallet.balanceInPaise).toBe(15000);
  });

  it('should find by rider id', async () => {
    await walletRepository.updateBalance(riderDbId, 20000);
    
    const wallet = await walletRepository.findByRiderId(riderDbId);
    expect(wallet).not.toBeNull();
    expect(wallet!.balanceInPaise).toBe(20000);
  });

  it('should get balance', async () => {
    await walletRepository.updateBalance(riderDbId, 25000);
    
    const balance = await walletRepository.getBalance(riderDbId);
    expect(balance).toBe(25000);
  });

  it('should create and retrieve transactions', async () => {
    const txn = await walletRepository.createTransaction({
      riderId: riderDbId,
      type: TransactionType.CREDIT,
      amount: 5000,
      purpose: TransactionPurpose.TOP_UP,
      idempotencyKey: `idem-${uuidv4()}`,
    });

    expect(txn.id).toBeDefined();
    expect(txn.amount).toBe(5000);
    expect(txn.status).toBe(TransactionStatus.PENDING);

    const retrieved = await walletRepository.findTransactionById(txn.id);
    expect(retrieved?.id).toBe(txn.id);

    const byKey = await walletRepository.findTransactionByKey(txn.idempotencyKey as string);
    expect(byKey?.id).toBe(txn.id);

    const txns = await walletRepository.getTransactions(riderDbId);
    expect(txns).toHaveLength(1);
    expect(txns[0].id).toBe(txn.id);
  });

  it('should update transaction status', async () => {
    const txn = await walletRepository.createTransaction({
      riderId: riderDbId,
      type: TransactionType.DEBIT,
      amount: 1000,
      purpose: TransactionPurpose.RENT_PAYMENT,
    });

    expect(txn.status).toBe(TransactionStatus.PENDING);

    const updated = await walletRepository.updateTransactionStatus(txn.id, TransactionStatus.APPROVED, 'admin-1');
    expect(updated.status).toBe(TransactionStatus.APPROVED);
    expect(updated.approvedBy).toBe('admin-1');
    expect(updated.approvedAt).toBeDefined();
  });

  it('should retrieve ledger entries', async () => {
    const wallet = await testDb.wallet.create({
      data: {
        riderId: riderDbId,
        balanceInPaise: 5000,
        securityDeposit: 0,
      }
    });

    await testDb.walletLedger.create({
      data: {
        riderId: riderDbId,
        walletId: wallet.id,
        entryType: LedgerEntryType.CREDIT,
        category: LedgerCategory.TOP_UP,
        amountInPaise: 5000,
        balanceAfter: 5000,
        note: 'Test entry',
      }
    });

    const entries = await walletRepository.getLedgerEntries(riderDbId);
    expect(entries).toHaveLength(1);
    expect(entries[0].amountInPaise).toBe(5000);
  });
});
