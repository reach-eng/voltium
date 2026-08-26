import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/utils/accessibility.dart';

void main() {
  // ── Pure string functions ─────────────────────────────────────────────────
  group('a11yLabel', () {
    test('returns label unchanged', () {
      expect(a11yLabel('Submit'), 'Submit');
      expect(a11yLabel(''), '');
    });
  });

  group('a11yImage', () {
    test('returns description unchanged', () {
      expect(a11yImage('Profile photo of John'), 'Profile photo of John');
    });
  });

  group('a11yButton', () {
    test('with target returns action target button', () {
      expect(a11yButton('Tap', 'Submit'), 'Tap Submit button');
    });

    test('without target returns action button', () {
      expect(a11yButton('Close'), 'Close button');
    });

    test('with null target returns action button', () {
      expect(a11yButton('Open', null), 'Open button');
    });
  });

  group('a11yHeading', () {
    test('returns text with default level 2', () {
      expect(a11yHeading('Dashboard'), 'Dashboard, heading level 2');
    });

    test('respects custom level', () {
      expect(a11yHeading('Section', '3'), 'Section, heading level 3');
    });
  });

  group('a11yNavigation', () {
    test('appends navigation suffix', () {
      expect(a11yNavigation('Main'), 'Main navigation');
      expect(a11yNavigation('Bottom bar'), 'Bottom bar navigation');
    });
  });

  group('a11yStatus', () {
    test('prepends Status: prefix', () {
      expect(a11yStatus('Active'), 'Status: Active');
      expect(a11yStatus('Pending'), 'Status: Pending');
    });
  });
}
