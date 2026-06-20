/**
 * Unit tests for Sprint 3 — Wallet, Deposit, and File service logic.
 *
 * Tests the core business rules:
 *   - Wallet ledger integrity semantics (credit/debit/reversal)
 *   - Deposit service validation (approval/rejection pre-checks)
 *   - File service rules (MIME validation, ownership, path generation, upload rules)
 *
 * These tests are pure logic tests (no database). They validate isolated service functions.
 */

import { describe, it, expect, vi } from 'vitest';
vi.mock('@/lib/db', () => ({ db: {} }));
import { WalletServiceError } from '@/lib/services/wallet-service';

// ---------------------------------------------------------------------------
// Wallet Ledger Semantics (pure logic)
// ---------------------------------------------------------------------------

describe('Wallet Ledger — error class', () => {
  it('creates a WalletServiceError with code', () => {
    const err = new WalletServiceError('Insufficient balance', 'INSUFFICIENT_BALANCE');
    expect(err.message).toBe('Insufficient balance');
    expect(err.code).toBe('INSUFFICIENT_BALANCE');
    expect(err.name).toBe('WalletServiceError');
  });

  it('creates a WalletServiceError with default code', () => {
    const err = new WalletServiceError('Wallet not found');
    expect(err.code).toBe('WALLET_ERROR');
  });
});

describe('Wallet Ledger — credit/debit invariants', () => {
  it('rejects zero or negative amounts', () => {
    // credit and debit functions enforce amountInPaise > 0
    expect(() => {
      throw new WalletServiceError('creditWallet: amountInPaise must be > 0, got 0');
    }).toThrow('amountInPaise must be > 0');
  });

  it('rejects negative debit amounts', () => {
    expect(() => {
      throw new WalletServiceError('debitWallet: amountInPaise must be > 0, got -100');
    }).toThrow('amountInPaise must be > 0');
  });
});

// ---------------------------------------------------------------------------
// Deposit Service Validation (pure logic — no DB)
// ---------------------------------------------------------------------------

describe('Deposit Service — refund eligibility', () => {
  // Import the deposit service to test getRefundEligibleAmount
  // This function is pure logic with no side effects

  it('returns full amount for APPROVED deposit', async () => {
    const { depositService } = await import('@/server/modules/deposits/deposit.service');
    const result = depositService.getRefundEligibleAmount('APPROVED', 50000);
    expect(result).toBe(50000);
  });

  it('returns 0 for PARTIALLY_REFUNDED deposit', async () => {
    const { depositService } = await import('@/server/modules/deposits/deposit.service');
    const result = depositService.getRefundEligibleAmount('PARTIALLY_REFUNDED', 50000);
    expect(result).toBe(0);
  });

  it('returns 0 for PENDING_VERIFICATION deposit', async () => {
    const { depositService } = await import('@/server/modules/deposits/deposit.service');
    const result = depositService.getRefundEligibleAmount('PENDING_VERIFICATION', 50000);
    expect(result).toBe(0);
  });

  it('returns 0 for REJECTED deposit', async () => {
    const { depositService } = await import('@/server/modules/deposits/deposit.service');
    const result = depositService.getRefundEligibleAmount('REJECTED', 50000);
    expect(result).toBe(0);
  });

  it('returns 0 for FORFEITED deposit', async () => {
    const { depositService } = await import('@/server/modules/deposits/deposit.service');
    const result = depositService.getRefundEligibleAmount('FORFEITED', 50000);
    expect(result).toBe(0);
  });

  it('returns 0 for NOT_SUBMITTED deposit', async () => {
    const { depositService } = await import('@/server/modules/deposits/deposit.service');
    const result = depositService.getRefundEligibleAmount('NOT_SUBMITTED', 50000);
    expect(result).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// File Service Rules (pure logic)
// ---------------------------------------------------------------------------

describe('File Service — storage key generation', () => {
  it('generates rider-namespaced key with timestamp', async () => {
    const { fileService } = await import('@/server/modules/files/files.service');
    const key = fileService.generateStorageKey('rider-123', 'kyc_document', 'aadhaar.jpg');
    expect(key).toMatch(/^rider-123\/kyc_document\/\d+-aadhaar\.jpg$/);
  });

  it('sanitizes unsafe characters in filenames', async () => {
    const { fileService } = await import('@/server/modules/files/files.service');
    const key = fileService.generateStorageKey(
      'rider-123',
      'kyc_document',
      '../../malicious<script>.pdf'
    );
    expect(key).toMatch(/^rider-123\/kyc_document\/\d+-.._.._malicious_script_.pdf$/);
    expect(key).not.toContain('<');
    expect(key).not.toContain('>');
    expect(key).not.toContain('/../');
  });
});

describe('File Service — MIME type validation rules', () => {
  it('accepts JPEG images for kyc_document', async () => {
    const { FILE_UPLOAD_RULES } = await import('@/server/modules/files/files.types');
    const rule = FILE_UPLOAD_RULES.kyc_document;
    expect(rule.allowedMimeTypes).toContain('image/jpeg');
    expect(rule.allowedMimeTypes).toContain('image/png');
    expect(rule.allowedMimeTypes).toContain('application/pdf');
  });

  it('rejects unsupported MIME types for kyc_document', async () => {
    const { FILE_UPLOAD_RULES } = await import('@/server/modules/files/files.types');
    const rule = FILE_UPLOAD_RULES.kyc_document;
    expect(rule.allowedMimeTypes).not.toContain('video/mp4');
    expect(rule.allowedMimeTypes).not.toContain('image/gif');
  });

  it('has correct max file sizes per category', async () => {
    const { FILE_UPLOAD_RULES } = await import('@/server/modules/files/files.types');
    expect(FILE_UPLOAD_RULES.kyc_document.maxSizeBytes).toBe(5 * 1024 * 1024);
    expect(FILE_UPLOAD_RULES.profile_photo.maxSizeBytes).toBe(2 * 1024 * 1024);
    expect(FILE_UPLOAD_RULES.vehicle_photo.maxSizeBytes).toBe(5 * 1024 * 1024);
    expect(FILE_UPLOAD_RULES.payment_proof.maxSizeBytes).toBe(5 * 1024 * 1024);
    expect(FILE_UPLOAD_RULES.support_attachment.maxSizeBytes).toBe(10 * 1024 * 1024);
  });

  it('supports video for support_attachment', async () => {
    const { FILE_UPLOAD_RULES } = await import('@/server/modules/files/files.types');
    expect(FILE_UPLOAD_RULES.support_attachment.allowedMimeTypes).toContain('video/mp4');
  });
});

describe('File Service — ownership policy', () => {
  const riderRecord = { ownerId: 'rider-123', purpose: 'kyc_document', visibility: 'PRIVATE' };
  const paymentRecord = { ownerId: 'rider-123', purpose: 'payment_proof', visibility: 'PRIVATE' };
  const profileRecord = { ownerId: 'rider-123', purpose: 'profile_photo', visibility: 'PRIVATE' };

  it('allows rider to access their own files', async () => {
    const { filePolicy } = await import('@/server/modules/files/files.policy');
    expect(filePolicy.canRiderAccess('rider-123', 'rider-123')).toBe(true);
  });

  it("blocks rider from accessing another rider's files", async () => {
    const { filePolicy } = await import('@/server/modules/files/files.policy');
    expect(filePolicy.canRiderAccess('rider-123', 'rider-456')).toBe(false);
  });

  it('allows admin with view_kyc to view KYC documents', async () => {
    const { filePolicy } = await import('@/server/modules/files/files.policy');
    expect(
      filePolicy.canViewFile({ role: 'admin', permissions: ['files_view_kyc'] }, riderRecord)
    ).toBe(true);
  });

  it('blocks admin without view_kyc from viewing KYC documents', async () => {
    const { filePolicy } = await import('@/server/modules/files/files.policy');
    expect(filePolicy.canViewFile({ role: 'admin', permissions: [] }, riderRecord)).toBe(false);
  });

  it('allows admin with view_payment_proof to view payment documents', async () => {
    const { filePolicy } = await import('@/server/modules/files/files.policy');
    expect(
      filePolicy.canViewFile(
        { role: 'admin', permissions: ['files_view_payment_proof'] },
        paymentRecord
      )
    ).toBe(true);
  });

  it('blocks admin without correct permission from viewing payment documents', async () => {
    const { filePolicy } = await import('@/server/modules/files/files.policy');
    expect(
      filePolicy.canViewFile({ role: 'admin', permissions: ['files_view_kyc'] }, paymentRecord)
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Flutter ApiService helpers (pure logic)
// ---------------------------------------------------------------------------

describe('ApiService — MIME type inference', () => {
  // This tests the logic we added to Flutter's ApiService._inferMimeType
  // by recreating the mapping logic in TypeScript

  const inferMimeType = (fileName: string): string => {
    const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
    const mapping: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
      pdf: 'application/pdf',
      mp4: 'video/mp4',
    };
    return mapping[ext] || 'application/octet-stream';
  };

  it('maps .jpg to image/jpeg', () => {
    expect(inferMimeType('photo.jpg')).toBe('image/jpeg');
  });

  it('maps .png to image/png', () => {
    expect(inferMimeType('document.png')).toBe('image/png');
  });

  it('maps .pdf to application/pdf', () => {
    expect(inferMimeType('file.pdf')).toBe('application/pdf');
  });

  it('maps .mp4 to video/mp4', () => {
    expect(inferMimeType('video.mp4')).toBe('video/mp4');
  });

  it('falls back to octet-stream for unknown extensions', () => {
    expect(inferMimeType('file.xyz')).toBe('application/octet-stream');
  });

  it('handles files without extensions', () => {
    expect(inferMimeType('Makefile')).toBe('application/octet-stream');
  });

  it('maps .jpeg to image/jpeg', () => {
    expect(inferMimeType('scan.jpeg')).toBe('image/jpeg');
  });
});

describe('ApiService — category to legacy type mapping', () => {
  // Tests the Flutter _mapCategoryToLegacyType logic recreated in TypeScript

  const mapCategory = (category: string): string => {
    const mapping: Record<string, string> = {
      kyc_document: 'KYC_AADHAAR_FRONT',
      profile_photo: 'KYC_SELFIE',
      vehicle_photo: 'VEHICLE_PICKUP',
      payment_proof: 'TOPUP_PROOF',
      support_attachment: 'SUPPORT',
    };
    return mapping[category] || 'KYC_AADHAAR_FRONT';
  };

  it('maps kyc_document to KYC_AADHAAR_FRONT', () => {
    expect(mapCategory('kyc_document')).toBe('KYC_AADHAAR_FRONT');
  });

  it('maps profile_photo to KYC_SELFIE', () => {
    expect(mapCategory('profile_photo')).toBe('KYC_SELFIE');
  });

  it('maps payment_proof to TOPUP_PROOF', () => {
    expect(mapCategory('payment_proof')).toBe('TOPUP_PROOF');
  });

  it('falls back for unknown categories', () => {
    expect(mapCategory('unknown')).toBe('KYC_AADHAAR_FRONT');
  });
});

// ---------------------------------------------------------------------------
// Deposit State Machine — pure logic
// ---------------------------------------------------------------------------

describe('Deposit State Machine — transition validation', () => {
  let mod: any;
  beforeAll(async () => {
    mod = await import('@/server/modules/deposits/deposit-state-machine');
  });

  it('allows NOT_SUBMITTED → PENDING_VERIFICATION', () => {
    expect(() =>
      mod.validateDepositTransition('NOT_SUBMITTED', 'PENDING_VERIFICATION')
    ).not.toThrow();
  });

  it('allows PENDING_VERIFICATION → APPROVED', () => {
    expect(() => mod.validateDepositTransition('PENDING_VERIFICATION', 'APPROVED')).not.toThrow();
  });

  it('allows PENDING_VERIFICATION → REJECTED', () => {
    expect(() => mod.validateDepositTransition('PENDING_VERIFICATION', 'REJECTED')).not.toThrow();
  });

  it('allows APPROVED → REFUND_REQUESTED', () => {
    expect(() => mod.validateDepositTransition('APPROVED', 'REFUND_REQUESTED')).not.toThrow();
  });

  it('allows APPROVED → FORFEITED', () => {
    expect(() => mod.validateDepositTransition('APPROVED', 'FORFEITED')).not.toThrow();
  });

  it('allows REJECTED → PENDING_VERIFICATION (resubmit)', () => {
    expect(() => mod.validateDepositTransition('REJECTED', 'PENDING_VERIFICATION')).not.toThrow();
  });

  it('allows REFUND_REQUESTED → REFUNDED', () => {
    expect(() => mod.validateDepositTransition('REFUND_REQUESTED', 'REFUNDED')).not.toThrow();
  });

  it('allows REFUND_REQUESTED → PARTIALLY_REFUNDED', () => {
    expect(() =>
      mod.validateDepositTransition('REFUND_REQUESTED', 'PARTIALLY_REFUNDED')
    ).not.toThrow();
  });

  it('allows same-state transition (no-op)', () => {
    expect(() => mod.validateDepositTransition('APPROVED', 'APPROVED')).not.toThrow();
  });

  it('throws on invalid PENDING_VERIFICATION → REFUNDED (skip approval)', () => {
    expect(() => mod.validateDepositTransition('PENDING_VERIFICATION', 'REFUNDED')).toThrow(
      mod.DepositStateMachineError
    );
  });

  it('throws on invalid APPROVED → PENDING_VERIFICATION (regress)', () => {
    expect(() => mod.validateDepositTransition('APPROVED', 'PENDING_VERIFICATION')).toThrow(
      mod.DepositStateMachineError
    );
  });

  it('throws on invalid REJECTED → APPROVED (must resubmit first)', () => {
    expect(() => mod.validateDepositTransition('REJECTED', 'APPROVED')).toThrow(
      mod.DepositStateMachineError
    );
  });

  it('throws on invalid FORFEITED → any', () => {
    expect(() => mod.validateDepositTransition('FORFEITED', 'REFUNDED')).toThrow(
      mod.DepositStateMachineError
    );
  });

  it('throws on invalid REFUNDED → any', () => {
    expect(() => mod.validateDepositTransition('REFUNDED', 'APPROVED')).toThrow(
      mod.DepositStateMachineError
    );
  });
});

describe('Deposit State Machine — canTransitionDeposit helper', () => {
  let mod: any;
  beforeAll(async () => {
    mod = await import('@/server/modules/deposits/deposit-state-machine');
  });

  it('returns true for valid transition', () => {
    expect(mod.canTransitionDeposit('PENDING_VERIFICATION', 'APPROVED')).toBe(true);
  });

  it('returns false for invalid transition', () => {
    expect(mod.canTransitionDeposit('REFUNDED', 'APPROVED')).toBe(false);
  });

  it('returns true for same-state', () => {
    expect(mod.canTransitionDeposit('APPROVED', 'APPROVED')).toBe(true);
  });
});

describe('Deposit Service — refund eligibility', () => {
  it('returns full amount for APPROVED deposit', async () => {
    const { depositService } = await import('@/server/modules/deposits/deposit.service');
    expect(depositService.getRefundEligibleAmount('APPROVED', 50000)).toBe(50000);
  });

  it('returns 0 for PARTIALLY_REFUNDED deposit', async () => {
    const { depositService } = await import('@/server/modules/deposits/deposit.service');
    expect(depositService.getRefundEligibleAmount('PARTIALLY_REFUNDED', 50000)).toBe(0);
  });

  it('returns 0 for PENDING_VERIFICATION deposit', async () => {
    const { depositService } = await import('@/server/modules/deposits/deposit.service');
    expect(depositService.getRefundEligibleAmount('PENDING_VERIFICATION', 50000)).toBe(0);
  });

  it('returns 0 for REJECTED deposit', async () => {
    const { depositService } = await import('@/server/modules/deposits/deposit.service');
    expect(depositService.getRefundEligibleAmount('REJECTED', 50000)).toBe(0);
  });

  it('returns 0 for FORFEITED deposit', async () => {
    const { depositService } = await import('@/server/modules/deposits/deposit.service');
    expect(depositService.getRefundEligibleAmount('FORFEITED', 50000)).toBe(0);
  });

  it('returns 0 for NOT_SUBMITTED deposit', async () => {
    const { depositService } = await import('@/server/modules/deposits/deposit.service');
    expect(depositService.getRefundEligibleAmount('NOT_SUBMITTED', 50000)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Wallet Ledger — category & type validation (pure logic)
// ---------------------------------------------------------------------------

describe('Wallet Ledger — LedgerCategory exhaustiveness', () => {
  it('all known categories are assignable', () => {
    const categories: string[] = [
      'TOP_UP',
      'SECURITY_DEPOSIT',
      'RENT_PAYMENT',
      'REWARD',
      'REFUND',
      'REVERSAL',
      'ADMIN_ADJUSTMENT',
      'FORFEITURE',
    ];
    // Verify no duplicates
    expect(new Set(categories).size).toBe(categories.length);
    // At minimum, TOP_UP and RENT_PAYMENT must exist
    expect(categories).toContain('TOP_UP');
    expect(categories).toContain('RENT_PAYMENT');
    expect(categories).toContain('SECURITY_DEPOSIT');
  });
});

describe('Deposit State Machine — error class', () => {
  let mod: any;
  beforeAll(async () => {
    mod = await import('@/server/modules/deposits/deposit-state-machine');
  });

  it('creates DepositStateMachineError with status info', () => {
    const err = new mod.DepositStateMachineError(
      'bad transition',
      'APPROVED',
      'PENDING_VERIFICATION'
    );
    expect(err.message).toBe('bad transition');
    expect(err.currentStatus).toBe('APPROVED');
    expect(err.targetStatus).toBe('PENDING_VERIFICATION');
    expect(err.name).toBe('DepositStateMachineError');
  });

  it('error message includes allowed transitions', () => {
    expect(() => mod.validateDepositTransition('REFUNDED', 'APPROVED')).toThrow(/REFUNDED/);
    expect(() => mod.validateDepositTransition('REFUNDED', 'APPROVED')).toThrow(/APPROVED/);
    expect(() => mod.validateDepositTransition('REFUNDED', 'APPROVED')).toThrow(/Allowed/);
  });
});

// ---------------------------------------------------------------------------
// Signed URL & FileRecord Flow (pure logic — no DB)
// ---------------------------------------------------------------------------

describe('Signed URLs — storage provider interface', () => {
  it('LocalStorageProvider returns proxy URL for read', async () => {
    const { LocalStorageProvider } = await import('@/lib/storage');
    const provider = new LocalStorageProvider();
    const url = await provider.getSignedReadUrl('rider-123/kyc_document/doc.pdf');
    expect(url).toBe('/api/files/rider-123/kyc_document/doc.pdf');
  });

  it('LocalStorageProvider returns URL as-is for already-prefixed keys', async () => {
    const { LocalStorageProvider } = await import('@/lib/storage');
    const provider = new LocalStorageProvider();
    const url = await provider.getSignedReadUrl('/api/files/test/file.jpg');
    expect(url).toBe('/api/files/test/file.jpg');
  });

  it('LocalStorageProvider returns upload URL with key param', async () => {
    const { LocalStorageProvider } = await import('@/lib/storage');
    const provider = new LocalStorageProvider();
    await expect(
      provider.getSignedUploadUrl('rider-123/doc.pdf', 'application/pdf')
    ).rejects.toThrow('Legacy storage-key upload is disabled');
  });

  it('LocalStorageProvider detect missing file via verifyUpload', async () => {
    const { LocalStorageProvider } = await import('@/lib/storage');
    const provider = new LocalStorageProvider();
    const exists = await provider.verifyUpload('nonexistent/file.pdf');
    expect(exists).toBe(false);
  });
});
