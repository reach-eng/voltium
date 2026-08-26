import { rentalUseCases } from '../rental.use-cases';
export { RentalBookError, RentalReturnError } from './errors';

export async function bookRental(riderId: string, input: any) {
  return rentalUseCases.bookRental(riderId, input);
}

export async function syncPickup(riderId: string, input: any) {
  return rentalUseCases.syncPickup(riderId, input);
}

export { submitReturn } from './submitReturn';
