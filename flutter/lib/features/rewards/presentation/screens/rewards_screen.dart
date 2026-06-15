import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:voltium_rider/providers/app_provider.dart';
import 'package:voltium_rider/models/reward_model.dart';
import 'package:voltium_rider/widgets/fade_up_widget.dart';
import 'dart:ui';

class RewardsScreen extends StatefulWidget {
  const RewardsScreen({super.key});

  @override
  State<RewardsScreen> createState() => _RewardsScreenState();
}

class _RewardsScreenState extends State<RewardsScreen> {
  @override
  Widget build(BuildContext context) {
    final provider = context.watch<AppProvider>();
    final rewardPoints = provider.rewardPoints;
    final streak = provider.paymentStreak;

    return Scaffold(
      backgroundColor: const Color(0xFFF1F5F9),
      body: Stack(
        children: [
          _buildMeshBackground(),
          SafeArea(
            child: Column(
              children: [
                _buildHeader(context, rewardPoints),
                Expanded(
                  child: SingleChildScrollView(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        FadeUpWidget(
                          delay: 0,
                          child: _buildTierCard(rewardPoints),
                        ),
                        const SizedBox(height: 24),
                        FadeUpWidget(
                          delay: 100,
                          child: _buildStreakSection(streak),
                        ),
                        const SizedBox(height: 32),
                        const FadeUpWidget(
                          delay: 200,
                          child: Text(
                            'UNLOCKED REWARDS',
                            style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w900,
                                color: Color(0xFF64748B),
                                letterSpacing: 1.2),
                          ),
                        ),
                        const SizedBox(height: 12),
                        _buildRewardsGrid(streak),
                        const SizedBox(height: 32),
                        const FadeUpWidget(
                          delay: 300,
                          child: Text(
                            'REWARD HISTORY',
                            style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w900,
                                color: Color(0xFF64748B),
                                letterSpacing: 1.2),
                          ),
                        ),
                        const SizedBox(height: 12),
                        _buildHistoryList(),
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
            colors: [Color(0xFFF1F5F9), Color(0xFFDEE9FF)],
          ),
        ),
      ),
    );
  }

  Widget _buildHeader(BuildContext context, int points) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              InkWell(
                key: const Key('backButton'),
                onTap: () => Navigator.maybePop(context),
                child: Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                          color: Colors.black.withOpacity(0.05), blurRadius: 10)
                    ],
                  ),
                  child: const Icon(Icons.arrow_back,
                      size: 18, color: Color(0xFF1E293B)),
                ),
              ),
              const SizedBox(width: 16),
              const Text(
                'VoltRewards',
                style: TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF1E293B)),
              ),
            ],
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
                color: const Color(0xFFFEF3C7),
                borderRadius: BorderRadius.circular(20)),
            child: Row(
              children: [
                const Icon(Icons.bolt, color: Color(0xFFD97706), size: 14),
                const SizedBox(width: 4),
                Text('$points pts',
                    style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w900,
                        color: Color(0xFF92400E))),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTierCard(int totalPoints) {
    final progress = (totalPoints % 2000) / 2000;
    final tierName = totalPoints >= 4000
        ? 'Gold Member'
        : totalPoints >= 2000
            ? 'Silver Member'
            : 'Bronze Member';
    final tierGradient = totalPoints >= 4000
        ? const LinearGradient(
            colors: [Color(0xFFD4AF37), Color(0xFFF59E0B)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight)
        : const LinearGradient(
            colors: [Color(0xFFD97706), Color(0xFFF59E0B)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight);
    final nextTier = totalPoints >= 4000
        ? 'Max'
        : totalPoints >= 2000
            ? 'Gold'
            : 'Silver';
    return Container(
      decoration: BoxDecoration(
        gradient: tierGradient,
        borderRadius: BorderRadius.circular(32),
        boxShadow: [
          BoxShadow(
              color: const Color(0xFFD97706).withOpacity(0.3),
              blurRadius: 24,
              offset: const Offset(0, 12)),
        ],
      ),
      padding: const EdgeInsets.all(28),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                height: 52,
                width: 52,
                decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.2),
                    borderRadius: BorderRadius.circular(16)),
                child: const Icon(Icons.workspace_premium,
                    color: Colors.white, size: 30),
              ),
              const SizedBox(width: 16),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('CURRENT TIER',
                      style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w900,
                          color: Colors.white70,
                          letterSpacing: 1.2)),
                  Text(tierName,
                      style: const TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.bold,
                          color: Colors.white)),
                ],
              ),
            ],
          ),
          const SizedBox(height: 24),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Progress to $nextTier',
                  style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: Colors.white70)),
              Text('${(progress * 100).toInt()}%',
                  style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w900,
                      color: Colors.white)),
            ],
          ),
          const SizedBox(height: 10),
          ClipRRect(
            borderRadius: BorderRadius.circular(10),
            child: LinearProgressIndicator(
              value: progress,
              backgroundColor: Colors.white.withOpacity(0.2),
              valueColor: const AlwaysStoppedAnimation<Color>(Colors.white),
              minHeight: 8,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStreakSection(int streak) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(32),
        boxShadow: [
          BoxShadow(
              color: Colors.black.withOpacity(0.02),
              blurRadius: 20,
              offset: const Offset(0, 8))
        ],
      ),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Payment Streak',
                  style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF1E293B))),
              Row(
                children: [
                  const Icon(Icons.local_fire_department,
                      color: Color(0xFFF97316), size: 18),
                  const SizedBox(width: 4),
                  Text('$streak/5 days',
                      style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w900,
                          color: Color(0xFFEA580C))),
                ],
              ),
            ],
          ),
          const SizedBox(height: 20),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: List.generate(5, (idx) {
              final active = idx < streak;
              return Column(
                children: [
                  Container(
                    height: 44,
                    width: 44,
                    decoration: BoxDecoration(
                      color: active
                          ? const Color(0xFFFFF7ED)
                          : const Color(0xFFF1F5F9),
                      shape: BoxShape.circle,
                      border: active
                          ? Border.all(
                              color: const Color(0xFFFDBA74), width: 1.5)
                          : null,
                    ),
                    child: Icon(
                      active ? Icons.check_circle : Icons.circle_outlined,
                      color: active
                          ? const Color(0xFFF97316)
                          : const Color(0xFFCBD5E1),
                      size: 20,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text('Day ${idx + 1}',
                      style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w600,
                          color: active
                              ? const Color(0xFFEA580C)
                              : const Color(0xFF94A3B8))),
                ],
              );
            }),
          ),
        ],
      ),
    );
  }

  Widget _buildRewardsGrid(int currentStreak) {
    final list = [
      {
        'icon': Icons.bolt,
        'label': '5-Day Streak',
        'desc': 'Free recharge',
        'target': 5
      },
      {
        'icon': Icons.wallet,
        'label': '10-Day Streak',
        'desc': '₹200 credit',
        'target': 10
      },
    ];

    return Column(
      children: list.map((item) {
        final unlocked = currentStreak >= (item['target'] as int);
        return Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: unlocked ? Colors.white : Colors.white.withOpacity(0.6),
              borderRadius: BorderRadius.circular(24),
              boxShadow: unlocked
                  ? [
                      BoxShadow(
                          color: Colors.black.withOpacity(0.02),
                          blurRadius: 20,
                          offset: const Offset(0, 8))
                    ]
                  : null,
            ),
            child: Row(
              children: [
                Container(
                  height: 48,
                  width: 48,
                  decoration: BoxDecoration(
                      color: unlocked
                          ? const Color(0xFFEFF6FF)
                          : const Color(0xFFF1F5F9),
                      borderRadius: BorderRadius.circular(16)),
                  child: Icon(item['icon'] as IconData,
                      color: unlocked
                          ? const Color(0xFF2563EB)
                          : const Color(0xFF94A3B8)),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(item['label'] as String,
                          style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.bold,
                              color: unlocked
                                  ? const Color(0xFF1E293B)
                                  : const Color(0xFF94A3B8))),
                      Text(item['desc'] as String,
                          style: const TextStyle(
                              fontSize: 11, color: Color(0xFF64748B))),
                    ],
                  ),
                ),
                if (unlocked)
                  GestureDetector(
                    onTap: () {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                            content:
                                Text('Reward claimed! Check your wallet soon.'),
                            backgroundColor: Color(0xFF10B981)),
                      );
                    },
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 4),
                      decoration: BoxDecoration(
                          color: const Color(0xFFDCFCE7),
                          borderRadius: BorderRadius.circular(12)),
                      child: const Text('CLAIM',
                          style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w900,
                              color: Color(0xFF166534))),
                    ),
                  ),
              ],
            ),
          ),
        );
      }).toList(),
    );
  }

  Widget _buildHistoryList() {
    return Consumer<AppProvider>(
      builder: (context, provider, _) {
        final rewards = provider.rewards;
        if (rewards.isEmpty) {
          return Container(
            padding: const EdgeInsets.symmetric(vertical: 32),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(32),
              boxShadow: [
                BoxShadow(
                    color: Colors.black.withOpacity(0.02),
                    blurRadius: 10,
                    offset: const Offset(0, 4))
              ],
            ),
            child: const Center(
              child: Text('No reward history yet',
                  style: TextStyle(
                      fontSize: 13,
                      color: Color(0xFF64748B),
                      fontStyle: FontStyle.italic)),
            ),
          );
        }
        return Container(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(32),
            boxShadow: [
              BoxShadow(
                  color: Colors.black.withOpacity(0.02),
                  blurRadius: 10,
                  offset: const Offset(0, 4))
            ],
          ),
          child: Column(
            children: rewards.map((r) {
              final dateStr =
                  '${r.createdAt.day} ${_getMonth(r.createdAt.month)}';
              return Column(
                children: [
                  _buildHistoryItem(r.title, '+${r.points} pts', dateStr),
                  if (r != rewards.last)
                    const Divider(height: 1, indent: 20, endIndent: 20),
                ],
              );
            }).toList(),
          ),
        );
      },
    );
  }

  String _getMonth(int month) {
    const months = [
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
      'Dec'
    ];
    return months[month - 1];
  }

  Widget _buildHistoryItem(String title, String pts, String date) {
    return Padding(
      padding: const EdgeInsets.all(20),
      child: Row(
        children: [
          Container(
            height: 40,
            width: 40,
            decoration: BoxDecoration(
                color: const Color(0xFFF0FDF4),
                borderRadius: BorderRadius.circular(12)),
            child: const Icon(Icons.confirmation_number_outlined,
                color: Color(0xFF16A34A), size: 18),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title,
                    style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF1E293B))),
                Text(date,
                    style: const TextStyle(
                        fontSize: 11, color: Color(0xFF64748B))),
              ],
            ),
          ),
          Text(pts,
              style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w900,
                  color: Color(0xFF16A34A))),
        ],
      ),
    );
  }
}
