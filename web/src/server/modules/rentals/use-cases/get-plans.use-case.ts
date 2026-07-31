import { rentalRepository } from '../rental.repository';

export async function getPlans() {
  return rentalRepository.findPlans();
}
