import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

class ContextMenuPreview extends StatefulWidget {
  final Widget child;
  final List<ContextMenuItem> items;
  final Widget? preview;
  final Offset? position;

  const ContextMenuPreview({
    super.key,
    required this.child,
    required this.items,
    this.preview,
    this.position,
  });

  @override
  State<ContextMenuPreview> createState() => _ContextMenuPreviewState();
}

class _ContextMenuPreviewState extends State<ContextMenuPreview> {
  OverlayEntry? _overlayEntry;

  @override
  void dispose() {
    _overlayEntry?.remove();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onLongPressStart: (details) {
        HapticFeedback.mediumImpact();
        _showMenu(context, details.globalPosition);
      },
      onLongPress: () {},
      child: widget.child,
    );
  }

  void _showMenu(BuildContext context, Offset position) {
    _overlayEntry?.remove();

    final overlay = Overlay.of(context);

    _overlayEntry = OverlayEntry(
      builder: (context) => Stack(
        children: [
          Positioned.fill(
            child: GestureDetector(
              onTap: () => _dismissMenu(),
              child: Container(color: Colors.transparent),
            ),
          ),
          Positioned(
            left: position.dx,
            top: position.dy,
            child: _ContextMenuWidget(
              items: widget.items,
              preview: widget.preview,
              onDismiss: () => _dismissMenu(),
            ),
          ),
        ],
      ),
    );

    overlay.insert(_overlayEntry!);
  }

  void _dismissMenu() {
    _overlayEntry?.remove();
    _overlayEntry = null;
  }
}

class _ContextMenuWidget extends StatefulWidget {
  final List<ContextMenuItem> items;
  final Widget? preview;
  final VoidCallback onDismiss;

  const _ContextMenuWidget({
    required this.items,
    this.preview,
    required this.onDismiss,
  });

  @override
  State<_ContextMenuWidget> createState() => _ContextMenuWidgetState();
}

class _ContextMenuWidgetState extends State<_ContextMenuWidget>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _scale;
  late Animation<double> _opacity;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 200),
    );
    _scale = Tween<double>(begin: 0.8, end: 1.0).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeOutBack),
    );
    _opacity = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeOut),
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
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        return Transform.scale(
          scale: _scale.value,
          child: Opacity(
            opacity: _opacity.value,
            child: child,
          ),
        );
      },
      child: Material(
        elevation: 8,
        borderRadius: BorderRadius.circular(12),
        color: isDark ? const Color(0xFF1E293B) : Colors.white,
        child: Container(
          width: 240,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.2),
                blurRadius: 20,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (widget.preview != null)
                Padding(
                  padding: const EdgeInsets.all(12),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: widget.preview,
                  ),
                ),
              const Divider(height: 1),
              ...widget.items.map((item) => _buildMenuItem(item)),
              const SizedBox(height: 8),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildMenuItem(ContextMenuItem item) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return InkWell(
      onTap: () {
        HapticFeedback.lightImpact();
        item.onTap?.call();
        widget.onDismiss();
      },
      borderRadius: BorderRadius.circular(8),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Row(
          children: [
            if (item.icon != null) ...[
              Icon(item.icon,
                  size: 20,
                  color:
                      item.color ?? (isDark ? Colors.white : Colors.black87)),
              const SizedBox(width: 12),
            ],
            Expanded(
              child: Text(
                item.label,
                style: TextStyle(
                  color: item.color ?? (isDark ? Colors.white : Colors.black87),
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
            if (item.subtitle != null)
              Text(
                item.subtitle!,
                style: TextStyle(
                  fontSize: 12,
                  color: Colors.grey[500],
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class ContextMenuItem {
  final String label;
  final IconData? icon;
  final Color? color;
  final String? subtitle;
  final VoidCallback? onTap;

  const ContextMenuItem({
    required this.label,
    this.icon,
    this.color,
    this.subtitle,
    this.onTap,
  });
}

class LongPressMenu extends StatelessWidget {
  final Widget child;
  final List<ContextMenuItem> items;
  final Widget? preview;

  const LongPressMenu({
    super.key,
    required this.child,
    required this.items,
    this.preview,
  });

  @override
  Widget build(BuildContext context) {
    return ContextMenuPreview(
      items: items,
      preview: preview,
      child: child,
    );
  }
}
