import 'package:flutter/material.dart';

/// An IndexedStack that lazily instantiates its children to optimize startup performance and memory.
class LazyIndexedStack extends StatefulWidget {
  final int index;
  final List<Widget> children;
  final AlignmentGeometry alignment;
  final TextDirection? textDirection;

  const LazyIndexedStack({
    super.key,
    required this.index,
    required this.children,
    this.alignment = Alignment.topLeft,
    this.textDirection,
  });

  @override
  State<LazyIndexedStack> createState() => _LazyIndexedStackState();
}

class _LazyIndexedStackState extends State<LazyIndexedStack> {
  late List<bool> _activatedList;

  @override
  void initState() {
    super.initState();
    _activatedList = List<bool>.generate(
      widget.children.length,
      (i) => i == widget.index,
    );
  }

  @override
  void didUpdateWidget(LazyIndexedStack oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!_activatedList[widget.index]) {
      setState(() {
        _activatedList[widget.index] = true;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return IndexedStack(
      index: widget.index,
      alignment: widget.alignment,
      textDirection: widget.textDirection,
      children: List.generate(widget.children.length, (i) {
        return _activatedList[i] ? widget.children[i] : const SizedBox.shrink();
      }),
    );
  }
}
