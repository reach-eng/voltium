import { rentalRepository } from '../rental.repository';

export async function selectPlan(riderDbId: string, planId: string) {
  return rentalRepository.selectPlan(riderDbId, planId);
}
