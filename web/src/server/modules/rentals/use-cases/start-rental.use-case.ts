import { rentalRepository } from '../rental.repository';

export async function startRental(riderDbId: string, vehicleId: string, hubId: string, teamLeader: string) {
  return rentalRepository.startRental(riderDbId, vehicleId, hubId, teamLeader);
}
