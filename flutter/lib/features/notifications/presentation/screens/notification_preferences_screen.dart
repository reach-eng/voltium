import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:voltium_rider/theme/app_theme.dart';

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
      debugPrint('Failed to load notification preferences: $e');
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

      if (mounted) {
        setState(() => _isLoading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Preferences saved'),
            backgroundColor: AppColors.success,
            duration: Duration(seconds: 2),
          ),
        );
      }
    } catch (e) {
      debugPrint('Failed to save notification preferences: $e');
      if (mounted) {
        setState(() => _isLoading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Failed to save preferences'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.iconBackground,
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
                            iconBg: const Color(0xFFEFF6FF),
                            title: 'Push Notifications',
                            subtitle: 'Receive push notifications from Voltium',
                            value: _pushEnabled,
                            onChanged: (v) => setState(() => _pushEnabled = v),
                          ),
                          _buildToggleTile(
                            icon: Icons.volume_up,
                            iconColor: const Color(0xFF7C3AED),
                            iconBg: const Color(0xFFF5F3FF),
                            title: 'Sound',
                            subtitle: 'Play sound for notifications',
                            value: _soundEnabled,
                            onChanged: (v) => setState(() => _soundEnabled = v),
                          ),
                          _buildToggleTile(
                            icon: Icons.vibration,
                            iconColor: AppColors.warning,
                            iconBg: const Color(0xFFFFFBEB),
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
                            iconColor: const Color(0xFF16A34A),
                            iconBg: const Color(0xFFF0FDF4),
                            title: 'Payments',
                            subtitle: 'Top-ups, rent deductions, refunds',
                            value: _paymentsEnabled,
                            onChanged: (v) =>
                                setState(() => _paymentsEnabled = v),
                          ),
                          _buildToggleTile(
                            icon: Icons.shield_outlined,
                            iconColor: const Color(0xFF7C3AED),
                            iconBg: const Color(0xFFF5F3FF),
                            title: 'KYC',
                            subtitle: 'Document verification updates',
                            value: _kycEnabled,
                            onChanged: (v) => setState(() => _kycEnabled = v),
                          ),
                          _buildToggleTile(
                            icon: Icons.build_outlined,
                            iconColor: const Color(0xFF2563EB),
                            iconBg: const Color(0xFFEFF6FF),
                            title: 'Maintenance',
                            subtitle: 'Service reminders, battery swaps',
                            value: _maintenanceEnabled,
                            onChanged: (v) =>
                                setState(() => _maintenanceEnabled = v),
                          ),
                          _buildToggleTile(
                            icon: Icons.campaign_outlined,
                            iconColor: const Color(0xFF9333EA),
                            iconBg: const Color(0xFFFAF5FF),
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
                            : const Text('Save Preferences',
                                style: TextStyle(
                                  fontSize: 15,
                                  fontWeight: FontWeight.w700,
                                  color: Colors.white,
                                ),
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
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [AppColors.iconBackground, Color(0xFFF8FAFC)],
          ),
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      child: Row(
        children: [
          InkWell(
            onTap: () => Navigator.maybePop(context),
            child: Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: Colors.white,
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(
                      color: Colors.black.withValues(alpha: 0.05), blurRadius: 10,),
                ],
              ),
              child: const Icon(Icons.arrow_back,
                  size: 18, color: Color(0xFF1E293B),),
            ),
          ),
          const SizedBox(width: 16),
          const Text('Notification Preferences',
            style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
                color: Color(0xFF1E293B),),
          ),
        ],
      ),
    );
  }

  Widget _buildSection(
      {required String title, required List<Widget> children,}) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0A0F172A),
            blurRadius: 48,
            offset: Offset(0, 24),
          ),
        ],
      ),
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w900,
              color: AppColors.slate500,
              letterSpacing: 1.5,
            ),
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
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: iconBg,
              borderRadius: BorderRadius.circular(12),
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
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF1E293B),
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.slate500,
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
