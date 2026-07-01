import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/utils/date_helpers.dart';

void main() {
  group('DateHelpers', () {
    test('getMonth returns correct month name', () {
      expect(DateHelpers.getMonth(1), 'Jan');
      expect(DateHelpers.getMonth(12), 'Dec');
    });

    test('getMonthUpper returns correct uppercase month name', () {
      expect(DateHelpers.getMonthUpper(1), 'JAN');
      expect(DateHelpers.getMonthUpper(12), 'DEC');
    });

    test('formatShortDate formats correctly', () {
      final date = DateTime(2023, 10, 24);
      expect(DateHelpers.formatShortDate(date), '24 Oct');
    });

    test('formatFullDate formats correctly', () {
      final date = DateTime(2023, 10, 24);
      expect(DateHelpers.formatFullDate(date), '24 Oct 2023');
    });

    test('formatDateSlash formats correctly', () {
      final date = DateTime(2023, 10, 24);
      expect(DateHelpers.formatDateSlash(date), '24/10/2023');
    });

    test('dayName returns short day name', () {
      // 2023-10-24 is a Tuesday
      final date = DateTime(2023, 10, 24);
      expect(DateHelpers.dayName(date), 'Tue');
    });

    test('formatWeekdayDate formats correctly', () {
      final date = DateTime(2023, 10, 27);
      expect(DateHelpers.formatWeekdayDate(date), 'Friday, Oct 27, 2023');
    });

    test('computeTimeRemaining handles null correctly', () {
      expect(DateHelpers.computeTimeRemaining(null), '7d 0h');
    });

    test('computeTimeRemaining calculates remaining time', () {
      final now = DateTime.now();
      final future = now.add(const Duration(days: 2, hours: 5, minutes: 1)); // Add buffer
      expect(DateHelpers.computeTimeRemaining(future), '2d 5h');
    });
    
    test('computeTimeRemaining calculates remaining hours if less than a day', () {
      final now = DateTime.now();
      final future = now.add(const Duration(hours: 15, minutes: 1)); // Add buffer
      expect(DateHelpers.computeTimeRemaining(future), '15h');
    });

    test('computeNextRecharge handles null', () {
      expect(DateHelpers.computeNextRecharge(null), '—');
    });

    test('computeNextRecharge formats future date', () {
      final date = DateTime(2023, 10, 24);
      expect(DateHelpers.computeNextRecharge(date), '24 Oct');
    });

    test('daysRemaining calculates days', () {
      final now = DateTime.now();
      final future = now.add(const Duration(days: 3, minutes: 1)); // Add buffer
      expect(DateHelpers.daysRemaining(future), '3d');
    });

    test('daysRemaining returns 0d for past dates', () {
      final now = DateTime.now();
      final past = now.subtract(const Duration(days: 1));
      expect(DateHelpers.daysRemaining(past), '0d');
    });

    test('getMondayOfWeek returns correct Monday', () {
      // 2023-10-24 is a Tuesday. The Monday is 2023-10-23.
      final date = DateTime(2023, 10, 24, 15, 30);
      final monday = DateHelpers.getMondayOfWeek(date);
      
      expect(monday.year, 2023);
      expect(monday.month, 10);
      expect(monday.day, 23);
      expect(monday.hour, 0);
      expect(monday.minute, 0);
      expect(monday.second, 0);
    });
  });
}
