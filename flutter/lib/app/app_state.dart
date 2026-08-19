enum AuthState {
  splash,
  kycPreflight,
  legal,
  permissions,
  login,
  otp,
  intent,
  userForm,
  guarantorForm,

  dashboard,
  preDashboard,
  choosePlan,
  planSuccess,
  pickupHub,
  pickupVerification,
  pickupSuccess,
  // PR-ONBOARDING-FLOW-2026-08-11: async wait state in the new active
  // onboarding path. Replaces the synchronous pre-dashboard wait at the
  // end of guarantor → plan → pickup. The rider lands here after submitting
  // the pickup form (pickupVerification.onNext) and waits for admin to flip
  // them to ACTIVE. Lifecycle gate keeps them here while rank == 10
  // (PICKUP_SCHEDULED) and !pickupDone; redirects to dashboard when the
  // rider becomes active. No design changes to existing screens; this is
  // purely a new routing state.
  hangTight,
  tlDetails,
  // PR-3 (2026-08-07 master fix plan): rentalDetails used to be reached
  // via direct AppNavigator.push from the dashboard / workflow hub. That
  // bypassed the lifecycle gate — a KYC revocation or admin suspension
  // mid-screen would not route the rider off. Adding it to AuthState
  // makes the screen lifecycle-aware.
  rentalDetails,
  endRental,
  faq,
  vehiclePhotos,
  topUpAmount,
  topUpUpi,
  topUpProof,
  topUpReceipt,
  referralDetails,
  legalPage,
  myDocuments,
  accountClosed,
}
