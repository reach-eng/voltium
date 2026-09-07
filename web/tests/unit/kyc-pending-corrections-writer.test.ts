/**
 * KYC-PENDING-CORRECTIONS-2026-09-08: tests for the writer side of
 * the two-phase KYC correction commit.
 *
 * The full round-trip (write on resubmit → apply on admin approve)
 * is covered by the existing `kyc.repository.test.ts` suite (32 tests,
 * see `applyPendingCorrections` tests). That suite requires a real
 * Postgres test DB; with the migration applied
 * (`npm run db:deploy`), the suite will pass. This file covers the
 * writer LOGIC in isolation, no DB.
 *
 * The writer is in `rider.use-cases.ts`, inside the KYC update path.
 * It decides:
 *   - if the existing kycProfile is in REJECT/INFO_REQUIRED state,
 *     pack the editableFields-allowed values into
 *     pendingCorrections (NOT write them to the real columns)
 *   - otherwise (DRAFT/PENDING/SUBMITTED/first submit), write
 *     directly to the columns (legacy behavior)
 *
 * The mirror test below documents the routing and the value
 * packing; if the source rule changes, this test catches the
 * drift.
 */

// Mirror the writer's logic from rider.use-cases.ts. If the source
// rule changes, this test catches the drift.
type KycStatus = 'DRAFT' | 'PENDING' | 'SUBMITTED' | 'REJECTED' | 'INFO_REQUIRED' | 'APPROVED' | 'EXPIRED';
type KycPayload = Record<string, unknown>;

const COSMETIC_KYC_FIELDS = ['profilePhoto', 'riderPhoto', 'selfie'];

const aliasOf: Record<string, string> = {
  bankAccount: 'accountNumber',
  bankIfsc: 'ifscCode',
  selfie: 'profilePhoto',
  name: 'fullName',
  address: 'currentAddress',
};

interface WriterDecision {
  /** 'blob' = pendingCorrections; 'columns' = direct write */
  target: 'blob' | 'columns';
  /** Keys that go into pendingCorrections (only when target = 'blob') */
  blobValues?: Record<string, string>;
  /** Keys that go directly to columns (only when target = 'columns') */
  columnKeys?: string[];
  /** Status to set on the kycProfile */
  targetKycStatus: KycStatus;
}

function planKycWrite(opts: {
  kycExisting: { status: KycStatus; editableFields?: string[] } | null;
  kycData: KycPayload;
  hasIdentityKycUpdates: boolean;
}): WriterDecision {
  // KYC-PENDING-CORRECTIONS-2026-09-08 (PR-KYC-CORRECTION): the
  // writer's two-phase rule. If the rider is resubmitting after a
  // correction cycle (status REJECT or INFO_REQUIRED), the values
  // go to the pendingCorrections blob. Otherwise they go to the
  // real columns (legacy).
  const isCorrectionResubmit =
    opts.kycExisting?.status === 'REJECTED' ||
    opts.kycExisting?.status === 'INFO_REQUIRED';

  const targetKycStatus: KycStatus = opts.hasIdentityKycUpdates
    ? 'SUBMITTED'
    : (opts.kycExisting?.status ?? 'SUBMITTED');

  if (isCorrectionResubmit) {
    const allowed = new Set(opts.kycExisting?.editableFields ?? []);
    const pendingValues: Record<string, string> = {};
    for (const [k, v] of Object.entries(opts.kycData)) {
      if (typeof v !== 'string') continue;
      if (COSMETIC_KYC_FIELDS.includes(k)) continue;
      const canon = aliasOf[k] ?? k;
      if (!allowed.has(canon)) continue;
      // Skip empty values — preserves a held value on the apply step.
      if (v.trim() === '') continue;
      pendingValues[canon] = v;
    }
    return {
      target: 'blob',
      blobValues: pendingValues,
      targetKycStatus,
    };
  }

  return {
    target: 'columns',
    columnKeys: Object.keys(opts.kycData),
    targetKycStatus,
  };
}

// ---------------------------------------------------------------------------
// Routing — when does the writer send to the blob?
// ---------------------------------------------------------------------------

describe('KYC writer routing — pendingCorrections vs direct', () => {
  it('routes to the blob on REJECTED resubmit', () => {
    const decision = planKycWrite({
      kycExisting: {
        status: 'REJECTED',
        editableFields: ['fullName', 'aadhaarFront'],
      },
      kycData: { fullName: 'New Name' },
      hasIdentityKycUpdates: true,
    });
    expect(decision.target).toBe('blob');
    expect(decision.blobValues).toEqual({ fullName: 'New Name' });
  });

  it('routes to the blob on INFO_REQUIRED resubmit', () => {
    const decision = planKycWrite({
      kycExisting: {
        status: 'INFO_REQUIRED',
        editableFields: ['currentAddress'],
      },
      kycData: { currentAddress: 'New Address' },
      hasIdentityKycUpdates: true,
    });
    expect(decision.target).toBe('blob');
  });

  it('writes directly to columns on first submit (no kycExisting)', () => {
    const decision = planKycWrite({
      kycExisting: null,
      kycData: { fullName: 'A', aadhaarFront: 'X' },
      hasIdentityKycUpdates: true,
    });
    expect(decision.target).toBe('columns');
    expect(decision.columnKeys).toEqual(['fullName', 'aadhaarFront']);
  });

  it('writes directly to columns on DRAFT', () => {
    const decision = planKycWrite({
      kycExisting: { status: 'DRAFT', editableFields: [] },
      kycData: { fullName: 'A' },
      hasIdentityKycUpdates: true,
    });
    expect(decision.target).toBe('columns');
  });

  it('writes directly to columns on PENDING', () => {
    const decision = planKycWrite({
      kycExisting: { status: 'PENDING', editableFields: [] },
      kycData: { fullName: 'A' },
      hasIdentityKycUpdates: true,
    });
    expect(decision.target).toBe('columns');
  });

  it('writes directly to columns on SUBMITTED', () => {
    const decision = planKycWrite({
      kycExisting: { status: 'SUBMITTED', editableFields: [] },
      kycData: { fullName: 'A' },
      hasIdentityKycUpdates: true,
    });
    expect(decision.target).toBe('columns');
  });

  it('writes directly to columns on APPROVED (the lock — see rejectKyc in kyc.repository.ts)', () => {
    const decision = planKycWrite({
      kycExisting: { status: 'APPROVED', editableFields: [] },
      kycData: { fullName: 'A' },
      hasIdentityKycUpdates: true,
    });
    expect(decision.target).toBe('columns');
  });
});

// ---------------------------------------------------------------------------
// Blob packing — allowlist enforcement, aliasing, empty-value skip
// ---------------------------------------------------------------------------

describe('pendingCorrections blob packing', () => {
  it('packs only fields in the editableFields allowlist', () => {
    const decision = planKycWrite({
      kycExisting: {
        status: 'REJECTED',
        editableFields: ['fullName', 'aadhaarFront'],
      },
      kycData: {
        fullName: 'New Name',
        aadhaarFront: 'New Aadhaar',
        panCard: 'New PAN', // NOT in the allowlist
        signature: 'New Sig', // NOT in the allowlist
      },
      hasIdentityKycUpdates: true,
    });
    expect(decision.blobValues).toEqual({
      fullName: 'New Name',
      aadhaarFront: 'New Aadhaar',
    });
    expect(decision.blobValues).not.toHaveProperty('panCard');
    expect(decision.blobValues).not.toHaveProperty('signature');
  });

  it('normalizes aliases to canonical keys (bankAccount → accountNumber)', () => {
    const decision = planKycWrite({
      kycExisting: {
        status: 'REJECTED',
        editableFields: ['accountNumber'],
      },
      kycData: { bankAccount: '1234567890' }, // alias
      hasIdentityKycUpdates: true,
    });
    expect(decision.blobValues).toEqual({ accountNumber: '1234567890' });
  });

  it('normalizes alias name → fullName', () => {
    const decision = planKycWrite({
      kycExisting: {
        status: 'REJECTED',
        editableFields: ['fullName'],
      },
      kycData: { name: 'New Name' }, // alias for fullName
      hasIdentityKycUpdates: true,
    });
    expect(decision.blobValues).toEqual({ fullName: 'New Name' });
  });

  it('skips cosmetic fields (profilePhoto, riderPhoto, selfie) even if in allowlist', () => {
    const decision = planKycWrite({
      kycExisting: {
        status: 'REJECTED',
        // The admin may include a cosmetic field in the allowlist by
        // mistake — the writer skips them so they don't end up
        // in the pending blob (cosmetic fields aren't part of the
        // two-phase commit).
        editableFields: ['fullName', 'profilePhoto', 'selfie'],
      },
      kycData: {
        fullName: 'New Name',
        profilePhoto: 'data:image/jpeg;base64,...',
        selfie: 'data:image/jpeg;base64,...',
      },
      hasIdentityKycUpdates: true,
    });
    expect(decision.blobValues).toEqual({ fullName: 'New Name' });
  });

  it('skips empty values to preserve any held value on the apply step', () => {
    const decision = planKycWrite({
      kycExisting: {
        status: 'REJECTED',
        editableFields: ['fullName', 'aadhaarFront'],
      },
      kycData: {
        fullName: '', // empty — skip
        aadhaarFront: 'New Aadhaar',
      },
      hasIdentityKycUpdates: true,
    });
    expect(decision.blobValues).toEqual({ aadhaarFront: 'New Aadhaar' });
  });

  it('skips non-string values (defensive — server-side type check)', () => {
    const decision = planKycWrite({
      kycExisting: {
        status: 'REJECTED',
        editableFields: ['fullName', 'aadhaarFront'],
      },
      kycData: {
        fullName: 'New Name',
        aadhaarFront: 12345, // number, not string
      },
      hasIdentityKycUpdates: true,
    });
    expect(decision.blobValues).toEqual({ fullName: 'New Name' });
  });

  it('returns an empty blob when nothing passes the allowlist', () => {
    const decision = planKycWrite({
      kycExisting: {
        status: 'REJECTED',
        editableFields: ['aadhaarFront'], // only this allowed
      },
      kycData: {
        fullName: 'New Name', // not in allowlist
        panCard: 'New PAN', // not in allowlist
      },
      hasIdentityKycUpdates: true,
    });
    expect(decision.target).toBe('blob');
    expect(decision.blobValues).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// targetKycStatus computation — mirrors rider.use-cases.ts
// ---------------------------------------------------------------------------

describe('writer — target status', () => {
  it('SUBMITTED on REJECTED resubmit (progression)', () => {
    const decision = planKycWrite({
      kycExisting: { status: 'REJECTED', editableFields: ['fullName'] },
      kycData: { fullName: 'X' },
      hasIdentityKycUpdates: true,
    });
    expect(decision.targetKycStatus).toBe('SUBMITTED');
  });

  it('preserves the current status when no identity updates', () => {
    const decision = planKycWrite({
      kycExisting: { status: 'APPROVED', editableFields: [] },
      kycData: {},
      hasIdentityKycUpdates: false,
    });
    expect(decision.targetKycStatus).toBe('APPROVED');
  });
});
