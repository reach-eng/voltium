import 'package:flutter/material.dart';
import 'shimmer_loading.dart';
import '../theme/app_theme.dart';

/// Collections of full-screen skeleton loaders that mirror the web app's layouts.
/// This ensures 1:1 visual parity during data fetching.

class DashboardSkeleton extends StatelessWidget {
  const DashboardSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return const SingleChildScrollView(
      physics: NeverScrollableScrollPhysics(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Padding(
            padding: EdgeInsets.fromLTRB(20, 24, 20, 12),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                ShimmerLoading(width: 112, height: 24, borderRadius: 4),
                ShimmerLoading(
                  width: 40,
                  height: 40,
                  shape: ShimmerShape.circle,
                ),
              ],
            ),
          ),

          Padding(
            padding: EdgeInsets.symmetric(horizontal: 20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                ShimmerLoading(width: 192, height: 40, borderRadius: 20),
                SizedBox(height: 16),
                ShimmerLoading(
                  width: double.infinity,
                  height: 96,
                  borderRadius: 20,
                ),
                SizedBox(height: 16),
                ShimmerLoading(
                  width: double.infinity,
                  height: 176,
                  borderRadius: 20,
                ),
                SizedBox(height: 16),

                // Bento Grid
                Row(
                  children: [
                    Expanded(
                      child: ShimmerLoading(
                        width: double.infinity,
                        height: 96,
                        borderRadius: 20,
                      ),
                    ),
                    SizedBox(width: 12),
                    Expanded(
                      child: ShimmerLoading(
                        width: double.infinity,
                        height: 96,
                        borderRadius: 20,
                      ),
                    ),
                  ],
                ),
                SizedBox(height: 16),

                ShimmerLoading(
                  width: double.infinity,
                  height: 112,
                  borderRadius: 20,
                ),
                SizedBox(height: 16),
                ShimmerLoading(width: 160, height: 32, borderRadius: 8),
                SizedBox(height: 16),

                // Performance Grid
                Row(
                  children: [
                    Expanded(
                      child: ShimmerLoading(
                        width: double.infinity,
                        height: 80,
                        borderRadius: 20,
                      ),
                    ),
                    SizedBox(width: 12),
                    Expanded(
                      child: ShimmerLoading(
                        width: double.infinity,
                        height: 80,
                        borderRadius: 20,
                      ),
                    ),
                  ],
                ),
                SizedBox(height: 12),
                ShimmerLoading(
                  width: double.infinity,
                  height: 80,
                  borderRadius: 20,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class WalletSkeleton extends StatelessWidget {
  const WalletSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // App Bar Mock
        Container(
          height: 140,
          color: Colors.transparent, // Padding for -mt-4 logic in web
          padding: const EdgeInsets.fromLTRB(20, 48, 20, 32),
          child: const ShimmerLoading(width: 112, height: 28, borderRadius: 4),
        ),

        Expanded(
          child: ListView(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            children: const [
              ShimmerLoading(
                width: double.infinity,
                height: 192,
                borderRadius: 24,
              ),
              SizedBox(height: 16),
              ShimmerLoading(
                width: double.infinity,
                height: 128,
                borderRadius: 24,
              ),
              SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: ShimmerLoading(
                      width: double.infinity,
                      height: 64,
                      borderRadius: 16,
                    ),
                  ),
                  SizedBox(width: 12),
                  Expanded(
                    child: ShimmerLoading(
                      width: double.infinity,
                      height: 64,
                      borderRadius: 16,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class PreDashboardSkeleton extends StatelessWidget {
  const PreDashboardSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Blue header block
        Container(
          height: 160,
          padding: const EdgeInsets.fromLTRB(20, 48, 20, 32),
          child: const Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ShimmerLoading(width: 112, height: 16, borderRadius: 4),
              SizedBox(height: 8),
              ShimmerLoading(width: 160, height: 28, borderRadius: 4),
            ],
          ),
        ),

        const Expanded(
          child: Padding(
            padding: EdgeInsets.symmetric(horizontal: 16),
            child: Column(
              children: [
                ShimmerLoading(
                  width: double.infinity,
                  height: 64,
                  borderRadius: 12,
                ),
                SizedBox(height: 16),
                ShimmerLoading(
                  width: double.infinity,
                  height: 112,
                  borderRadius: 12,
                ),
                SizedBox(height: 16),
                ShimmerLoading(
                  width: double.infinity,
                  height: 192,
                  borderRadius: 12,
                ),
                SizedBox(height: 16),
                ShimmerLoading(
                  width: double.infinity,
                  height: 128,
                  borderRadius: 12,
                ),
                SizedBox(height: 16),
                ShimmerLoading(
                  width: double.infinity,
                  height: 96,
                  borderRadius: 12,
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class ProfileSkeleton extends StatelessWidget {
  const ProfileSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.fromLTRB(20, 48, 20, 20),
      child: SingleChildScrollView(
        child: Column(
          children: [
            Row(
              children: [
                ShimmerLoading(
                    width: 40, height: 40, shape: ShimmerShape.circle),
                SizedBox(width: 12),
                ShimmerLoading(width: 80, height: 28, borderRadius: 4),
              ],
            ),
            SizedBox(height: 24),
            ShimmerLoading(
              width: double.infinity,
              height: 192,
              borderRadius: 16,
            ),
            SizedBox(height: 24),
            ShimmerLoading(
              width: double.infinity,
              height: 208,
              borderRadius: 16,
            ),
          ],
        ),
      ),
    );
  }
}

class SupportSkeleton extends StatelessWidget {
  const SupportSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(Spacing.md),
      child: SingleChildScrollView(
        child: Column(
          children: [
            const Row(
              children: [
                ShimmerLoading(
                    width: 40, height: 40, shape: ShimmerShape.circle),
                SizedBox(width: 12),
                ShimmerLoading(width: 144, height: 28, borderRadius: 4),
              ],
            ),
            const SizedBox(height: 20),
            Row(
              children: List.generate(
                3,
                (i) => const Expanded(
                  child: Padding(
                    padding: EdgeInsets.symmetric(horizontal: 4),
                    child: ShimmerLoading(
                      width: double.infinity,
                      height: 80,
                      borderRadius: 12,
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 20),
            const ShimmerLoading(
              width: double.infinity,
              height: 48,
              borderRadius: 12,
            ),
            const SizedBox(height: 20),
            ...List.generate(
              4,
              (i) => const Padding(
                padding: EdgeInsets.only(bottom: 12),
                child: ShimmerLoading(
                  width: double.infinity,
                  height: 64,
                  borderRadius: 12,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Skeleton for pickup hub selection screen — card grid with search bar placeholder.
class PickupHubSkeleton extends StatelessWidget {
  const PickupHubSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: Spacing.paddingMd,
      child: Column(
        children: [
          // Search bar
          const ShimmerLoading(
              width: double.infinity, height: 48, borderRadius: 24),
          const SizedBox(height: 20),
          // Hub cards grid
          Expanded(
            child: GridView.builder(
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                childAspectRatio: 0.85,
                crossAxisSpacing: 12,
                mainAxisSpacing: 12,
              ),
              itemCount: 6,
              physics: const NeverScrollableScrollPhysics(),
              itemBuilder: (_, __) => const ShimmerLoading(
                  width: double.infinity,
                  height: double.infinity,
                  borderRadius: 16),
            ),
          ),
        ],
      ),
    );
  }
}

/// Skeleton for pickup verification screen — photo capture + detail placeholders.
class PickupVerificationSkeleton extends StatelessWidget {
  const PickupVerificationSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return const Column(
      children: [
        SizedBox(height: 24),
        // Photo capture area
        Padding(
          padding: EdgeInsets.symmetric(horizontal: 16),
          child: ShimmerLoading(
              width: double.infinity, height: 200, borderRadius: 16),
        ),
        SizedBox(height: 16),
        // Multiple photo thumbnails
        Padding(
          padding: EdgeInsets.symmetric(horizontal: 16),
          child: Row(
            children: [
              Expanded(
                  child: ShimmerLoading(
                      width: double.infinity, height: 80, borderRadius: 12)),
              SizedBox(width: 8),
              Expanded(
                  child: ShimmerLoading(
                      width: double.infinity, height: 80, borderRadius: 12)),
              SizedBox(width: 8),
              Expanded(
                  child: ShimmerLoading(
                      width: double.infinity, height: 80, borderRadius: 12)),
            ],
          ),
        ),
        SizedBox(height: 24),
        // Detail field placeholders
        Padding(
          padding: EdgeInsets.symmetric(horizontal: 16),
          child: Column(
            children: [
              ShimmerLoading(
                  width: double.infinity, height: 56, borderRadius: 12),
              SizedBox(height: 12),
              ShimmerLoading(
                  width: double.infinity, height: 56, borderRadius: 12),
              SizedBox(height: 12),
              ShimmerLoading(
                  width: double.infinity, height: 56, borderRadius: 12),
            ],
          ),
        ),
      ],
    );
  }
}

/// Skeleton for plan selection screen — plan cards with compare layout.
class PlansSkeleton extends StatelessWidget {
  const PlansSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return const SingleChildScrollView(
      physics: NeverScrollableScrollPhysics(),
      padding: Spacing.paddingMd,
      child: Column(
        children: [
          // Header
          ShimmerLoading(width: 180, height: 28, borderRadius: 4),
          SizedBox(height: 8),
          ShimmerLoading(width: 240, height: 16, borderRadius: 4),
          SizedBox(height: 24),
          // Plan card 1
          ShimmerLoading(width: double.infinity, height: 200, borderRadius: 20),
          SizedBox(height: 16),
          // Plan card 2
          ShimmerLoading(width: double.infinity, height: 200, borderRadius: 20),
          SizedBox(height: 16),
          // Plan card 3
          ShimmerLoading(width: double.infinity, height: 200, borderRadius: 20),
        ],
      ),
    );
  }
}

/// Skeleton for guarantor onboarding — form fields + upload area.
class GuarantorSkeleton extends StatelessWidget {
  const GuarantorSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return const SingleChildScrollView(
      physics: NeverScrollableScrollPhysics(),
      padding: Spacing.paddingMd,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ShimmerLoading(width: 160, height: 24, borderRadius: 4),
          SizedBox(height: 16),
          ShimmerLoading(width: double.infinity, height: 56, borderRadius: 12),
          SizedBox(height: 12),
          ShimmerLoading(width: double.infinity, height: 56, borderRadius: 12),
          SizedBox(height: 12),
          ShimmerLoading(width: double.infinity, height: 56, borderRadius: 12),
          SizedBox(height: 24),
          ShimmerLoading(width: 140, height: 24, borderRadius: 4),
          SizedBox(height: 16),
          // Document upload area
          ShimmerLoading(width: double.infinity, height: 160, borderRadius: 16),
          SizedBox(height: 24),
          // Submit button
          ShimmerLoading(width: double.infinity, height: 56, borderRadius: 28),
        ],
      ),
    );
  }
}

/// Skeleton for KYC form — multi-step form fields.
class KycSkeleton extends StatelessWidget {
  const KycSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return const SingleChildScrollView(
      physics: NeverScrollableScrollPhysics(),
      padding: Spacing.paddingMd,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Step indicator
          Row(
            children: [
              ShimmerLoading(width: 32, height: 32, shape: ShimmerShape.circle),
              SizedBox(width: 8),
              Expanded(
                  child: ShimmerLoading(
                      width: double.infinity, height: 4, borderRadius: 2)),
              SizedBox(width: 8),
              ShimmerLoading(width: 32, height: 32, shape: ShimmerShape.circle),
              SizedBox(width: 8),
              Expanded(
                  child: ShimmerLoading(
                      width: double.infinity, height: 4, borderRadius: 2)),
              SizedBox(width: 8),
              ShimmerLoading(width: 32, height: 32, shape: ShimmerShape.circle),
            ],
          ),
          SizedBox(height: 32),
          // Form fields
          ShimmerLoading(width: 120, height: 16, borderRadius: 4),
          SizedBox(height: 8),
          ShimmerLoading(width: double.infinity, height: 56, borderRadius: 12),
          SizedBox(height: 16),
          ShimmerLoading(width: 100, height: 16, borderRadius: 4),
          SizedBox(height: 8),
          ShimmerLoading(width: double.infinity, height: 56, borderRadius: 12),
          SizedBox(height: 16),
          ShimmerLoading(width: 80, height: 16, borderRadius: 4),
          SizedBox(height: 8),
          ShimmerLoading(width: double.infinity, height: 56, borderRadius: 12),
          SizedBox(height: 32),
          // Submit
          ShimmerLoading(width: double.infinity, height: 56, borderRadius: 28),
        ],
      ),
    );
  }
}

/// Skeleton for notification list — list items.
class NotificationSkeleton extends StatelessWidget {
  const NotificationSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: Spacing.paddingMd,
      child: Column(
        children: List.generate(
          5,
          (i) => const Padding(
            padding: EdgeInsets.only(bottom: 12),
            child: ShimmerListTile(showTrailing: true),
          ),
        ),
      ),
    );
  }
}

/// PR #6: Skeleton for wallet history + transaction list — same shape as
/// the actual list (header card + N row tiles) so the layout doesn't
/// jump when data arrives. Default count is 6 rows.
class HistoryListSkeleton extends StatelessWidget {
  final int itemCount;
  const HistoryListSkeleton({super.key, this.itemCount = 6});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const ShimmerLoading(
            width: double.infinity,
            height: 96,
            borderRadius: 16,
          ),
          const SizedBox(height: 16),
          ...List.generate(
            itemCount,
            (i) => const Padding(
              padding: EdgeInsets.only(bottom: 12),
              child: ShimmerListTile(showTrailing: true),
            ),
          ),
        ],
      ),
    );
  }
}

/// PR #6: Skeleton for support ticket list — matches the ListTile +
/// subtitle shape of the real tickets list.
class TicketListSkeleton extends StatelessWidget {
  final int itemCount;
  const TicketListSkeleton({super.key, this.itemCount = 4});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      child: Column(
        children: List.generate(
          itemCount,
          (i) => const Padding(
            padding: EdgeInsets.only(bottom: 12),
            child: ShimmerListTile(showTrailing: false),
          ),
        ),
      ),
    );
  }
}
