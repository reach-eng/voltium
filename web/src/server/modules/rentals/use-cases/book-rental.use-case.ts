/**
 * Book rental use-case — minimal stub.
 */

import { RentalBookError } from './errors';

export interface BookRentalInput {
  vehicleId: string;
  planId?: string;
  startDate?: string;
}

export async function bookRental(riderId: string, input: BookRentalInput): Promise<{ lease: { id: string; status: string } }> {
  if (!input.vehicleId) {
    throw new RentalBookError('vehicleId is required');
  }
  return {
    lease: {
      id: `lease-${riderId}-${Date.now()}`,
      status: 'BOOKED',
    },
  };
}

export async function syncPickup(riderId: string, input: { leaseId: string }): Promise<{ status: string }> {
  return { status: 'PICKED_UP' };
}
