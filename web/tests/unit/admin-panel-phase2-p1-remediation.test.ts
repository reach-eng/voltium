import { describe, it, expect, vi } from 'vitest';
import { updateRiderSchema } from '@/server/modules/riders/rider.schemas';
import { couponUseCases } from '@/server/modules/coupons/coupon.use-cases';
import { supportUseCases } from '@/server/modules/support/support.use-cases';
import { TicketStateError } from '@/server/modules/support/ticket-state-machine';
import { vehicleRepository } from '@/server/modules/vehicles/vehicle.repository';
import { vehicleUseCases } from '@/server/modules/vehicles/vehicle.use-cases';
import { db } from '@/lib/db';

describe('Admin Panel Phase 2 P1 Remediation Suite', () => {
  describe('Rider Guarantor & TL Action Schema (P1-06, P1-07)', () => {
    it('accepts null for guarantorStatus when clearing a guarantor', () => {
      const result = updateRiderSchema.safeParse({
        id: 'rider_123',
        guarantorStatus: null,
        guarantorName: '',
        guarantorPhone: '',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.guarantorStatus).toBeNull();
      }
    });

    it('accepts case-insensitive tlAction and transforms to uppercase', () => {
      const approveResult = updateRiderSchema.safeParse({
        id: 'rider_123',
        tlAction: 'approve',
      });
      expect(approveResult.success).toBe(true);
      if (approveResult.success) {
        expect(approveResult.data.tlAction).toBe('APPROVE');
      }

      const rejectResult = updateRiderSchema.safeParse({
        id: 'rider_123',
        tlAction: 'reject',
      });
      expect(rejectResult.success).toBe(true);
      if (rejectResult.success) {
        expect(rejectResult.data.tlAction).toBe('REJECT');
      }
    });
  });

  describe('Coupon Percentage Cap on Partial Update (P1-13)', () => {
    it('rejects percentage discount greater than 100 on existing percentage coupon', async () => {
      const mockFindUnique = vi.spyOn(db.coupon, 'findUnique').mockResolvedValue({
        id: 'coupon_pct',
        discountType: 'PERCENTAGE',
      } as any);

      await expect(
        couponUseCases.update('coupon_pct', { discountValue: 150 }, 'admin_1')
      ).rejects.toThrow('Percentage discount must be between 1 and 100');

      mockFindUnique.mockRestore();
    });

    it('allows valid percentage discount <= 100', async () => {
      const mockFindUnique = vi.spyOn(db.coupon, 'findUnique').mockResolvedValue({
        id: 'coupon_pct',
        discountType: 'PERCENTAGE',
      } as any);
      const mockUpdate = vi.spyOn(db.coupon, 'update').mockResolvedValue({
        id: 'coupon_pct',
        discountType: 'PERCENTAGE',
        discountValueInPaise: 25,
      } as any);

      const res = await couponUseCases.update('coupon_pct', { discountValue: 25 }, 'admin_1');
      expect(res).toBeDefined();

      mockFindUnique.mockRestore();
      mockUpdate.mockRestore();
    });
  });

  describe('Support Ticket State Machine Enforcement (P1-12)', () => {
    it('throws TicketStateError when trying to jump from CLOSED to OPEN', async () => {
      const mockFindById = vi.spyOn(db.supportTicket, 'findUnique').mockResolvedValue({
        id: 'ticket_1',
        status: 'CLOSED',
      } as any);

      await expect(
        supportUseCases.updateTicket('ticket_1', { status: 'OPEN' })
      ).rejects.toThrow(TicketStateError);

      mockFindById.mockRestore();
    });
  });

  describe('Bulk Vehicle Lease & State Machine Guards (P1-03)', () => {
    it('bulkDelete blocks deletion of vehicles with BOOKED or RETURN_PENDING leases', async () => {
      const mockCount = vi.spyOn(db.rentalLease, 'count').mockResolvedValue(1);

      await expect(vehicleRepository.bulkDelete(['veh_1'])).rejects.toThrow(
        /Cannot delete vehicles: 1 vehicle\(s\) currently have active or booked rental leases/
      );

      mockCount.mockRestore();
    });

    it('bulkUpdateVehicles changeStatus validates transitions for each vehicle', async () => {
      const mockFindMany = vi.spyOn(db.vehicle, 'findMany').mockResolvedValue([
        { id: 'veh_retired', status: 'RETIRED' },
      ] as any);

      await expect(
        vehicleUseCases.bulkUpdateVehicles(['veh_retired'], 'changeStatus', 'ACTIVE_RENTAL', 'admin_1')
      ).rejects.toThrow();

      mockFindMany.mockRestore();
    });
  });
});
