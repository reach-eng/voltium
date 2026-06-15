import '../domain/entity.dart';

/// Abstract repository for onboarding operations.
abstract class OnboardingRepository {
  /// Returns the current onboarding status for a rider.
  Future<OnboardingStatus> getStatus(String riderDbId);

  /// Submits profile information.
  Future<void> submitProfile(Map<String, dynamic> profileData);

  /// Marks onboarding as complete.
  Future<void> completeOnboarding(String riderDbId);
}
