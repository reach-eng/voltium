import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../widgets/fade_up_widget.dart';
import 'dart:ui';

class ReferralScreen extends StatefulWidget {
  const ReferralScreen({super.key});

  @override
  State<ReferralScreen> createState() => _ReferralScreenState();
}

class _ReferralScreenState extends State<ReferralScreen> {
  final String _referralCode = 'VOLT-RIDER-99';

  void _copyToClipboard() {
    Clipboard.setData(ClipboardData(text: _referralCode));
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Referral code copied!'), backgroundColor: Colors.green),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF1F5F9),
      body: Stack(
        children: [
          _buildMeshBackground(),
          SafeArea(
            child: Column(
              children: [
                _buildHeader(context),
                Expanded(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const SizedBox(height: 20),
                        FadeUpWidget(
                          delay: 0,
                          child: _buildShareCard(),
                        ),
                        const SizedBox(height: 32),
                        const FadeUpWidget(
                          delay: 100,
                          child: Text(
                            'HOW IT WORKS',
                            style: TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: Color(0xFF64748B), letterSpacing: 1.2),
                          ),
                        ),
                        const SizedBox(height: 16),
                        FadeUpWidget(
                          delay: 200,
                          child: _buildStepRow(Icons.share_outlined, 'Share your code', 'Invite friends to join the VoltFleet revolution.'),
                        ),
                        const SizedBox(height: 12),
                        FadeUpWidget(
                          delay: 300,
                          child: _buildStepRow(Icons.person_add_outlined, 'They register', 'When they sign up using your unique referral code.'),
                        ),
                        const SizedBox(height: 12),
                        FadeUpWidget(
                          delay: 400,
                          child: _buildStepRow(Icons.card_giftcard_outlined, 'Get Rewarded', 'You both get ₹500 wallet credit on their first ride!'),
                        ),
                        const SizedBox(height: 32),
                        const FadeUpWidget(
                          delay: 500,
                          child: Text(
                            'REFERRAL HISTORY',
                            style: TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: Color(0xFF64748B), letterSpacing: 1.2),
                          ),
                        ),
                        const SizedBox(height: 12),
                        FadeUpWidget(
                          delay: 600,
                          child: _buildHistoryList(),
                        ),
                        const SizedBox(height: 48),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMeshBackground() {
    return Positioned.fill(
      child: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0xFFF1F5F9), Color(0xFFE2E8F0)],
          ),
        ),
      ),
    );
  }

  Widget _buildHeader(BuildContext context) {
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
                boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 10)],
              ),
              child: const Icon(Icons.arrow_back, size: 18, color: Color(0xFF1E293B)),
            ),
          ),
          const SizedBox(width: 16),
          const Text(
            'Refer & Earn',
            style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: Color(0xFF1E293B)),
          ),
        ],
      ),
    );
  }

  Widget _buildShareCard() {
    return Container(
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF9333EA), Color(0xFF7C3AED)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(32),
        boxShadow: [
          BoxShadow(color: const Color(0xFF9333EA).withOpacity(0.3), blurRadius: 24, offset: const Offset(0, 12)),
        ],
      ),
      padding: const EdgeInsets.all(32),
      child: Column(
        children: [
          const Icon(Icons.stars_rounded, color: Colors.white, size: 48),
          const SizedBox(height: 16),
          const Text('Share the Spark', style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Colors.white)),
          const SizedBox(height: 8),
          const Text('Earn ₹500 for every friend who joins.', style: TextStyle(fontSize: 14, color: Colors.white70), textAlign: TextAlign.center),
          const SizedBox(height: 32),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
            decoration: BoxDecoration(color: Colors.white.withOpacity(0.15), borderRadius: BorderRadius.circular(20), border: Border.all(color: Colors.white.withOpacity(0.2))),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(_referralCode, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white, fontFamily: 'monospace', letterSpacing: 1.5)),
                InkWell(onTap: _copyToClipboard, child: const Icon(Icons.copy, color: Colors.white, size: 20)),
              ],
            ),
          ),
          const SizedBox(height: 24),
          ElevatedButton.icon(
            onPressed: () {}, // Share logic
            icon: const Icon(Icons.share, size: 16),
            label: const Text('INVITE FRIENDS', style: TextStyle(fontWeight: FontWeight.w900, letterSpacing: 1)),
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.white,
              foregroundColor: const Color(0xFF7C3AED),
              minimumSize: const Size(double.infinity, 54),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(27)),
              elevation: 0,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStepRow(IconData icon, String title, String desc) {
    return Row(
      children: [
        Container(
          height: 48,
          width: 48,
          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 10)]),
          child: Icon(icon, color: const Color(0xFF7C3AED), size: 22),
        ),
        const SizedBox(width: 16),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Color(0xFF1E293B))),
              Text(desc, style: const TextStyle(fontSize: 12, color: Color(0xFF64748B))),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildHistoryList() {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(32),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 10, offset: const Offset(0, 4))],
      ),
      child: Column(
        children: [
          _buildHistoryItem('Rahul Sharma', 'SUCCESS', '15 Apr'),
          const Divider(height: 1, indent: 20, endIndent: 20),
          _buildHistoryItem('Amit Patel', 'PENDING', '10 Apr'),
          const Divider(height: 1, indent: 20, endIndent: 20),
          _buildHistoryItem('John Doe', 'SUCCESS', '05 Apr'),
        ],
      ),
    );
  }

  Widget _buildHistoryItem(String name, String status, String date) {
    final bool success = status == 'SUCCESS';
    return Padding(
      padding: const EdgeInsets.all(20),
      child: Row(
        children: [
          Container(
            height: 40,
            width: 40,
            decoration: BoxDecoration(color: const Color(0xFFF1F5F9), shape: BoxShape.circle),
            child: const Icon(Icons.person_outline, color: Color(0xFF64748B), size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFF1E293B))),
                Text(date, style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
            decoration: BoxDecoration(color: success ? const Color(0xFFDCFCE7) : const Color(0xFFFEF3C7), borderRadius: BorderRadius.circular(8)),
            child: Text(status, style: TextStyle(fontSize: 9, fontWeight: FontWeight.w900, color: success ? const Color(0xFF166534) : const Color(0xFF92400E))),
          ),
        ],
      ),
    );
  }
}
