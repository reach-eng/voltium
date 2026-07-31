/**
 * Admin Riders module - Use cases.
 *
 * Orchestrates admin rider management: list with full filters, create with relations,
 * update with field-level security and wallet adjustments, delete with cascade.
 *
 * All wallet mutations go through wallet-service (ledger-backed).
 *
 * @fileoverview This file re-exports from focused sub-modules for backward compatibility.
 *  - admin-riders-list   — list/search/pagination
 *  - admin-riders-detail — get single rider, device data
 *  - admin-riders-update — create, update, assignPlan, completePickup, endRental, updateSecurityFlags
 *  - admin-riders-bulk   — delete
 *  - admin-riders-kyc-actions   — KYC field sets, audit logging, notifications
 *  - admin-riders-wallet-adjust — wallet field sets, ledger-backed adjustments
 */

import { listRiders } from './admin-riders-list.use-cases';
import { listFleet } from './admin-riders-list-fleet.use-cases';
import { getRiderWithWallet, getDeviceData } from './admin-riders-detail.use-cases';
import { createRider } from './admin-riders-create.use-cases';
import { updateRider } from './admin-riders-update.use-cases';
import { assignPlan } from './admin-riders-assign-plan.use-cases';
import { completePickup } from './admin-riders-complete-pickup.use-cases';
import { endRental } from './admin-riders-end-rental.use-cases';
import { updateSecurityFlags } from './admin-riders-security.use-cases';
import { deleteRider } from './admin-riders-bulk.use-cases';

export { KYC_FIELDS, extractKycData, getKycLifecycleSync, logKycAuditAndNotify } from './admin-riders-kyc-actions.use-cases';
export { WALLET_FIELDS, extractWalletData, adjustWalletInTransaction } from './admin-riders-wallet-adjust.use-cases';
export { listRiders } from './admin-riders-list.use-cases';
export { listFleet } from './admin-riders-list-fleet.use-cases';
export { getRiderWithWallet, getDeviceData } from './admin-riders-detail.use-cases';
export { createRider } from './admin-riders-create.use-cases';
export { updateRider } from './admin-riders-update.use-cases';
export { assignPlan } from './admin-riders-assign-plan.use-cases';
export { completePickup } from './admin-riders-complete-pickup.use-cases';
export { endRental } from './admin-riders-end-rental.use-cases';
export { updateSecurityFlags } from './admin-riders-security.use-cases';
export { deleteRider } from './admin-riders-bulk.use-cases';

/**
 * Backward-compatible object that composes all admin rider use-case functions.
 */
export const adminRiderUseCases = {
  list: listRiders,
  create: createRider,
  update: updateRider,
  getRiderWithWallet,
  assignPlan,
  completePickup,
  endRental,
  getDeviceData,
  updateSecurityFlags,
  delete: deleteRider,
  listFleet,
};
