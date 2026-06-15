import 'package:flutter/material.dart';
import 'shimmer_loading.dart';

/// Collections of full-screen skeleton loaders that mirror the web app's layouts.
/// This ensures 1:1 visual parity during data fetching.

class DashboardSkeleton extends StatelessWidget {
  const DashboardSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      physics: const NeverScrollableScrollPhysics(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 24, 20, 12),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const ShimmerLoading(width: 112, height: 24, borderRadius: 4),
                const ShimmerLoading(
                    width: 40, height: 40, shape: ShimmerShape.circle),
              ],
            ),
          ),

          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const ShimmerLoading(width: 192, height: 40, borderRadius: 20),
                const SizedBox(height: 16),
                const ShimmerLoading(
                    width: double.infinity, height: 96, borderRadius: 20),
                const SizedBox(height: 16),
                const ShimmerLoading(
                    width: double.infinity, height: 176, borderRadius: 20),
                const SizedBox(height: 16),

                // Bento Grid
                Row(
                  children: [
                    const Expanded(
                        child: ShimmerLoading(
                            width: double.infinity,
                            height: 96,
                            borderRadius: 20)),
                    const SizedBox(width: 12),
                    const Expanded(
                        child: ShimmerLoading(
                            width: double.infinity,
                            height: 96,
                            borderRadius: 20)),
                  ],
                ),
                const SizedBox(height: 16),

                const ShimmerLoading(
                    width: double.infinity, height: 112, borderRadius: 20),
                const SizedBox(height: 16),
                const ShimmerLoading(width: 160, height: 32, borderRadius: 8),
                const SizedBox(height: 16),

                // Performance Grid
                Row(
                  children: [
                    const Expanded(
                        child: ShimmerLoading(
                            width: double.infinity,
                            height: 80,
                            borderRadius: 20)),
                    const SizedBox(width: 12),
                    const Expanded(
                        child: ShimmerLoading(
                            width: double.infinity,
                            height: 80,
                            borderRadius: 20)),
                  ],
                ),
                const SizedBox(height: 12),
                const ShimmerLoading(
                    width: double.infinity, height: 80, borderRadius: 20),
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
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Column(
              children: [
                const ShimmerLoading(
                    width: double.infinity, height: 192, borderRadius: 24),
                const SizedBox(height: 16),
                const ShimmerLoading(
                    width: double.infinity, height: 128, borderRadius: 24),
                const SizedBox(height: 16),
                const Row(
                  children: [
                    Expanded(
                        child: ShimmerLoading(
                            width: double.infinity,
                            height: 64,
                            borderRadius: 16)),
                    const SizedBox(width: 12),
                    Expanded(
                        child: ShimmerLoading(
                            width: double.infinity,
                            height: 64,
                            borderRadius: 16)),
                  ],
                ),
              ],
            ),
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

        Expanded(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Column(
              children: [
                const ShimmerLoading(
                    width: double.infinity, height: 64, borderRadius: 12),
                const SizedBox(height: 16),
                const ShimmerLoading(
                    width: double.infinity, height: 112, borderRadius: 12),
                const SizedBox(height: 16),
                const ShimmerLoading(
                    width: double.infinity, height: 192, borderRadius: 12),
                const SizedBox(height: 16),
                const ShimmerLoading(
                    width: double.infinity, height: 128, borderRadius: 12),
                const SizedBox(height: 16),
                const ShimmerLoading(
                    width: double.infinity, height: 96, borderRadius: 12),
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
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 48, 20, 20),
      child: Column(
        children: [
          const Row(
            children: [
              ShimmerLoading(width: 40, height: 40, shape: ShimmerShape.circle),
              const SizedBox(width: 12),
              ShimmerLoading(width: 80, height: 28, borderRadius: 4),
            ],
          ),
          const SizedBox(height: 24),
          const ShimmerLoading(
              width: double.infinity, height: 192, borderRadius: 16),
          const SizedBox(height: 24),
          const ShimmerLoading(
              width: double.infinity, height: 208, borderRadius: 16),
        ],
      ),
    );
  }
}

class SupportSkeleton extends StatelessWidget {
  const SupportSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        children: [
          const Row(
            children: [
              ShimmerLoading(width: 40, height: 40, shape: ShimmerShape.circle),
              const SizedBox(width: 12),
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
                            borderRadius: 12),
                      ),
                    )),
          ),
          const SizedBox(height: 20),
          const ShimmerLoading(
              width: double.infinity, height: 48, borderRadius: 12),
          const SizedBox(height: 20),
          ...List.generate(
              4,
              (i) => const Padding(
                    padding: EdgeInsets.only(bottom: 12),
                    child: ShimmerLoading(
                        width: double.infinity, height: 64, borderRadius: 12),
                  )),
        ],
      ),
    );
  }
}
