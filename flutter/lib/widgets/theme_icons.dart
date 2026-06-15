import 'package:flutter/material.dart';
import 'micro_animations.dart';

class ThemeIcon extends StatelessWidget {
  final IconData lightIcon;
  final IconData darkIcon;
  final double? size;
  final Color? color;

  const ThemeIcon({
    super.key,
    required this.lightIcon,
    required this.darkIcon,
    this.size,
    this.color,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Icon(
      isDark ? darkIcon : lightIcon,
      size: size,
      color: color,
    );
  }
}

class ThemeIcons {
  static IconData home(bool isDark) =>
      isDark ? Icons.home_rounded : Icons.home_outlined;
  static IconData wallet(bool isDark) => isDark
      ? Icons.account_balance_wallet_rounded
      : Icons.account_balance_wallet_outlined;
  static IconData support(bool isDark) =>
      isDark ? Icons.support_agent_rounded : Icons.support_agent_outlined;
  static IconData profile(bool isDark) =>
      isDark ? Icons.person_rounded : Icons.person_outline;
  static IconData notification(bool isDark) =>
      isDark ? Icons.notifications_rounded : Icons.notifications_outlined;
  static IconData settings(bool isDark) =>
      isDark ? Icons.settings_rounded : Icons.settings_outlined;
  static IconData visibility(bool isDark) =>
      isDark ? Icons.visibility_rounded : Icons.visibility_outlined;
  static IconData visibilityOff(bool isDark) =>
      isDark ? Icons.visibility_off_rounded : Icons.visibility_off_outlined;
  static IconData edit(bool isDark) =>
      isDark ? Icons.edit_rounded : Icons.edit_outlined;
  static IconData delete(bool isDark) =>
      isDark ? Icons.delete_rounded : Icons.delete_outlined;
  static IconData add(bool isDark) =>
      isDark ? Icons.add_circle_rounded : Icons.add_circle_outline;
  static IconData remove(bool isDark) =>
      isDark ? Icons.remove_circle_rounded : Icons.remove_circle_outline;
  static IconData check(bool isDark) =>
      isDark ? Icons.check_circle_rounded : Icons.check_circle_outline;
  static IconData close(bool isDark) =>
      isDark ? Icons.cancel_rounded : Icons.cancel_outlined;
  static IconData menu(bool isDark) =>
      isDark ? Icons.menu_rounded : Icons.menu_outlined;
  static IconData search(bool isDark) =>
      isDark ? Icons.search_rounded : Icons.search_outlined;
  static IconData filter(bool isDark) =>
      isDark ? Icons.filter_list_rounded : Icons.filter_list_outlined;
  static IconData sort(bool isDark) =>
      isDark ? Icons.sort_rounded : Icons.sort_outlined;
  static IconData share(bool isDark) =>
      isDark ? Icons.share_rounded : Icons.share_outlined;
  static IconData download(bool isDark) =>
      isDark ? Icons.download_rounded : Icons.download_outlined;
  static IconData upload(bool isDark) =>
      isDark ? Icons.cloud_upload_rounded : Icons.cloud_upload_outlined;
  static IconData refresh(bool isDark) =>
      isDark ? Icons.refresh_rounded : Icons.refresh_outlined;
  static IconData arrowBack(bool isDark) =>
      isDark ? Icons.arrow_back_rounded : Icons.arrow_back_outlined;
  static IconData arrowForward(bool isDark) =>
      isDark ? Icons.arrow_forward_rounded : Icons.arrow_forward_outlined;
  static IconData arrowDropDown(bool isDark) =>
      isDark ? Icons.arrow_drop_down_rounded : Icons.arrow_drop_down_outlined;
  static IconData star(bool isDark) =>
      isDark ? Icons.star_rounded : Icons.star_outline;
  static IconData starHalf(bool isDark) =>
      isDark ? Icons.star_half_rounded : Icons.star_half_outlined;
  static IconData bookmark(bool isDark) =>
      isDark ? Icons.bookmark_rounded : Icons.bookmark_outline;
  static IconData info(bool isDark) =>
      isDark ? Icons.info_rounded : Icons.info_outline;
  static IconData help(bool isDark) =>
      isDark ? Icons.help_rounded : Icons.help_outlined;
  static IconData warning(bool isDark) =>
      isDark ? Icons.warning_rounded : Icons.warning_amber_outlined;
  static IconData error(bool isDark) =>
      isDark ? Icons.error_rounded : Icons.error_outline;
  static IconData success(bool isDark) =>
      isDark ? Icons.check_circle_rounded : Icons.check_circle_outlined;
  static IconData qrCode(bool isDark) =>
      isDark ? Icons.qr_code_rounded : Icons.qr_code_outlined;
  static IconData barcode(bool isDark) =>
      isDark ? Icons.qr_code_rounded : Icons.qr_code_outlined;
  static IconData location(bool isDark) =>
      isDark ? Icons.location_on_rounded : Icons.location_on_outlined;
  static IconData locationOff(bool isDark) =>
      isDark ? Icons.location_off_rounded : Icons.location_off_outlined;
  static IconData map(bool isDark) =>
      isDark ? Icons.map_rounded : Icons.map_outlined;
  static IconData directions(bool isDark) =>
      isDark ? Icons.directions_rounded : Icons.directions_outlined;
  static IconData EV({bool isDark = false}) => Icons.electric_moped;
  static IconData battery(bool isDark) => isDark
      ? Icons.battery_charging_full_rounded
      : Icons.battery_charging_full_outlined;
  static IconData phone(bool isDark) =>
      isDark ? Icons.phone_rounded : Icons.phone_outlined;
  static IconData email(bool isDark) =>
      isDark ? Icons.email_rounded : Icons.email_outlined;
  static IconData lock(bool isDark) =>
      isDark ? Icons.lock_rounded : Icons.lock_outline;
  static IconData lockOpen(bool isDark) =>
      isDark ? Icons.lock_open_rounded : Icons.lock_open_outlined;
}

class StatusBadge extends StatelessWidget {
  final String text;
  final Color color;
  final bool pulsing;
  final double fontSize;

  const StatusBadge({
    super.key,
    required this.text,
    required this.color,
    this.pulsing = false,
    this.fontSize = 11,
  });

  @override
  Widget build(BuildContext context) {
    final content = Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Text(
        text,
        style: TextStyle(
          color: color,
          fontSize: fontSize,
          fontWeight: FontWeight.w600,
        ),
      ),
    );

    if (pulsing) {
      return PulseWidget(
        child: content,
      );
    }
    return content;
  }
}

class StatusBadgeColors {
  static const Color active = Color(0xFF16A34A);
  static const Color pending = Color(0xFFF59E0B);
  static const Color inactive = Color(0xFF64748B);
  static const Color error = Color(0xFFDC2626);
  static const Color info = Color(0xFF3B82F6);
  static const Color warning = Color(0xFFF59E0B);
}
