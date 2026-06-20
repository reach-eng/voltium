import 'package:flutter/material.dart';

class ChipWidget extends StatelessWidget {
  final String label;
  final VoidCallback? onTap;
  final VoidCallback? onDelete;
  final Color color;
  final bool selected;
  final IconData? icon;

  const ChipWidget({
    super.key,
    required this.label,
    this.onTap,
    this.onDelete,
    this.color = Colors.amber,
    this.selected = false,
    this.icon,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: selected ? color : color.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: color),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (icon != null) ...[
              Icon(icon, size: 16, color: selected ? Colors.white : color),
              const SizedBox(width: 4),
            ],
            Text(
              label,
              style: TextStyle(
                color: selected ? Colors.white : color,
                fontSize: 12,
                fontWeight: FontWeight.w500,
              ),
            ),
            if (onDelete != null) ...[
              const SizedBox(width: 4),
              GestureDetector(
                onTap: onDelete,
                child: Icon(
                  Icons.close,
                  size: 14,
                  color: selected ? Colors.white : color,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class FilterChipList extends StatelessWidget {
  final List<String> labels;
  final List<int> selectedIndices;
  final ValueChanged<int>? onSelected;
  final Color activeColor;

  const FilterChipList({
    super.key,
    required this.labels,
    this.selectedIndices = const [],
    this.onSelected,
    this.activeColor = Colors.amber,
  });

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: List.generate(labels.length, (index) {
        final isSelected = selectedIndices.contains(index);
        return ChipWidget(
          label: labels[index],
          selected: isSelected,
          color: activeColor,
          onTap: () => onSelected?.call(index),
        );
      }),
    );
  }
}

class ChoiceChipList<T> extends StatelessWidget {
  final List<T> options;
  final T? selectedOption;
  final ValueChanged<T>? onSelected;
  final Widget Function(T option, bool isSelected)? labelBuilder;
  final Color activeColor;

  const ChoiceChipList({
    super.key,
    required this.options,
    this.selectedOption,
    this.onSelected,
    this.labelBuilder,
    this.activeColor = Colors.amber,
  });

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: options.map((option) {
        final isSelected = option == selectedOption;
        return ChipWidget(
          label: labelBuilder != null ? '' : option.toString(),
          selected: isSelected,
          color: activeColor,
          onTap: () => onSelected?.call(option),
        );
      }).toList(),
    );
  }
}

class CircularProgressIndicatorWidget extends StatelessWidget {
  final double? value;
  final Color? color;
  final double size;
  final double strokeWidth;

  const CircularProgressIndicatorWidget({
    super.key,
    this.value,
    this.color,
    this.size = 24,
    this.strokeWidth = 3,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: CircularProgressIndicator(
        value: value,
        color: color ?? Theme.of(context).colorScheme.primary,
        strokeWidth: strokeWidth,
      ),
    );
  }
}

class LinearProgressBar extends StatelessWidget {
  final double value;
  final Color? backgroundColor;
  final Color? progressColor;
  final double height;
  final BorderRadius? borderRadius;

  const LinearProgressBar({
    super.key,
    required this.value,
    this.backgroundColor,
    this.progressColor,
    this.height = 8,
    this.borderRadius,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      height: height,
      decoration: BoxDecoration(
        color: backgroundColor ?? Colors.grey.shade200,
        borderRadius: borderRadius ?? BorderRadius.circular(4),
      ),
      child: FractionallySizedBox(
        alignment: Alignment.centerLeft,
        widthFactor: value.clamp(0, 1),
        child: Container(
          decoration: BoxDecoration(
            color: progressColor ?? Colors.amber,
            borderRadius: borderRadius ?? BorderRadius.circular(4),
          ),
        ),
      ),
    );
  }
}

class AnimatedLinearProgressBar extends StatefulWidget {
  final double value;
  final Color? backgroundColor;
  final Color? progressColor;
  final double height;
  final Duration duration;

  const AnimatedLinearProgressBar({
    super.key,
    required this.value,
    this.backgroundColor,
    this.progressColor,
    this.height = 8,
    this.duration = const Duration(milliseconds: 300),
  });

  @override
  State<AnimatedLinearProgressBar> createState() =>
      _AnimatedLinearProgressBarState();
}

class _AnimatedLinearProgressBarState extends State<AnimatedLinearProgressBar>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _animation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: widget.duration,
    );
    _animation = Tween<double>(begin: 0, end: widget.value)
        .animate(CurvedAnimation(parent: _controller, curve: Curves.easeInOut));
    _controller.forward();
  }

  @override
  void didUpdateWidget(AnimatedLinearProgressBar oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.value != widget.value) {
      _animation = Tween<double>(begin: _animation.value, end: widget.value)
          .animate(
              CurvedAnimation(parent: _controller, curve: Curves.easeInOut),);
      _controller.forward(from: 0);
    }
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
        return LinearProgressBar(
          value: _animation.value,
          backgroundColor: widget.backgroundColor,
          progressColor: widget.progressColor,
          height: widget.height,
        );
      },
    );
  }
}

class SkeletonLoader extends StatefulWidget {
  final double width;
  final double height;
  final BorderRadius? borderRadius;

  const SkeletonLoader({
    super.key,
    this.width = double.infinity,
    this.height = 20,
    this.borderRadius,
  });

  @override
  State<SkeletonLoader> createState() => _SkeletonLoaderState();
}

class _SkeletonLoaderState extends State<SkeletonLoader>
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
        return Container(
          width: widget.width,
          height: widget.height,
          decoration: BoxDecoration(
            borderRadius: widget.borderRadius ?? BorderRadius.circular(4),
            gradient: LinearGradient(
              begin: Alignment(_animation.value - 1, 0),
              end: Alignment(_animation.value + 1, 0),
              colors: [
                Colors.grey.shade300,
                Colors.grey.shade100,
                Colors.grey.shade300,
              ],
            ),
          ),
        );
      },
    );
  }
}
