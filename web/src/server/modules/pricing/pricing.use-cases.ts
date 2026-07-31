import { db } from '@/lib/db';

export const pricingUseCases = {
  async calculate(hubId: string, basePriceRupees: number) {
    const totalVehicles = await db.vehicle.count({ where: { hubId } });
    const availableVehicles = await db.vehicle.count({ where: { hubId, status: 'AVAILABLE' } });
    const utilization = totalVehicles > 0 ? (totalVehicles - availableVehicles) / totalVehicles : 0;
    const surgeMultiplier = utilization > 0.8 ? 1.2 : utilization > 0.6 ? 1.1 : 1.0;
    const dynamicPrice = Math.round(basePriceRupees * surgeMultiplier);
    return {
      basePrice: basePriceRupees,
      dynamicPrice,
      utilization,
      surgeMultiplier,
      totalVehicles,
      availableVehicles,
    };
  },

  async getHubPricing(hubId: string) {
    const hub = await db.hub.findUnique({
      where: { id: hubId },
      select: { id: true, name: true, isActive: true },
    });
    if (!hub) throw new Error('Hub not found');
    if (!hub.isActive) throw new Error('Hub is currently inactive');
    const totalVehicles = await db.vehicle.count({ where: { hubId } });
    const availableVehicles = await db.vehicle.count({ where: { hubId, status: 'AVAILABLE' } });
    return { hub: { id: hub.id, name: hub.name }, totalVehicles, availableVehicles };
  },
};
