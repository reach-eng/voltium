import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import '../providers/theme_provider.dart';
import '../providers/locale_provider.dart';
import '../theme/app_theme.dart';

class AppSettingsScreen extends StatefulWidget {
  const AppSettingsScreen({super.key});

  @override
  State<AppSettingsScreen> createState() => _AppSettingsScreenState();
}

class _AppSettingsScreenState extends State<AppSettingsScreen> {
  bool _twoFactor = true;

  Future<void> _launchUrl(String url) async {
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  Future<void> _rateApp() async {
    final uri = Uri.parse(
      'https://play.google.com/store/apps/details?id=in.voltfleet.rider',
    );
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  void _showDeleteAccountDialog() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Account'),
        content: const Text(
          'This action is irreversible. All your data, including KYC documents, wallet balance, and rental history will be permanently deleted. Are you sure?',
        ),
        actions: [
          TextButton(
            key: const Key('cancelDeleteButton'),
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          FilledButton(
            key: const Key('confirmDeleteButton'),
            onPressed: () {
              // TODO: Call DELETE /api/rider/account backend endpoint
              Navigator.pop(ctx);
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('Account deletion request submitted'),
                  backgroundColor: Color(0xFFDC2626),
                ),
              );
            },
            style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFFDC2626)),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final themeProvider = context.watch<ThemeProvider>();
    final localeProvider = context.watch<LocaleProvider>();
    final isDark = themeProvider.isDarkMode;
    final currentLocale = localeProvider.locale.languageCode;

    return Scaffold(
      backgroundColor:
          isDark ? const Color(0xFF0F172A) : const Color(0xFFF1F5F9),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: Padding(
          padding: const EdgeInsets.all(8.0),
          child: CircleAvatar(
            backgroundColor: isDark ? const Color(0xFF1E293B) : Colors.white,
            child: IconButton(
              icon: Icon(Icons.arrow_back,
                  color: isDark
                      ? const Color(0xFFF1F5F9)
                      : const Color(0xFF1E293B),
                  size: 20),
              onPressed: () => Navigator.pop(context),
            ),
          ),
        ),
        title: Text(
          'Settings',
          style: TextStyle(
            color: isDark ? const Color(0xFFF1F5F9) : const Color(0xFF1E293B),
            fontWeight: FontWeight.bold,
          ),
        ),
        centerTitle: false,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildSectionHeader('APP SETTINGS', isDark: isDark),
            _buildSettingsContainer([
              _buildSwitchTile(
                key: const Key('notificationsSwitch'),
                icon: Icons.notifications_none,
                iconColor: const Color(0xFF3B82F6),
                iconBgColor: const Color(0xFFEFF6FF),
                title: 'Notifications',
                value: true,
                onChanged: (v) {},
                isDark: isDark,
              ),
              _buildDivider(isDark: isDark),
              _buildSwitchTile(
                key: const Key('darkModeSwitch'),
                icon: Icons.dark_mode_outlined,
                iconColor: const Color(0xFF64748B),
                iconBgColor:
                    isDark ? const Color(0xFF1E293B) : const Color(0xFFF1F5F9),
                title: 'Dark Mode',
                value: isDark,
                onChanged: (v) => themeProvider.setDarkMode(v),
                isDark: isDark,
              ),
              _buildDivider(isDark: isDark),
              _buildActionTile(
                key: const Key('languageOption'),
                icon: Icons.language,
                iconColor: const Color(0xFF10B981),
                iconBgColor: const Color(0xFFECFDF5),
                title: 'Language',
                trailing: currentLocale == 'hi' ? 'Hindi' : 'English',
                onTap: () => _showLanguageDialog(context, localeProvider),
                isDark: isDark,
              ),
            ], isDark: isDark),
            const SizedBox(height: 24),
            _buildSectionHeader('SECURITY', isDark: isDark),
            _buildSettingsContainer([
              _buildActionTile(
                key: const Key('changePhoneTile'),
                icon: Icons.smartphone_outlined,
                iconColor: const Color(0xFF8B5CF6),
                iconBgColor: const Color(0xFFF5F3FF),
                title: 'Change Phone Number',
                isDark: isDark,
              ),
              _buildDivider(isDark: isDark),
              _buildActionTile(
                key: const Key('changePasswordTile'),
                icon: Icons.lock_outline,
                iconColor: const Color(0xFFF59E0B),
                iconBgColor: const Color(0xFFFFFBEB),
                title: 'Change Password',
                isDark: isDark,
              ),
              _buildDivider(isDark: isDark),
              _buildSwitchTile(
                key: const Key('twoFactorSwitch'),
                icon: Icons.verified_user_outlined,
                iconColor: const Color(0xFF0D9488),
                iconBgColor: const Color(0xFFF0FDFA),
                title: 'Two-Factor Auth',
                value: _twoFactor,
                onChanged: (v) => setState(() => _twoFactor = v),
                isDark: isDark,
              ),
            ], isDark: isDark),
            const SizedBox(height: 24),
            _buildSectionHeader('ABOUT', isDark: isDark),
            _buildSettingsContainer([
              _buildInfoTile(
                icon: Icons.info_outline,
                iconColor: const Color(0xFF64748B),
                iconBgColor:
                    isDark ? const Color(0xFF1E293B) : const Color(0xFFF8FAFC),
                title: 'App Version',
                value: 'v2.1.0',
                isDark: isDark,
              ),
              _buildDivider(isDark: isDark),
              _buildActionTile(
                key: const Key('termsTile'),
                icon: Icons.description_outlined,
                iconColor: const Color(0xFF64748B),
                iconBgColor:
                    isDark ? const Color(0xFF1E293B) : const Color(0xFFF8FAFC),
                title: 'Terms of Service',
                onTap: () => _launchUrl('https://voltfleet.app/terms'),
                isDark: isDark,
              ),
              _buildDivider(isDark: isDark),
              _buildActionTile(
                key: const Key('privacyTile'),
                icon: Icons.privacy_tip_outlined,
                iconColor: const Color(0xFF64748B),
                iconBgColor:
                    isDark ? const Color(0xFF1E293B) : const Color(0xFFF8FAFC),
                title: 'Privacy Policy',
                onTap: () => _launchUrl('https://voltfleet.app/privacy'),
                isDark: isDark,
              ),
              _buildDivider(isDark: isDark),
              _buildActionTile(
                key: const Key('rateUsTile'),
                icon: Icons.star_outline,
                iconColor: const Color(0xFFF59E0B),
                iconBgColor: const Color(0xFFFFFBEB),
                title: 'Rate Us',
                onTap: _rateApp,
                isDark: isDark,
              ),
            ], isDark: isDark),
            const SizedBox(height: 24),
            _buildSectionHeader('DANGER ZONE',
                color: const Color(0xFFDC2626), isDark: isDark),
            _buildDangerZone(isDark: isDark),
            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }

  void _showLanguageDialog(
      BuildContext context, LocaleProvider localeProvider) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Select Language'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              title: const Text('English'),
              leading: Radio<String>(
                key: const Key('englishRadio'),
                value: 'en',
                groupValue: localeProvider.locale.languageCode,
                onChanged: (v) {
                  localeProvider.setEnglish();
                  Navigator.pop(ctx);
                },
              ),
              onTap: () {
                localeProvider.setEnglish();
                Navigator.pop(ctx);
              },
            ),
            ListTile(
              title: const Text('हिंदी (Hindi)'),
              leading: Radio<String>(
                key: const Key('hindiRadio'),
                value: 'hi',
                groupValue: localeProvider.locale.languageCode,
                onChanged: (v) {
                  localeProvider.setHindi();
                  Navigator.pop(ctx);
                },
              ),
              onTap: () {
                localeProvider.setHindi();
                Navigator.pop(ctx);
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSectionHeader(String title,
      {Color? color, required bool isDark}) {
    return Padding(
      padding: const EdgeInsets.only(left: 4, bottom: 8),
      child: Text(
        title,
        style: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w800,
          color: color ??
              (isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B)),
          letterSpacing: 1,
        ),
      ),
    );
  }

  Widget _buildSettingsContainer(List<Widget> children,
      {required bool isDark}) {
    return Container(
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E293B) : Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(children: children),
    );
  }

  Widget _buildDivider({required bool isDark}) {
    return Divider(
      height: 1,
      thickness: 1,
      color: isDark
          ? const Color(0xFF334155)
          : Colors.grey.withValues(alpha: 0.05),
      indent: 16,
      endIndent: 16,
    );
  }

  Widget _buildSwitchTile({
    Key? key,
    required IconData icon,
    required Color iconColor,
    required Color iconBgColor,
    required String title,
    required bool value,
    required ValueChanged<bool> onChanged,
    required bool isDark,
  }) {
    return ListTile(
      leading: _buildIcon(icon, iconColor, iconBgColor),
      title: Text(
        title,
        style: TextStyle(
          fontWeight: FontWeight.w600,
          fontSize: 15,
          color: isDark ? const Color(0xFFF1F5F9) : const Color(0xFF1E293B),
        ),
      ),
      trailing: Switch.adaptive(
        key: key,
        value: value,
        onChanged: onChanged,
        activeColor: AppColors.primary,
      ),
    );
  }

  Widget _buildActionTile({
    Key? key,
    required IconData icon,
    required Color iconColor,
    required Color iconBgColor,
    required String title,
    String? trailing,
    VoidCallback? onTap,
    required bool isDark,
  }) {
    return ListTile(
      key: key,
      leading: _buildIcon(icon, iconColor, iconBgColor),
      title: Text(
        title,
        style: TextStyle(
          fontWeight: FontWeight.w600,
          fontSize: 15,
          color: isDark ? const Color(0xFFF1F5F9) : const Color(0xFF1E293B),
        ),
      ),
      trailing: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (trailing != null)
            Text(
              trailing,
              style: TextStyle(
                color:
                    isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B),
                fontSize: 14,
              ),
            ),
          const SizedBox(width: 8),
          Icon(
            Icons.chevron_right,
            size: 18,
            color: isDark ? const Color(0xFF475569) : const Color(0xFFCBD5E1),
          ),
        ],
      ),
      onTap: onTap ?? () {},
    );
  }

  Widget _buildInfoTile({
    required IconData icon,
    required Color iconColor,
    required Color iconBgColor,
    required String title,
    required String value,
    required bool isDark,
  }) {
    return ListTile(
      leading: _buildIcon(icon, iconColor, iconBgColor),
      title: Text(
        title,
        style: TextStyle(
          fontWeight: FontWeight.w600,
          fontSize: 15,
          color: isDark ? const Color(0xFFF1F5F9) : const Color(0xFF1E293B),
        ),
      ),
      trailing: Text(
        value,
        style: TextStyle(
          fontFamily: 'monospace',
          color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B),
        ),
      ),
    );
  }

  Widget _buildIcon(IconData icon, Color color, Color bgColor) {
    return Container(
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Icon(icon, color: color, size: 20),
    );
  }

  Widget _buildDangerZone({required bool isDark}) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFFEF2F2),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFFEE2E2)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: const Color(0xFFFFE4E6),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(Icons.delete_outline,
                color: Color(0xFFDC2626), size: 24),
          ),
          const SizedBox(width: 16),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Delete Account',
                  style: TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 15,
                      color: Color(0xFF991B1B)),
                ),
                Text(
                  'This action is irreversible',
                  style: TextStyle(fontSize: 12, color: Color(0xFFEF4444)),
                ),
              ],
            ),
          ),
          ElevatedButton(
            key: const Key('deleteAccountButton'),
            onPressed: _showDeleteAccountDialog,
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFB91C1C),
              foregroundColor: Colors.white,
              elevation: 0,
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(20)),
            ),
            child: const Text('Delete',
                style: TextStyle(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }
}
