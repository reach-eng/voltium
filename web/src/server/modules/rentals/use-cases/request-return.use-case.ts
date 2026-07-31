import { rentalRepository } from '../rental.repository';

export async function requestReturn(riderDbId: string) {
  return rentalRepository.endRental(riderDbId);
}
