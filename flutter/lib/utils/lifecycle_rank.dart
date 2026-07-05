/// Shared lifecycle rank utility — single source of truth.
library;

///
/// Previously duplicated in 5 files. Update this one function
/// when lifecycle statuses change.
///
/// Maps lifecycle status to a numeric rank. All callers use `>=` comparisons.
///
/// Threshold guide:
///   ≥14 — fully active
///   ≥10 — deposit done / pickup scheduled
///    ≥8 — deposit approved
///    ≥4 — KYC approved
///    ≥2 — profile submitted

import '../models/rider_model.dart';

/// Returns a numeric rank for the rider's lifecycle status.
int lifecycleRank(RiderModel rider) {
  const rank = <String, int>{
    'NEW': 0,
    'PHONE_VERIFIED': 1,
    'PROFILE_SUBMITTED': 2,
    'KYC_SUBMITTED': 3,
    'KYC_APPROVED': 4,
    'GUARANTOR_SUBMITTED': 5,
    'GUARANTOR_APPROVED': 6,
    'DEPOSIT_PENDING': 7,
    'DEPOSIT_APPROVED': 8,
    'PLAN_SELECTED': 9,
    'PICKUP_SCHEDULED': 10,
    'ACTIVE': 11,
    'ACTIVE_RIDING': 11,
    'RIDING': 11,
    'SUSPENDED': 12,
    'RETURN_PENDING': 13,
    'RETURNED': 13,
    'PICKUP_COMPLETED': 14,
    'CLOSED': 14,
  };
  return rank[rider.lifecycleStatus] ?? 0;
}
