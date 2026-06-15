import 'dart:async';
import 'package:flutter/material.dart';

class ToastService {
  static OverlayEntry? _currentToast;
  static Timer? _autoDismissTimer;

  static void show(
    BuildContext context, {
    required String message,
    ToastType type = ToastType.info,
    Duration duration = const Duration(seconds: 3),
    VoidCallback? onTap,
  }) {
    _currentToast?.remove();
    _autoDismissTimer?.cancel();

    final overlay = Overlay.of(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    _currentToast = OverlayEntry(
      builder: (context) => _ToastWidget(
        message: message,
        type: type,
        isDark: isDark,
        onTap: onTap,
      ),
    );

    overlay.insert(_currentToast!);

    _autoDismissTimer = Timer(duration, () {
      if (context.mounted) {
        _currentToast?.remove();
        _currentToast = null;
      }
    });
  }

  static void success(BuildContext context, String message,
      {Duration? duration}) {
    show(context,
        message: message,
        type: ToastType.success,
        duration: duration ?? const Duration(seconds: 2));
  }

  static void error(BuildContext context, String message,
      {Duration? duration}) {
    show(context,
        message: message,
        type: ToastType.error,
        duration: duration ?? const Duration(seconds: 4));
  }

  static void warning(BuildContext context, String message,
      {Duration? duration}) {
    show(context,
        message: message,
        type: ToastType.warning,
        duration: duration ?? const Duration(seconds: 3));
  }

  static void info(BuildContext context, String message,
      {Duration duration = const Duration(seconds: 3)}) {
    show(context, message: message, type: ToastType.info, duration: duration);
  }
}

enum ToastType { success, error, warning, info }

class _ToastWidget extends StatefulWidget {
  final String message;
  final ToastType type;
  final bool isDark;
  final VoidCallback? onTap;

  const _ToastWidget({
    required this.message,
    required this.type,
    required this.isDark,
    this.onTap,
  });

  @override
  State<_ToastWidget> createState() => _ToastWidgetState();
}

class _ToastWidgetState extends State<_ToastWidget>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<Offset> _slideAnimation;
  late Animation<double> _fadeAnimation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 300));
    _slideAnimation =
        Tween<Offset>(begin: const Offset(0, -1), end: Offset.zero).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeOutCubic),
    );
    _fadeAnimation = Tween<double>(begin: 0, end: 1).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeIn),
    );
    _controller.forward();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Positioned(
      top: MediaQuery.of(context).padding.top + 16,
      left: 16,
      right: 16,
      child: SlideTransition(
        position: _slideAnimation,
        child: FadeTransition(
          opacity: _fadeAnimation,
          child: Material(
            borderRadius: BorderRadius.circular(12),
            elevation: 8,
            child: GestureDetector(
              onTap: widget.onTap,
              child: Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: _getBackgroundColor(),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: _getBorderColor()),
                ),
                child: Row(
                  children: [
                    Icon(_getIcon(), color: _getIconColor(), size: 24),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        widget.message,
                        style: TextStyle(
                          color: widget.isDark ? Colors.white : Colors.black87,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Color _getBackgroundColor() {
    switch (widget.type) {
      case ToastType.success:
        return const Color(0xFFDCFCE7);
      case ToastType.error:
        return const Color(0xFFFEE2E2);
      case ToastType.warning:
        return const Color(0xFFFEF3C7);
      case ToastType.info:
        return const Color(0xFFE0F2FE);
    }
  }

  Color _getBorderColor() {
    switch (widget.type) {
      case ToastType.success:
        return const Color(0xFF16A34A);
      case ToastType.error:
        return const Color(0xFFDC2626);
      case ToastType.warning:
        return const Color(0xFFF59E0B);
      case ToastType.info:
        return const Color(0xFF3B82F6);
    }
  }

  IconData _getIcon() {
    switch (widget.type) {
      case ToastType.success:
        return Icons.check_circle;
      case ToastType.error:
        return Icons.error;
      case ToastType.warning:
        return Icons.warning;
      case ToastType.info:
        return Icons.info;
    }
  }

  Color _getIconColor() {
    switch (widget.type) {
      case ToastType.success:
        return const Color(0xFF16A34A);
      case ToastType.error:
        return const Color(0xFFDC2626);
      case ToastType.warning:
        return const Color(0xFFF59E0B);
      case ToastType.info:
        return const Color(0xFF3B82F6);
    }
  }
}

class Toast {
  final String message;
  final ToastType type;

  Toast({required this.message, required this.type});
}

class AnimatedToast extends StatefulWidget {
  final List<Toast> toasts;
  final Widget child;

  const AnimatedToast({
    super.key,
    required this.toasts,
    required this.child,
  });

  @override
  State<AnimatedToast> createState() => _AnimatedToastState();
}

class _AnimatedToastState extends State<AnimatedToast> {
  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        widget.child,
        if (widget.toasts.isNotEmpty)
          Positioned(
            bottom: 100,
            left: 16,
            right: 16,
            child: Column(
              children: widget.toasts.asMap().entries.map((entry) {
                return Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: _ToastItem(
                    toast: entry.value,
                    onDismiss: () {},
                  ),
                );
              }).toList(),
            ),
          ),
      ],
    );
  }
}

class _ToastItem extends StatefulWidget {
  final Toast toast;
  final VoidCallback onDismiss;

  const _ToastItem({required this.toast, required this.onDismiss});

  @override
  State<_ToastItem> createState() => _ToastItemState();
}

class _ToastItemState extends State<_ToastItem>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _animation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 300));
    _animation = CurvedAnimation(parent: _controller, curve: Curves.easeOut);
    _controller.forward();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SizeTransition(
      sizeFactor: _animation,
      child: Material(
        borderRadius: BorderRadius.circular(8),
        elevation: 4,
        child: Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(8),
          ),
          child: Text(widget.toast.message),
        ),
      ),
    );
  }
}
