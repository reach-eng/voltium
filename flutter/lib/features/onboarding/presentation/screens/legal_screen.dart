import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:voltium_rider/utils/app_navigator.dart';
import 'package:voltium_rider/core/observability/posthog_service.dart';
import 'package:voltium_rider/services/cache_service.dart';
import 'package:voltium_rider/core/network/api_client.dart';
import 'package:voltium_rider/utils/app_logger.dart';
import 'package:voltium_rider/utils/toast.dart';
import 'legal_page_screen.dart';
import '../legal_fallback_loader.dart';
import 'package:voltium_rider/theme/app_typography.dart';

class LegalScreen extends StatefulWidget {
  final VoidCallback? onNext;
  final VoidCallback? onBack;

  const LegalScreen({super.key, this.onNext, this.onBack});

  @override
  State<LegalScreen> createState() => _LegalScreenState();
}

class _LegalScreenState extends State<LegalScreen>
    with TickerProviderStateMixin {
  final Set<String> _expandedIds = {};
  bool _accepted = false;
  bool _isContinuing = false;

  // AUDIT FIX: recognizers were created INLINE in build() on every rebuild
  // (checkbox toggle, section expand, doc load) and never disposed — a
  // GestureBinding leak per rebuild. Created once here, disposed in dispose.
  late final TapGestureRecognizer _termsRecognizer;
  late final TapGestureRecognizer _privacyRecognizer;

  Map<String, ({String title, String content})> _apiDocs = const {};
  bool _loadingDocs = false;

  Map<String, ({String title, String content})> _fallback = const {};

  late final AnimationController _entryCtrl;
  late final AnimationController _checkCtrl;

  @override
  void initState() {
    super.initState();
    _entryCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 500),
    )..forward();

    _checkCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 200),
    );

    _termsRecognizer = TapGestureRecognizer()
      ..onTap = () {
        AppNavigator.push(
          context,
          const LegalPageScreen(documentType: LegalDocumentType.terms),
        );
      };
    _privacyRecognizer = TapGestureRecognizer()
      ..onTap = () {
        AppNavigator.push(
          context,
          const LegalPageScreen(documentType: LegalDocumentType.privacy),
        );
      };

    _loadFallback();
    _loadDocs();
  }

  Future<void> _loadFallback() async {
    try {
      final loaded = await const LegalFallbackLoader().loadAll();
      if (mounted) setState(() => _fallback = loaded);
    } catch (e) {
      appDebug('[legalScreen] fallback load failed: $e');
    }
  }

  Future<void> _loadDocs() async {
    setState(() => _loadingDocs = true);
    try {
      // PR-13: was a wrapper call to
      // `VoltiumApiService.fetchLegalDocuments`, which is a 1-line
      // pass-through to `ApiClient.getWithSWR('/api/rider/legal')`.
      // This screen is `StatefulWidget` (no `ref`); construct the
      // transport ad hoc. The new-instance allocation is cheap
      // (it shares the shared pinned HTTP client).
      final envelope = await ApiClient().getWithSWR('/api/rider/legal');
      final data = envelope['data'];
      if (data is List) {
        final docs = <String, ({String title, String content})>{};
        for (final raw in data) {
          if (raw is Map<String, dynamic>) {
            final type = raw['type'] as String?;
            final title = raw['title'] as String?;
            final content = raw['content'] as String?;
            if (type != null && content != null && content.isNotEmpty) {
              docs[type] = (title: title ?? type, content: content);
            }
          }
        }
        if (docs.isNotEmpty && mounted) {
          setState(() => _apiDocs = docs);
        }
      }
    } catch (e) {
      appDebug('[legalScreen] API docs load failed: $e');
    } finally {
      if (mounted) setState(() => _loadingDocs = false);
    }
  }

  @override
  void dispose() {
    _entryCtrl.dispose();
    _checkCtrl.dispose();
    _termsRecognizer.dispose();
    _privacyRecognizer.dispose();
    super.dispose();
  }

  void _toggleAccepted() {
    setState(() => _accepted = !_accepted);
    if (_accepted) {
      _checkCtrl.forward();
    } else {
      _checkCtrl.reverse();
    }
  }

  Future<void> _handleContinue() async {
    if (!_accepted || _isContinuing) return;
    _isContinuing = true;
    try {
      await CacheService().setBool('legal_accepted_v1', true);
      PostHogService.capture('legal_accepted');
      widget.onNext?.call();
    } catch (e) {
      // AUDIT FIX: a failed consent write used to propagate unhandled out
      // of the tap handler (or silently no-op) — the rider believed they
      // accepted. Surface the failure and let them retry.
      appDebug('[legalScreen] consent write failed: $e');
      if (mounted) {
        Toast.error(
          context,
          'Could not save your acceptance. Please try again.',
        );
      }
      setState(() => _accepted = false);
      _checkCtrl.reverse();
    } finally {
      if (mounted) _isContinuing = false;
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final l10n = AppLocalizations.of(context)!;

    return Scaffold(
      backgroundColor: colors.surface,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 24, 20, 0),
              child: FadeTransition(
                opacity: CurvedAnimation(
                  parent: _entryCtrl,
                  curve: const Interval(0, 0.5, curve: Curves.easeIn),
                ),
                child: _buildBackButton(),
              ),
            ),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(20, 24, 20, 0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _buildHeader(),
                    const SizedBox(height: 8),

                    // Subtitle
                    FadeTransition(
                      opacity: CurvedAnimation(
                        parent: _entryCtrl,
                        curve: const Interval(0.2, 0.8, curve: Curves.easeIn),
                      ),
                      child: Text(
                        l10n.txtpleaseReviewAndAcceptOurLegalDocumentsToContinue,
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 14,
                          color: colors.onSurfaceVariant,
                          height: 1.6,
                        ),
                      ),
                    ),

                    const SizedBox(height: 24),

                    // Expandable sections
                    SlideTransition(
                      position: Tween<Offset>(
                        begin: const Offset(0, 0.3),
                        end: Offset.zero,
                      ).animate(
                        CurvedAnimation(
                          parent: _entryCtrl,
                          curve: const Interval(
                            0.2,
                            0.9,
                            curve: Curves.easeOutCubic,
                          ),
                        ),
                      ),
                      child: FadeTransition(
                        opacity: CurvedAnimation(
                          parent: _entryCtrl,
                          curve: const Interval(0.2, 0.8),
                        ),
                        child: Column(
                          children: [
                            if (_loadingDocs && _apiDocs.isEmpty)
                              Padding(
                                padding: const EdgeInsets.only(bottom: 12),
                                child: Row(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    const SizedBox(
                                      width: 14,
                                      height: 14,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2,
                                      ),
                                    ),
                                    const SizedBox(width: 10),
                                    Text(
                                      l10n.txtsyncingLatestDocs,
                                      style: GoogleFonts.plusJakartaSans(
                                        fontSize: 12,
                                        color: colors.onSurfaceVariant,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ..._buildSections(),
                          ],
                        ),
                      ),
                    ),

                    const SizedBox(height: 40),
                  ],
                ),
              ),
            ),

            // Checkbox + Continue button
            _buildFooter(),
          ],
        ),
      ),
    );
  }

  Widget _buildBackButton() {
    final colors = AppColors.of(context);
    return GestureDetector(
      onTap: widget.onBack ?? () => Navigator.maybePop(context),
      child: Container(
        width: 44,
        height: 44,
        decoration: BoxDecoration(
          color: colors.card.withValues(alpha: 0.8),
          borderRadius: BorderRadius.circular(AppRadius.full),
          border: Border.all(color: colors.outline.withValues(alpha: 0.2)),
          boxShadow: AppShadows.card,
        ),
        child: Icon(
          Icons.arrow_back,
          size: 20,
          color: colors.onSurface,
        ),
      ),
    );
  }

  Widget _buildHeader() {
    final colors = AppColors.of(context);
    final l10n = AppLocalizations.of(context)!;

    return SlideTransition(
      position:
          Tween<Offset>(begin: const Offset(0, 0.3), end: Offset.zero).animate(
        CurvedAnimation(
          parent: _entryCtrl,
          curve: const Interval(0.1, 0.7, curve: Curves.easeOutCubic),
        ),
      ),
      child: FadeTransition(
        opacity: CurvedAnimation(
          parent: _entryCtrl,
          curve: const Interval(0.1, 0.7),
        ),
        child: Row(
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: colors.card.withValues(alpha: 0.8),
                borderRadius: BorderRadius.circular(AppRadius.lg),
                border:
                    Border.all(color: colors.outline.withValues(alpha: 0.2)),
                boxShadow: AppShadows.card,
              ),
              child: const Icon(
                Icons.shield_outlined,
                size: 24,
                color: AppColors.primary,
              ),
            ),
            const SizedBox(width: 12),
            Text(
              l10n.txtagreeToTerms,
              style: GoogleFonts.plusJakartaSans(
                fontSize: 24,
                fontWeight: FontWeight.w700,
                color: colors.onSurface,
                letterSpacing: -0.5,
              ),
            ),
          ],
        ),
      ),
    );
  }

  List<Widget> _buildSections() {
    final fallback =
        <({String id, String title, String content, Key headerKey})>[
      (
        id: 'terms',
        title: _fallback['terms']?.title ?? 'Terms of Service',
        content: _fallback['terms']?.content ?? '',
        headerKey: const Key('termsExpand'),
      ),
      (
        id: 'privacy',
        title: _fallback['privacy']?.title ?? 'Privacy Policy',
        content: _fallback['privacy']?.content ?? '',
        headerKey: const Key('privacyExpand'),
      ),
      (
        id: 'rental_safety',
        title: _fallback['rentalSafety']?.title ?? 'Rental & Safety Agreement',
        content: _fallback['rentalSafety']?.content ?? '',
        headerKey: const Key('rentalSafetyExpand'),
      ),
      (
        id: 'refund',
        title: _fallback['refund']?.title ?? 'Refund & Cancellation',
        content: _fallback['refund']?.content ?? '',
        headerKey: const Key('refundExpand'),
      ),
      (
        id: 'guarantor',
        title: _fallback['guarantor']?.title ?? "Guarantor's Agreement",
        content: _fallback['guarantor']?.content ?? '',
        headerKey: const Key('guarantorExpand'),
      ),
    ];

    final widgets = <Widget>[];
    final renderedIds = <String>{};

    void addSection(
      String id,
      String title,
      String content,
      Key headerKey,
    ) {
      renderedIds.add(id);
      widgets.add(_buildExpandableSection(
        id: id,
        title: title,
        content: content,
        headerKey: headerKey,
      ));
      widgets.add(const SizedBox(height: 12));
    }

    for (final section in fallback) {
      final api = _apiDocs[section.id];
      addSection(
        section.id,
        api?.title ?? section.title,
        api?.content ?? section.content,
        section.headerKey,
      );
    }

    // API-only types not covered by the fallback set (e.g. lease).
    for (final entry in _apiDocs.entries) {
      if (renderedIds.contains(entry.key)) continue;
      addSection(entry.key, entry.value.title, entry.value.content,
          ValueKey(entry.key));
    }

    if (widgets.isNotEmpty) widgets.removeLast(); // trailing SizedBox
    return widgets;
  }

  Widget _buildExpandableSection({
    required String id,
    required String title,
    required String content,
    Key? headerKey,
  }) {
    final colors = AppColors.of(context);
    final isExpanded = _expandedIds.contains(id);
    return RepaintBoundary(
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 300),
        decoration: BoxDecoration(
          color: colors.card,
          borderRadius: BorderRadius.circular(AppRadius.lg),
          border: Border.all(color: colors.outline.withValues(alpha: 0.2)),
          boxShadow: AppShadows.card,
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(AppRadius.lg),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header row
              InkWell(
                key: headerKey,
                onTap: () {
                  setState(() {
                    if (isExpanded) {
                      _expandedIds.remove(id);
                    } else {
                      _expandedIds.add(id);
                    }
                  });
                },
                child: Padding(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        title,
                        style: AppTypography.bodyLarge
                            .copyWith(fontWeight: FontWeight.w600)
                            .copyWith(color: colors.onSurface),
                      ),
                      AnimatedRotation(
                        turns: isExpanded ? 0.5 : 0.0,
                        duration: const Duration(milliseconds: 250),
                        child: Icon(
                          Icons.keyboard_arrow_down,
                          size: 20,
                          color: colors.onSurfaceVariant,
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              // Expandable content
              AnimatedSize(
                duration: const Duration(milliseconds: 300),
                curve: Curves.easeOutCubic,
                child: isExpanded
                    ? Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Divider
                          Container(
                            height: 1,
                            color: colors.outline.withValues(alpha: 0.2),
                            margin: const EdgeInsets.symmetric(horizontal: 20),
                          ),
                          Padding(
                            padding: const EdgeInsets.fromLTRB(20, 16, 20, 20),
                            child: ConstrainedBox(
                              constraints: const BoxConstraints(maxHeight: 280),
                              child: SingleChildScrollView(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: content
                                      .split('\n\n')
                                      .map(
                                        (para) => Padding(
                                          padding:
                                              const EdgeInsets.only(bottom: 12),
                                          child: Text(
                                            para,
                                            style: GoogleFonts.plusJakartaSans(
                                              fontSize: 13,
                                              color: colors.onSurfaceVariant,
                                              height: 1.7,
                                            ),
                                          ),
                                        ),
                                      )
                                      .toList(),
                                ),
                              ),
                            ),
                          ),
                        ],
                      )
                    : const SizedBox.shrink(),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildFooter() {
    final colors = AppColors.of(context);
    final l10n = AppLocalizations.of(context)!;

    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
      child: SlideTransition(
        position: Tween<Offset>(begin: const Offset(0, 0.5), end: Offset.zero)
            .animate(
          CurvedAnimation(
            parent: _entryCtrl,
            curve: const Interval(0.3, 1.0, curve: Curves.easeOutCubic),
          ),
        ),
        child: FadeTransition(
          opacity: CurvedAnimation(
            parent: _entryCtrl,
            curve: const Interval(0.3, 0.9),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Custom checkbox row
              GestureDetector(
                key: const Key('acceptCheckbox'),
                behavior: HitTestBehavior.opaque,
                onTap: _toggleAccepted,
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Custom gradient checkbox 24×24 rounded-lg
                      AnimatedContainer(
                        duration: const Duration(milliseconds: 200),
                        width: 24,
                        height: 24,
                        margin: const EdgeInsets.only(top: 2),
                        decoration: BoxDecoration(
                          gradient: _accepted ? AppGradients.primary : null,
                          color: _accepted
                              ? null
                              : colors.outline.withValues(alpha: 0.3),
                          borderRadius: BorderRadius.circular(AppRadius.sm),
                          boxShadow:
                              _accepted ? AppShadows.checkboxAccepted : null,
                        ),
                        child: _accepted
                            ? ScaleTransition(
                                scale: CurvedAnimation(
                                  parent: _checkCtrl,
                                  curve: Curves.elasticOut,
                                ),
                                child: const Icon(
                                  Icons.check,
                                  size: 16,
                                  color: Colors.white,
                                ),
                              )
                            : null,
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: RichText(
                          text: TextSpan(
                            style: GoogleFonts.plusJakartaSans(
                              fontSize: 13,
                              color: colors.onSurfaceVariant,
                              height: 1.6,
                            ),
                            children: [
                              TextSpan(
                                text: l10n.txtlegalAgreeCheckboxPrefix,
                              ),
                              TextSpan(
                                text: l10n.txttermsOfService,
                                style: AppTypography.bodyMedium
                                    .copyWith(
                                        fontSize: 13,
                                        fontWeight: FontWeight.w600)
                                    .copyWith(
                                        color: AppColors.primary,
                                        decoration: TextDecoration.underline),
                                recognizer: _termsRecognizer,
                              ),
                              const TextSpan(text: ' and '),
                              TextSpan(
                                text: l10n.txtprivacyPolicy,
                                style: AppTypography.bodyMedium
                                    .copyWith(
                                        fontSize: 13,
                                        fontWeight: FontWeight.w600)
                                    .copyWith(
                                        color: AppColors.primary,
                                        decoration: TextDecoration.underline),
                                recognizer: _privacyRecognizer,
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              const SizedBox(height: 20),

              // Continue button
              GestureDetector(
                key: const Key('continueLegalButton'),
                onTap: _accepted ? _handleContinue : null,
                child: AnimatedOpacity(
                  opacity: _accepted ? 1.0 : 0.4,
                  duration: const Duration(milliseconds: 200),
                  child: Container(
                    height: 56,
                    decoration: BoxDecoration(
                      gradient: AppGradients.primary,
                      borderRadius: BorderRadius.circular(AppRadius.full),
                      boxShadow: _accepted ? AppShadows.primaryButton : null,
                    ),
                    child: Center(
                      child: Text(
                        l10n.txtcontinue,
                        style: AppTypography.bodyLarge
                            .copyWith(fontWeight: FontWeight.w600)
                            .copyWith(color: Colors.white),
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
