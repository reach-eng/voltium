/**
 * Phase 2b — Input Validation Negative Tests
 *
 * Tests every Zod schema in validators.ts with:
 *   - Missing required fields
 *   - Invalid format (date, phone, email, Aadhaar, PAN, IFSC)
 *   - Empty / null / undefined
 *   - Extreme values (negative amounts, huge strings, 100-year dates)
 *
 * Pure unit tests — no database or HTTP needed.
 */

import { describe, it, expect } from 'vitest';
import {
  validateBody,
  sendOtpSchema,
  verifyOtpSchema,
  updateProfileSchema,
  submitKycSchema,
  submitGuarantorSchema,
  topUpSchema,
  createTicketSchema,
  createVehicleSchema,
  approveTransactionSchema,
  createPlanSchema,
  createRiderSchema,
  createOfferSchema,
  createCouponSchema,
  createFaqSchema,
  createHubSchema,
  createTeamLeaderSchema,
  sendNotificationSchema,
  createIncidentSchema,
  createEarningSchema,
  subscribePlanSchema,
  bulkActionSchema,
  vehicleBulkActionSchema,
  ticketBulkActionSchema,
  adminWalletTopupSchema,
  updateSettingsSchema,
  updateLegalSchema,
  updateTicketSchema,
  ticketReplySchema,
  awardRewardSchema,
  riderActionSchema,
  devicePermissionsSchema,
  vehicleReturnSchema,
  createAnnouncementSchema,
  chatMessageSchema,
  registerTokenSchema,
  refreshTokenSchema,
} from '../../src/lib/validators';

// ── Helper ──────────────────────────────────────────────────────────────────

function expectInvalid(schema: any, data: any, expectedMessage?: string) {
  const result = validateBody(schema, data);
  expect(result.success).toBe(false);
  expect(result.error).toBeTruthy();
  if (expectedMessage) {
    expect(result.error).toContain(expectedMessage);
  }
}

function expectValid(schema: any, data: any) {
  const result = validateBody(schema, data);
  expect(result.success).toBe(true);
  expect(result.data).toBeTruthy();
  expect(result.error).toBeNull();
}

// ═══════════════════════════════════════════════════════════════════════════════
// sendOtpSchema
// ═══════════════════════════════════════════════════════════════════════════════

describe('sendOtpSchema — negative', () => {
  it('rejects missing phone', () => {
    expectInvalid(sendOtpSchema, {});
  });

  it('rejects phone with letters', () => {
    expectInvalid(sendOtpSchema, { phone: 'abcdefghij' });
  });

  it('rejects phone shorter than 10 digits', () => {
    expectInvalid(sendOtpSchema, { phone: '987654321' }); // 9 digits
  });

  it('rejects phone longer than 10 digits', () => {
    expectInvalid(sendOtpSchema, { phone: '98765432100' }); // 11 digits
  });

  it('rejects empty string phone', () => {
    expectInvalid(sendOtpSchema, { phone: '' });
  });

  it('rejects null phone', () => {
    expectInvalid(sendOtpSchema, { phone: null });
  });

  it('rejects phone with special characters', () => {
    expectInvalid(sendOtpSchema, { phone: '98765-4321' });
  });

  it('rejects phone with spaces', () => {
    expectInvalid(sendOtpSchema, { phone: '987 654 321' });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// verifyOtpSchema
// ═══════════════════════════════════════════════════════════════════════════════

describe('verifyOtpSchema — negative', () => {
  it('rejects empty body', () => {
    expectInvalid(verifyOtpSchema, {});
  });

  it('rejects phone without otp', () => {
    expectInvalid(verifyOtpSchema, { phone: '9876543210' });
  });

  it('rejects otp without phone', () => {
    expectInvalid(verifyOtpSchema, { otp: '123456' });
  });

  it('rejects otp shorter than 6 digits', () => {
    expectInvalid(verifyOtpSchema, { phone: '9876543210', otp: '12345' });
  });

  it('rejects otp longer than 6 digits', () => {
    expectInvalid(verifyOtpSchema, { phone: '9876543210', otp: '1234567' });
  });

  it('accepts otp with letters (schema validates length only, not numeric)', () => {
    // verifyOtpSchema uses z.string().length(6) — does not enforce digits-only
    expectValid(verifyOtpSchema, { phone: '9876543210', otp: 'abcdef' });
  });

  it('rejects invalid phone format in otp flow', () => {
    expectInvalid(verifyOtpSchema, { phone: '123', otp: '123456' });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// updateProfileSchema
// ═══════════════════════════════════════════════════════════════════════════════

describe('updateProfileSchema — negative', () => {
  it('rejects invalid email format', () => {
    expectInvalid(updateProfileSchema, { email: 'not-an-email' });
  });

  it('rejects dob in wrong format (yyyy-mm-dd)', () => {
    expectInvalid(updateProfileSchema, { dob: '1998-05-15' });
  });

  it('rejects dob with wrong separators', () => {
    expectInvalid(updateProfileSchema, { dob: '15/05/1998' });
  });

  it('rejects fullName too short', () => {
    expectInvalid(updateProfileSchema, { fullName: 'A' }); // min 2
  });

  it('rejects fullName too long', () => {
    expectInvalid(updateProfileSchema, { fullName: 'X'.repeat(101) }); // max 100
  });

  it('rejects currentAddress too long', () => {
    expectInvalid(updateProfileSchema, { currentAddress: 'X'.repeat(501) }); // max 500
  });

  it('accepts any intent string (nullish string)', () => {
    expectValid(updateProfileSchema, { intent: 'commute' });
  });

  it('accepts valid intent values', () => {
    expectValid(updateProfileSchema, { intent: 'deliver' });
    expectValid(updateProfileSchema, { intent: 'personal' });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// submitKycSchema
// ═══════════════════════════════════════════════════════════════════════════════

describe('submitKycSchema — negative', () => {
  const validKyc = {
    riderId: 'rider-1',
    aadhaarNumber: '1234-5678-9012',
    panNumber: 'ABCDE1234F',
    bankName: 'HDFC',
    bankAccount: '1234567890',
    bankIfsc: 'HDFC0000123',
    riderPhoto: 'https://example.com/photo.jpg',
    riderVideo: 'https://example.com/video.mp4',
  };

  it('rejects missing riderId', () => {
    const { riderId, ...rest } = validKyc;
    expectInvalid(submitKycSchema, rest);
  });

  it('rejects missing aadhaarNumber', () => {
    const { aadhaarNumber, ...rest } = validKyc;
    expectInvalid(submitKycSchema, rest);
  });

  it('rejects aadhaar without dashes', () => {
    expectInvalid(submitKycSchema, { ...validKyc, aadhaarNumber: '123456789012' });
  });

  it('rejects aadhaar with wrong digit count', () => {
    expectInvalid(submitKycSchema, { ...validKyc, aadhaarNumber: '1234-5678-901' }); // 11 digits
  });

  it('rejects aadhaar with letters', () => {
    expectInvalid(submitKycSchema, { ...validKyc, aadhaarNumber: 'ABCD-EFGH-IJKL' });
  });

  it('rejects PAN with lowercase', () => {
    expectInvalid(submitKycSchema, { ...validKyc, panNumber: 'abcde1234f' });
  });

  it('rejects PAN too short', () => {
    expectInvalid(submitKycSchema, { ...validKyc, panNumber: 'ABCDE1234' }); // 9 chars
  });

  it('rejects PAN too long', () => {
    expectInvalid(submitKycSchema, { ...validKyc, panNumber: 'ABCDE1234FG' }); // 11 chars
  });

  it('rejects PAN with wrong pattern (starts with digit)', () => {
    expectInvalid(submitKycSchema, { ...validKyc, panNumber: '1BCDE1234F' });
  });

  it('rejects missing bankName', () => {
    const { bankName, ...rest } = validKyc;
    expectInvalid(submitKycSchema, rest);
  });

  it('rejects bankAccount too short (< 8 digits)', () => {
    expectInvalid(submitKycSchema, { ...validKyc, bankAccount: '1234567' });
  });

  it('rejects bankAccount too long (> 18 digits)', () => {
    expectInvalid(submitKycSchema, { ...validKyc, bankAccount: '1'.repeat(19) });
  });

  it('rejects bankAccount with letters', () => {
    expectInvalid(submitKycSchema, { ...validKyc, bankAccount: 'abcdefghij' });
  });

  it('rejects IFSC too short', () => {
    expectInvalid(submitKycSchema, { ...validKyc, bankIfsc: 'SBIN001' }); // 7 chars
  });

  it('rejects IFSC wrong format (no zero at position 5)', () => {
    expectInvalid(submitKycSchema, { ...validKyc, bankIfsc: 'SBIN1001234' });
  });

  it('rejects IFSC with lowercase', () => {
    expectInvalid(submitKycSchema, { ...validKyc, bankIfsc: 'sbin0001234' });
  });

  it('accepts valid KYC data', () => {
    expectValid(submitKycSchema, validKyc);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// submitGuarantorSchema
// ═══════════════════════════════════════════════════════════════════════════════

describe('submitGuarantorSchema — negative', () => {
  const validGuarantor = {
    riderId: 'rider-1',
    name: 'Vikram Sharma',
    relation: 'Father',
    phone: '9876543210',
    video: 'https://example.com/guarantor.mp4',
  };

  it('rejects missing name', () => {
    const { name, ...rest } = validGuarantor;
    expectInvalid(submitGuarantorSchema, rest);
  });

  it('rejects name too short', () => {
    expectInvalid(submitGuarantorSchema, { ...validGuarantor, name: 'V' }); // min 2
  });

  it('rejects missing relation', () => {
    const { relation, ...rest } = validGuarantor;
    expectInvalid(submitGuarantorSchema, rest);
  });

  it('rejects invalid phone format', () => {
    expectInvalid(submitGuarantorSchema, { ...validGuarantor, phone: '12345' });
  });

  it('rejects phone with letters', () => {
    expectInvalid(submitGuarantorSchema, { ...validGuarantor, phone: 'abcdefghij' });
  });

  it('rejects dob in wrong format', () => {
    expectInvalid(submitGuarantorSchema, { ...validGuarantor, dob: '1970-03-20' });
  });

  it('accepts valid guarantor data', () => {
    expectValid(submitGuarantorSchema, validGuarantor);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// topUpSchema
// ═══════════════════════════════════════════════════════════════════════════════

describe('topUpSchema — negative', () => {
  const validTopUp = {
    riderId: 'rider-1',
    amount: 500,
    purpose: 'TOP_UP',
    method: 'UPI',
    proofUrl: 'https://example.com/receipt.jpg',
  };

  it('rejects missing riderId', () => {
    const { riderId, ...rest } = validTopUp;
    expectInvalid(topUpSchema, rest);
  });

  it('rejects zero amount', () => {
    expectInvalid(topUpSchema, { ...validTopUp, amount: 0 });
  });

  it('rejects negative amount', () => {
    expectInvalid(topUpSchema, { ...validTopUp, amount: -500 });
  });

  it('rejects amount exceeding max (50000)', () => {
    expectInvalid(topUpSchema, { ...validTopUp, amount: 50001 });
  });

  it('accepts amount at max boundary (50000)', () => {
    expectValid(topUpSchema, { ...validTopUp, amount: 50000 });
  });

  it('rejects invalid purpose', () => {
    expectInvalid(topUpSchema, { ...validTopUp, purpose: 'PENALTY' });
  });

  it('rejects invalid method', () => {
    expectInvalid(topUpSchema, { ...validTopUp, method: 'NET_BANKING' });
  });

  it('accepts all valid purpose values', () => {
    expectValid(topUpSchema, { ...validTopUp, purpose: 'TOP_UP' });
    expectValid(topUpSchema, { ...validTopUp, purpose: 'SECURITY_DEPOSIT' });
  });

  it('accepts all valid method values', () => {
    expectValid(topUpSchema, { ...validTopUp, method: 'UPI' });
    expectValid(topUpSchema, { ...validTopUp, method: 'CASH' });
    expectValid(topUpSchema, { ...validTopUp, method: 'CARD' });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// createTicketSchema
// ═══════════════════════════════════════════════════════════════════════════════

describe('createTicketSchema — negative', () => {
  const validTicket = {
    riderId: 'rider-1',
    category: 'TECHNICAL',
    subject: 'Battery not charging properly',
    message: 'Vehicle battery is not holding charge after full cycle.',
  };

  it('rejects missing category', () => {
    const { category, ...rest } = validTicket;
    expectInvalid(createTicketSchema, rest);
  });

  it('rejects invalid category', () => {
    expectInvalid(createTicketSchema, { ...validTicket, category: 'BILLING' });
  });

  it('rejects subject too short (< 5 chars)', () => {
    expectInvalid(createTicketSchema, { ...validTicket, subject: 'Hi' });
  });

  it('rejects subject too long (> 200 chars)', () => {
    expectInvalid(createTicketSchema, { ...validTicket, subject: 'X'.repeat(201) });
  });

  it('rejects message too short (< 10 chars)', () => {
    expectInvalid(createTicketSchema, { ...validTicket, message: 'Short msg' });
  });

  it('rejects message too long (> 5000 chars)', () => {
    expectInvalid(createTicketSchema, { ...validTicket, message: 'X'.repeat(5001) });
  });

  it('rejects invalid priority', () => {
    expectInvalid(createTicketSchema, { ...validTicket, priority: 'URGENT' });
  });

  it('accepts all valid categories', () => {
    for (const cat of ['TECHNICAL', 'PAYMENT', 'VEHICLE', 'GENERAL', 'TROUBLESHOOTER', 'BATTERY']) {
      expectValid(createTicketSchema, { ...validTicket, category: cat });
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// createVehicleSchema
// ═══════════════════════════════════════════════════════════════════════════════

describe('createVehicleSchema — negative', () => {
  const validVehicle = {
    vehicleNumber: 'DL 04 AB 1234',
    model: 'Volt MX-4',
    hubId: 'hub-delhi-central',
  };

  it('rejects missing vehicleNumber', () => {
    const { vehicleNumber, ...rest } = validVehicle;
    expectInvalid(createVehicleSchema, rest);
  });

  it('rejects vehicleNumber too short (< 5 chars)', () => {
    expectInvalid(createVehicleSchema, { ...validVehicle, vehicleNumber: 'DL04' });
  });

  it('rejects missing model', () => {
    const { model, ...rest } = validVehicle;
    expectInvalid(createVehicleSchema, rest);
  });

  it('rejects missing hubId', () => {
    const { hubId, ...rest } = validVehicle;
    expectInvalid(createVehicleSchema, rest);
  });

  it('rejects invalid status value', () => {
    expectInvalid(createVehicleSchema, { ...validVehicle, status: 'PARKED' });
  });

  it('accepts all valid statuses', () => {
    const statuses = ['AVAILABLE', 'RESERVED', 'ASSIGNED', 'ACTIVE_RENTAL', 'RETURN_PENDING', 'MAINTENANCE', 'RETIRED', 'LOST'];
    for (const status of statuses) {
      expectValid(createVehicleSchema, { ...validVehicle, status });
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// approveTransactionSchema
// ═══════════════════════════════════════════════════════════════════════════════

describe('approveTransactionSchema — negative', () => {
  it('rejects missing id', () => {
    expectInvalid(approveTransactionSchema, { action: 'APPROVE' });
  });

  it('rejects missing action', () => {
    expectInvalid(approveTransactionSchema, { id: 'txn-1' });
  });

  it('rejects invalid action', () => {
    expectInvalid(approveTransactionSchema, { id: 'txn-1', action: 'DELETE' });
  });

  it('rejects negative walletCreditAmount', () => {
    expectInvalid(approveTransactionSchema, {
      id: 'txn-1',
      action: 'APPROVE',
      walletCreditAmount: -100,
    });
  });

  it('accepts all valid actions', () => {
    expectValid(approveTransactionSchema, { id: 'txn-1', action: 'APPROVE' });
    expectValid(approveTransactionSchema, { id: 'txn-1', action: 'REJECT' });
    expectValid(approveTransactionSchema, { id: 'txn-1', action: 'REVERSE' });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// createPlanSchema
// ═══════════════════════════════════════════════════════════════════════════════

describe('createPlanSchema — negative', () => {
  const validPlan = {
    name: 'Daily Plan',
    type: 'DAILY',
    price: 399,
    durationDays: 1,
  };

  it('rejects missing name', () => {
    const { name, ...rest } = validPlan;
    expectInvalid(createPlanSchema, rest);
  });

  it('rejects missing type', () => {
    const { type, ...rest } = validPlan;
    expectInvalid(createPlanSchema, rest);
  });

  it('rejects invalid type', () => {
    expectInvalid(createPlanSchema, { ...validPlan, type: 'HOURLY' });
  });

  it('rejects zero price', () => {
    expectInvalid(createPlanSchema, { ...validPlan, price: 0 });
  });

  it('rejects negative price', () => {
    expectInvalid(createPlanSchema, { ...validPlan, price: -100 });
  });

  it('rejects zero durationDays', () => {
    expectInvalid(createPlanSchema, { ...validPlan, durationDays: 0 });
  });

  it('rejects negative durationDays', () => {
    expectInvalid(createPlanSchema, { ...validPlan, durationDays: -1 });
  });

  it('rejects non-integer durationDays', () => {
    expectInvalid(createPlanSchema, { ...validPlan, durationDays: 1.5 });
  });

  it('accepts all valid types', () => {
    expectValid(createPlanSchema, { ...validPlan, type: 'DAILY' });
    expectValid(createPlanSchema, { ...validPlan, type: 'WEEKLY' });
    expectValid(createPlanSchema, { ...validPlan, type: 'MONTHLY' });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// createOfferSchema
// ═══════════════════════════════════════════════════════════════════════════════

describe('createOfferSchema — negative', () => {
  const validOffer = {
    title: 'Welcome Offer',
    description: 'Get 20% off your first ride',
    validFrom: '2026-01-01',
    validUntil: '2026-12-31',
  };

  it('rejects missing title', () => {
    const { title, ...rest } = validOffer;
    expectInvalid(createOfferSchema, rest);
  });

  it('rejects title too short (< 2 chars)', () => {
    expectInvalid(createOfferSchema, { ...validOffer, title: 'A' });
  });

  it('rejects missing description', () => {
    const { description, ...rest } = validOffer;
    expectInvalid(createOfferSchema, rest);
  });

  it('rejects missing validFrom', () => {
    const { validFrom, ...rest } = validOffer;
    expectInvalid(createOfferSchema, rest);
  });

  it('rejects missing validUntil', () => {
    const { validUntil, ...rest } = validOffer;
    expectInvalid(createOfferSchema, rest);
  });

  it('accepts valid offer', () => {
    expectValid(createOfferSchema, validOffer);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// createCouponSchema
// ═══════════════════════════════════════════════════════════════════════════════

describe('createCouponSchema — negative', () => {
  const validCoupon = {
    code: 'WELCOME100',
    description: 'Get ₹100 off',
    discountType: 'FIXED',
    discountValue: 100,
    validFrom: '2026-01-01',
    validUntil: '2026-12-31',
  };

  it('rejects missing code', () => {
    const { code, ...rest } = validCoupon;
    expectInvalid(createCouponSchema, rest);
  });

  it('rejects missing discountType', () => {
    const { discountType, ...rest } = validCoupon;
    expectInvalid(createCouponSchema, rest);
  });

  it('rejects invalid discountType', () => {
    expectInvalid(createCouponSchema, { ...validCoupon, discountType: 'BUY_ONE_GET_ONE' });
  });

  it('rejects zero discountValue', () => {
    expectInvalid(createCouponSchema, { ...validCoupon, discountValue: 0 });
  });

  it('rejects negative discountValue', () => {
    expectInvalid(createCouponSchema, { ...validCoupon, discountValue: -50 });
  });

  it('accepts both discount types', () => {
    expectValid(createCouponSchema, { ...validCoupon, discountType: 'FIXED' });
    expectValid(createCouponSchema, { ...validCoupon, discountType: 'PERCENTAGE' });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// createFaqSchema
// ═══════════════════════════════════════════════════════════════════════════════

describe('createFaqSchema — negative', () => {
  it('rejects missing question', () => {
    expectInvalid(createFaqSchema, { answer: 'This is the answer.' });
  });

  it('rejects question too short (< 5 chars)', () => {
    expectInvalid(createFaqSchema, { question: 'Hi?', answer: 'This is the answer.' });
  });

  it('rejects missing answer', () => {
    expectInvalid(createFaqSchema, { question: 'How does this work?' });
  });

  it('rejects answer too short (< 5 chars)', () => {
    expectInvalid(createFaqSchema, { question: 'How does this work?', answer: 'Yes' });
  });

  it('accepts valid FAQ', () => {
    expectValid(createFaqSchema, {
      question: 'How do I request a battery swap?',
      answer: 'Go to Support > Battery Issue.',
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// createHubSchema
// ═══════════════════════════════════════════════════════════════════════════════

describe('createHubSchema — negative', () => {
  it('rejects missing name', () => {
    expectInvalid(createHubSchema, {});
  });

  it('rejects name too short', () => {
    expectInvalid(createHubSchema, { name: 'A' });
  });

  it('accepts valid hub', () => {
    expectValid(createHubSchema, { name: 'New Delhi Central' });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// createTeamLeaderSchema
// ═══════════════════════════════════════════════════════════════════════════════

describe('createTeamLeaderSchema — negative', () => {
  it('rejects missing name', () => {
    expectInvalid(createTeamLeaderSchema, { phone: '9876543210' });
  });

  it('rejects missing phone', () => {
    expectInvalid(createTeamLeaderSchema, { name: 'Amit Sharma' });
  });

  it('rejects invalid phone format', () => {
    expectInvalid(createTeamLeaderSchema, { name: 'Amit', phone: '12345' });
  });

  it('accepts valid team leader', () => {
    expectValid(createTeamLeaderSchema, { name: 'Amit Sharma', phone: '9876543210' });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// sendNotificationSchema
// ═══════════════════════════════════════════════════════════════════════════════

describe('sendNotificationSchema — negative', () => {
  it('rejects missing title', () => {
    expectInvalid(sendNotificationSchema, { message: 'Hello there, this is a test message.' });
  });

  it('rejects title too short (< 3 chars)', () => {
    expectInvalid(sendNotificationSchema, {
      title: 'Hi',
      message: 'Hello there, this is a test message.',
    });
  });

  it('rejects missing message', () => {
    expectInvalid(sendNotificationSchema, { title: 'Alert' });
  });

  it('rejects message too short (< 5 chars)', () => {
    expectInvalid(sendNotificationSchema, { title: 'Alert', message: 'Hi' });
  });

  it('rejects invalid type', () => {
    expectInvalid(sendNotificationSchema, {
      title: 'Alert',
      message: 'Hello there, this is a test message.',
      type: 'CRITICAL',
    });
  });

  it('accepts valid notification', () => {
    expectValid(sendNotificationSchema, {
      title: 'Plan Expiring',
      message: 'Your plan expires in 2 days.',
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// createIncidentSchema
// ═══════════════════════════════════════════════════════════════════════════════

describe('createIncidentSchema — negative', () => {
  const validIncident = {
    title: 'Vehicle accident',
    description: 'Minor collision at intersection near sector 29.',
    type: 'ACCIDENT',
  };

  it('rejects missing title', () => {
    const { title, ...rest } = validIncident;
    expectInvalid(createIncidentSchema, rest);
  });

  it('rejects title too short (< 3 chars)', () => {
    expectInvalid(createIncidentSchema, { ...validIncident, title: 'Hi' });
  });

  it('rejects missing description', () => {
    const { description, ...rest } = validIncident;
    expectInvalid(createIncidentSchema, rest);
  });

  it('rejects description too short (< 10 chars)', () => {
    expectInvalid(createIncidentSchema, { ...validIncident, description: 'Short' });
  });

  it('rejects invalid type', () => {
    expectInvalid(createIncidentSchema, { ...validIncident, type: 'COLLISION' });
  });

  it('rejects invalid severity', () => {
    expectInvalid(createIncidentSchema, { ...validIncident, severity: 'MINOR' });
  });

  it('accepts all valid incident types', () => {
    for (const type of ['ACCIDENT', 'THEFT', 'DAMAGE', 'BREAKDOWN', 'OTHER']) {
      expectValid(createIncidentSchema, { ...validIncident, type });
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// bulkActionSchema
// ═══════════════════════════════════════════════════════════════════════════════

describe('bulkActionSchema — negative', () => {
  it('rejects empty ids array', () => {
    expectInvalid(bulkActionSchema, { ids: [], action: 'updateStatus' });
  });

  it('rejects missing ids', () => {
    expectInvalid(bulkActionSchema, { action: 'updateStatus' });
  });

  it('rejects missing action', () => {
    expectInvalid(bulkActionSchema, { ids: ['id-1'] });
  });

  it('rejects invalid action', () => {
    expectInvalid(bulkActionSchema, { ids: ['id-1'], action: 'archive' });
  });

  it('rejects ids array > 500', () => {
    expectInvalid(bulkActionSchema, {
      ids: Array.from({ length: 501 }, (_, i) => `id-${i}`),
      action: 'updateStatus',
    });
  });

  it('rejects non-array ids', () => {
    expectInvalid(bulkActionSchema, { ids: 'id-1', action: 'updateStatus' });
  });

  it('accepts valid bulk action', () => {
    expectValid(bulkActionSchema, { ids: ['id-1', 'id-2'], action: 'updateStatus' });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// vehicleBulkActionSchema
// ═══════════════════════════════════════════════════════════════════════════════

describe('vehicleBulkActionSchema — negative', () => {
  it('rejects invalid action', () => {
    expectInvalid(vehicleBulkActionSchema, { ids: ['v-1'], action: 'park' });
  });

  it('accepts valid actions', () => {
    expectValid(vehicleBulkActionSchema, { ids: ['v-1'], action: 'changeStatus' });
    expectValid(vehicleBulkActionSchema, { ids: ['v-1'], action: 'reassignHub' });
    expectValid(vehicleBulkActionSchema, { ids: ['v-1'], action: 'delete' });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ticketBulkActionSchema
// ═══════════════════════════════════════════════════════════════════════════════

describe('ticketBulkActionSchema — negative', () => {
  it('rejects invalid action', () => {
    expectInvalid(ticketBulkActionSchema, { ids: ['t-1'], action: 'close' });
  });

  it('accepts valid actions', () => {
    expectValid(ticketBulkActionSchema, { ids: ['t-1'], action: 'changeStatus' });
    expectValid(ticketBulkActionSchema, { ids: ['t-1'], action: 'assign' });
    expectValid(ticketBulkActionSchema, { ids: ['t-1'], action: 'revert' });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// adminWalletTopupSchema
// ═══════════════════════════════════════════════════════════════════════════════

describe('adminWalletTopupSchema — negative', () => {
  it('rejects missing riderId', () => {
    expectInvalid(adminWalletTopupSchema, { amount: 100 });
  });

  it('rejects amount below minimum (10)', () => {
    expectInvalid(adminWalletTopupSchema, { riderId: 'r-1', amount: 5 });
  });

  it('rejects amount above maximum (10000)', () => {
    expectInvalid(adminWalletTopupSchema, { riderId: 'r-1', amount: 10001 });
  });

  it('rejects zero amount', () => {
    expectInvalid(adminWalletTopupSchema, { riderId: 'r-1', amount: 0 });
  });

  it('rejects negative amount', () => {
    expectInvalid(adminWalletTopupSchema, { riderId: 'r-1', amount: -100 });
  });

  it('accepts valid topup at boundaries', () => {
    expectValid(adminWalletTopupSchema, { riderId: 'r-1', amount: 10 });
    expectValid(adminWalletTopupSchema, { riderId: 'r-1', amount: 10000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// updateLegalSchema
// ═══════════════════════════════════════════════════════════════════════════════

describe('updateLegalSchema — negative', () => {
  it('rejects invalid type', () => {
    expectInvalid(updateLegalSchema, { type: 'warranty', content: 'Some content' });
  });

  it('rejects missing content', () => {
    expectInvalid(updateLegalSchema, { type: 'terms' });
  });

  it('rejects empty content', () => {
    expectInvalid(updateLegalSchema, { type: 'terms', content: '' });
  });

  it('accepts all valid types', () => {
    expectValid(updateLegalSchema, { type: 'terms', content: 'Terms text' });
    expectValid(updateLegalSchema, { type: 'privacy', content: 'Privacy text' });
    expectValid(updateLegalSchema, { type: 'refund', content: 'Refund text' });
    expectValid(updateLegalSchema, { type: 'lease', content: 'Lease text' });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// updateTicketSchema
// ═══════════════════════════════════════════════════════════════════════════════

describe('updateTicketSchema — negative', () => {
  it('rejects missing id', () => {
    expectInvalid(updateTicketSchema, { status: 'IN_PROGRESS' });
  });

  it('rejects invalid status', () => {
    expectInvalid(updateTicketSchema, { id: 't-1', status: 'CANCELLED' });
  });

  it('accepts valid update', () => {
    expectValid(updateTicketSchema, { id: 't-1', status: 'IN_PROGRESS' });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ticketReplySchema
// ═══════════════════════════════════════════════════════════════════════════════

describe('ticketReplySchema — negative', () => {
  it('rejects missing message', () => {
    expectInvalid(ticketReplySchema, {});
  });

  it('rejects empty message', () => {
    expectInvalid(ticketReplySchema, { message: '' });
  });

  it('rejects message too long (> 5000)', () => {
    expectInvalid(ticketReplySchema, { message: 'X'.repeat(5001) });
  });

  it('accepts valid reply', () => {
    expectValid(ticketReplySchema, { message: 'We are looking into it.' });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// awardRewardSchema
// ═══════════════════════════════════════════════════════════════════════════════

describe('awardRewardSchema — negative', () => {
  it('rejects missing riderDbId', () => {
    expectInvalid(awardRewardSchema, { title: 'Bonus', points: 100 });
  });

  it('rejects missing title', () => {
    expectInvalid(awardRewardSchema, { riderDbId: 'r-1', points: 100 });
  });

  it('rejects zero points', () => {
    expectInvalid(awardRewardSchema, { riderDbId: 'r-1', title: 'Bonus', points: 0 });
  });

  it('rejects negative points', () => {
    expectInvalid(awardRewardSchema, { riderDbId: 'r-1', title: 'Bonus', points: -50 });
  });

  it('rejects non-integer points', () => {
    expectInvalid(awardRewardSchema, { riderDbId: 'r-1', title: 'Bonus', points: 10.5 });
  });

  it('accepts valid reward', () => {
    expectValid(awardRewardSchema, { riderDbId: 'r-1', title: 'Streak Bonus', points: 500 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// riderActionSchema
// ═══════════════════════════════════════════════════════════════════════════════

describe('riderActionSchema — negative', () => {
  it('rejects missing action', () => {
    expectInvalid(riderActionSchema, { riderId: 'r-1' });
  });

  it('rejects missing riderId', () => {
    expectInvalid(riderActionSchema, { action: 'LOCK_DEVICE' });
  });

  it('rejects invalid action', () => {
    expectInvalid(riderActionSchema, { riderId: 'r-1', action: 'WIPE_DEVICE' });
  });

  it('accepts valid actions', () => {
    const actions = [
      'ASSIGN_PLAN', 'COMPLETE_PICKUP', 'END_RENTAL', 'LOCK_DEVICE',
      'FACTORY_RESET', 'DISABLE_CAMERA', 'ENABLE_CAMERA', 'ENFORCE_PASSCODE',
      'CHECK_LOCATION_INTEGRITY', 'ADMIN_LOCK', 'UNLOCK_DEVICE',
      'PERSIST_APP', 'ENFORCE_LOCATION', 'RESTRICT_APPS_CONTROL',
    ];
    for (const action of actions) {
      expectValid(riderActionSchema, { riderId: 'r-1', action });
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// devicePermissionsSchema
// ═══════════════════════════════════════════════════════════════════════════════

describe('devicePermissionsSchema — negative', () => {
  it('rejects missing riderId', () => {
    expectInvalid(devicePermissionsSchema, { permissions: { location: true } });
  });

  it('rejects missing permissions', () => {
    expectInvalid(devicePermissionsSchema, { riderId: 'r-1' });
  });

  it('rejects non-object permissions', () => {
    expectInvalid(devicePermissionsSchema, { riderId: 'r-1', permissions: 'location' });
  });

  it('accepts valid permissions', () => {
    expectValid(devicePermissionsSchema, {
      riderId: 'r-1',
      permissions: { location: true, camera: false },
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// vehicleReturnSchema
// ═══════════════════════════════════════════════════════════════════════════════

describe('vehicleReturnSchema — negative', () => {
  it('rejects missing riderId', () => {
    expectInvalid(vehicleReturnSchema, { photoUrls: ['https://example.com/photo.jpg'] });
  });

  it('rejects empty photoUrls', () => {
    expectInvalid(vehicleReturnSchema, { riderId: 'r-1', photoUrls: [] });
  });

  it('rejects missing photoUrls', () => {
    expectInvalid(vehicleReturnSchema, { riderId: 'r-1' });
  });

  it('accepts valid return request', () => {
    expectValid(vehicleReturnSchema, {
      riderId: 'r-1',
      photoUrls: ['https://example.com/photo.jpg'],
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// chatMessageSchema
// ═══════════════════════════════════════════════════════════════════════════════

describe('chatMessageSchema — negative', () => {
  it('rejects missing message', () => {
    expectInvalid(chatMessageSchema, {});
  });

  it('rejects empty message', () => {
    expectInvalid(chatMessageSchema, { message: '' });
  });

  it('rejects message too long (> 2000)', () => {
    expectInvalid(chatMessageSchema, { message: 'X'.repeat(2001) });
  });

  it('accepts valid message', () => {
    expectValid(chatMessageSchema, { message: 'Hello, I need help.' });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// registerTokenSchema
// ═══════════════════════════════════════════════════════════════════════════════

describe('registerTokenSchema — negative', () => {
  it('rejects missing fcmToken', () => {
    expectInvalid(registerTokenSchema, {});
  });

  it('rejects empty fcmToken', () => {
    expectInvalid(registerTokenSchema, { fcmToken: '' });
  });

  it('accepts valid token', () => {
    expectValid(registerTokenSchema, { fcmToken: 'dGhpc0lzQWZjVG9rZW4' });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// refreshTokenSchema
// ═══════════════════════════════════════════════════════════════════════════════

describe('refreshTokenSchema — negative', () => {
  it('rejects missing refreshToken', () => {
    expectInvalid(refreshTokenSchema, {});
  });

  it('rejects empty refreshToken', () => {
    expectInvalid(refreshTokenSchema, { refreshToken: '' });
  });

  it('accepts valid refresh token', () => {
    expectValid(refreshTokenSchema, { refreshToken: 'eyJhbGciOiJIUzI1NiJ9.test' });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// createRiderSchema
// ═══════════════════════════════════════════════════════════════════════════════

describe('createRiderSchema — negative', () => {
  it('rejects missing phone', () => {
    expectInvalid(createRiderSchema, {});
  });

  it('rejects phone with letters', () => {
    expectInvalid(createRiderSchema, { phone: 'abcdefghij' });
  });

  it('rejects phone shorter than 10 digits', () => {
    expectInvalid(createRiderSchema, { phone: '98765' });
  });

  it('rejects invalid lifecycleStatus', () => {
    expectInvalid(createRiderSchema, { phone: '9876543210', lifecycleStatus: 'BANNED' });
  });

  it('rejects invalid email', () => {
    expectInvalid(createRiderSchema, { phone: '9876543210', email: 'not-email' });
  });

  it('accepts valid rider', () => {
    expectValid(createRiderSchema, { phone: '9876543210' });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// subscribePlanSchema
// ═══════════════════════════════════════════════════════════════════════════════

describe('subscribePlanSchema — negative', () => {
  it('rejects missing planId', () => {
    expectInvalid(subscribePlanSchema, {});
  });

  it('rejects empty planId', () => {
    expectInvalid(subscribePlanSchema, { planId: '' });
  });

  it('accepts valid subscription', () => {
    expectValid(subscribePlanSchema, { planId: 'plan-daily' });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// createAnnouncementSchema
// ═══════════════════════════════════════════════════════════════════════════════

describe('createAnnouncementSchema — negative', () => {
  it('rejects missing title', () => {
    expectInvalid(createAnnouncementSchema, {
      message: 'Hello everyone, this is important.',
      channel: 'PUSH',
      targetAudience: 'ALL',
    });
  });

  it('rejects missing message', () => {
    expectInvalid(createAnnouncementSchema, {
      title: 'System Update',
      channel: 'PUSH',
      targetAudience: 'ALL',
    });
  });

  it('rejects invalid channel', () => {
    expectInvalid(createAnnouncementSchema, {
      title: 'System Update',
      message: 'Hello everyone, this is important.',
      channel: 'EMAIL',
      targetAudience: 'ALL',
    });
  });

  it('rejects invalid targetAudience', () => {
    expectInvalid(createAnnouncementSchema, {
      title: 'System Update',
      message: 'Hello everyone, this is important.',
      channel: 'PUSH',
      targetAudience: 'SELECTED',
    });
  });

  it('accepts valid announcement', () => {
    expectValid(createAnnouncementSchema, {
      title: 'System Update',
      message: 'Scheduled maintenance tonight.',
      channel: 'PUSH',
      targetAudience: 'ALL',
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// createEarningSchema
// ═══════════════════════════════════════════════════════════════════════════════

describe('createEarningSchema — negative', () => {
  it('rejects missing date', () => {
    expectInvalid(createEarningSchema, { amount: 500 });
  });

  it('rejects missing amount', () => {
    expectInvalid(createEarningSchema, { date: '2026-01-01' });
  });

  it('rejects zero amount', () => {
    expectInvalid(createEarningSchema, { date: '2026-01-01', amount: 0 });
  });

  it('rejects negative amount', () => {
    expectInvalid(createEarningSchema, { date: '2026-01-01', amount: -100 });
  });

  it('rejects negative trips', () => {
    expectInvalid(createEarningSchema, {
      date: '2026-01-01',
      amount: 500,
      trips: -1,
    });
  });

  it('accepts valid earning', () => {
    expectValid(createEarningSchema, { date: '2026-01-01', amount: 500, trips: 5 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// updateSettingsSchema
// ═══════════════════════════════════════════════════════════════════════════════

describe('updateSettingsSchema — negative', () => {
  it('rejects empty object', () => {
    expectInvalid(updateSettingsSchema, {});
  });

  it('rejects invalid setting key', () => {
    expectInvalid(updateSettingsSchema, { invalidKey: 'value' });
  });

  it('rejects empty key string', () => {
    expectInvalid(updateSettingsSchema, { '': 'value' });
  });

  it('accepts valid setting keys', () => {
    expectValid(updateSettingsSchema, { walletMinTopup: '500' });
    expectValid(updateSettingsSchema, { lateFee: '50' });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Extreme / boundary value tests across schemas
// ═══════════════════════════════════════════════════════════════════════════════

describe('Extreme values — cross-schema', () => {
  it('topUpSchema rejects Float.MAX_SAFE_INTEGER', () => {
    expectInvalid(topUpSchema, {
      riderId: 'r-1',
      amount: Number.MAX_SAFE_INTEGER,
      purpose: 'TOP_UP',
      method: 'UPI',
    });
  });

  it('topUpSchema rejects NaN', () => {
    expectInvalid(topUpSchema, {
      riderId: 'r-1',
      amount: NaN,
      purpose: 'TOP_UP',
      method: 'UPI',
    });
  });

  it('topUpSchema rejects Infinity', () => {
    expectInvalid(topUpSchema, {
      riderId: 'r-1',
      amount: Infinity,
      purpose: 'TOP_UP',
      method: 'UPI',
    });
  });

  it('bulkActionSchema rejects ids array exceeding 500 items', () => {
    expectInvalid(bulkActionSchema, {
      ids: Array.from({ length: 501 }, (_, i) => `id-${i}`),
      action: 'updateStatus',
    });
  });

  it('chatMessageSchema rejects extremely long message', () => {
    expectInvalid(chatMessageSchema, {
      message: 'X'.repeat(100000),
    });
  });

  it('sendNotificationSchema rejects extremely long title', () => {
    expectInvalid(sendNotificationSchema, {
      title: 'X'.repeat(10000),
      message: 'Valid message here.',
    });
  });

  it('updateProfileSchema accepts all optional fields null/undefined', () => {
    // All fields are optional, so empty body should be valid
    expectValid(updateProfileSchema, {});
  });
});
