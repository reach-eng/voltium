import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/rider_model.dart';
import '../providers/app_provider.dart';
import '../theme/app_theme.dart';
import '../widgets/approval_matrix_widget.dart';
import '../widgets/fade_up_widget.dart';
import '../widgets/skeleton_loader.dart';

import '../gen/app_localizations.dart';
import 'auth_wrapper.dart';

class PreDashboardScreen extends StatelessWidget {
  final Function(AuthState) onStepNavigation;

  const PreDashboardScreen({super.key, required this.onStepNavigation});

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<AppProvider>();
    final rider = provider.rider;
    final l10n = AppLocalizations.of(context)!;

    if (rider == null) {
      return const PreDashboardSkeleton();
    }

    // Determine the next action
    String nextStepTitle = 'Ready to Ride?';
    String nextStepAction = 'Book Vehicle';
    VoidCallback? onNext;
    bool canAction = false;

    if (!rider.kycDone) {
      nextStepTitle = 'Ready to Ride?';
      nextStepAction = 'Complete KYC';
      onNext = () => onStepNavigation(AuthState.userForm);
      canAction = true;
    } else if (rider.guarantorStatus == GuarantorStatus.PENDING) {
      nextStepTitle = 'Add Guarantor';
      nextStepAction = 'Submit Details';
      onNext = () => onStepNavigation(AuthState.guarantorForm);
      canAction = true;
    } else if (!rider.depositDone) {
      nextStepTitle = 'Security Deposit';
      nextStepAction = 'Pay Deposit';
      canAction = true;
      onNext = () => onStepNavigation(AuthState.topUpPurpose);
    } else if (!rider.planDone) {
      nextStepTitle = 'Select Plan';
      nextStepAction = 'Choose Plan';
      onNext = () => onStepNavigation(AuthState.choosePlan);
      canAction = true;
    } else if (!rider.pickupDone) {
      nextStepTitle = 'Time for Pickup!';
      nextStepAction = 'Start Pickup';
      onNext = () => onStepNavigation(AuthState.pickupHub);
      canAction = true;
    }

    final kycVerified = rider.kycStatus == KycStatus.VERIFIED || rider.kycStatus == KycStatus.SUBMITTED;

    return Scaffold(
      backgroundColor: const Color(0xFFF7F9FB),
      body: Column(
        children: [
          // Header
          Container(
            padding: const EdgeInsets.fromLTRB(20, 48, 20, 32),
            width: double.infinity,
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                colors: [Color(0xFF0053C1), Color(0xFF2F6DDE)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Welcome back,',
                  style: TextStyle(color: Colors.white70, fontSize: 14, fontWeight: FontWeight.w500),
                ),
                Text(
                  rider.name.split(' ')[0],
                  style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.bold),
                ),
              ],
            ),
          ),

          // Main Content
          Expanded(
            child: Transform.translate(
              offset: const Offset(0, -16),
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Column(
                  children: [
                    // Profile Card
                    FadeUpWidget(
                      delay: 0,
                      child: _buildProfileCard(rider, kycVerified),
                    ),
                    const SizedBox(height: 16),

                    // Approval Matrix
                    FadeUpWidget(
                      delay: 100,
                      child: Container(
                        padding: const EdgeInsets.all(20),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(20),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withOpacity(0.04),
                              blurRadius: 24,
                              offset: const Offset(0, 12),
                            ),
                          ],
                        ),
                        child: ApprovalMatrixWidget(rider: rider),
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Wallet Card
                    FadeUpWidget(
                      delay: 200,
                      child: _buildWalletCard(rider),
                    ),
                    const SizedBox(height: 16),

                    // Action Card
                    FadeUpWidget(
                      delay: 300,
                      child: _buildActionCard(nextStepTitle, nextStepAction, onNext, canAction),
                    ),
                    const SizedBox(height: 16),

                    // Info Card
                    FadeUpWidget(
                      delay: 400,
                      child: _buildInfoCard(),
                    ),
                    const SizedBox(height: 32),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildProfileCard(RiderModel rider, bool kycVerified) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 24,
            offset: const Offset(0, 12),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 56,
            height: 56,
            decoration: const BoxDecoration(
              shape: BoxShape.circle,
              gradient: LinearGradient(
                colors: [Color(0xFF0053C1), Color(0xFF2F6DDE)],
              ),
            ),
            child: Center(
              child: Text(
                rider.name.substring(0, 1).toUpperCase(),
                style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold),
              ),
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  rider.name,
                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF191C1E)),
                ),
                Text(
                  rider.riderId,
                  style: const TextStyle(fontSize: 12, color: Color(0xFF424653)),
                ),
                const SizedBox(height: 4),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: kycVerified ? const Color(0xFFDCFCE7) : const Color(0xFFFEF3C7),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 6,
                        height: 6,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: kycVerified ? const Color(0xFF16A34A) : const Color(0xFFD97706),
                        ),
                      ),
                      const SizedBox(width: 6),
                      Text(
                        kycVerified ? 'Verified' : 'KYC: ${rider.kycStatus.name}',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                          color: kycVerified ? const Color(0xFF166534) : const Color(0xFFB45309),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildWalletCard(RiderModel rider) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF0053C1), Color(0xFF2F6DDE)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Available Balance', style: TextStyle(color: Colors.white70, fontSize: 10)),
                  Text(
                    '₹${rider.walletBalance.toStringAsFixed(2)}',
                    style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.bold),
                  ),
                ],
              ),
              FilledButton(
                onPressed: () => onStepNavigation(AuthState.topUpPurpose),
                style: FilledButton.styleFrom(
                  backgroundColor: Colors.white.withOpacity(0.2),
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                ),
                child: const Text('Top Up', style: TextStyle(fontSize: 12)),
              ),
            ],
          ),
          const SizedBox(height: 20),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Rental Recovery', style: TextStyle(color: Colors.white70, fontSize: 10)),
              Text('${rider.paymentStreak} / 5 Days', style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold)),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: List.generate(5, (i) => Expanded(
              child: Container(
                height: 8,
                margin: EdgeInsets.only(right: i < 4 ? 6 : 0),
                decoration: BoxDecoration(
                  color: i < rider.paymentStreak ? Colors.white : Colors.white.withOpacity(0.25),
                  borderRadius: BorderRadius.circular(4),
                ),
              ),
            )),
          ),
          const SizedBox(height: 12),
          const Text(
            'Maintaining a 5-day streak unlocks premium tiers',
            style: TextStyle(color: Colors.white38, fontSize: 10, fontStyle: FontStyle.italic),
          ),
        ],
      ),
    );
  }

  Widget _buildActionCard(String title, String action, VoidCallback? onNext, bool canAction) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 24,
            offset: const Offset(0, 12),
          ),
        ],
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: const Color(0xFFF0F9FF),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Icon(Icons.flash_on, color: Color(0xFF0053C1), size: 24),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF191C1E))),
                const SizedBox(height: 4),
                const Text(
                  'Your account is being processed. Complete the next steps to unlock your vehicle.',
                  style: TextStyle(fontSize: 12, color: Color(0xFF424653)),
                ),
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: canAction ? onNext : null,
                    style: FilledButton.styleFrom(
                      backgroundColor: const Color(0xFF0053C1),
                      disabledBackgroundColor: const Color(0xFFE0E3E5),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
                    ),
                    child: Text(action, style: const TextStyle(fontWeight: FontWeight.bold)),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInfoCard() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFFF0FDF4),
        borderRadius: BorderRadius.circular(20),
      ),
      child: const Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.eco_outlined, color: Color(0xFF16A34A), size: 24),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Did you know?', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFF191C1E))),
                const SizedBox(height: 4),
                Text(
                  'Electric scooters produce zero direct emissions. Each ride saves approximately 0.5 kg of CO2 compared to petrol moped.',
                  style: TextStyle(fontSize: 12, color: Color(0xFF424653), height: 1.4),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
