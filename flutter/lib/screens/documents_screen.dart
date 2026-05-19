import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import '../providers/app_provider.dart';
import '../gen/app_localizations.dart';
import 'auth_wrapper.dart';
import '../widgets/fade_up_widget.dart';
import 'support_center_screen.dart';
import '../utils/app_navigator.dart';

class MyDocumentsScreen extends StatelessWidget {
  const MyDocumentsScreen({super.key});

  Future<void> _viewDocument(BuildContext context, String? url) async {
    if (url == null || url.isEmpty) return;
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } else {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Unable to open document')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF1F5F9), // mesh-gradient equivalent bg
      appBar: AppBar(
        backgroundColor: const Color(0xFFF1F5F9),
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        leadingWidth: 68,
        leading: Padding(
          padding: const EdgeInsets.only(left: 20.0),
          child: UnconstrainedBox(
            child: Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: Colors.white,
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(
                      color: Colors.black.withOpacity(0.05),
                      blurRadius: 10,
                      offset: const Offset(0, 4)),
                ],
              ),
              child: Material(
                color: Colors.transparent,
                child: InkWell(
                  borderRadius: BorderRadius.circular(20),
                  onTap: () => Navigator.pop(context),
                  child: const Icon(Icons.arrow_back,
                      color: Color(0xFF1E293B), size: 18),
                ),
              ),
            ),
          ),
        ),
        title: const Text('My Documents',
            style: TextStyle(
                fontWeight: FontWeight.bold,
                color: Color(0xFF1E293B),
                fontSize: 20)),
        centerTitle: false,
      ),
      body: Consumer<AppProvider>(
        builder: (context, provider, child) {
          final rider = provider.rider;
          return ListView(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
            children: [
              FadeUpWidget(
                delay: 0,
                child: _buildVerificationStatusCard(
                    rider?.kycStatus.name ?? 'PENDING'),
              ),
              const SizedBox(height: 24),
              FadeUpWidget(
                delay: 100,
                child: _buildCategoryHeader(
                    'YOUR DOCUMENTS',
                    _countDocs([
                      rider?.aadhaarFront,
                      rider?.aadhaarBack,
                      rider?.panCard,
                      rider?.signature
                    ])),
              ),
              const SizedBox(height: 12),
              _buildDocList(
                  context,
                  [
                    _DocModel(
                        label: 'Aadhaar Card (Front)',
                        url: rider?.aadhaarFront,
                        icon: Icons.description_outlined),
                    _DocModel(
                        label: 'Aadhaar Card (Back)',
                        url: rider?.aadhaarBack,
                        icon: Icons.description_outlined),
                    _DocModel(
                        label: 'PAN Card',
                        url: rider?.panCard,
                        icon: Icons.badge_outlined),
                    _DocModel(
                        label: 'Digital Signature',
                        url: rider?.signature,
                        icon: Icons.gesture_outlined),
                  ],
                  150),
              const SizedBox(height: 32),
              FadeUpWidget(
                delay: 400,
                child: _buildCategoryHeader(
                    "GUARANTOR'S DOCUMENTS",
                    _countDocs([
                      rider?.guarantorAadhaarFront,
                      rider?.guarantorAadhaarBack,
                      rider?.guarantorPan,
                      rider?.guarantorVideo,
                      rider?.guarantorSignature
                    ])),
              ),
              const SizedBox(height: 12),
              _buildDocList(
                  context,
                  [
                    _DocModel(
                        label: "Guarantor's Aadhaar (Front)",
                        url: rider?.guarantorAadhaarFront,
                        icon: Icons.shield_outlined),
                    _DocModel(
                        label: "Guarantor's Aadhaar (Back)",
                        url: rider?.guarantorAadhaarBack,
                        icon: Icons.shield_outlined),
                    _DocModel(
                        label: "Guarantor's PAN Card",
                        url: rider?.guarantorPan,
                        icon: Icons.contact_mail_outlined),
                    _DocModel(
                        label: "Verification Video",
                        url: rider?.guarantorVideo,
                        icon: Icons.videocam_outlined,
                        isVideo: true),
                    _DocModel(
                        label: "Guarantor's Signature",
                        url: rider?.guarantorSignature,
                        icon: Icons.gesture_outlined),
                  ],
                  450),
              const SizedBox(height: 32),
              FadeUpWidget(
                delay: 700,
                child: _buildSupportBanner(context),
              ),
              const SizedBox(height: 48),
            ],
          );
        },
      ),
    );
  }

  int _countDocs(List<String?> urls) {
    return urls.where((u) => u != null && u.isNotEmpty).length;
  }

  Widget _buildVerificationStatusCard(String status) {
    final bool isApproved = status.toUpperCase() == 'APPROVED' ||
        status.toUpperCase() == 'VERIFIED';
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
              color: Colors.black.withOpacity(0.04),
              blurRadius: 48,
              offset: const Offset(0, 24)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Container(
                    height: 40,
                    width: 40,
                    decoration: BoxDecoration(
                        color: const Color(0xFFECFDF5), shape: BoxShape.circle),
                    child: const Icon(Icons.shield_outlined,
                        color: Color(0xFF10B981), size: 20),
                  ),
                  const SizedBox(width: 12),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('SECURITY PROFILE',
                          style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w900,
                              color: Color(0xFF065F46),
                              letterSpacing: 1.2)),
                      const SizedBox(height: 2),
                      const Text('Verified & Secure',
                          style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF1E293B))),
                    ],
                  ),
                ],
              ),
              Container(
                height: 4,
                width: 60,
                decoration: BoxDecoration(
                    color: const Color(0xFFECFDF5),
                    borderRadius: BorderRadius.circular(2)),
                child: FractionallySizedBox(
                  alignment: Alignment.centerLeft,
                  widthFactor: isApproved ? 1.0 : 0.6,
                  child: Container(
                      decoration: BoxDecoration(
                          color: const Color(0xFF10B981),
                          borderRadius: BorderRadius.circular(2))),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Text(
            isApproved
                ? 'Your identity and guarantor information have been verified. You can view or download copies of your documents below.'
                : 'Your verification is in progress. Some documents may still be under review by our safety team.',
            style: const TextStyle(
                fontSize: 11,
                color: Color(0xFF64748B),
                height: 1.5,
                fontWeight: FontWeight.w500),
          ),
        ],
      ),
    );
  }

  Widget _buildCategoryHeader(String title, int count) {
    return Row(
      children: [
        Text(title,
            style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w900,
                color: Color(0xFF64748B),
                letterSpacing: 1.2)),
        const SizedBox(width: 8),
        Expanded(
            child: Container(height: 1, color: Colors.black.withOpacity(0.05))),
        const SizedBox(width: 8),
        Text('$count FILES',
            style: const TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w900,
                color: Color(0xFF0053C1))),
      ],
    );
  }

  Widget _buildDocList(
      BuildContext context, List<_DocModel> docs, int baseDelay) {
    final filtered = docs.where((d) => d.url != null).toList();
    if (filtered.isEmpty) {
      return Container(
        padding: const EdgeInsets.symmetric(vertical: 32),
        decoration: BoxDecoration(
          color: Colors.white.withOpacity(0.4),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
              color: Colors.black.withOpacity(0.05), style: BorderStyle.solid),
        ),
        child: const Center(
            child: Text('No documents submitted yet',
                style: TextStyle(
                    fontSize: 12,
                    fontStyle: FontStyle.italic,
                    color: Color(0xFF64748B)))),
      );
    }

    return Column(
      children: filtered.asMap().entries.map((entry) {
        final idx = entry.key;
        final doc = entry.value;
        return Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: FadeUpWidget(
            delay: baseDelay + (idx * 50),
            child: _buildDocItem(context, doc),
          ),
        );
      }).toList(),
    );
  }

  Widget _buildDocItem(BuildContext context, _DocModel doc) {
    final bool isVideo = doc.isVideo;
    return InkWell(
      onTap: () => _viewDocument(context, doc.url),
      borderRadius: BorderRadius.circular(20),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(20),
          boxShadow: [
            BoxShadow(
                color: Colors.black.withOpacity(0.02),
                blurRadius: 20,
                offset: const Offset(0, 8)),
          ],
          border: Border.all(color: Colors.transparent),
        ),
        child: Row(
          children: [
            Container(
              height: 48,
              width: 48,
              decoration: BoxDecoration(
                color:
                    isVideo ? const Color(0xFFFFF7ED) : const Color(0xFFEFF6FF),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Icon(doc.icon,
                  color: isVideo
                      ? const Color(0xFFF97316)
                      : const Color(0xFF0062FF),
                  size: 22),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(doc.label,
                      style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF1E293B))),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      const Text('VERIFIED',
                          style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w900,
                              color: Color(0xFF10B981),
                              letterSpacing: 1)),
                      const SizedBox(width: 6),
                      Container(
                          height: 3,
                          width: 3,
                          decoration: const BoxDecoration(
                              color: Color(0xFFCBD5E1),
                              shape: BoxShape.circle)),
                      const SizedBox(width: 6),
                      Text(isVideo ? 'VIDEO' : 'IMAGE',
                          style: const TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w900,
                              color: Color(0xFF64748B),
                              letterSpacing: 1)),
                    ],
                  ),
                ],
              ),
            ),
            Container(
              height: 36,
              width: 36,
              decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFC), shape: BoxShape.circle),
              child: Icon(isVideo ? Icons.videocam_outlined : Icons.open_in_new,
                  color: const Color(0xFF94A3B8), size: 18),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSupportBanner(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFF0053C1).withOpacity(0.05),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: const Color(0xFF0053C1).withOpacity(0.1)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            height: 40,
            width: 40,
            decoration: BoxDecoration(
                color: const Color(0xFF0053C1),
                borderRadius: BorderRadius.circular(12)),
            child:
                const Icon(Icons.info_outline, color: Colors.white, size: 20),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Having trouble with documents?',
                    style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF0053C1))),
                const SizedBox(height: 4),
                const Text(
                  'If you see any issues with your verified documents or need to update them, please raise a support ticket.',
                  style: TextStyle(
                      fontSize: 11,
                      color: Color(0xFF0053C1),
                      height: 1.5,
                      fontWeight: FontWeight.w500),
                ),
                const SizedBox(height: 16),
                InkWell(
                  onTap: () =>
                      AppNavigator.push(context, const SupportCenterScreen()),
                  child: Row(
                    children: [
                      const Text('CONTACT SUPPORT',
                          style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w900,
                              color: Color(0xFF0053C1),
                              letterSpacing: 1.2)),
                      const SizedBox(width: 4),
                      const Icon(Icons.open_in_new,
                          color: Color(0xFF0053C1), size: 14),
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
}

class _DocModel {
  final String label;
  final String? url;
  final IconData icon;
  final bool isVideo;

  _DocModel(
      {required this.label,
      this.url,
      required this.icon,
      this.isVideo = false});
}
