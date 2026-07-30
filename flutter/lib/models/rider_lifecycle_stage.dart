/// Rider lifecycle stage — single source of truth for the 5-value stage.
///
/// PR-K.2: mirrors the Prisma `RiderLifecycleStage` enum (5 values) on the
/// Flutter side. The backend now writes `lifecycleStage` in addition to
/// `lifecycleStatus` (15 values). The Flutter app prefers `lifecycleStage`
/// and falls back to `lifecycleStatus` mapped via
/// [lifecycleStageFromStatus] for backward compatibility.
///
/// Why a separate enum from `RiderLifecycleStatus`:
///   - 5 stages (NEW, IN_PROGRESS, ACTIVE, PAUSED, CLOSED) for routing
///   - 15 statuses (PHONE_VERIFIED, KYC_APPROVED, etc.) for granular state
///   - The stage is the high-level "where are they in the journey" signal
///   - The status is the granular "what step are they on" signal
library;

/// The 5 high-level lifecycle stages (matches the Prisma enum exactly).
enum RiderLifecycleStage {
  newRider,        // 'NEW' on the backend
  inProgress,      // 'IN_PROGRESS' on the backend
  active,          // 'ACTIVE' on the backend
  paused,          // 'PAUSED' on the backend
  closed,          // 'CLOSED' on the backend
}

/// Parse a backend `lifecycleStage` string to a typed enum value.
///
/// Returns `RiderLifecycleStage.newRider` if the string is null, empty,
/// or unknown (defensive default — never throws on unparseable data).
RiderLifecycleStage parseRiderLifecycleStage(String? raw) {
  if (raw == null || raw.isEmpty) return RiderLifecycleStage.newRider;
  switch (raw) {
    case 'NEW':
      return RiderLifecycleStage.newRider;
    case 'IN_PROGRESS':
      return RiderLifecycleStage.inProgress;
    case 'ACTIVE':
      return RiderLifecycleStage.active;
    case 'PAUSED':
      return RiderLifecycleStage.paused;
    case 'CLOSED':
      return RiderLifecycleStage.closed;
    default:
      return RiderLifecycleStage.newRider;
  }
}

/// Convert a RiderLifecycleStage back to its canonical string form.
String riderLifecycleStageToString(RiderLifecycleStage stage) {
  switch (stage) {
    case RiderLifecycleStage.newRider:
      return 'NEW';
    case RiderLifecycleStage.inProgress:
      return 'IN_PROGRESS';
    case RiderLifecycleStage.active:
      return 'ACTIVE';
    case RiderLifecycleStage.paused:
      return 'PAUSED';
    case RiderLifecycleStage.closed:
      return 'CLOSED';
  }
}

/// Map the legacy 15-value `RiderLifecycleStatus` to the 5-value stage.
///
/// Used as a fallback when the backend doesn't yet ship `lifecycleStage`
/// (i.e. before the new column is populated). Mirrors the SQL case
/// statement in the PR-K.1 migration.
///
/// Mapping rationale:
///   - NEW                        -> NEW
///   - PHONE_VERIFIED             -> IN_PROGRESS
///   - PROFILE_SUBMITTED          -> IN_PROGRESS
///   - KYC_*                      -> IN_PROGRESS (or ACTIVE if downstream done)
///   - GUARANTOR_*                -> IN_PROGRESS
///   - DEPOSIT_*                  -> IN_PROGRESS
///   - PLAN_SELECTED              -> IN_PROGRESS
///   - PICKUP_SCHEDULED           -> IN_PROGRESS
///   - ACTIVE                     -> ACTIVE
///   - SUSPENDED                  -> PAUSED
///   - RETURN_PENDING             -> PAUSED
///   - CLOSED                     -> CLOSED
RiderLifecycleStage lifecycleStageFromStatus(String? status) {
  if (status == null || status.isEmpty) return RiderLifecycleStage.newRider;
  switch (status) {
    case 'NEW':
      return RiderLifecycleStage.newRider;
    case 'PHONE_VERIFIED':
    case 'PROFILE_SUBMITTED':
    case 'KYC_SUBMITTED':
    case 'KYC_APPROVED':
    case 'GUARANTOR_SUBMITTED':
    case 'GUARANTOR_APPROVED':
    case 'DEPOSIT_PENDING':
    case 'DEPOSIT_APPROVED':
    case 'PLAN_SELECTED':
    case 'PICKUP_SCHEDULED':
    case 'ACTIVE_RIDING':
    case 'RIDING':
    case 'PICKUP_COMPLETED':
    case 'TERMINATED':
      return RiderLifecycleStage.inProgress;
    case 'ACTIVE':
      return RiderLifecycleStage.active;
    case 'SUSPENDED':
    case 'RETURN_PENDING':
    case 'RETURNED':
      return RiderLifecycleStage.paused;
    case 'CLOSED':
      return RiderLifecycleStage.closed;
    default:
      // Unknown status — treat as NEW to be safe (never throws)
      return RiderLifecycleStage.newRider;
  }
}
