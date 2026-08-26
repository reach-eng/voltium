import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/utils/page_transitions.dart';

void main() {
  // ── AppPageTransitions route creation ────────────────────────────────────
  group('AppPageTransitions', () {
    test('slide() returns a route with 300ms transition duration', () {
      final route = AppPageTransitions.slide(const SizedBox()) as ModalRoute;
      expect(route.transitionDuration, const Duration(milliseconds: 300));
    });

    test('slide() with Direction.left creates a route', () {
      final route =
          AppPageTransitions.slide(const SizedBox(), direction: Direction.left);
      expect(route, isA<PageRouteBuilder>());
    });

    test('slide() covers all Direction values without throwing', () {
      for (final dir in Direction.values) {
        expect(
          () => AppPageTransitions.slide(const SizedBox(), direction: dir),
          returnsNormally,
          reason: 'Direction.$dir should not throw',
        );
      }
    });

    test('fade() returns a route with 250ms transition duration', () {
      final route = AppPageTransitions.fade(const SizedBox()) as ModalRoute;
      expect(route.transitionDuration, const Duration(milliseconds: 250));
    });

    test('scale() returns a route with 300ms transition duration', () {
      final route = AppPageTransitions.scale(const SizedBox()) as ModalRoute;
      expect(route.transitionDuration, const Duration(milliseconds: 300));
    });

    test('slideUp() returns a route', () {
      final route = AppPageTransitions.slideUp(const SizedBox());
      expect(route, isA<PageRouteBuilder>());
    });

    test('sharedAxis() returns a route without throwing', () {
      final route =
          AppPageTransitions.sharedAxis(const SizedBox(), forward: true);
      expect(route, isA<PageRouteBuilder>());
      // forward=false should also not throw
      final route2 =
          AppPageTransitions.sharedAxis(const SizedBox(), forward: false);
      expect(route2, isA<PageRouteBuilder>());
    });
  });

  // ── Direction enum ───────────────────────────────────────────────────────
  group('Direction enum', () {
    test('has all 4 values', () {
      expect(
          Direction.values,
          containsAll([
            Direction.right,
            Direction.left,
            Direction.up,
            Direction.down,
          ]));
    });
  });

  // ── HeroPageRoute ────────────────────────────────────────────────────────
  group('HeroPageRoute', () {
    test('maintainState is true', () {
      final route = HeroPageRoute(builder: (_) => const SizedBox());
      expect(route.maintainState, isTrue);
    });

    test('transitionDuration is 300ms', () {
      final route = HeroPageRoute(builder: (_) => const SizedBox());
      expect(route.transitionDuration, const Duration(milliseconds: 300));
    });

    test('barrierColor is null', () {
      final route = HeroPageRoute(builder: (_) => const SizedBox());
      expect(route.barrierColor, isNull);
    });
  });

  // ── TransitionType enum ──────────────────────────────────────────────────
  group('TransitionType enum', () {
    test('has all 4 values', () {
      expect(
          TransitionType.values,
          containsAll([
            TransitionType.slide,
            TransitionType.fade,
            TransitionType.scale,
            TransitionType.slideUp,
          ]));
    });
  });
}
