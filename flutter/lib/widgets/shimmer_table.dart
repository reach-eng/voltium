import 'package:flutter/material.dart';
import 'package:voltium_rider/theme/app_theme.dart';

class ShimmerTable extends StatefulWidget {
  final int rows;
  final int columns;
  final double rowHeight;
  final double cellPadding;
  final List<double>? columnWidths;
  final List<String>? headers;

  const ShimmerTable({
    super.key,
    this.rows = 5,
    this.columns = 4,
    this.rowHeight = 48,
    this.cellPadding = 12,
    this.columnWidths,
    this.headers,
  });

  @override
  State<ShimmerTable> createState() => _ShimmerTableState();
}

class _ShimmerTableState extends State<ShimmerTable>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _animation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    )..repeat();
    _animation = Tween<double>(begin: -2, end: 2).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final baseShimmer = isDark ? AppColors.slate800 : AppColors.shimmerBase;
    final highlightShimmer =
        isDark ? AppColors.slate700 : AppColors.shimmerHighlight;

    return AnimatedBuilder(
      animation: _animation,
      builder: (context, child) {
        return Column(
          children: [
            if (widget.headers != null)
              Container(
                height: widget.rowHeight,
                decoration: BoxDecoration(
                  border: Border(
                    bottom: BorderSide(color: colors.divider),
                  ),
                ),
                child: Row(
                  children: List.generate(widget.columns, (colIndex) {
                    final width = widget.columnWidths != null &&
                            colIndex < widget.columnWidths!.length
                        ? widget.columnWidths![colIndex]
                        : null;
                    return _buildShimmerCell(
                      width: width,
                      isHeader: true,
                      widthFactor: 0.6,
                      baseColor: baseShimmer,
                      highlightColor: highlightShimmer,
                    );
                  }),
                ),
              ),
            ...List.generate(widget.rows, (rowIndex) {
              return Container(
                height: widget.rowHeight,
                decoration: BoxDecoration(
                  border: Border(
                    bottom: BorderSide(color: colors.divider),
                  ),
                ),
                child: Row(
                  children: List.generate(widget.columns, (colIndex) {
                    final width = widget.columnWidths != null &&
                            colIndex < widget.columnWidths!.length
                        ? widget.columnWidths![colIndex]
                        : null;
                    return _buildShimmerCell(
                      width: width,
                      widthFactor: colIndex == 0 ? 0.8 : 0.5,
                      baseColor: baseShimmer,
                      highlightColor: highlightShimmer,
                    );
                  }),
                ),
              );
            }),
          ],
        );
      },
    );
  }

  Widget _buildShimmerCell({
    double? width,
    bool isHeader = false,
    required double widthFactor,
    required Color baseColor,
    required Color highlightColor,
  }) {
    return Expanded(
      child: Container(
        width: width,
        padding: EdgeInsets.all(widget.cellPadding),
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppRadius.xs),
            gradient: LinearGradient(
              begin: Alignment(_animation.value - 1, 0),
              end: Alignment(_animation.value + 1, 0),
              colors: [
                baseColor,
                highlightColor,
                baseColor,
              ],
            ),
          ),
          height: isHeader ? 16 : 12,
        ),
      ),
    );
  }
}

class ShimmerList extends StatefulWidget {
  final int itemCount;
  final double itemHeight;
  final EdgeInsets padding;
  final double separatorHeight;

  const ShimmerList({
    super.key,
    this.itemCount = 5,
    this.itemHeight = 72,
    this.padding = Spacing.paddingMd,
    this.separatorHeight = 8,
  });

  @override
  State<ShimmerList> createState() => _ShimmerListState();
}

class _ShimmerListState extends State<ShimmerList>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _animation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    )..repeat();
    _animation = Tween<double>(begin: -2, end: 2).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _animation,
      builder: (context, child) {
        return ListView.separated(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          padding: widget.padding,
          itemCount: widget.itemCount,
          separatorBuilder: (context, index) =>
              SizedBox(height: widget.separatorHeight),
          itemBuilder: (context, index) {
            return _buildShimmerItem();
          },
        );
      },
    );
  }

  Widget _buildShimmerItem() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final baseColor = isDark ? AppColors.slate800 : AppColors.shimmerBase;
    final highlightColor =
        isDark ? AppColors.slate700 : AppColors.shimmerHighlight;

    return Container(
      height: widget.itemHeight,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(AppRadius.md),
      ),
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: LinearGradient(
                begin: Alignment(_animation.value - 1, 0),
                end: Alignment(_animation.value + 1, 0),
                colors: [
                  baseColor,
                  highlightColor,
                  baseColor,
                ],
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  height: 14,
                  width: double.infinity,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(AppRadius.xs),
                    gradient: LinearGradient(
                      begin: Alignment(_animation.value - 1, 0),
                      end: Alignment(_animation.value + 1, 0),
                      colors: [
                        baseColor,
                        highlightColor,
                        baseColor,
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                Container(
                  height: 10,
                  width: 150,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(AppRadius.xs),
                    gradient: LinearGradient(
                      begin: Alignment(_animation.value - 1, 0),
                      end: Alignment(_animation.value + 1, 0),
                      colors: [
                        baseColor,
                        highlightColor,
                        baseColor,
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class ShimmerGrid extends StatefulWidget {
  final int itemCount;
  final int crossAxisCount;
  final double childAspectRatio;
  final double spacing;
  final EdgeInsets padding;

  const ShimmerGrid({
    super.key,
    this.itemCount = 6,
    this.crossAxisCount = 2,
    this.childAspectRatio = 1,
    this.spacing = 16,
    this.padding = Spacing.paddingMd,
  });

  @override
  State<ShimmerGrid> createState() => _ShimmerGridState();
}

class _ShimmerGridState extends State<ShimmerGrid>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _animation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    )..repeat();
    _animation = Tween<double>(begin: -2, end: 2).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _animation,
      builder: (context, child) {
        return GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          padding: widget.padding,
          gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: widget.crossAxisCount,
            childAspectRatio: widget.childAspectRatio,
            crossAxisSpacing: widget.spacing,
            mainAxisSpacing: widget.spacing,
          ),
          itemCount: widget.itemCount,
          itemBuilder: (context, index) {
            return Container(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(AppRadius.sm),
                gradient: LinearGradient(
                  begin: Alignment(_animation.value - 1, 0),
                  end: Alignment(_animation.value + 1, 0),
                  colors: [
                    AppColors.shimmerBase,
                    AppColors.shimmerHighlight,
                    AppColors.shimmerBase,
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }
}
