/// Shared lifecycle rank utility — single source of truth.
library;

///
/// Previously duplicated in 5 files. Update this one function
/// when lifecycle statuses change.
///
/// Maps lifecycle status to a numeric rank. All callers use `>=` comparisons.
///
/// Threshold guide:
///   ≥9 — fully active
///   ≥8 — pickup scheduled
///   ≥7 — kyc approved
///   ≥6 — deposit approved
///   ≥4 — plan selected
///   ≥2 — profile submitted

import '../models/rider_model.dart';

int lifecycleRank(RiderModel rider) {
  const rank = <String, int>{
    'NEW': 0,
    'PHONE_VERIFIED': 1,
    'PROFILE_SUBMITTED': 2,
    'GUARANTOR_SUBMITTED': 3,
    'GUARANTOR_APPROVED': 3,
    'PLAN_SELECTED': 4,
    'DEPOSIT_PENDING': 5,
    'DEPOSIT_APPROVED': 6,
    'KYC_SUBMITTED': 7,
    'KYC_APPROVED': 8,
    'PICKUP_SCHEDULED': 9,
    'ACTIVE': 10,
    'ACTIVE_RIDING': 10,
    'RIDING': 10,
    'SUSPENDED': 11,
    'RETURN_PENDING': 12,
    'RETURNED': 12,
    'PICKUP_COMPLETED': 13,
    'CLOSED': 13,
  };
  return rank[rider.lifecycleStatus] ?? 0;
}
