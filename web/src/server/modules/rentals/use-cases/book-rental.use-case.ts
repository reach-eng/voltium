import { rentalUseCases } from '../rental.use-cases';
export { RentalBookError, RentalReturnError } from './errors';

export async function bookRental(riderId: string, input: Parameters<typeof rentalUseCases.bookRental>[1]) {
  return rentalUseCases.bookRental(riderId, input);
}

export async function syncPickup(riderId: string, input: Parameters<typeof rentalUseCases.syncPickup>[1]) {
  return rentalUseCases.syncPickup(riderId, input);
}

export { submitReturn } from './submitReturn';
