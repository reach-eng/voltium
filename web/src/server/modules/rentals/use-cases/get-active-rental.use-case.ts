import { rentalRepository } from '../rental.repository';

export async function getActiveRental(riderDbId: string) {
  return rentalRepository.findActiveRental(riderDbId);
}
