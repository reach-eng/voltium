import 'package:flutter/material.dart';

class TimelineItem {
  final String title;
  final String? subtitle;
  final IconData? icon;
  final Color? iconColor;
  final bool isCompleted;
  final bool isActive;
  final DateTime? timestamp;

  TimelineItem({
    required this.title,
    this.subtitle,
    this.icon,
    this.iconColor,
    this.isCompleted = false,
    this.isActive = false,
    this.timestamp,
  });
}

class TimelineWidget extends StatelessWidget {
  final List<TimelineItem> items;
  final Color lineColor;
  final double lineWidth;
  final bool showConnector;

  const TimelineWidget({
    super.key,
    required this.items,
    this.lineColor = Colors.grey,
    this.lineWidth = 2,
    this.showConnector = true,
  });

  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: items.length,
      itemBuilder: (context, index) {
        final item = items[index];
        final isLast = index == items.length - 1;
        return IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SizedBox(
                width: 60,
                child: Column(
                  children: [
                    Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: item.isCompleted
                            ? Colors.green
                            : item.isActive
                                ? Colors.amber
                                : Colors.grey.shade300,
                        shape: BoxShape.circle,
                      ),
                      child: Icon(
                        item.icon ??
                            (item.isCompleted
                                ? Icons.check
                                : item.isActive
                                    ? Icons.circle
                                    : Icons.circle_outlined),
                        color: item.isCompleted || item.isActive
                            ? Colors.white
                            : Colors.grey,
                        size: 20,
                      ),
                    ),
                    if (showConnector && !isLast)
                      Expanded(
                        child: Container(
                          width: lineWidth,
                          color: item.isCompleted ? Colors.green : lineColor,
                        ),
                      ),
                  ],
                ),
              ),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.only(bottom: 24),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        item.title,
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          color: item.isCompleted || item.isActive
                              ? Colors.black
                              : Colors.grey,
                        ),
                      ),
                      if (item.subtitle != null)
                        Text(
                          item.subtitle!,
                          style: TextStyle(
                            color: Colors.grey.shade600,
                            fontSize: 12,
                          ),
                        ),
                      if (item.timestamp != null)
                        Text(
                          _formatTimestamp(item.timestamp!),
                          style: TextStyle(
                            color: Colors.grey.shade500,
                            fontSize: 10,
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  String _formatTimestamp(DateTime timestamp) {
    return '${timestamp.hour.toString().padLeft(2, '0')}:${timestamp.minute.toString().padLeft(2, '0')}';
  }
}

class BadgeCounter extends StatelessWidget {
  final int count;
  final Color color;
  final double size;
  final Widget? child;

  const BadgeCounter({
    super.key,
    required this.count,
    this.color = Colors.red,
    this.size = 20,
    this.child,
  });

  @override
  Widget build(BuildContext context) {
    return Stack(
      clipBehavior: Clip.none,
      children: [
        if (child != null) child!,
        if (count > 0)
          Positioned(
            right: -5,
            top: -5,
            child: Container(
              padding: const EdgeInsets.all(4),
              constraints: BoxConstraints(
                minWidth: size,
                minHeight: size,
              ),
              decoration: BoxDecoration(
                color: color,
                shape: BoxShape.circle,
              ),
              child: Center(
                child: Text(
                  count > 99 ? '99+' : count.toString(),
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}

class RatingStars extends StatelessWidget {
  final double rating;
  final double size;
  final Color activeColor;
  final Color inactiveColor;
  final bool allowHalfRating;

  const RatingStars({
    super.key,
    required this.rating,
    this.size = 24,
    this.activeColor = Colors.amber,
    this.inactiveColor = Colors.grey,
    this.allowHalfRating = true,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(5, (index) {
        final starValue = index + 1;
        IconData icon;
        if (rating >= starValue) {
          icon = Icons.star;
        } else if (allowHalfRating && rating >= starValue - 0.5) {
          icon = Icons.star_half;
        } else {
          icon = Icons.star_border;
        }
        return Icon(
          icon,
          size: size,
          color: rating >= starValue - 0.5 ? activeColor : inactiveColor,
        );
      }),
    );
  }
}

class InteractiveRatingStars extends StatefulWidget {
  final double initialRating;
  final double size;
  final Color activeColor;
  final Color inactiveColor;
  final ValueChanged<double>? onRatingChanged;

  const InteractiveRatingStars({
    super.key,
    this.initialRating = 0,
    this.size = 40,
    this.activeColor = Colors.amber,
    this.inactiveColor = Colors.grey,
    this.onRatingChanged,
  });

  @override
  State<InteractiveRatingStars> createState() => _InteractiveRatingStarsState();
}

class _InteractiveRatingStarsState extends State<InteractiveRatingStars> {
  late double _rating;

  @override
  void initState() {
    super.initState();
    _rating = widget.initialRating;
  }

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(5, (index) {
        final starValue = index + 1;
        return GestureDetector(
          onTap: () {
            setState(() {
              _rating = starValue.toDouble();
            });
            widget.onRatingChanged?.call(_rating);
          },
          child: Icon(
            _rating >= starValue ? Icons.star : Icons.star_border,
            size: widget.size,
            color: _rating >= starValue
                ? widget.activeColor
                : widget.inactiveColor,
          ),
        );
      }),
    );
  }
}

class NotificationDot extends StatelessWidget {
  final Color color;
  final double size;

  const NotificationDot({
    super.key,
    this.color = Colors.red,
    this.size = 8,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: color,
        shape: BoxShape.circle,
      ),
    );
  }
}

class StepIndicator extends StatelessWidget {
  final int currentStep;
  final int totalSteps;
  final List<String>? labels;
  final Color activeColor;
  final Color inactiveColor;

  const StepIndicator({
    super.key,
    required this.currentStep,
    required this.totalSteps,
    this.labels,
    this.activeColor = Colors.amber,
    this.inactiveColor = Colors.grey,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: List.generate(totalSteps, (index) {
        final isActive = index <= currentStep;
        final isCompleted = index < currentStep;
        return Expanded(
          child: Row(
            children: [
              Container(
                width: 30,
                height: 30,
                decoration: BoxDecoration(
                  color: isCompleted
                      ? activeColor
                      : isActive
                          ? activeColor.withOpacity(0.3)
                          : inactiveColor.withOpacity(0.3),
                  shape: BoxShape.circle,
                ),
                child: Center(
                  child: isCompleted
                      ? const Icon(Icons.check, color: Colors.white, size: 16)
                      : Text(
                          '${index + 1}',
                          style: TextStyle(
                            color: isActive ? activeColor : inactiveColor,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                ),
              ),
              if (index < totalSteps - 1)
                Expanded(
                  child: Container(
                    height: 2,
                    color: isCompleted
                        ? activeColor
                        : inactiveColor.withOpacity(0.3),
                  ),
                ),
            ],
          ),
        );
      }),
    );
  }
}
