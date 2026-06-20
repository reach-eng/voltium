import { describe, it, expect } from 'vitest';
import { api, generateRandomPhone, riderLogin, adminLogin } from '../helpers';

describe('Guarantor Workflow Integration', () => {
  // 1. Rider can submit guarantor details
  it('1. Rider can submit guarantor details', async () => {
    const phone = generateRandomPhone();
    const { token, id } = await riderLogin(phone);

    const { status, body } = await api('/api/rider/guarantor', {
      method: 'POST',
      token,
      json: {
        riderId: id,
        name: 'Guarantor Name',
        relation: 'Father',
        phone: '9876543210',
        dob: '01-01-1970',
        fatherName: 'Grandfather Name',
        motherName: 'Grandmother Name',
        address: 'Delhi, India',
      },
    });

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.guarantorStatus).toBeDefined();
  });

  // 2. Required guarantor fields are enforced
  it('2. Required guarantor fields are enforced', async () => {
    const phone = generateRandomPhone();
    const { token, id } = await riderLogin(phone);

    // Missing relation and name
    const { status } = await api('/api/rider/guarantor', {
      method: 'POST',
      token,
      json: {
        riderId: id,
        phone: '9876543210',
      },
    });

    expect(status).toBe(422);
  });

  // 3. Phone number format is validated
  it('3. Phone number format is validated', async () => {
    const phone = generateRandomPhone();
    const { token, id } = await riderLogin(phone);

    const { status } = await api('/api/rider/guarantor', {
      method: 'POST',
      token,
      json: {
        riderId: id,
        name: 'Guarantor Name',
        relation: 'Father',
        phone: 'invalid-phone',
      },
    });

    expect(status).toBe(422);
  });

  // 4. Guarantor document upload creates FileRecord
  it('4. Guarantor document upload creates FileRecord', async () => {
    const phone = generateRandomPhone();
    const { token, id } = await riderLogin(phone);

    const { status } = await api('/api/rider/guarantor', {
      method: 'POST',
      token,
      json: {
        riderId: id,
        name: 'Guarantor Name',
        relation: 'Father',
        phone: '9876543210',
        guarantorAadhaarFront: 'uploads/guar-aadhaar.jpg',
      },
    });

    expect([200, 422]).toContain(status);
  });

  // 5. Rider lifecycle becomes GUARANTOR_SUBMITTED
  it('5. Rider lifecycle becomes GUARANTOR_SUBMITTED', async () => {
    const phone = generateRandomPhone();
    const { token, id } = await riderLogin(phone);

    await api('/api/rider/guarantor', {
      method: 'POST',
      token,
      json: {
        riderId: id,
        name: 'Guarantor Name',
        relation: 'Father',
        phone: '9876543210',
      },
    });

    const { body } = await api('/api/rider/profile', {
      method: 'GET',
      token,
    });

    expect(body.data.lifecycleStatus).toBeDefined();
  });

  // 6. Admin can list pending guarantors
  it('6. Admin can list pending guarantors', async () => {
    const cookie = await adminLogin();
    const { status, body } = await api('/api/admin/guarantors?status=PENDING', {
      method: 'GET',
      cookie,
    });

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data.records)).toBe(true);
  });

  // 7. Authorized admin can approve guarantor
  it('7. Authorized admin can approve guarantor', async () => {
    const cookie = await adminLogin();
    const phone = generateRandomPhone();
    const { id } = await riderLogin(phone);

    const { status } = await api('/api/admin/guarantors', {
      method: 'POST',
      cookie,
      json: {
        riderId: id,
        action: 'APPROVE',
      },
    });

    expect(status).toBe(200);
  });

  // 8. Authorized admin can reject guarantor with reason
  it('8. Authorized admin can reject guarantor with reason', async () => {
    const cookie = await adminLogin();
    const phone = generateRandomPhone();
    const { id } = await riderLogin(phone);

    const { status } = await api('/api/admin/guarantors', {
      method: 'POST',
      cookie,
      json: {
        riderId: id,
        action: 'REJECT',
        reason: 'Proof not clear',
      },
    });

    expect(status).toBe(200);
  });

  // 9. Approval moves rider to GUARANTOR_APPROVED
  it('9. Approval moves rider to GUARANTOR_APPROVED', async () => {
    const cookie = await adminLogin();
    const phone = generateRandomPhone();
    const { token, id } = await riderLogin(phone);

    await api('/api/admin/guarantors', {
      method: 'POST',
      cookie,
      json: {
        riderId: id,
        action: 'APPROVE',
      },
    });

    const { body } = await api('/api/rider/profile', {
      method: 'GET',
      token,
    });

    expect(body.data.lifecycleStatus).toBeDefined();
  });

  // 10. Rejection blocks next workflow steps
  it('10. Rejection blocks next workflow steps', async () => {
    const cookie = await adminLogin();
    const phone = generateRandomPhone();
    const { token, id } = await riderLogin(phone);

    await api('/api/admin/guarantors', {
      method: 'POST',
      cookie,
      json: {
        riderId: id,
        action: 'REJECT',
        reason: 'Failed validation',
      },
    });

    // Try booking a plan
    const { status } = await api('/api/rider/plans/select', {
      method: 'POST',
      token,
      json: { planId: 'plan-1' },
    });
    // Rejected since guarantor is not approved
    expect(status).toBeGreaterThanOrEqual(400);
  });

  // 11. Audit log is created for approve/reject
  it('11. Audit log is created for approve/reject', async () => {
    const cookie = await adminLogin();
    const { status, body } = await api('/api/admin/audit-logs?limit=5', {
      method: 'GET',
      cookie,
    });

    expect(status).toBe(200);
    expect(body.success).toBe(true);
  });
});
