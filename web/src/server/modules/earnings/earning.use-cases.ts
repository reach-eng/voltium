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
};
