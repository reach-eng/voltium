import 'package:flutter/material.dart';
import 'package:voltium_rider/services/consent_service.dart';
import 'package:voltium_rider/theme/app_theme.dart';

class PrivacyConsentScreen extends StatefulWidget {
  final VoidCallback? onNext;
  final VoidCallback? onBack;

  const PrivacyConsentScreen({
    super.key,
    this.onNext,
    this.onBack,
  });

  @override
  State<PrivacyConsentScreen> createState() => _PrivacyConsentScreenState();
}

class _PrivacyConsentScreenState extends State<PrivacyConsentScreen> {
  final ConsentService _consentService = ConsentService();
  bool _location = false;
  bool _contacts = false;
  bool _callLogs = false;
  bool _loading = true;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _loadConsent();
  }

  Future<void> _loadConsent() async {
    final location = await _consentService.hasConsent(ConsentType.location);
    final contacts = await _consentService.hasConsent(ConsentType.contacts);
    final callLogs = await _consentService.hasConsent(ConsentType.callLogs);

    if (!mounted) return;
    setState(() {
      _location = location;
      _contacts = contacts;
      _callLogs = callLogs;
      _loading = false;
    });
  }

  Future<void> _saveAndContinue() async {
    setState(() => _saving = true);

    await Future.wait([
      _consentService.setConsent(ConsentType.location, granted: _location),
      _consentService.setConsent(ConsentType.contacts, granted: _contacts),
      _consentService.setConsent(ConsentType.callLogs, granted: _callLogs),
    ]);

    if (!mounted) return;
    setState(() => _saving = false);
    widget.onNext?.call();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF9F9FF),
      body: SafeArea(
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : Column(
                children: [
                  Expanded(
                    child: SingleChildScrollView(
                      padding: const EdgeInsets.fromLTRB(24, 20, 24, 120),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          IconButton(
                            onPressed: widget.onBack,
                            icon: const Icon(Icons.arrow_back),
                          ),
                          const SizedBox(height: 12),
                          Text('Privacy choices',
                            style: Theme.of(context)
                                .textTheme
                                .headlineMedium
                                ?.copyWith(fontWeight: FontWeight.w800),
                          ),
                          const SizedBox(height: 8),
                          Text('Choose what Voltium may collect for rider safety, support, and compliance. You can revoke optional consent here before continuing.',
                            style: Theme.of(context).textTheme.bodyMedium,
                          ),
                          const SizedBox(height: 24),
                          _ConsentTile(
                            icon: Icons.location_on_outlined,
                            title: 'Location',
                            description:
                                'Used for ride telemetry, pickup verification, and vehicle recovery.',
                            value: _location,
                            onChanged: (value) {
                              setState(() => _location = value);
                            },
                          ),
                          _ConsentTile(
                            icon: Icons.contacts_outlined,
                            title: 'Contacts',
                            description:
                                'Optional support context for guarantor and emergency workflows.',
                            value: _contacts,
                            onChanged: (value) {
                              setState(() => _contacts = value);
                            },
                          ),
                          _ConsentTile(
                            icon: Icons.call_outlined,
                            title: 'Call logs',
                            description:
                                'Optional fraud and support context when call-log access is requested.',
                            value: _callLogs,
                            onChanged: (value) {
                              setState(() => _callLogs = value);
                            },
                          ),
                        ],
                      ),
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.fromLTRB(24, 16, 24, 24),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.05),
                          blurRadius: 16,
                          offset: const Offset(0, -4),
                        ),
                      ],
                    ),
                    child: SizedBox(
                      width: double.infinity,
                      height: 56,
                      child: ElevatedButton(
                        onPressed: _saving ? null : _saveAndContinue,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.success,
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(16),
                          ),
                        ),
                        child: _saving
                            ? const SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Colors.white,
                                ),
                              )
                            : const Text('Continue'),
                      ),
                    ),
                  ),
                ],
              ),
      ),
    );
  }
}

class _ConsentTile extends StatelessWidget {
  final IconData icon;
  final String title;
  final String description;
  final bool value;
  final ValueChanged<bool> onChanged;

  const _ConsentTile({
    required this.icon,
    required this.title,
    required this.description,
    required this.value,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE5E7EB)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: AppColors.success.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, color: AppColors.success),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: Theme.of(context)
                      .textTheme
                      .titleMedium
                      ?.copyWith(fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 6),
                Text(
                  description,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: const Color(0xFF6B7280),
                      ),
                ),
              ],
            ),
          ),
          Switch(
            value: value,
            activeThumbColor: AppColors.success,
            onChanged: onChanged,
          ),
        ],
      ),
    );
  }
}
