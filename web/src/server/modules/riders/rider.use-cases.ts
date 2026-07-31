/**
 * Riders module - Use cases.
 *
 * Orchestrates rider profile management, onboarding state, and lifecycle transitions.
 * All field-level security (field allowlists), relation upserts, and state transitions
 * are handled here — routes stay thin.
 *
 * @fileoverview This file re-exports from focused sub-modules for backward compatibility.
 *  - rider-register  — registration, FCM token
 *  - rider-update    — profile updates with field-level security
 *  - rider-lifecycle — lifecycle status transitions, state queries
 *  - rider-queries   — profile, dashboard, rewards, earnings
 */

import { registerFcmToken } from './rider-register.use-cases';
import { updateProfile } from './rider-update.use-cases';
import { rejectPlan, getState } from './rider-lifecycle.use-cases';
import {
  getProfile,
  getDashboard,
  getRewards,
  listEarnings,
  createEarning,
} from './rider-queries.use-cases';

export { registerFcmToken } from './rider-register.use-cases';
export { updateProfile } from './rider-update.use-cases';
export { rejectPlan, getState } from './rider-lifecycle.use-cases';
export {
  getProfile,
  getDashboard,
  getRewards,
  listEarnings,
  createEarning,
} from './rider-queries.use-cases';

/**
 * Backward-compatible object that composes all rider use-case functions.
 */
export const riderUseCases = {
  getProfile,
  rejectPlan,
  getDashboard,
  getRewards,
  registerFcmToken,
  listEarnings,
  createEarning,
  updateProfile,
  getState,
};
