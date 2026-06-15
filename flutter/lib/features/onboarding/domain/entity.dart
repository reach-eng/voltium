/// Onboarding domain entity
class OnboardingStatus {
  final bool isProfileComplete;
  final bool isKycSubmitted;
  final bool isGuarantorSubmitted;
  final bool isDepositPending;
  final bool isPlanSelected;
  final bool isPickupDone;
  final bool isActive;

  const OnboardingStatus({
    this.isProfileComplete = false,
    this.isKycSubmitted = false,
    this.isGuarantorSubmitted = false,
    this.isDepositPending = false,
    this.isPlanSelected = false,
    this.isPickupDone = false,
    this.isActive = false,
  });

  int get completionPercentage {
    final steps = [
      isProfileComplete,
      isKycSubmitted,
      isGuarantorSubmitted,
      isDepositPending,
      isPlanSelected,
      isPickupDone,
    ];
    final completed = steps.where((s) => s).length;
    return (completed / steps.length * 100).round();
  }

  String get currentStepLabel {
    if (!isProfileComplete) return 'Complete Profile';
    if (!isKycSubmitted) return 'Submit KYC Documents';
    if (!isGuarantorSubmitted) return 'Submit Guarantor Details';
    if (!isDepositPending) return 'Pay Security Deposit';
    if (!isPlanSelected) return 'Select Rental Plan';
    if (!isPickupDone) return 'Schedule Vehicle Pickup';
    return 'Onboarding Complete';
  }
}
