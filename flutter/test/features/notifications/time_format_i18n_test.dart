import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:voltium_rider/gen/app_localizations_en.dart';
import 'package:voltium_rider/gen/app_localizations_hi.dart';

String formatTimeWithLoc(DateTime dt, DateTime now, AppLocalizations l) {
  var diff = now.difference(dt);
  if (diff.isNegative) diff = Duration.zero;
  if (diff.inMinutes < 60) return l.txtnotifTimeMinutesAgo(diff.inMinutes);
  if (diff.inHours < 24) return l.txtnotifTimeHoursAgo(diff.inHours);
  if (diff.inDays < 7) return l.txtnotifTimeDaysAgo(diff.inDays);
  return l.txtnotifTimeLongAgo(dt.day, dt.month);
}

void main() {
  final en = AppLocalizationsEn();
  final hi = AppLocalizationsHi();
  final fixedNow = DateTime(2026, 8, 26, 12, 0, 0);

  group('Notification Time Formatter i18n (F-7)', () {
    test('relative time under 1 hour formats in English and Hindi', () {
      final dt = fixedNow.subtract(const Duration(minutes: 5));
      expect(formatTimeWithLoc(dt, fixedNow, en), '5m ago');
      expect(formatTimeWithLoc(dt, fixedNow, hi), '5 मिनट पहले');
    });

    test('relative time 1h to 24h formats in English and Hindi', () {
      final dt = fixedNow.subtract(const Duration(hours: 3));
      expect(formatTimeWithLoc(dt, fixedNow, en), '3h ago');
      expect(formatTimeWithLoc(dt, fixedNow, hi), '3 घंटे पहले');
    });

    test('relative time 1d to 7d formats in English and Hindi', () {
      final dt = fixedNow.subtract(const Duration(days: 2));
      expect(formatTimeWithLoc(dt, fixedNow, en), '2d ago');
      expect(formatTimeWithLoc(dt, fixedNow, hi), '2 दिन पहले');
    });

    test('absolute time older than 7 days formats as day/month', () {
      final dt = DateTime(2026, 8, 10, 10, 0, 0);
      expect(formatTimeWithLoc(dt, fixedNow, en), '10/8');
      expect(formatTimeWithLoc(dt, fixedNow, hi), '10/8');
    });

    test('clock skew (future date) clamps to 0m ago instead of negative', () {
      final dt = fixedNow.add(const Duration(minutes: 5));
      expect(formatTimeWithLoc(dt, fixedNow, en), '0m ago');
      expect(formatTimeWithLoc(dt, fixedNow, hi), '0 मिनट पहले');
    });
  });
}