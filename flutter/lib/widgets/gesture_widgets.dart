import 'package:flutter/material.dart';

class PinchZoom extends StatefulWidget {
  final Widget child;
  final double minScale;
  final double maxScale;
  final bool clipBehavior;

  const PinchZoom({
    super.key,
    required this.child,
    this.minScale = 1.0,
    this.maxScale = 4.0,
    this.clipBehavior = true,
  });

  @override
  State<PinchZoom> createState() => _PinchZoomState();
}

class _PinchZoomState extends State<PinchZoom>
    with SingleTickerProviderStateMixin {
  final TransformationController _controller = TransformationController();
  late AnimationController _animationController;

  @override
  void initState() {
    super.initState();
    _animationController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 200),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    _animationController.dispose();
    super.dispose();
  }

  void _onDoubleTap() {
    final currentScale = _controller.value.getMaxScaleOnAxis();
    if (currentScale > widget.minScale) {
      _controller.value = Matrix4.identity();
    } else {
      _controller.value = Matrix4.identity()..scale(2.0, 2.0);
    }
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onDoubleTap: _onDoubleTap,
      child: InteractiveViewer(
        transformationController: _controller,
        minScale: widget.minScale,
        maxScale: widget.maxScale,
        clipBehavior: widget.clipBehavior ? Clip.hardEdge : Clip.none,
        child: widget.child,
      ),
    );
  }
}

class DoubleTapDetector extends StatefulWidget {
  final Widget child;
  final VoidCallback onDoubleTap;
  final VoidCallback? onTap;

  const DoubleTapDetector({
    super.key,
    required this.child,
    required this.onDoubleTap,
    this.onTap,
  });

  @override
  State<DoubleTapDetector> createState() => _DoubleTapDetectorState();
}

class _DoubleTapDetectorState extends State<DoubleTapDetector> {
  DateTime? _lastTap;

  void _handleTap() {
    final now = DateTime.now();
    if (_lastTap != null &&
        now.difference(_lastTap!) < const Duration(milliseconds: 300)) {
      widget.onDoubleTap();
      _lastTap = null;
    } else {
      _lastTap = now;
      widget.onTap?.call();
    }
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: _handleTap,
      child: widget.child,
    );
  }
}

class LongPressDraggableWidget<T extends Object> extends StatefulWidget {
  final Widget child;
  final T data;
  final Widget? feedback;
  final Widget? childWhenDragging;
  final VoidCallback? onDragStarted;
  final void Function(DraggableDetails details)? onDragEnd;
  final void Function(DragUpdateDetails details)? onDragUpdate;

  const LongPressDraggableWidget({
    super.key,
    required this.child,
    required this.data,
    this.feedback,
    this.childWhenDragging,
    this.onDragStarted,
    this.onDragEnd,
    this.onDragUpdate,
  });

  @override
  State<LongPressDraggableWidget<T>> createState() =>
      _LongPressDraggableWidgetState<T>();
}

class _LongPressDraggableWidgetState<T extends Object>
    extends State<LongPressDraggableWidget<T>> {
  @override
  Widget build(BuildContext context) {
    return LongPressDraggable<T>(
      data: widget.data,
      feedback: widget.feedback ??
          Material(
            elevation: 8,
            borderRadius: BorderRadius.circular(8),
            child: widget.child,
          ),
      childWhenDragging: widget.childWhenDragging ??
          Opacity(
            opacity: 0.3,
            child: widget.child,
          ),
      onDragStarted: widget.onDragStarted,
      onDragEnd: widget.onDragEnd,
      onDragUpdate: widget.onDragUpdate,
      child: widget.child,
    );
  }
}

class DragTargetWidget<T extends Object> extends StatelessWidget {
  final Widget Function(BuildContext context, T? data, List<T> candidateData)?
      builder;
  final void Function(T data)? onAccept;
  final bool Function(T data)? onWillAccept;

  const DragTargetWidget({
    super.key,
    this.builder,
    this.onAccept,
    this.onWillAccept,
  });

  @override
  Widget build(BuildContext context) {
    return DragTarget<T>(
      builder:
          (context, List<Object?> candidateData, List<dynamic> rejectedData) {
        if (builder != null) {
          final first =
              candidateData.isNotEmpty ? candidateData.first as T? : null;
          return builder!(context, first, candidateData.cast<T>());
        }
        return Container(
          decoration: BoxDecoration(
            color: candidateData.isNotEmpty
                ? Colors.blue.withOpacity(0.1)
                : Colors.transparent,
            borderRadius: BorderRadius.circular(8),
          ),
          child: const SizedBox.expand(),
        );
      },
      onAccept: onAccept,
      onWillAccept:
          onWillAccept != null ? (data) => onWillAccept!(data as T) : null,
    );
  }
}
