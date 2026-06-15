import 'package:flutter/material.dart';

class KeyboardAwareScrollView extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry? padding;
  final bool avoidBottomInset;

  const KeyboardAwareScrollView({
    super.key,
    required this.child,
    this.padding,
    this.avoidBottomInset = true,
  });

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        return SingleChildScrollView(
          padding: padding ?? const EdgeInsets.all(16),
          child: ConstrainedBox(
            constraints: BoxConstraints(
              minHeight: constraints.maxHeight,
            ),
            child: IntrinsicHeight(
              child: child,
            ),
          ),
        );
      },
    );
  }
}

class KeyboardAvoidingWrapper extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry? padding;
  final Duration duration;

  const KeyboardAvoidingWrapper({
    super.key,
    required this.child,
    this.padding,
    this.duration = const Duration(milliseconds: 250),
  });

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: duration,
      curve: Curves.easeInOut,
      child: MediaQuery.of(context).viewInsets.bottom > 0
          ? Padding(
              padding: EdgeInsets.only(
                bottom: MediaQuery.of(context).viewInsets.bottom,
              ),
              child: child,
            )
          : child,
    );
  }
}

class FormKeyboardAdjuster extends StatefulWidget {
  final Widget child;

  const FormKeyboardAdjuster({
    super.key,
    required this.child,
  });

  @override
  State<FormKeyboardAdjuster> createState() => _FormKeyboardAdjusterState();
}

class _FormKeyboardAdjusterState extends State<FormKeyboardAdjuster> {
  final _focusNode = FocusNode();

  @override
  void dispose() {
    _focusNode.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => FocusScope.of(context).unfocus(),
      behavior: HitTestBehavior.opaque,
      child: widget.child,
    );
  }
}

class AnimatedPadding extends StatelessWidget {
  final Widget child;
  final bool isKeyboardVisible;
  final double keyboardHeight;

  const AnimatedPadding({
    super.key,
    required this.child,
    required this.isKeyboardVisible,
    this.keyboardHeight = 0,
  });

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      padding: EdgeInsets.only(
        bottom: isKeyboardVisible ? keyboardHeight : 0,
      ),
      child: child,
    );
  }
}

class ScrollableFormColumn extends StatelessWidget {
  final List<Widget> children;
  final MainAxisAlignment mainAxisAlignment;
  final CrossAxisAlignment crossAxisAlignment;
  final EdgeInsetsGeometry? padding;

  const ScrollableFormColumn({
    super.key,
    required this.children,
    this.mainAxisAlignment = MainAxisAlignment.start,
    this.crossAxisAlignment = CrossAxisAlignment.stretch,
    this.padding,
  });

  @override
  Widget build(BuildContext context) {
    return KeyboardAwareScrollView(
      padding: padding,
      child: Column(
        mainAxisAlignment: mainAxisAlignment,
        crossAxisAlignment: crossAxisAlignment,
        children: children,
      ),
    );
  }
}
