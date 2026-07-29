import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:voltium_rider/utils/app_navigator.dart';
import 'package:voltium_rider/features/support/presentation/screens/faq_screen.dart';
import 'package:voltium_rider/features/support/presentation/screens/troubleshooter_screen.dart';
import '../../../../theme/app_theme.dart';
import 'create_ticket_screen.dart';

import 'package:google_fonts/google_fonts.dart';

import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/features/support/presentation/providers/ticket_provider.dart';
import 'package:voltium_rider/features/support/presentation/screens/ticket_detail_screen.dart';
import 'package:voltium_rider/theme/app_typography.dart';
import 'package:voltium_rider/widgets/skeleton_loader.dart';
import 'package:voltium_rider/core/state/rider_provider.dart' show DataState;

class SupportCenterScreen extends ConsumerStatefulWidget {
  const SupportCenterScreen({super.key});

  @override
  ConsumerState<SupportCenterScreen> createState() =>
      _SupportCenterScreenState();
}

class _SupportCenterScreenState extends ConsumerState<SupportCenterScreen> {
  @override
  Widget build(BuildContext context) {
    final rider = ref.watch(riderProvider.select((p) => p.rider));
    final dataState = ref.watch(riderProvider.select((p) => p.dataState));
    final tlName = rider?.teamLeader;
    final tlPhone = rider?.emergencyContact;
    final isLoading = rider == null &&
        (dataState == DataState.initial ||
            dataState == DataState.loading);

    return Scaffold(
      backgroundColor: AppColors.iconBackground,
      appBar: AppBar(
        backgroundColor: AppColors.iconBackground,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        automaticallyImplyLeading: false,
        centerTitle: false,
        titleSpacing: 20,
        title: Text(
          'Support Center',
          style: AppTypography.headingMedium
              .copyWith(color: AppColors.slate800, letterSpacing: -0.5),
        ),
      ),
      body: isLoading
          ? const SupportSkeleton()
          : RefreshIndicator(
              onRefresh: () async {
                await ref.read(supportTicketsProvider.notifier).fetchTickets();
                await ref.read(supportProvider).refreshTickets();
              },
              child: CustomScrollView(
                slivers: [
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
                sliver: SliverList(
                  delegate: SliverChildListDelegate([
                    // Search
                    SearchAnchor(
                      builder:
                          (BuildContext context, SearchController controller) {
                        return SearchBar(
                          controller: controller,
                          padding: const WidgetStatePropertyAll<EdgeInsets>(
                              EdgeInsets.symmetric(horizontal: 16.0)),
                          onTap: () {
                            controller.openView();
                          },
                          onChanged: (_) {
                            controller.openView();
                          },
                          leading: const Icon(Icons.search,
                              color: AppColors.slate500),
                          hintText: 'Search FAQs, topics...',
                          elevation: const WidgetStatePropertyAll(0),
                          backgroundColor:
                              WidgetStatePropertyAll(AppColors.iconBackground),
                        );
                      },
                      suggestionsBuilder:
                          (BuildContext context, SearchController controller) {
                        final keyword = controller.text.toLowerCase();
                        final staticFaqs = [
                          'How to lock the scooter?',
                          'Payment failed',
                          'Report a damaged vehicle',
                          'Refund policy'
                        ];
                        final matches = staticFaqs
                            .where((f) => f.toLowerCase().contains(keyword))
                            .toList();
                        return matches.map((faq) => ListTile(
                              title: Text(faq),
                              leading: const Icon(Icons.help_outline),
                              onTap: () {
                                controller.closeView(faq);
                                AppNavigator.push(context, const FaqScreen());
                              },
                            ));
                      },
                    ),
                    const SizedBox(height: 24),

                    // Quick Help section (Moved to top)
                    Text(
                      'Quick Help',
                      style: AppTypography.titleMedium
                          .copyWith(color: AppColors.slate800),
                    ),
                    const SizedBox(height: 12),
                    Wrap(
                      spacing: 10,
                      runSpacing: 10,
                      children: [
                        _buildQuickChip(
                            Icons.help_outline,
                            'FAQ',
                            () =>
                                AppNavigator.push(context, const FaqScreen())),
                        _buildQuickChip(
                            Icons.build_circle_outlined,
                            'Troubleshoot',
                            () => AppNavigator.push(
                                context, const TroubleshooterScreen())),
                      ],
                    ),
                    const SizedBox(height: 24),

                    // Low battery warning removed — not data-driven.
                    // Re-add when vehicle battery level is available in RiderModel.

                    // Create Ticket Container
                    Container(
                      padding: const EdgeInsets.all(Spacing.md),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(AppRadius.lg),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.05),
                            blurRadius: 10,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: Column(
                        children: [
                          const Icon(Icons.headset_mic,
                              size: 48, color: AppColors.primary),
                          SizedBox(height: 16),
                          Text(
                            'Contact Support',
                            style: AppTypography.titleMedium,
                          ),
                          SizedBox(height: 8),
                          Text(
                            'Our team is here to help you with any issues.',
                            textAlign: TextAlign.center,
                            style: GoogleFonts.plusJakartaSans(
                                color: AppColors.slate500),
                          ),
                          SizedBox(height: 20),
                          SizedBox(
                            width: double.infinity,
                            child: FilledButton(
                              key: const Key('createTicketButton'),
                              onPressed: () {
                                Navigator.of(context).push(
                                  MaterialPageRoute(
                                    builder: (_) => const CreateTicketScreen(),
                                  ),
                                );
                              },
                              style: FilledButton.styleFrom(
                                backgroundColor: AppColors.primary,
                                padding:
                                    const EdgeInsets.symmetric(vertical: 16),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(AppRadius.md),
                                ),
                              ),
                              child: Text('Create Ticket',
                                  style: GoogleFonts.plusJakartaSans(
                                      fontWeight: FontWeight.bold)),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),

                    // Recent Tickets Section
                    const RecentTicketsContainer(),
                    const SizedBox(height: 24),
                  ]),
                ),
              ),

              // Bottom anchored contact cards
              SliverFillRemaining(
                hasScrollBody: false,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: [
                      // Team Leader card
                      if (tlName != null && tlName.isNotEmpty) ...[
                        _buildContactCard(
                          icon: Icons.person_outline,
                          title: 'Your Team Leader',
                          subtitle: tlName,
                          actionLabel: 'Call',
                          actionIcon: Icons.call,
                          color: AppColors.primary,
                          onTap: tlPhone != null && tlPhone.isNotEmpty
                              ? () {
                                  final sanitized =
                                      tlPhone.replaceAll(RegExp(r'[^\d+]'), '');
                                  launchUrl(Uri.parse('tel:$sanitized'));
                                }
                              : null,
                        ),
                        const SizedBox(height: 12),
                      ],
                      // Email us
                      _buildContactCard(
                        icon: Icons.email_outlined,
                        title: 'Email Us',
                        subtitle: 'support@voltium.in',
                        actionLabel: 'Send',
                        actionIcon: Icons.open_in_new,
                        color: AppColors.royalBlue,
                        onTap: () =>
                            launchUrl(Uri.parse('mailto:support@voltium.in')),
                      ),
                      const SizedBox(height: 12),
                      _buildContactCard(
                        icon: Icons.phone_outlined,
                        title: 'Call Us',
                        subtitle: '+91-9876543210',
                        actionLabel: 'Call',
                        actionIcon: Icons.call,
                        color: AppColors.success,
                        onTap: () => launchUrl(Uri.parse('tel:9876543210')),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
    );
  }

  Widget _buildQuickChip(IconData icon, String label, VoidCallback onTap) {
    return Material(
      color: AppColors.surfaceBright,
      borderRadius: BorderRadius.circular(AppRadius.md),
      child: InkWell(
        borderRadius: BorderRadius.circular(AppRadius.md),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, color: AppColors.primary, size: 18),
              SizedBox(width: 8),
              Text(label,
                  style: AppTypography.bodyCompactStrong
                      .copyWith(color: AppColors.slate800)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildContactCard({
    required IconData icon,
    required String title,
    required String subtitle,
    required String actionLabel,
    required IconData actionIcon,
    required Color color,
    VoidCallback? onTap,
  }) {
    return Container(
      padding: Spacing.paddingMd,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.1),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: color, size: 22),
          ),
          SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: AppTypography.bodyMediumEmphasis),
                Text(subtitle,
                    style: GoogleFonts.plusJakartaSans(
                        color: AppColors.slate500, fontSize: 12)),
              ],
            ),
          ),
          if (onTap != null)
            InkWell(
              onTap: onTap,
              borderRadius: BorderRadius.circular(AppRadius.md),
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(AppRadius.md),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(actionIcon, color: color, size: 16),
                    SizedBox(width: 6),
                    Text(actionLabel,
                        style:
                            AppTypography.labelMedium.copyWith(color: color)),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class RecentTicketsContainer extends ConsumerWidget {
  const RecentTicketsContainer({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ticketState = ref.watch(supportTicketsProvider);

    return Container(
      padding: const EdgeInsets.all(Spacing.md),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Recent Tickets',
            style: AppTypography.titleMedium,
          ),
          SizedBox(height: 12),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: TicketFilter.values.map((filter) {
                return Padding(
                  padding: const EdgeInsets.only(right: 8.0),
                  child: ChoiceChip(
                    label: Text(
                      filter.name.toUpperCase(),
                      style: AppTypography.labelMedium.copyWith(
                          color: ticketState.filter == filter
                              ? Colors.white
                              : AppColors.slate500),
                    ),
                    selected: ticketState.filter == filter,
                    selectedColor: AppColors.primary,
                    onSelected: (_) => ref
                        .read(supportTicketsProvider.notifier)
                        .setFilter(filter),
                  ),
                );
              }).toList(),
            ),
          ),
          const SizedBox(height: 12),
          if (ticketState.isLoading)
            const Center(child: CircularProgressIndicator())
          else if (ticketState.filteredTickets.isEmpty)
            Padding(
              padding: EdgeInsets.symmetric(vertical: 20),
              child: Text(
                'No tickets found in this category.',
                style: GoogleFonts.plusJakartaSans(color: AppColors.onSurfaceVariant),
              ),
            )
          else
            ...ticketState.filteredTickets.map((ticket) => ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(
                    ticket.subject,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: GoogleFonts.plusJakartaSans(
                        fontWeight: FontWeight.bold),
                  ),
                  subtitle: Text(
                    'Status: ${ticket.status.name.toUpperCase()}',
                    style: GoogleFonts.plusJakartaSans(
                      color: ticket.status.name.toLowerCase() == 'closed'
                          ? AppColors.onSurfaceVariant
                          : AppColors.primary,
                    ),
                  ),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () {
                    Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => TicketDetailScreen(ticket: ticket),
                      ),
                    );
                  },
                )),
        ],
      ),
    );
  }
}
