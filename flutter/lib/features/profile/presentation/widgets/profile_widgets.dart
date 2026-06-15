import 'package:flutter/material.dart';
import 'package:voltium_rider/models/rider_model.dart';
import 'package:voltium_rider/widgets/fade_up_widget.dart';

class StatusTile extends StatelessWidget {
  final String title;
  final String status;

  const StatusTile({
    super.key,
    required this.title,
    required this.status,
  });

  @override
  Widget build(BuildContext context) {
    final bool isApproved = status.toUpperCase() == 'APPROVED' ||
        status.toUpperCase() == 'VERIFIED';
    final Color dotColor =
        isApproved ? const Color(0xFF10B981) : const Color(0xFFDC2626);

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.02),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 8,
                height: 8,
                decoration: BoxDecoration(
                  color: dotColor,
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: 8),
              Text(
                title,
                style: const TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFF64748B),
                  letterSpacing: 0.8,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            status,
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.bold,
              color: dotColor,
            ),
          ),
        ],
      ),
    );
  }
}

class QuickLinkItem extends StatelessWidget {
  final IconData icon;
  final Color iconColor;
  final Color iconBgColor;
  final String title;
  final VoidCallback onTap;

  const QuickLinkItem({
    super.key,
    required this.icon,
    required this.iconColor,
    required this.iconBgColor,
    required this.title,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.02),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(24),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
            child: Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: iconBgColor,
                    shape: BoxShape.circle,
                  ),
                  child: Icon(icon, color: iconColor, size: 22),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Text(
                    title,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF1E293B),
                    ),
                  ),
                ),
                const Icon(
                  Icons.chevron_right,
                  color: Color(0xFFCBD5E1),
                  size: 20,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class CustomDivider extends StatelessWidget {
  const CustomDivider({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(vertical: 12),
      height: 1,
      color: const Color(0xFFF1F5F9),
    );
  }
}

class ProfileDetailRow extends StatelessWidget {
  final IconData icon;
  final String title;
  final String value;

  const ProfileDetailRow({
    super.key,
    required this.icon,
    required this.title,
    required this.value,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 40,
          height: 40,
          decoration: const BoxDecoration(
            color: Color(0xFFF1F5F9),
            shape: BoxShape.circle,
          ),
          child: Icon(icon, color: const Color(0xFF64748B), size: 20),
        ),
        const SizedBox(width: 16),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(
                  fontSize: 11,
                  color: Color(0xFF64748B),
                ),
              ),
              const SizedBox(height: 2),
              Text(
                value,
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF1E293B),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class ProfileGuarantorCard extends StatelessWidget {
  final RiderModel rider;

  const ProfileGuarantorCard({super.key, required this.rider});

  String _capitalize(String text) {
    if (text.isEmpty) return text;
    return text.substring(0, 1).toUpperCase() + text.substring(1).toLowerCase();
  }

  @override
  Widget build(BuildContext context) {
    final isApproved = rider.guarantorStatus == GuarantorStatus.VERIFIED;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.02),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: const Color(0xFFF1F5F9),
                  shape: BoxShape.circle,
                  border: Border.all(color: Colors.white, width: 2),
                  boxShadow: const [
                    BoxShadow(color: Colors.black12, blurRadius: 4),
                  ],
                ),
                child: (rider.guarantorPhoto != null &&
                        rider.guarantorPhoto!.isNotEmpty)
                    ? ClipOval(
                        child: Image.network(
                          rider.guarantorPhoto!,
                          width: 48,
                          height: 48,
                          fit: BoxFit.cover,
                          cacheWidth: 96,
                          cacheHeight: 96,
                          errorBuilder: (_, __, ___) => const Icon(Icons.person,
                              color: Color(0xFF94A3B8), size: 24),
                        ),
                      )
                    : const Icon(Icons.person,
                        color: Color(0xFF94A3B8), size: 24),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      rider.guarantorName ?? 'No Name Provided',
                      style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF1E293B)),
                    ),
                    Text(
                      rider.guarantorPhone ?? 'No Phone Provided',
                      style: const TextStyle(
                          fontSize: 12, color: Color(0xFF64748B)),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: isApproved
                      ? const Color(0xFFECFDF5)
                      : const Color(0xFFFFFBEB),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(
                      color: isApproved
                          ? const Color(0xFF10B981).withOpacity(0.2)
                          : const Color(0xFFFDE68A)),
                ),
                child: Text(
                  _capitalize(rider.guarantorStatus.name),
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                    color: isApproved
                        ? const Color(0xFF10B981)
                        : const Color(0xFFD97706),
                  ),
                ),
              ),
            ],
          ),
          if (rider.guarantorAddress != null &&
              rider.guarantorAddress!.isNotEmpty) ...[
            const SizedBox(height: 12),
            const CustomDivider(),
            const SizedBox(height: 8),
            Row(
              children: [
                const Icon(Icons.home_outlined,
                    color: Color(0xFF64748B), size: 16),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    rider.guarantorAddress!,
                    style:
                        const TextStyle(fontSize: 12, color: Color(0xFF475569)),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class ProfileEmergencySosTile extends StatelessWidget {
  final VoidCallback onTap;

  const ProfileEmergencySosTile({super.key, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFFFEF2F2),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: const Color(0xFFFECACA)),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(24),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
            child: Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: const BoxDecoration(
                    color: Color(0xFFFEE2E2),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.emergency_outlined,
                      color: Color(0xFFDC2626), size: 22),
                ),
                const SizedBox(width: 16),
                const Expanded(
                  child: Text(
                    'Emergency SOS',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFFDC2626),
                    ),
                  ),
                ),
                const Icon(Icons.chevron_right,
                    color: Color(0xFFEF4444)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class ProfileLogoutButton extends StatelessWidget {
  final VoidCallback onTap;

  const ProfileLogoutButton({super.key, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return ElevatedButton(
      key: const Key('logoutButton'),
      onPressed: onTap,
      style: ElevatedButton.styleFrom(
        backgroundColor: Colors.transparent,
        foregroundColor: const Color(0xFFDC2626),
        elevation: 0,
        side: const BorderSide(color: Color(0xFFFECACA), width: 1.5),
        minimumSize: const Size(double.infinity, 54),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(9999),
        ),
      ),
      child: const Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.logout, size: 20),
          SizedBox(width: 8),
          Text(
            'Logout',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }
}

class ProfileQuickLinks extends StatelessWidget {
  final VoidCallback onEditProfileTap;
  final VoidCallback onMyDocumentsTap;
  final VoidCallback onRewardsTap;
  final VoidCallback onReferralTap;
  final VoidCallback onAppSettingsTap;
  final VoidCallback onLegalTap;

  const ProfileQuickLinks({
    super.key,
    required this.onEditProfileTap,
    required this.onMyDocumentsTap,
    required this.onRewardsTap,
    required this.onReferralTap,
    required this.onAppSettingsTap,
    required this.onLegalTap,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        FadeUpWidget(
          delay: 300,
          child: QuickLinkItem(
            key: const Key('editProfileLink'),
            icon: Icons.edit_outlined,
            iconColor: const Color(0xFF3B82F6), // blue-500
            iconBgColor: const Color(0xFFEFF6FF), // blue-50
            title: 'Edit Profile',
            onTap: onEditProfileTap,
          ),
        ),
        const SizedBox(height: 8),
        FadeUpWidget(
          delay: 350,
          child: QuickLinkItem(
            key: const Key('myDocumentsLink'),
            icon: Icons.contact_page_outlined,
            iconColor: const Color(0xFF10B981), // emerald-500
            iconBgColor: const Color(0xFFECFDF5), // emerald-50
            title: 'My Documents',
            onTap: onMyDocumentsTap,
          ),
        ),
        const SizedBox(height: 8),
        FadeUpWidget(
          delay: 400,
          child: QuickLinkItem(
            key: const Key('rewardsLink'),
            icon: Icons.card_giftcard_outlined,
            iconColor: const Color(0xFF8B5CF6), // violet-500
            iconBgColor: const Color(0xFFF5F3FF), // violet-50
            title: 'Rewards',
            onTap: onRewardsTap,
          ),
        ),
        const SizedBox(height: 8),
        FadeUpWidget(
          delay: 450,
          child: QuickLinkItem(
            key: const Key('referralLink'),
            icon: Icons.people_outline,
            iconColor: const Color(0xFFF59E0B), // amber-500
            iconBgColor: const Color(0xFFFFFBEB), // amber-50
            title: 'Referral Program',
            onTap: onReferralTap,
          ),
        ),
        const SizedBox(height: 8),
        FadeUpWidget(
          delay: 500,
          child: QuickLinkItem(
            key: const Key('appSettingsLink'),
            icon: Icons.settings_outlined,
            iconColor: const Color(0xFF64748B), // slate-500
            iconBgColor: const Color(0xFFF1F5F9), // slate-100
            title: 'App settings',
            onTap: onAppSettingsTap,
          ),
        ),
        const SizedBox(height: 8),
        FadeUpWidget(
          delay: 600,
          child: QuickLinkItem(
            key: const Key('legalLink'),
            icon: Icons.gavel_outlined,
            iconColor: const Color(0xFF0F766E), // teal-700
            iconBgColor: const Color(0xFFCCFBF1), // teal-50
            title: 'Legal',
            onTap: onLegalTap,
          ),
        ),
      ],
    );
  }
}
