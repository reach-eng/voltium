// Voltium — Design system lint & token contract test
//
// Two layers of coverage for the design-system gate (Ticket #32):
//   1. Shell-driven: invoke scripts/lint-design-system.sh against the live
//      codebase and assert it exits 0. Catches any new raw `Color(0xFF...)`,
//      off-grid `EdgeInsets.all(N)`, or off-grid `BorderRadius.circular(N)`
//      that land in a non-theme file.
//   2. Token contract: assert that the new tokens added by the migration
//      (Spacing.xxs/xs2/sm2/sm3/md2/md3/lg2/lg3, AppRadius.xxs/xs2/sm2/
//      md2/lg2/xl2, and the feather palette on AppColors) are present with
//      the expected values. Catches accidental renames in the theme file.
//
// The script is sourced from the repository, not reimplemented, so the
// test and CI always agree.

import 'dart:io';

import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/theme/app_theme.dart';

void main() {
  group('Design system lint script', () {
    test('scripts/lint-design-system.sh exits 0 on current tree', () async {
      final script = File('scripts/lint-design-system.sh');
      expect(
        script.existsSync(),
        isTrue,
        reason: 'lint-design-system.sh must exist at the Flutter project root',
      );

      // Run on POSIX. On Windows dev machines, prefer Git for Windows' bash
      // (`C:\Program Files\Git\bin\bash.exe`) since `bash` may not be on PATH.
      // CI runners are Linux so they have `bash` on PATH. We try the explicit
      // path first, then fall back to whatever `which bash` would resolve to.
      String? bashPath;
      if (Platform.isWindows) {
        const candidates = <String>[
          r'C:\Program Files\Git\bin\bash.exe',
          r'C:\Program Files (x86)\Git\bin\bash.exe',
          r'C:\Windows\System32\bash.exe',
        ];
        for (final c in candidates) {
          if (File(c).existsSync()) {
            bashPath = c;
            break;
          }
        }
      }
      bashPath ??= 'bash';

      final result = await Process.run(
        bashPath,
        [script.absolute.path],
        workingDirectory: Directory.current.path,
      );

      expect(
        result.exitCode,
        0,
        reason: 'lint-design-system.sh must pass.\n'
            'STDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}',
      );
    });
  });

  group('Spacing tokens', () {
    test('canonical 4px grid', () {
      expect(Spacing.xs, 4);
      expect(Spacing.sm, 8);
      expect(Spacing.md, 16);
      expect(Spacing.lg, 24);
      expect(Spacing.xl, 32);
      expect(Spacing.xxl, 48);
    });

    test('sub-grid values (added by migration)', () {
      // Tight-UI tokens that were previously off-grid in the codebase.
      expect(Spacing.xxs, 2);
      expect(Spacing.xs2, 6);
      expect(Spacing.sm2, 10);
      expect(Spacing.sm3, 12);
      expect(Spacing.md2, 14);
      expect(Spacing.md3, 18);
      expect(Spacing.lg2, 20);
      expect(Spacing.lg3, 22);
    });

    test('prebuilt padding insets stay even', () {
      // Every `Spacing.padding*` constant must be on-grid.
      const pads = <EdgeInsets>[
        Spacing.paddingXs,
        Spacing.paddingSm,
        Spacing.paddingMd,
        Spacing.paddingLg,
        Spacing.paddingXl,
      ];
      for (final p in pads) {
        final v = p.left;
        expect(v % 2, 0, reason: 'padding constant must be on-grid: $p');
      }
    });
  });

  group('AppRadius tokens', () {
    test('canonical 4px grid', () {
      expect(AppRadius.xs, 4);
      expect(AppRadius.sm, 8);
      expect(AppRadius.md, 12);
      expect(AppRadius.lg, 16);
      expect(AppRadius.xl, 24);
      expect(AppRadius.xxl, 32);
    });

    test('sub-grid values (added by migration)', () {
      expect(AppRadius.xxs, 2);
      expect(AppRadius.xs2, 6);
      expect(AppRadius.sm2, 10);
      expect(AppRadius.md2, 14);
      expect(AppRadius.lg2, 18);
      expect(AppRadius.xl2, 22);
    });
  });

  group('AppColors feather palette', () {
    test('amber icon pair (settings: change-password, rate-us)', () {
      expect(AppColors.amberIcon.toARGB32(), 0xFFEAB308);
      expect(AppColors.amberIconSurface.toARGB32(), 0xFFFEF9C3);
    });

    test('purple icon pair (settings: feedback, referrals)', () {
      expect(AppColors.purpleIcon.toARGB32(), 0xFF7E22CE);
      expect(AppColors.purpleIconSurface.toARGB32(), 0xFFF3E8FF);
      expect(AppColors.purpleLightSurface.toARGB32(), 0xFFFAF5FF);
    });

    test('teal icon pair (settings: legal, privacy)', () {
      expect(AppColors.tealIcon.toARGB32(), 0xFF0F766E);
      expect(AppColors.tealIconSurface.toARGB32(), 0xFFCCFBF1);
    });

    test('danger / red zone (KYC rejected, delete account)', () {
      expect(AppColors.dangerText.toARGB32(), 0xFF991B1B);
    });

    test('orange accent (PENDING KYC, TAX history)', () {
      expect(AppColors.orangeAccent.toARGB32(), 0xFFEA580C);
      expect(AppColors.orangeAccentDark.toARGB32(), 0xFFC2410C);
      expect(AppColors.orangeAccentSurface.toARGB32(), 0xFFFFF7ED);
      expect(AppColors.orangeAccentBorder.toARGB32(), 0xFFFED7AA);
    });

    test('sky spark + sky surface (OTP input, info toast)', () {
      expect(AppColors.skySpark.toARGB32(), 0xFF38BDF8);
      expect(AppColors.skySparkSurface.toARGB32(), 0xFFE0F2FE);
    });

    test('royal blue (active status pills, login glow)', () {
      expect(AppColors.royalBlue.toARGB32(), 0xFF1B60DA);
      expect(AppColors.royalBlueTint.toARGB32(), 0xFFDEE9FF);
      expect(AppColors.royalBlueStrong.toARGB32(), 0xFF2176FF);
    });

    test('success tints (PENDING KYC success, disabled-OK buttons)', () {
      expect(AppColors.successTint.toARGB32(), 0xFFA7F3D0);
      expect(AppColors.successBorderLight.toARGB32(), 0xFF6EE7B7);
      expect(AppColors.successOutline.toARGB32(), 0xFFBBF7D0);
    });

    test('rental + status fills', () {
      expect(AppColors.greenFill.toARGB32(), 0xFF86EFAC);
      expect(AppColors.indigoVivid.toARGB32(), 0xFF4F46E5);
    });

    test('shimmer skeleton (light mode)', () {
      expect(AppColors.shimmerBase.toARGB32(), 0xFFE8EDF5);
      expect(AppColors.shimmerHighlight.toARGB32(), 0xFFF5F8FF);
    });

    test('translucent text (over gradient)', () {
      expect(AppColors.white70.toARGB32(), 0xB3FFFFFF);
    });

    test('electric burst palette (7-stop blue ramp + white spark)', () {
      expect(AppColors.electricBurstPalette.length, 7);
      expect(AppColors.electricBurstPalette.first.toARGB32(), 0xFFDBEAFE);
      expect(AppColors.electricBurstPalette.last.toARGB32(), 0xFFFFFFFF);
    });
  });
}
