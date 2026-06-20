/**
 * Vehicles module - Policy.
 *
 * Authorization rules for vehicle operations.
 */
import { AdminRole } from '../admin/admin.types';

export const vehiclePolicy = {
  canViewVehicles(adminRole: AdminRole): boolean {
    return [
      AdminRole.SUPER_ADMIN,
      AdminRole.OPERATIONS_ADMIN,
      AdminRole.HUB_MANAGER,
      AdminRole.FLEET_MANAGER,
    ].includes(adminRole);
  },

  canManageVehicles(adminRole: AdminRole): boolean {
    return [
      AdminRole.SUPER_ADMIN,
      AdminRole.OPERATIONS_ADMIN,
      AdminRole.HUB_MANAGER,
      AdminRole.FLEET_MANAGER,
    ].includes(adminRole);
  },

  canAssignVehicle(adminRole: AdminRole): boolean {
    return [
      AdminRole.SUPER_ADMIN,
      AdminRole.OPERATIONS_ADMIN,
      AdminRole.HUB_MANAGER,
      AdminRole.FLEET_MANAGER,
    ].includes(adminRole);
  },
};
