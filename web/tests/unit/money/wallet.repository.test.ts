import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { testDb } from '../../_setup/test-postgres';
import { walletRepository } from '../../../src/server/modules/wallet/wallet.repository';
import { TransactionType, TransactionPurpose, TransactionStatus, LedgerEntryType, LedgerCategory } from '@prisma/client';

describe('walletRepository', () => {
  beforeAll(async () => {
    process.env.DATABASE_OFFLINE = 'false';
  });

  afterAll(async () => {
  });

  let riderId: string;
  let riderDbId: string;
  
  beforeEach(async () => {
    riderId = `RD-${uuidv4().substring(0, 6)}`;
    riderDbId = uuidv4();
    const phone = Math.floor(Math.random() * 9000000000 + 1000000000).toString();
    const referralCode = `REF-${uuidv4().substring(0, 12)}`;
    
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

  describe('findByRiderId', () => {
    it('should return undefined if wallet not found', async () => {
      const wallet = await walletRepository.findByRiderId('non-existent');
      expect(wallet).toBeNull();
    });

    it('should find by rider id', async () => {
      await walletRepository.updateBalance(riderDbId, 20000);
      
      const wallet = await walletRepository.findByRiderId(riderDbId);
      expect(wallet).not.toBeNull();
      expect(wallet!.balanceInPaise).toBe(20000);
    });
  });

  describe('getBalance', () => {
    it('should return 0 balance if wallet not found', async () => {
      const balance = await walletRepository.getBalance('non-existent');
      expect(balance).toBe(0);
    });

    it('should get balance after update', async () => {
      await walletRepository.updateBalance(riderDbId, 25000);
      
      const balance = await walletRepository.getBalance(riderDbId);
      expect(balance).toBe(25000);
    });

    it('should return 0 for rider with 0 balance', async () => {
      await walletRepository.updateBalance(riderDbId, 0);
      expect(await walletRepository.getBalance(riderDbId)).toBe(0);
    });
  });

  describe('updateBalance', () => {
    it('should upsert balance correctly (create)', async () => {
      const wallet = await walletRepository.updateBalance(riderDbId, 10000);
      expect(wallet.balanceInPaise).toBe(10000);
      expect(wallet.riderId).toBe(riderDbId);
    });

    it('should upsert balance correctly (update)', async () => {
      await walletRepository.updateBalance(riderDbId, 10000);
      const wallet = await walletRepository.updateBalance(riderDbId, 15000);
      expect(wallet.balanceInPaise).toBe(15000);
    });

    it('should support setting balance to 0', async () => {
      await walletRepository.updateBalance(riderDbId, 5000);
      const wallet = await walletRepository.updateBalance(riderDbId, 0);
      expect(wallet.balanceInPaise).toBe(0);
    });
  });

  describe('createTransaction', () => {
    it('should create and retrieve transaction with required fields only', async () => {
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
    });

    it('should create transaction with all optional fields', async () => {
      const idKey = `idem-${uuidv4()}`;
      const txn = await walletRepository.createTransaction({
        riderId: riderDbId,
        type: TransactionType.DEBIT,
        amount: 3000,
        purpose: TransactionPurpose.RENT_PAYMENT,
        method: 'RAZORPAY',
        proofUrl: 'https://example.com/proof.jpg',
        upiRef: 'UPI-123456',
        idempotencyKey: idKey,
        description: 'Monthly rent debit',
        status: TransactionStatus.APPROVED,
      });

      expect(txn.method).toBe('RAZORPAY');
      expect(txn.proofUrl).toBe('https://example.com/proof.jpg');
      expect(txn.upiRef).toBe('UPI-123456');
      expect(txn.idempotencyKey).toBe(idKey);
      expect(txn.description).toBe('Monthly rent debit');
      expect(txn.status).toBe(TransactionStatus.APPROVED);
    });

    it('should find transaction by idempotency key', async () => {
      const idKey = `idem-${uuidv4()}`;
      const txn = await walletRepository.createTransaction({
        riderId: riderDbId,
        type: TransactionType.CREDIT,
        amount: 5000,
        purpose: TransactionPurpose.TOP_UP,
        idempotencyKey: idKey,
      });

      const byKey = await walletRepository.findTransactionByKey(idKey);
      expect(byKey?.id).toBe(txn.id);
    });

    it('returns null for non-existent idempotency key', async () => {
      const byKey = await walletRepository.findTransactionByKey('non-existent-key');
      expect(byKey).toBeNull();
    });

    it('returns null for findTransactionById non-existent', async () => {
      const retrieved = await walletRepository.findTransactionById('non-existent-id');
      expect(retrieved).toBeNull();
    });

    it('should retrieve all transactions via getTransactions', async () => {
      const txn = await walletRepository.createTransaction({
        riderId: riderDbId,
        type: TransactionType.CREDIT,
        amount: 5000,
        purpose: TransactionPurpose.TOP_UP,
        idempotencyKey: `idem-${uuidv4()}`,
      });

      const txns = await walletRepository.getTransactions(riderDbId);
      expect(txns).toHaveLength(1);
      expect(txns[0].id).toBe(txn.id);
    });

    it('should respect limit in getTransactions', async () => {
      await walletRepository.createTransaction({
        riderId: riderDbId,
        type: TransactionType.CREDIT,
        amount: 5000,
        purpose: TransactionPurpose.TOP_UP,
        idempotencyKey: `idem-${uuidv4()}`,
      });
      await walletRepository.createTransaction({
        riderId: riderDbId,
        type: TransactionType.CREDIT,
        amount: 3000,
        purpose: TransactionPurpose.TOP_UP,
        idempotencyKey: `idem-${uuidv4()}`,
      });

      const txnsAll = await walletRepository.getTransactions(riderDbId, 20);
      expect(txnsAll.length).toBeGreaterThanOrEqual(2);

      const txnsLimited = await walletRepository.getTransactions(riderDbId, 1);
      expect(txnsLimited).toHaveLength(1);
    });
  });

  describe('updateTransactionStatus', () => {
    it('should update transaction status to APPROVED', async () => {
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

    it('should update transaction status to REJECTED with approvedAt set', async () => {
      const txn = await walletRepository.createTransaction({
        riderId: riderDbId,
        type: TransactionType.CREDIT,
        amount: 5000,
        purpose: TransactionPurpose.TOP_UP,
      });

      const updated = await walletRepository.updateTransactionStatus(txn.id, TransactionStatus.REJECTED, 'admin-2');
      expect(updated.status).toBe(TransactionStatus.REJECTED);
      expect(updated.approvedAt).toBeDefined();
    });

    it('should update transaction status to FAILED without approvedAt', async () => {
      const txn = await walletRepository.createTransaction({
        riderId: riderDbId,
        type: TransactionType.CREDIT,
        amount: 5000,
        purpose: TransactionPurpose.TOP_UP,
      });

      const updated = await walletRepository.updateTransactionStatus(txn.id, TransactionStatus.FAILED);
      expect(updated.status).toBe(TransactionStatus.FAILED);
      expect(updated.approvedAt).toBeNull();
    });
  });

  describe('getLedgerEntries', () => {
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

    it('should return empty if no ledger entries', async () => {
      const entries = await walletRepository.getLedgerEntries(riderDbId);
      expect(entries).toHaveLength(0);
    });

    it('should respect limit in getLedgerEntries', async () => {
      const wallet = await testDb.wallet.create({
        data: {
          riderId: riderDbId,
          balanceInPaise: 15000,
          securityDeposit: 0,
        }
      });

      // Create 3 ledger entries
      for (let i = 0; i < 3; i++) {
        await testDb.walletLedger.create({
          data: {
            riderId: riderDbId,
            walletId: wallet.id,
            entryType: LedgerEntryType.CREDIT,
            category: LedgerCategory.TOP_UP,
            amountInPaise: 5000,
            balanceAfter: 5000 * (i + 1),
          }
        });
      }

      const allEntries = await walletRepository.getLedgerEntries(riderDbId, 50);
      expect(allEntries.length).toBe(3);

      const limited = await walletRepository.getLedgerEntries(riderDbId, 1);
      expect(limited).toHaveLength(1);
    });
  });
});


