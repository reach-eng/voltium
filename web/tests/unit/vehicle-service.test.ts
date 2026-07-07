import { describe, it, expect, vi, beforeEach } from 'vitest';
import { vehicleUseCases } from '@/server/modules/vehicles/vehicle.use-cases';
import { vehicleRepository } from '@/server/modules/vehicles/vehicle.repository';

vi.mock('@/server/modules/vehicles/vehicle.repository', () => ({
  vehicleRepository: {
    findAll: vi.fn(),
    findById: vi.fn(),
    findByHubId: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  }
}));

vi.mock('@/lib/cache', () => ({
  invalidateCache: vi.fn()
}));

describe('Vehicle Use Cases - Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('listVehicles calls repository correctly', async () => {
    (vehicleRepository.findAll as any).mockResolvedValue([]);
    const result = await vehicleUseCases.listVehicles({ hubId: 'hub-1' });
    expect(vehicleRepository.findAll).toHaveBeenCalledWith({ hubId: 'hub-1' });
    expect(result).toEqual([]);
  });

  it('getVehicle calls repository correctly', async () => {
    const mockVehicle = { id: 'veh-1' };
    (vehicleRepository.findById as any).mockResolvedValue(mockVehicle);
    const result = await vehicleUseCases.getVehicle('veh-1');
    expect(vehicleRepository.findById).toHaveBeenCalledWith('veh-1');
    expect(result).toEqual(mockVehicle);
  });

  it('getVehiclesByHub calls repository correctly', async () => {
    (vehicleRepository.findByHubId as any).mockResolvedValue([]);
    const result = await vehicleUseCases.getVehiclesByHub('hub-1');
    expect(vehicleRepository.findByHubId).toHaveBeenCalledWith('hub-1');
    expect(result).toEqual([]);
  });

  it('createVehicle calls repository and invalidates cache', async () => {
    (vehicleRepository.create as any).mockResolvedValue({ id: 'veh-1' });
    const result = await vehicleUseCases.createVehicle({ vehicleId: 'V001', vehicleNumber: 'KA01' } as any);
    expect(vehicleRepository.create).toHaveBeenCalled();
    expect(result.id).toBe('veh-1');
  });
});
