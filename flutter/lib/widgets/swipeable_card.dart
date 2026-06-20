import 'package:flutter/material.dart';

class SwipeableCard extends StatefulWidget {
  final Widget child;
  final VoidCallback? onDelete;
  final VoidCallback? onArchive;
  final VoidCallback? onFlag;
  final String? deleteLabel;
  final String? archiveLabel;
  final Color? deleteColor;
  final Color? archiveColor;
  final double threshold;

  const SwipeableCard({
    super.key,
    required this.child,
    this.onDelete,
    this.onArchive,
    this.onFlag,
    this.deleteLabel,
    this.archiveLabel,
    this.deleteColor,
    this.archiveColor,
    this.threshold = 0.3,
  });

  @override
  State<SwipeableCard> createState() => _SwipeableCardState();
}

class _SwipeableCardState extends State<SwipeableCard>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<Offset> _slideAnimation;
  double _dragExtent = 0;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 200),);
    _slideAnimation =
        Tween<Offset>(begin: Offset.zero, end: Offset.zero).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeOut),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _handleDragUpdate(DragUpdateDetails details) {
    setState(() {
      _dragExtent += details.delta.dx;
      _dragExtent = _dragExtent.clamp(-200.0, 200.0);
    });
  }

  void _handleDragEnd(DragEndDetails details) {
    final width = context.size?.width ?? 300;
    final thresholdValue = width * widget.threshold;

    if (_dragExtent > thresholdValue && widget.onArchive != null) {
      _animateOut(() => widget.onArchive?.call());
    } else if (_dragExtent < -thresholdValue && widget.onDelete != null) {
      _animateOut(() => widget.onDelete?.call());
    } else {
      _animateBack();
    }
  }

  void _animateBack() {
    _slideAnimation = Tween<Offset>(
      begin: Offset(_dragExtent, 0),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _controller, curve: Curves.easeOut));
    _controller.forward(from: 0).then((_) {
      setState(() => _dragExtent = 0);
    });
  }

  void _animateOut(VoidCallback callback) {
    final width = context.size?.width ?? 300;
    _slideAnimation = Tween<Offset>(
      begin: Offset(_dragExtent, 0),
      end: Offset(_dragExtent > 0 ? width : -width, 0),
    ).animate(CurvedAnimation(parent: _controller, curve: Curves.easeIn));
    _controller.forward(from: 0).then((_) {
      callback();
      setState(() => _dragExtent = 0);
    });
  }

  @override
  Widget build(BuildContext context) {
    final deleteColor = widget.deleteColor ?? Colors.red;
    final archiveColor = widget.archiveColor ?? Colors.orange;

    return Stack(
      children: [
        Positioned.fill(
          child: Row(
            children: [
              if (widget.onArchive != null)
                Expanded(
                  child: Container(
                    alignment: Alignment.centerLeft,
                    padding: const EdgeInsets.only(left: 20),
                    color: archiveColor,
                    child: Row(
                      children: [
                        const Icon(Icons.archive, color: Colors.white),
                        if (_dragExtent > 50)
                          Padding(
                            padding: const EdgeInsets.only(left: 8),
                            child: Text(
                              widget.archiveLabel ?? 'Archive',
                              style: const TextStyle(color: Colors.white),
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
              if (widget.onDelete != null)
                Expanded(
                  child: Container(
                    alignment: Alignment.centerRight,
                    padding: const EdgeInsets.only(right: 20),
                    color: deleteColor,
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.end,
                      children: [
                        if (_dragExtent < -50)
                          Padding(
                            padding: const EdgeInsets.only(right: 8),
                            child: Text(
                              widget.deleteLabel ?? 'Delete',
                              style: const TextStyle(color: Colors.white),
                            ),
                          ),
                        const Icon(Icons.delete, color: Colors.white),
                      ],
                    ),
                  ),
                ),
            ],
          ),
        ),
        GestureDetector(
          onHorizontalDragUpdate: _handleDragUpdate,
          onHorizontalDragEnd: _handleDragEnd,
          child: AnimatedBuilder(
            animation: _controller,
            builder: (context, child) {
              return Transform.translate(
                offset: _controller.isAnimating
                    ? _slideAnimation.value
                    : Offset(_dragExtent, 0),
                child: child,
              );
            },
            child: widget.child,
          ),
        ),
      ],
    );
  }
}

class SwipeAction extends StatelessWidget {
  final Widget child;
  final List<SwipeActionItem> actions;
  final double threshold;

  const SwipeAction({
    super.key,
    required this.child,
    required this.actions,
    this.threshold = 0.3,
  });

  @override
  Widget build(BuildContext context) {
    return SwipeableCard(
      onDelete: actions.any((a) => a.type == SwipeActionType.delete)
          ? actions.firstWhere((a) => a.type == SwipeActionType.delete).onTap
          : null,
      onArchive: actions.any((a) => a.type == SwipeActionType.archive)
          ? actions.firstWhere((a) => a.type == SwipeActionType.archive).onTap
          : null,
      child: child,
    );
  }
}

enum SwipeActionType { delete, archive, flag, custom }

class SwipeActionItem {
  final SwipeActionType type;
  final VoidCallback onTap;
  final Color? color;
  final IconData? icon;
  final String? label;

  const SwipeActionItem({
    required this.type,
    required this.onTap,
    this.color,
    this.icon,
    this.label,
  });
}
