import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { validateBody, submitGuarantorSchema } from '@/lib/validators';
import { logger } from '@/lib/logger';
import { requireRiderSession } from '@/lib/rider-auth';
import { guarantorUseCases } from '@/server/modules/guarantors/guarantor.use-cases';

export async function POST(request: NextRequest) {
  try {
    const session = await requireRiderSession(request);
    if (session instanceof Response) return session;
    const riderDbId = session.riderDbId;

    const body = await request.json();
    const validation = validateBody(submitGuarantorSchema, body);
    if (!validation.success) {
      return errors.validation(validation.error);
    }

    const guarantor = await guarantorUseCases.submitGuarantor(riderDbId, validation.data);

    await guarantorUseCases.autoVerifyIfTestMode(riderDbId);

    return success(
      {
        id: guarantor.id,
        riderId: guarantor.riderId,
        guarantorStatus: guarantor.status,
      },
      'Guarantor submitted successfully'
    );
  } catch (err: any) {
    if (err.name === 'GuarantorStateError') {
      return errors.conflict(err.message);
    }
    logger.error('[POST /api/rider/guarantor]', err);
    return errors.internal('Failed to submit guarantor');
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireRiderSession(request);
    if (session instanceof Response) return session;

    const result = await guarantorUseCases.getGuarantorStatus(session.riderDbId);

    if (!result) {
      return success(
        {
          guarantorStatus: 'PENDING',
          name: null,
          relation: null,
          dob: null,
          phone: null,
        },
        'No guarantor profile found'
      );
    }

    return success({
      guarantorStatus: result.status,
      name: result.name,
      relation: result.relation,
      dob: result.dob,
      phone: result.phone,
      fatherName: result.fatherName,
      motherName: result.motherName,
      rejectionReason: (result as any).rejectionReason,
    });
  } catch (err) {
    logger.error('[GET /api/rider/guarantor]', err);
    return errors.internal('Failed to fetch guarantor');
  }
}
