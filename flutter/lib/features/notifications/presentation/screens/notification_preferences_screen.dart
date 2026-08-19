import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:voltium_rider/services/notification_service.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:voltium_rider/utils/toast.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:voltium_rider/theme/app_typography.dart';
import '../../../../utils/app_logger.dart';

class NotificationPreferencesScreen extends StatefulWidget {
  const NotificationPreferencesScreen({super.key});

  @override
  State<NotificationPreferencesScreen> createState() =>
      _NotificationPreferencesScreenState();
}

class _NotificationPreferencesScreenState
    extends State<NotificationPreferencesScreen> {
  bool _pushEnabled = true;
  bool _soundEnabled = true;
  bool _vibrationEnabled = true;
  bool _paymentsEnabled = true;
  bool _kycEnabled = true;
  bool _maintenanceEnabled = true;
  bool _announcementsEnabled = true;

  bool _isLoading = false;

  static const String _keyPush = 'notif_push';
  static const String _keySound = 'notif_sound';
  static const String _keyVibration = 'notif_vibration';
  static const String _keyPayments = 'notif_payments';
  static const String _keyKyc = 'notif_kyc';
  static const String _keyMaintenance = 'notif_maintenance';
  static const String _keyAnnouncements = 'notif_announcements';

  @override
  void initState() {
    super.initState();
    _loadPreferences();
  }

  Future<void> _loadPreferences() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      if (!mounted) return;
      setState(() {
        _pushEnabled = prefs.getBool(_keyPush) ?? true;
        _soundEnabled = prefs.getBool(_keySound) ?? true;
        _vibrationEnabled = prefs.getBool(_keyVibration) ?? true;
        _paymentsEnabled = prefs.getBool(_keyPayments) ?? true;
        _kycEnabled = prefs.getBool(_keyKyc) ?? true;
        _maintenanceEnabled = prefs.getBool(_keyMaintenance) ?? true;
        _announcementsEnabled = prefs.getBool(_keyAnnouncements) ?? true;
      });
    } catch (e) {
      appDebug('Failed to load notification preferences: $e');
    }
  }

  Future<void> _savePreferences() async {
    setState(() => _isLoading = true);
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool(_keyPush, _pushEnabled);
      await prefs.setBool(_keySound, _soundEnabled);
      await prefs.setBool(_keyVibration, _vibrationEnabled);
      await prefs.setBool(_keyPayments, _paymentsEnabled);
      await prefs.setBool(_keyKyc, _kycEnabled);
      await prefs.setBool(_keyMaintenance, _maintenanceEnabled);
      await prefs.setBool(_keyAnnouncements, _announcementsEnabled);
      await NotificationService().refreshNotificationPreference();

      if (mounted) {
        setState(() => _isLoading = false);
        Toast.success(
          context,
          AppLocalizations.of(context)!.txtpreferencesSaved,
        );
      }
    } catch (e) {
      appDebug('Failed to save notification preferences: $e');
      if (mounted) {
        setState(() => _isLoading = false);
        Toast.error(
          context,
          AppLocalizations.of(context)!.txtfailedToSavePreferences,
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Scaffold(
      backgroundColor: colors.surface,
      body: Stack(
        children: [
          _buildBackground(),
          SafeArea(
            child: Column(
              children: [
                _buildHeader(),
                Expanded(
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
                    children: [
                      _buildSection(
                        title: 'MASTER SWITCH',
                        children: [
                          _buildToggleTile(
                            icon: Icons.notifications_active,
                            iconColor: AppColors.primary,
                            iconBg: AppColors.of(context).primarySurface,
                            title: 'Push Notifications',
                            subtitle: 'Receive push notifications from Voltium',
                            value: _pushEnabled,
                            onChanged: (v) => setState(() => _pushEnabled = v),
                          ),
                          _buildToggleTile(
                            icon: Icons.volume_up,
                            iconColor: AppColors.accentPurple,
                            iconBg: AppColors.accentPurpleSurface,
                            title: 'Sound',
                            subtitle: 'Play sound for notifications',
                            value: _soundEnabled,
                            onChanged: (v) => setState(() => _soundEnabled = v),
                          ),
                          _buildToggleTile(
                            icon: Icons.vibration,
                            iconColor: AppColors.warning,
                            iconBg: AppColors.warningSurface,
                            title: 'Vibration',
                            subtitle: 'Vibrate for notifications',
                            value: _vibrationEnabled,
                            onChanged: (v) =>
                                setState(() => _vibrationEnabled = v),
                          ),
                        ],
                      ),
                      const SizedBox(height: 20),
                      _buildSection(
                        title: 'NOTIFICATION CATEGORIES',
                        children: [
                          _buildToggleTile(
                            icon: Icons.currency_rupee,
                            iconColor: AppColors.success,
                            iconBg: AppColors.of(context).successLight,
                            title: 'Payments',
                            subtitle: 'Top-ups, rent deductions, refunds',
                            value: _paymentsEnabled,
                            onChanged: (v) =>
                                setState(() => _paymentsEnabled = v),
                          ),
                          _buildToggleTile(
                            icon: Icons.shield_outlined,
                            iconColor: AppColors.accentPurple,
                            iconBg: AppColors.accentPurpleSurface,
                            title: 'KYC',
                            subtitle: 'Document verification updates',
                            value: _kycEnabled,
                            onChanged: (v) => setState(() => _kycEnabled = v),
                          ),
                          _buildToggleTile(
                            icon: Icons.build_outlined,
                            iconColor: AppColors.primary,
                            iconBg: AppColors.of(context).primarySurface,
                            title: 'Maintenance',
                            subtitle: 'Service reminders, battery swaps',
                            value: _maintenanceEnabled,
                            onChanged: (v) =>
                                setState(() => _maintenanceEnabled = v),
                          ),
                          _buildToggleTile(
                            icon: Icons.campaign_outlined,
                            iconColor: AppColors.accentPurple,
                            iconBg: AppColors.accentPurpleSurface,
                            title: 'Announcements',
                            subtitle: 'Promotions, offers, platform updates',
                            value: _announcementsEnabled,
                            onChanged: (v) =>
                                setState(() => _announcementsEnabled = v),
                          ),
                        ],
                      ),
                      const SizedBox(height: 32),
                      FilledButton(
                        onPressed: _isLoading ? null : _savePreferences,
                        style: FilledButton.styleFrom(
                          backgroundColor: AppColors.primary,
                          minimumSize: const Size(double.infinity, 56),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(AppRadius.full),
                          ),
                        ),
                        child: _isLoading
                            ? const SizedBox(
                                height: 20,
                                width: 20,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Colors.white,
                                ),
                              )
                            : Text(
                                'Save Preferences',
                                style: AppTypography.labelLarge
                                    .copyWith(fontWeight: FontWeight.w700)
                                    .copyWith(color: Colors.white),
                              ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBackground() {
    return Positioned.fill(
      child: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              AppColors.of(context).iconBackground,
              AppColors.of(context).surfaceBright
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHeader() {
    final colors = AppColors.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      child: Row(
        children: [
          InkWell(
            onTap: () => Navigator.maybePop(context),
            child: Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: colors.card,
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.05),
                    blurRadius: 10,
                  ),
                ],
              ),
              child: Icon(
                Icons.arrow_back,
                size: 18,
                color: colors.onSurface,
              ),
            ),
          ),
          const SizedBox(width: 16),
          Text(
            'Notification Preferences',
            style: AppTypography.titleLarge.copyWith(color: colors.onSurface),
          ),
        ],
      ),
    );
  }

  Widget _buildSection({
    required String title,
    required List<Widget> children,
  }) {
    final colors = AppColors.of(context);
    return Container(
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(AppRadius.radiusModal),
        boxShadow: const [
          BoxShadow(
            color: AppColors.shadowSoftColor,
            blurRadius: 48,
            offset: Offset(0, 24),
          ),
        ],
      ),
      padding: const EdgeInsets.all(Spacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: AppTypography.overline
                .copyWith(color: colors.onSurfaceVariant, letterSpacing: 1.5),
          ),
          const SizedBox(height: 12),
          ...children,
        ],
      ),
    );
  }

  Widget _buildToggleTile({
    required IconData icon,
    required Color iconColor,
    required Color iconBg,
    required String title,
    required String subtitle,
    required bool value,
    required ValueChanged<bool> onChanged,
  }) {
    final colors = AppColors.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: iconBg,
              borderRadius: BorderRadius.circular(AppRadius.md),
            ),
            child: Icon(icon, color: iconColor, size: 20),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: AppTypography.bodyMedium
                      .copyWith(fontWeight: FontWeight.w600)
                      .copyWith(color: colors.onSurface),
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 12,
                    color: colors.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),
          Switch(
            value: value,
            onChanged: onChanged,
            activeThumbColor: AppColors.primary,
            materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
          ),
        ],
      ),
    );
  }
}
