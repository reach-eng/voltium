/// Shared date/time formatting utilities extracted from large screen files.
library;

class DateHelpers {
  static const List<String> months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];

  static const List<String> monthsUpper = [
    'JAN',
    'FEB',
    'MAR',
    'APR',
    'MAY',
    'JUN',
    'JUL',
    'AUG',
    'SEP',
    'OCT',
    'NOV',
    'DEC',
  ];

  static const List<String> weekdays = [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
  ];

  static const List<String> dayNamesShort = [
    'Mon',
    'Tue',
    'Wed',
    'Thu',
    'Fri',
    'Sat',
    'Sun',
  ];

  /// Returns month name capitalized (e.g. "Jan").
  static String getMonth(int month) {
    return months[month - 1];
  }

  /// Returns month name in uppercase (e.g. "JAN").
  static String getMonthUpper(int month) {
    return monthsUpper[month - 1];
  }

  /// Formats date as "d MMM" (e.g. "24 Oct").
  static String formatShortDate(DateTime date) {
    return '${date.day} ${months[date.month - 1]}';
  }

  /// Formats date as "d MMM yyyy" (e.g. "24 Oct 2023").
  static String formatFullDate(DateTime date) {
    return '${date.day} ${months[date.month - 1]} ${date.year}';
  }

  /// Formats date as "dd/MM/yyyy".
  static String formatDateSlash(DateTime date) {
    return '${date.day}/${date.month}/${date.year}';
  }

  /// Returns short day name (e.g. "Mon", "Tue").
  static String dayName(DateTime date) {
    return dayNamesShort[date.weekday - 1];
  }

  /// Returns full weekday name and formatted date (e.g. "Friday, Oct 27, 2023").
  static String formatWeekdayDate(DateTime date) {
    return '${weekdays[date.weekday - 1]}, ${months[date.month - 1]} ${date.day}, ${date.year}';
  }

  /// Computes a human-readable remaining time string like "7d 0h" or "5h".
  static String computeTimeRemaining(DateTime? planEndDate) {
    if (planEndDate != null) {
      final remaining = planEndDate.difference(DateTime.now());
      if (remaining.inDays > 0) {
        return '${remaining.inDays}d ${remaining.inHours % 24}h';
      }
      if (remaining.inHours > 0) return '${remaining.inHours}h';
    }
    return '7d 0h';
  }

  /// Computes next recharge display like "24 Oct".
  static String computeNextRecharge(DateTime? planEndDate) {
    if (planEndDate != null) {
      return '${planEndDate.day} ${months[planEndDate.month - 1]}';
    }
    return '—';
  }

  /// Returns days remaining as "(n)d" string.
  static String daysRemaining(DateTime endDate) {
    final now = DateTime.now();
    final diff = endDate.difference(now).inDays;
    if (diff <= 0) return '0d';
    return '${diff}d';
  }

  /// Gets the Monday of the current week for the given date.
  static DateTime getMondayOfWeek(DateTime date) {
    final dayOfWeek = date.weekday;
    return date.subtract(Duration(days: dayOfWeek - 1)).copyWith(
          hour: 0,
          minute: 0,
          second: 0,
          millisecond: 0,
          microsecond: 0,
        );
  }
}
