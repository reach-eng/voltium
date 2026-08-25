import 'package:flutter/material.dart';

/// An IndexedStack that lazily builds children on first access.
///
/// Unlike the standard `IndexedStack` which builds ALL children immediately,
/// this only builds a child when it's first selected. After building, children
/// stay alive (like `IndexedStack`) so state is preserved when switching tabs.
///
/// Usage:
/// ```dart
/// LazyIndexedStack(
///   index: _currentIndex,
///   children: [
///     DashboardScreen(),
///     WalletScreen(),
///     SupportScreen(),
///     ProfileScreen(),
///   ],
/// )
/// ```
class LazyIndexedStack extends StatefulWidget {
  final int index;
  final List<Widget> children;

  const LazyIndexedStack({
    super.key,
    required this.index,
    required this.children,
  });

  @override
  State<LazyIndexedStack> createState() => _LazyIndexedStackState();
}

class _LazyIndexedStackState extends State<LazyIndexedStack> {
  late List<bool> _built;

  @override
  void initState() {
    super.initState();
    _built = List.filled(widget.children.length, false);
    _built[widget.index] = true;
  }

  @override
  void didUpdateWidget(LazyIndexedStack oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.index != oldWidget.index) {
      _built[widget.index] = true;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: List.generate(widget.children.length, (i) {
        // AUDIT FIX (testing/widgets P1): wrap in TickerMode so hidden
        // tabs' animation controllers (shimmer, spark OTP, pulse effects)
        // are PAUSED instead of burning CPU/GPU at 60fps while offstage.
        return TickerMode(
          enabled: i == widget.index,
          child: Offstage(
            offstage: i != widget.index,
            child: _built[i] ? widget.children[i] : const SizedBox.shrink(),
          ),
        );
      }),
    );
  }
}
