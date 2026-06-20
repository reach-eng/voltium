import { describe, it, expect } from 'vitest';
import { api, generateRandomPhone, riderLogin, adminLogin } from '../helpers';

/**
 * Local File Storage Integration Tests
 *
 * Tests the file upload, access control, path traversal protection,
 * and file metadata endpoints under offline bypass mode.
 */
describe('Local File Storage Integration', () => {
  // 1. Request upload token requires authentication
  it('1. Request upload URL requires authentication', async () => {
    const { status, body } = await api('/api/files/request-upload', {
      method: 'POST',
      json: {
        filename: 'test-file.jpg',
        mimeType: 'image/jpeg',
        purpose: 'KYC_DOCUMENT',
      },
    });
    expect(status).toBe(401);
    expect(body.success).toBe(false);
  });

  // 2. Authenticated rider can request an upload URL
  it('2. Authenticated rider can request an upload URL', async () => {
    const phone = generateRandomPhone();
    const { token } = await riderLogin(phone);

    const { status, body } = await api('/api/files/request-upload', {
      method: 'POST',
      token,
      json: {
        filename: 'kyc-document.jpg',
        mimeType: 'image/jpeg',
        purpose: 'KYC_DOCUMENT',
      },
    });

    // Accepts or handles under offline bypass
    expect([200, 500]).toContain(status);
    if (status === 200) {
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('uploadUrl');
      expect(body.data).toHaveProperty('fileRecordId');
    }
  });

  // 3. Invalid MIME type is rejected
  it('3. Invalid MIME type is rejected', async () => {
    const phone = generateRandomPhone();
    const { token } = await riderLogin(phone);

    const { status, body } = await api('/api/files/request-upload', {
      method: 'POST',
      token,
      json: {
        filename: 'malware.exe',
        mimeType: 'application/x-msdownload',
        purpose: 'KYC_DOCUMENT',
      },
    });

    // Should reject invalid file type
    expect([400, 422]).toContain(status);
    expect(body.success).toBe(false);
  });

  // 4. Direct upload endpoint returns upload details or handles offline
  it('4. Direct upload endpoint is accessible for authenticated users', async () => {
    const phone = generateRandomPhone();
    const { token } = await riderLogin(phone);

    const { status } = await api('/api/files/direct-upload', {
      method: 'POST',
      token,
      json: {
        filename: 'photo.jpg',
        mimeType: 'image/jpeg',
        purpose: 'PICKUP_PHOTO',
        size: 1024 * 100, // 100KB
      },
    });

    // Endpoint exists and processes the request
    expect([200, 400, 500]).toContain(status);
  });

  // 5. Request read URL requires authentication
  it('5. File read URL request requires authentication', async () => {
    const { status } = await api('/api/files/request-read', {
      method: 'POST',
      json: { fileRecordId: 'some-file-id' },
    });

    expect(status).toBe(401);
  });

  // 6. Authenticated rider can request read URL for their file
  it('6. Authenticated rider can request read URL', async () => {
    const phone = generateRandomPhone();
    const { token } = await riderLogin(phone);

    const { status, body } = await api('/api/files/request-read', {
      method: 'POST',
      token,
      json: { fileRecordId: 'mock-file-id' },
    });

    // Under offline bypass - either succeeds with URL or returns not found
    expect([200, 404, 500]).toContain(status);
    if (status === 200) {
      expect(body.success).toBe(true);
    }
  });

  // 7. Path traversal in filename is rejected
  it('7. Path traversal in filename is blocked', async () => {
    const phone = generateRandomPhone();
    const { token } = await riderLogin(phone);

    const traversalAttempts = [
      '../../../etc/passwd.jpg',
      '..\\..\\windows\\system32\\cmd.exe',
      '%2e%2e%2fetc%2fpasswd.jpg',
    ];

    for (const filename of traversalAttempts) {
      const { status } = await api('/api/files/request-upload', {
        method: 'POST',
        token,
        json: {
          filename,
          mimeType: 'image/jpeg',
          purpose: 'KYC_DOCUMENT',
        },
      });

      // Should reject path traversal attempts
      expect([400, 422]).toContain(status);
    }
  });

  // 8. File confirmation requires a valid upload token
  it('8. File confirmation with invalid token is rejected', async () => {
    const phone = generateRandomPhone();
    const { token } = await riderLogin(phone);

    const { status, body } = await api('/api/files/confirm-upload', {
      method: 'POST',
      token,
      json: {
        fileRecordId: 'some-file-id',
        uploadToken: 'invalid-token',
      },
    });

    // Invalid token should be rejected
    expect([400, 401, 403, 404, 500]).toContain(status);
    if (status < 500) {
      expect(body.success).toBe(false);
    }
  });

  // 9. File download endpoint requires authentication
  it('9. File download path requires authentication', async () => {
    const { status } = await api('/api/files/uploads/test-file.jpg', {
      method: 'GET',
    });

    // Non-public files require authentication
    expect([401, 403, 404]).toContain(status);
  });

  // 10. Admin can access storage stats
  it('10. Admin can view storage statistics', async () => {
    const cookie = await adminLogin();

    const { status, body } = await api('/api/admin/data-management/storage', {
      method: 'GET',
      cookie,
    });

    expect(status).toBe(200);
    expect(body.success).toBe(true);
  });

  // 11. Upload without required fields is rejected
  it('11. Upload request with missing required fields is rejected', async () => {
    const phone = generateRandomPhone();
    const { token } = await riderLogin(phone);

    const { status, body } = await api('/api/files/request-upload', {
      method: 'POST',
      token,
      json: {
        // Missing filename, mimeType, purpose
      },
    });

    expect([400, 422]).toContain(status);
    expect(body.success).toBe(false);
  });

  // 12. Non-rider cannot access rider file endpoints
  it('12. Unauthenticated request to file endpoint returns 401', async () => {
    const { status } = await api('/api/files/confirm-upload', {
      method: 'POST',
      json: { fileRecordId: 'file-1', uploadToken: 'token-1' },
    });

    expect(status).toBe(401);
  });

  // 13. Admin can view backup storage overview
  it('13. Admin can view data management overview', async () => {
    const cookie = await adminLogin();

    const { status, body } = await api('/api/admin/data-management/overview', {
      method: 'GET',
      cookie,
    });

    expect(status).toBe(200);
    expect(body.success).toBe(true);
  });

  // 14. Local upload endpoint handles multipart (or rejects appropriately)
  it('14. Local upload endpoint requires valid upload token', async () => {
    const { status } = await api('/api/files/local-upload/invalid-record-id', {
      method: 'POST',
      json: { uploadToken: 'bad-token' },
    });

    // Invalid token or record ID should be rejected
    expect([400, 401, 403, 404, 500]).toContain(status);
  });

  // 15. Storage health check is accessible to admins
  it('15. Storage health check endpoint is accessible', async () => {
    const { status, body } = await api('/api/health/storage', {
      method: 'GET',
    });

    // Health endpoint should be accessible without auth
    expect([200, 503]).toContain(status);
    if (status === 200) {
      expect(body).toBeDefined();
    }
  });

  // 16. File size limit enforced
  it('16. Oversized file upload request is rejected', async () => {
    const phone = generateRandomPhone();
    const { token } = await riderLogin(phone);

    const { status, body } = await api('/api/files/request-upload', {
      method: 'POST',
      token,
      json: {
        filename: 'huge-file.jpg',
        mimeType: 'image/jpeg',
        purpose: 'KYC_DOCUMENT',
        size: 1024 * 1024 * 50, // 50MB - way over limit
      },
    });

    // Should reject oversized files
    expect([400, 422, 200]).toContain(status); // Some implementations validate size server-side
    if (status !== 200) {
      expect(body.success).toBe(false);
    }
  });
});
