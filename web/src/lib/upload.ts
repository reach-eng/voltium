/**
 * Upload utility — signed URL flow.
 *
 * Replaces all direct calls to the deprecated /api/upload endpoint.
 *
 * Flow:
 *   1. POST /api/files/request-upload  →  { uploadUrl, fileRecordId, storageKey }
 *   2. PUT  file data to the signed uploadUrl
 *   3. POST /api/files/confirm-upload  →  marks record as uploaded
 *   4. Return /api/files/{storageKey}  (read-accessible URL)
 */

const CATEGORY_MAP: Record<string, string> = {
  KYC_AADHAAR_FRONT: 'kyc_document',
  KYC_AADHAAR_BACK: 'kyc_document',
  KYC_PAN: 'kyc_document',
  KYC_PHOTO: 'profile_photo',
  GUARANTOR_AADHAAR_FRONT: 'kyc_document',
  GUARANTOR_AADHAAR_BACK: 'kyc_document',
  GUARANTOR_PAN: 'kyc_document',
  GUARANTOR_PHOTO: 'profile_photo',
  GUARANTOR_VIDEO: 'kyc_document',
  GUARANTOR_SIGNATURE: 'kyc_document',
  TOPUP_PROOF: 'payment_proof',
  pickup_verification: 'vehicle_photo',
  return_verification: 'vehicle_photo',
  vehicle_return: 'vehicle_photo',
  RETURN_PHOTO: 'vehicle_photo',
  support_attachment: 'support_attachment',
};

function mapTypeToCategory(type: string): string {
  return CATEGORY_MAP[type] || 'kyc_document';
}

export async function uploadFile(file: File, type: string): Promise<string> {
  const category = mapTypeToCategory(type);

  // Step 1: Request signed upload URL
  const reqRes = await fetch('/api/files/request-upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      category,
      fileSize: file.size,
    }),
  });

  if (!reqRes.ok) {
    const errBody = await reqRes.json().catch(() => ({}));
    throw new Error(
      (errBody as any)?.error?.message || `Failed to request upload URL (HTTP ${reqRes.status})`
    );
  }

  const reqData: {
    success: boolean;
    data: { uploadUrl: string; fileRecordId: string; storageKey: string };
  } = await reqRes.json();

  const { uploadUrl, storageKey } = reqData.data;
  if (!uploadUrl || !storageKey) {
    throw new Error('Invalid response: missing uploadUrl or storageKey');
  }

  // Step 2: Upload file data to the signed URL via PUT
  const fileBytes = await file.arrayBuffer();
  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
    },
    body: fileBytes,
  });

  if (!uploadRes.ok) {
    throw new Error(`Failed to upload file to storage (HTTP ${uploadRes.status})`);
  }

  // Step 3: Confirm upload
  const confirmRes = await fetch('/api/files/confirm-upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileRecordId: reqData.data.fileRecordId,
      sizeBytes: file.size,
    }),
  });

  if (!confirmRes.ok) {
    throw new Error(`Failed to confirm upload (HTTP ${confirmRes.status})`);
  }

  // Return the read-accessible URL
  return `/api/files/${storageKey}`;
}
