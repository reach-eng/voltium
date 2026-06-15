import 'package:voltium_rider/core/network/generated/api_client.dart';
import 'package:voltium_rider/core/network/generated/api_models.dart';
import '../domain/entity.dart';
import '../domain/repository.dart';

/// Implementation of OnboardingRepository using the Voltium API client.
class OnboardingRepositoryImpl implements OnboardingRepository {
  final VoltiumApiClient _apiClient;

  OnboardingRepositoryImpl(this._apiClient);

  @override
  Future<OnboardingStatus> getStatus(String riderDbId) async {
    final response = await _apiClient.getRiderProfile();
    return OnboardingStatus(
      isProfileComplete: response.fullName != null && response.fullName!.isNotEmpty,
      isKycSubmitted: response.kycStatus == 'SUBMITTED' || response.kycStatus == 'APPROVED',
      isGuarantorSubmitted: response.guarantorStatus == 'SUBMITTED' || response.guarantorStatus == 'APPROVED',
      isDepositPending: response.depositStatus == 'PENDING' || response.depositStatus == 'APPROVED',
      isPlanSelected: response.rentalStatus == 'ACTIVE',
      isPickupDone: response.state == 'PICKUP_DONE' || response.state == 'ACTIVE',
      isActive: response.accountStatus == 'ACTIVE',
    );
  }

  @override
  Future<void> submitProfile(Map<String, dynamic> profileData) async {
    final request = UpdateProfileRequest.fromJson(profileData);
    await _apiClient.putRiderProfile(request);
  }

  @override
  Future<void> completeOnboarding(String riderDbId) async {
    // Onboarding is automatically considered complete when all steps are done
  }
}
