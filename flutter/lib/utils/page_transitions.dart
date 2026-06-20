import 'package:flutter/material.dart';

class AppPageTransitions {
  static Route<T> slide<T>(Widget page,
      {Direction direction = Direction.right,}) {
    return PageRouteBuilder<T>(
      pageBuilder: (context, animation, secondaryAnimation) => page,
      transitionsBuilder: (context, animation, secondaryAnimation, child) {
        Offset begin;
        switch (direction) {
          case Direction.right:
            begin = const Offset(1.0, 0.0);
            break;
          case Direction.left:
            begin = const Offset(-1.0, 0.0);
            break;
          case Direction.up:
            begin = const Offset(0.0, 1.0);
            break;
          case Direction.down:
            begin = const Offset(0.0, -1.0);
            break;
        }

        return SlideTransition(
          position: Tween<Offset>(begin: begin, end: Offset.zero).animate(
            CurvedAnimation(parent: animation, curve: Curves.easeOutCubic),
          ),
          child: child,
        );
      },
      transitionDuration: const Duration(milliseconds: 300),
    );
  }

  static Route<T> fade<T>(Widget page) {
    return PageRouteBuilder<T>(
      pageBuilder: (context, animation, secondaryAnimation) => page,
      transitionsBuilder: (context, animation, secondaryAnimation, child) {
        return FadeTransition(
          opacity: animation,
          child: child,
        );
      },
      transitionDuration: const Duration(milliseconds: 250),
    );
  }

  static Route<T> scale<T>(Widget page) {
    return PageRouteBuilder<T>(
      pageBuilder: (context, animation, secondaryAnimation) => page,
      transitionsBuilder: (context, animation, secondaryAnimation, child) {
        return ScaleTransition(
          scale: Tween<double>(begin: 0.9, end: 1.0).animate(
            CurvedAnimation(parent: animation, curve: Curves.easeOutCubic),
          ),
          child: FadeTransition(
            opacity: animation,
            child: child,
          ),
        );
      },
      transitionDuration: const Duration(milliseconds: 300),
    );
  }

  static Route<T> slideUp<T>(Widget page) {
    return PageRouteBuilder<T>(
      pageBuilder: (context, animation, secondaryAnimation) => page,
      transitionsBuilder: (context, animation, secondaryAnimation, child) {
        return SlideTransition(
          position: Tween<Offset>(
            begin: const Offset(0.0, 1.0),
            end: Offset.zero,
          ).animate(CurvedAnimation(
            parent: animation,
            curve: Curves.easeOutCubic,
          ),),
          child: child,
        );
      },
      transitionDuration: const Duration(milliseconds: 350),
    );
  }

  static Route<T> sharedAxis<T>(Widget page, {bool forward = true}) {
    return PageRouteBuilder<T>(
      pageBuilder: (context, animation, secondaryAnimation) => page,
      transitionsBuilder: (context, animation, secondaryAnimation, child) {
        return SharedAxisTransition(
          animation: animation,
          secondaryAnimation: secondaryAnimation,
          fillColor: Colors.transparent,
          child: child,
        );
      },
      transitionDuration: const Duration(milliseconds: 300),
    );
  }
}

enum Direction { right, left, up, down }

class SharedAxisTransition extends StatelessWidget {
  final Animation<double> animation;
  final Animation<double> secondaryAnimation;
  final Widget child;
  final Color fillColor;

  const SharedAxisTransition({
    super.key,
    required this.animation,
    required this.secondaryAnimation,
    required this.child,
    this.fillColor = Colors.transparent,
  });

  @override
  Widget build(BuildContext context) {
    final fadeIn = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: animation,
        curve: const Interval(0.0, 0.75, curve: Curves.easeOut),
      ),
    );

    final slideIn =
        Tween<Offset>(begin: const Offset(0.03, 0), end: Offset.zero).animate(
      CurvedAnimation(
        parent: animation,
        curve: Curves.easeOutCubic,
      ),
    );

    return FadeTransition(
      opacity: fadeIn,
      child: SlideTransition(
        position: slideIn,
        child: child,
      ),
    );
  }
}

class HeroPageRoute<T> extends PageRoute<T> {
  final WidgetBuilder builder;

  HeroPageRoute({required this.builder});

  @override
  Color? get barrierColor => null;

  @override
  String? get barrierLabel => null;

  @override
  bool get maintainState => true;

  @override
  Duration get transitionDuration => const Duration(milliseconds: 300);

  @override
  Widget buildPage(BuildContext context, Animation<double> animation,
      Animation<double> secondaryAnimation,) {
    return builder(context);
  }

  @override
  Widget buildTransitions(BuildContext context, Animation<double> animation,
      Animation<double> secondaryAnimation, Widget child,) {
    return FadeTransition(opacity: animation, child: child);
  }
}

void navigateWithTransition(BuildContext context, Widget page,
    {TransitionType type = TransitionType.slide,}) {
  switch (type) {
    case TransitionType.slide:
      Navigator.push(context, AppPageTransitions.slide(page));
      break;
    case TransitionType.fade:
      Navigator.push(context, AppPageTransitions.fade(page));
      break;
    case TransitionType.scale:
      Navigator.push(context, AppPageTransitions.scale(page));
      break;
    case TransitionType.slideUp:
      Navigator.push(context, AppPageTransitions.slideUp(page));
      break;
  }
}

enum TransitionType { slide, fade, scale, slideUp }
