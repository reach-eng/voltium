import { earningRepository } from './earning.repository';

export const earningUseCases = {
  async list(params: {
    search?: string;
    platform?: string;
    startDate?: string;
    endDate?: string;
    page: number;
    limit: number;
  }) {
    return earningRepository.findAllPaginated(params);
  },

  async create(data: {
    riderId: string;
    date: Date;
    platform: string;
    amount: number;
    trips?: number;
    distance?: number;
    hoursOnline?: number;
    notes?: string;
  }) {
    return earningRepository.create(data);
  },
};
