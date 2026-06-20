import 'package:flutter/material.dart';
import 'package:shimmer/shimmer.dart';

class ShimmerLoading extends StatelessWidget {
  final double width;
  final double height;
  final double borderRadius;
  final ShimmerShape shape;

  const ShimmerLoading({
    super.key,
    required this.width,
    required this.height,
    this.borderRadius = 8,
    this.shape = ShimmerShape.rectangle,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Shimmer.fromColors(
      baseColor: isDark ? Colors.grey[800]! : Colors.grey[300]!,
      highlightColor: isDark ? Colors.grey[700]! : Colors.grey[100]!,
      child: Container(
        width: width,
        height: height,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: shape == ShimmerShape.circle
              ? BorderRadius.circular(height / 2)
              : BorderRadius.circular(borderRadius),
        ),
      ),
    );
  }
}

enum ShimmerShape { rectangle, circle, rounded }

class ShimmerCard extends StatelessWidget {
  final double? width;
  final double height;
  final EdgeInsets? margin;

  const ShimmerCard({
    super.key,
    this.width,
    this.height = 140,
    this.margin,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: margin ?? EdgeInsets.zero,
      child: ShimmerLoading(
        width: width ?? double.infinity,
        height: height,
        borderRadius: 16,
      ),
    );
  }
}

class ShimmerListTile extends StatelessWidget {
  final bool showAvatar;
  final bool showSubtitle;
  final bool showTrailing;

  const ShimmerListTile({
    super.key,
    this.showAvatar = true,
    this.showSubtitle = true,
    this.showTrailing = false,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      child: Row(
        children: [
          if (showAvatar) ...[
            const ShimmerLoading(
                width: 52, height: 52, shape: ShimmerShape.circle,),
            const SizedBox(width: 14),
          ],
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const ShimmerLoading(width: double.infinity, height: 16),
                if (showSubtitle) ...[
                  const SizedBox(height: 8),
                  const ShimmerLoading(width: 180, height: 12),
                ],
              ],
            ),
          ),
          if (showTrailing) ...[
            const SizedBox(width: 12),
            const ShimmerLoading(width: 60, height: 32, borderRadius: 8),
          ],
        ],
      ),
    );
  }
}

class ShimmerTransactionCard extends StatelessWidget {
  const ShimmerTransactionCard({super.key});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
        ),
        child: const Row(
          children: [
            ShimmerLoading(
                width: 48, height: 48, shape: ShimmerShape.circle,),
            SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  ShimmerLoading(width: 120, height: 16),
                  SizedBox(height: 8),
                  ShimmerLoading(width: 80, height: 12),
                ],
              ),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                ShimmerLoading(width: 60, height: 16),
                SizedBox(height: 8),
                ShimmerLoading(width: 50, height: 10),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class ShimmerWalletCard extends StatelessWidget {
  const ShimmerWalletCard({super.key});

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.all(16),
      child: ShimmerLoading(
        width: double.infinity,
        height: 180,
        borderRadius: 24,
      ),
    );
  }
}

class ShimmerVehicleCard extends StatelessWidget {
  const ShimmerVehicleCard({super.key});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
        ),
        child: const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                ShimmerLoading(width: 64, height: 64, borderRadius: 12),
                SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      ShimmerLoading(width: 100, height: 18),
                      SizedBox(height: 6),
                      ShimmerLoading(width: 60, height: 12),
                    ],
                  ),
                ),
                ShimmerLoading(
                    width: 32, height: 32, shape: ShimmerShape.circle,),
              ],
            ),
            SizedBox(height: 16),
            ShimmerLoading(width: double.infinity, height: 8),
          ],
        ),
      ),
    );
  }
}

class ShimmerProfileCard extends StatelessWidget {
  const ShimmerProfileCard({super.key});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          const Row(
            children: [
              ShimmerLoading(
                  width: 72, height: 72, shape: ShimmerShape.circle,),
              SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    ShimmerLoading(width: 140, height: 20),
                    SizedBox(height: 8),
                    ShimmerLoading(width: 100, height: 14),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),
          Row(
            children: List.generate(
              3,
              (index) => Expanded(
                child: Padding(
                  padding: EdgeInsets.only(left: index > 0 ? 8 : 0),
                  child: const ShimmerLoading(
                      width: double.infinity, height: 60, borderRadius: 12,),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class ShimmerKycStep extends StatelessWidget {
  final int stepNumber;

  const ShimmerKycStep({super.key, required this.stepNumber});

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          ShimmerLoading(
              width: 40, height: 40, shape: ShimmerShape.circle,),
          SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                ShimmerLoading(width: 150, height: 16),
                SizedBox(height: 6),
                ShimmerLoading(width: 200, height: 12),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class ShimmerDashboardCard extends StatelessWidget {
  final bool hasChart;

  const ShimmerDashboardCard({super.key, this.hasChart = false});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              ShimmerLoading(
                  width: 40, height: 40, shape: ShimmerShape.circle,),
              SizedBox(width: 12),
              Expanded(
                child: ShimmerLoading(width: 80, height: 14),
              ),
            ],
          ),
          const SizedBox(height: 16),
          if (hasChart) ...[
            const ShimmerLoading(width: double.infinity, height: 60),
          ] else ...[
            const ShimmerLoading(width: 100, height: 28),
          ],
        ],
      ),
    );
  }
}

class ShimmerText extends StatelessWidget {
  final double width;
  final double height;

  const ShimmerText({
    super.key,
    required this.width,
    this.height = 16,
  });

  @override
  Widget build(BuildContext context) {
    return ShimmerLoading(width: width, height: height);
  }
}

class ShimmerList extends StatelessWidget {
  final int itemCount;
  final Widget? item;

  const ShimmerList({
    super.key,
    this.itemCount = 5,
    this.item,
  });

  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: itemCount,
      itemBuilder: (context, index) => item ?? const SizedBox.shrink(),
    );
  }
}
