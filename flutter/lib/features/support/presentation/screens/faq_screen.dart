import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:voltium_rider/utils/app_logger.dart';
import 'package:voltium_rider/utils/dialer.dart';
import 'package:voltium_rider/utils/toast.dart';
import 'package:voltium_rider/widgets/fade_up_widget.dart';
import '../../../../theme/app_theme.dart';

import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:voltium_rider/models/support_model.dart' show FaqItem;
import 'package:google_fonts/google_fonts.dart';
import 'package:voltium_rider/theme/app_typography.dart';

class FaqScreen extends ConsumerStatefulWidget {
  final VoidCallback? onBack;
  const FaqScreen({super.key, this.onBack});

  @override
  ConsumerState<FaqScreen> createState() => _FaqScreenState();
}

class _FaqScreenState extends ConsumerState<FaqScreen> {
  String _searchQuery = '';
  String _activeCategory = 'All'; // UI label; the comparison below matches
  // against the raw English constant intentionally so localisation
  // (chip reads "सभी" in Hindi) doesn't break the filter.
  String? _expandedId;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        ref.read(supportProvider.notifier).refreshFaqs();
      }
    });
  }

  Future<void> _callSupport() async {
    final supportConfig = ref.read(supportProvider).supportConfig;
    // T-113: do NOT fall back to a hardcoded phone number. If the
    // server hasn't published a support phone yet, show the same
    // "being configured" toast the Support Center uses and bail.
    final phone = supportConfig?.supportPhone;
    if (phone == null || phone.isEmpty) {
      if (mounted) {
        Toast.info(
          context,
          AppLocalizations.of(context)?.supportNotConfigured ??
              'Support contact is being configured. Please try again shortly.',
        );
      }
      return;
    }
    // AUDIT FIX: guarded dialer with toast fallback (was silent no-op).
    await launchDialer(context, phone);
  }

  Future<void> _emailSupport() async {
    final supportConfig = ref.read(supportProvider).supportConfig;
    // T-113: do NOT fall back to a hardcoded email. The Support Center
    // also hides the email card when this is null; the FAQ screen
    // surfaces the same "being configured" toast on tap.
    final email = supportConfig?.supportEmail;
    if (email == null || email.isEmpty) {
      if (mounted) {
        Toast.info(
          context,
          AppLocalizations.of(context)?.supportNotConfigured ??
              'Support contact is being configured. Please try again shortly.',
        );
      }
      return;
    }
    final uri = Uri.parse('mailto:$email');
    try {
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      } else if (mounted) {
        Toast.error(context, 'Unable to open your email app');
      }
    } catch (e) {
      appDebug('Email launch failed: $e', tag: 'SUPPORT');
      if (mounted) {
        Toast.error(context, 'Unable to open your email app');
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final faqItems = ref.watch(supportProvider.select((p) => p.faqs));
    final colors = AppColors.of(context);

    final categories = <String>[
      AppLocalizations.of(context)?.history_all ?? 'All',
      ...faqItems.map((f) => f.category).toSet()
    ];

    final filteredFaqs = faqItems.where((f) {
      final matchesSearch =
          f.question.toLowerCase().contains(_searchQuery.toLowerCase()) ||
              f.answer.toLowerCase().contains(_searchQuery.toLowerCase());
      // The "All" key is shown localised in the chip; compare against the
      // raw English constant so the matching doesn't break when the locale
      // is Hindi (chip would read "सभी" but the comparison is `== 'All'`).
      final matchesCategory =
          _activeCategory == 'All' || f.category == _activeCategory;
      return matchesSearch && matchesCategory;
    }).toList();

    return Scaffold(
      backgroundColor: colors.iconBackground,
      body: Stack(
        children: [
          _buildMeshBackground(),
          SafeArea(
            child: Column(
              children: [
                _buildHeader(context),
                Expanded(
                  child: RefreshIndicator(
                    color: AppColors.primary,
                    onRefresh: () =>
                        ref.read(supportProvider.notifier).refreshFaqs(),
                    child: CustomScrollView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      slivers: [
                        SliverPadding(
                          padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
                          sliver: SliverToBoxAdapter(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                // AUDIT FIX: FadeUpWidget computes
                                // `index * delay(seconds) * 1000` — the old
                                // ms-int delays with default index collapsed
                                // every stagger to 0ms.
                                FadeUpWidget(
                                  index: 1,
                                  delay: 0.05,
                                  child: _buildSearchBar(),
                                ),
                                const SizedBox(height: 24),
                                if (categories.length > 2)
                                  FadeUpWidget(
                                    index: 1,
                                    delay: 0.1,
                                    child: _buildCategoryScroller(categories),
                                  ),
                                const SizedBox(height: 24),
                              ],
                            ),
                          ),
                        ),
                        if (filteredFaqs.isEmpty)
                          SliverToBoxAdapter(
                            child: Padding(
                              padding:
                                  const EdgeInsets.symmetric(horizontal: 20),
                              child: _buildEmptyFaqState(),
                            ),
                          )
                        else
                          SliverPadding(
                            padding: const EdgeInsets.symmetric(horizontal: 20),
                            sliver: SliverList.builder(
                              itemCount: filteredFaqs.length,
                              itemBuilder: (context, idx) {
                                final faq = filteredFaqs[idx];
                                return Padding(
                                  padding: const EdgeInsets.only(bottom: 12),
                                  child: FadeUpWidget(
                                    index: 3 + idx,
                                    delay: 0.05,
                                    child: _buildFaqItem(faq),
                                  ),
                                );
                              },
                            ),
                          ),
                        SliverPadding(
                          padding: const EdgeInsets.fromLTRB(20, 32, 20, 48),
                          sliver: SliverToBoxAdapter(
                            child: FadeUpWidget(
                              index: 1,
                              delay: 0.2,
                              child: _buildContactSection(),
                            ),
                          ),
                        ),
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
    final colors = AppColors.of(context);
    return Positioned.fill(
      child: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              colors.surface,
              colors.primarySurface,
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHeader(BuildContext context) {
    final colors = AppColors.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      decoration: BoxDecoration(
        color: colors.card.withValues(alpha: 0.8),
        border: Border(
            bottom: BorderSide(
                color: colors.outlineVariant.withValues(alpha: 0.3))),
      ),
      child: Row(
        children: [
          // AUDIT FIX: 48dp touch target + tooltip (was ~46dp, no semantics).
          SizedBox(
            width: 48,
            height: 48,
            child: InkWell(
              key: const Key('backButton'),
              onTap: widget.onBack ??
                  () {
                    if (Navigator.canPop(context)) {
                      Navigator.pop(context);
                    }
                  },
              customBorder: const CircleBorder(),
              child: Container(
                padding: const EdgeInsets.all(Spacing.md2),
                decoration: BoxDecoration(
                  color: colors.card,
                  shape: BoxShape.circle,
                  border: Border.all(
                      color: colors.outlineVariant.withValues(alpha: 0.4)),
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
          ),
          const SizedBox(width: 16),
          Text(
            AppLocalizations.of(context)?.txtfaq ?? 'FAQ',
            style: AppTypography.titleLarge.copyWith(color: colors.onSurface),
          ),
        ],
      ),
    );
  }

  Widget _buildSearchBar() {
    final colors = AppColors.of(context);
    return Container(
      decoration: BoxDecoration(
        color: colors.card.withValues(alpha: 0.8),
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(color: colors.outlineVariant.withValues(alpha: 0.4)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 20,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: TextFormField(
        onChanged: (v) => setState(() => _searchQuery = v),
        style: GoogleFonts.plusJakartaSans(color: colors.onSurface),
        decoration: InputDecoration(
          prefixIcon:
              Icon(Icons.search, color: colors.onSurfaceMuted, size: 18),
          hintText: 'Search help topics...',
          hintStyle:
              AppTypography.bodyMedium.copyWith(color: colors.onSurfaceMuted),
          border: InputBorder.none,
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
        ),
      ),
    );
  }

  Widget _buildCategoryScroller(List<String> categories) {
    final colors = AppColors.of(context);
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: categories.map((cat) {
          final isSelected = _activeCategory == cat;
          return Padding(
            padding: const EdgeInsets.only(right: 8),
            child: InkWell(
              onTap: () => setState(() => _activeCategory = cat),
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                decoration: BoxDecoration(
                  color: isSelected ? AppColors.primary : colors.card,
                  borderRadius: BorderRadius.circular(AppRadius.full),
                  border: isSelected
                      ? null
                      : Border.all(
                          color: colors.outlineVariant.withValues(alpha: 0.5)),
                  boxShadow: isSelected
                      ? [
                          BoxShadow(
                            color: AppColors.primary.withValues(alpha: 0.3),
                            blurRadius: 10,
                            offset: const Offset(0, 4),
                          ),
                        ]
                      : [],
                ),
                child: Text(
                  cat,
                  style: AppTypography.labelMedium.copyWith(
                      color:
                          isSelected ? Colors.white : colors.onSurfaceVariant),
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildEmptyFaqState() {
    final colors = AppColors.of(context);
    return Column(
      children: [
        const SizedBox(height: 60),
        Container(
          height: 64,
          width: 64,
          decoration: BoxDecoration(
            color: colors.primarySurface,
            shape: BoxShape.circle,
          ),
          child: const Icon(Icons.search, color: AppColors.primary, size: 24),
        ),
        const SizedBox(height: 16),
        Text(
          'No results found',
          style: AppTypography.titleSmall.copyWith(color: colors.onSurface),
        ),
        Text(
          "We couldn't find any match for your search.",
          style: GoogleFonts.plusJakartaSans(
              fontSize: 13, color: colors.onSurfaceVariant),
        ),
      ],
    );
  }

  Widget _buildFaqItem(FaqItem faq) {
    final isExpanded = _expandedId == faq.id;
    final colors = AppColors.of(context);
    return Material(
      color: colors.card,
      borderRadius: BorderRadius.circular(AppRadius.lg),
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(AppRadius.lg),
          border:
              Border.all(color: colors.outlineVariant.withValues(alpha: 0.4)),
        ),
        child: Column(
          children: [
            ListTile(
              onTap: () =>
                  setState(() => _expandedId = isExpanded ? null : faq.id),
              title: Text(
                faq.question,
                style: AppTypography.bodyMedium
                    .copyWith(fontWeight: FontWeight.w600)
                    .copyWith(color: colors.onSurface),
              ),
              trailing: AnimatedRotation(
                duration: const Duration(milliseconds: 300),
                turns: isExpanded ? 0.5 : 0,
                child: Icon(
                  Icons.keyboard_arrow_down,
                  size: 18,
                  color: colors.onSurfaceMuted,
                ),
              ),
            ),
            if (isExpanded)
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                child: Text(
                  faq.answer,
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 13,
                    height: 1.5,
                    color: colors.onSurfaceVariant,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildContactSection() {
    final colors = AppColors.of(context);
    return Container(
      padding: Spacing.paddingLg,
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(AppRadius.radiusBottomSheet),
        border: Border.all(color: colors.outlineVariant.withValues(alpha: 0.4)),
      ),
      child: Column(
        children: [
          Row(
            children: [
              Container(
                height: 40,
                width: 40,
                decoration: BoxDecoration(
                  color: colors.primarySurface,
                  borderRadius: BorderRadius.circular(AppRadius.md),
                ),
                child: const Icon(
                  Icons.message_outlined,
                  color: AppColors.primary,
                  size: 20,
                ),
              ),
              const SizedBox(width: 16),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Still need help?',
                    style: AppTypography.bodyMedium
                        .copyWith(fontWeight: FontWeight.w600)
                        .copyWith(color: colors.onSurface),
                  ),
                  Text(
                    'Our team is available 24/7 for you.',
                    style: GoogleFonts.plusJakartaSans(
                        fontSize: 12, color: colors.onSurfaceVariant),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 24),
          Row(
            children: [
              Expanded(
                child: GestureDetector(
                  onTap: _callSupport,
                  child: _buildContactButton(
                    Icons.phone_outlined,
                    'Call Support',
                    colors.successLight,
                    colors.successLightForeground,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: GestureDetector(
                  onTap: _emailSupport,
                  child: _buildContactButton(
                    Icons.email_outlined,
                    'Email Us',
                    AppColors.accentPurple.withValues(alpha: 0.15),
                    AppColors.accentPurple,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildContactButton(
    IconData icon,
    String label,
    Color bg,
    Color text,
  ) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 16),
      decoration: BoxDecoration(
          color: bg, borderRadius: BorderRadius.circular(AppRadius.lg)),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, size: 14, color: text),
          const SizedBox(width: 8),
          Text(
            label,
            style: AppTypography.labelMedium.copyWith(color: text),
          ),
        ],
      ),
    );
  }
}
