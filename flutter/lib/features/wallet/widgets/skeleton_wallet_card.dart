/// Skeleton placeholder for WalletCard — no layout shift when data loads.
library;

import 'package:flutter/material.dart';
import 'package:voltium_rider/theme/app_theme.dart';

class SkeletonWalletCard extends StatelessWidget {
  final bool compact;

  const SkeletonWalletCard({super.key, this.compact = false});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.all(compact ? 16 : 20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(AppRadius.radiusModal),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 20,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _bar(width: 80, height: 10),
          const SizedBox(height: 8),
          _bar(width: compact ? 60 : 120, height: compact ? 20 : 28),
          const SizedBox(height: 12),
          _bar(width: double.infinity, height: 44),
        ],
      ),
    );
  }

  Widget _bar({double width = double.infinity, double height = 12}) {
    return Container(
      width: width.isFinite ? width : null,
      height: height,
      decoration: BoxDecoration(
        color: AppColors.outlineVariant,
        borderRadius: BorderRadius.circular(AppRadius.xs),
      ),
    );
  }
}

class SkeletonPlanCard extends StatelessWidget {
  const SkeletonPlanCard({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(Spacing.md),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(AppRadius.radiusModal),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 20,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _bar(width: 60, height: 10),
          const SizedBox(height: 8),
          _bar(width: 100, height: 22),
          const SizedBox(height: 6),
          _bar(width: 140, height: 12),
        ],
      ),
    );
  }

  Widget _bar({double width = double.infinity, double height = 12}) {
    return Container(
      width: width.isFinite ? width : null,
      height: height,
      decoration: BoxDecoration(
        color: AppColors.outlineVariant,
        borderRadius: BorderRadius.circular(AppRadius.xs),
      ),
    );
  }
}
