import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:voltium_rider/utils/app_navigator.dart';
import 'package:voltium_rider/core/observability/posthog_service.dart';
import 'package:voltium_rider/services/cache_service.dart';
import 'package:voltium_rider/utils/app_logger.dart';
import 'package:voltium_rider/services/voltium_api_service.dart';
import 'legal_page_screen.dart';
import '../legal_fallback_loader.dart';
import 'package:voltium_rider/theme/app_typography.dart';

/// Matches web LegalConsentScreen.tsx exactly:
/// - bg #f7f9fb
/// - Glass back button (40×40 circle, white/70, blur, shadow)
/// - Shield icon in glass card (48×48, rounded-xl) + "Agree to Terms" title (24px bold)
/// - Subtitle "Please review and accept our legal documents to continue."
/// - Expandable white cards (rounded-xl, shadow) — Terms of Service, Privacy Policy
///   - Chevron rotates 180° when expanded
///   - Divider inside, scrollable content (max 280px), 13px text #424653
/// - Custom checkbox: 24×24 rounded-lg, gradient when checked, spring animation
/// - "Continue" gradient pill button (56px, disabled opacity 0.4)

// ── Offline fallback content (2026-08-05 legal/device audit P0-3) ─────────
// The admin panel is the source of truth for legal documents; the screen
// fetches them from GET /api/rider/legal (SWR-cached for offline). The
// JSON asset at `assets/json/legal_fallback.json` is only rendered when
// the API is unreachable AND no cached copy exists, so the legal
// acceptance gate can never hard-block onboarding.
//
// PR-1 (2026-08-07 master fix plan): the 5 inline `const _k*Content`
// strings were moved to the JSON asset so the legal team can update
// copy without a Flutter release. The asset ships in the APK via
// `pubspec.yaml` assets section.

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
  // ONBOARDING-AUDIT 2026-08-14 follow-up: double-tap guard for
  // `_handleContinue`. The button is a GestureDetector (not an
  // ElevatedButton), so the framework doesn't debounce taps and a
  // rapid double-tap would call `widget.onNext?.call()` twice. The
  // router swap is idempotent but the duplicate work is wasteful
  // (cache write, PostHog capture) and risks a transient mismatch
  // if the rider backgrounds between the two fires.
  bool _isContinuing = false;

  // API-sourced documents keyed by type; the JSON asset is only used as an
  // offline fallback when the fetch fails and no cache exists.
  Map<String, ({String title, String content})> _apiDocs = const {};
  bool _loadingDocs = false;

  // PR-1 (2026-08-07 master fix plan): the 5 inline `const _k*Content`
  // strings used to live at the top of this file as a 3KB literal. They
  // are now bundled in `assets/json/legal_fallback.json` and loaded once
  // per mount. Loading is fast (a single `rootBundle.loadString` from a
  // <8KB JSON asset) and the result is cached in `_fallback` for the
  // lifetime of the screen. The empty default is safe — the sections
  // short-circuit to the API docs when the asset load fails, and the
  // hardcoded string titles are still used as a last-resort fallback.
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
    _loadFallback();
    _loadDocs();
  }

  /// PR-1 (2026-08-07 master fix plan): load the offline fallback content
  /// from the bundled JSON asset. Runs once per mount; failure is silent
  /// (the API docs and the hardcoded titles still keep the legal gate
  /// functional).
  Future<void> _loadFallback() async {
    try {
      final loaded = await const LegalFallbackLoader().loadAll();
      if (mounted) setState(() => _fallback = loaded);
    } catch (e) {
      // ONBOARDING-AUDIT 2026-08-14 P3-7: log the failure so silent
      // asset/parse errors are visible. Asset missing or malformed —
      // fall through to the API docs only.
      appDebug('[legalScreen] fallback load failed: $e');
    }
  }

  /// Fetch legal documents from the server, merging into the fallback set.
  /// Uses the ApiClient's SWR cache (see [ApiClient.getWithSWR]) so the last
  /// successful fetch renders instantly offline. Failures are silent — the
  /// fallback constants above keep the legal gate functional.
  Future<void> _loadDocs() async {
    setState(() => _loadingDocs = true);
    try {
      final envelope = await VoltiumApiService().fetchLegalDocuments();
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
      // ONBOARDING-AUDIT 2026-08-14 P3-7: log the failure so silent
      // offline/server errors are visible. Fallback content stays in
      // place.
      appDebug('[legalScreen] API docs load failed: $e');
    } finally {
      if (mounted) setState(() => _loadingDocs = false);
    }
  }

  @override
  void dispose() {
    _entryCtrl.dispose();
    _checkCtrl.dispose();
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
    } finally {
      if (mounted) _isContinuing = false;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surface,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Back button row
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
                    // Header: Shield + "Agree to Terms"
                    _buildHeader(),
                    const SizedBox(height: 8),

                    // Subtitle
                    FadeTransition(
                      opacity: CurvedAnimation(
                        parent: _entryCtrl,
                        curve: const Interval(0.2, 0.8, curve: Curves.easeIn),
                      ),
                      child: Text(
                        'Please review and accept our legal documents to continue.',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 14,
                          color: AppColors.onSurfaceVariant,
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
                                      'Syncing latest documents…',
                                      style: GoogleFonts.plusJakartaSans(
                                        fontSize: 12,
                                        color: AppColors.onSurfaceVariant,
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
    return GestureDetector(
      onTap: widget.onBack ?? () => Navigator.maybePop(context),
      child: Container(
        width: 44,
        height: 44,
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.7),
          borderRadius: BorderRadius.circular(AppRadius.full),
          boxShadow: AppShadows.glass,
        ),
        child: Icon(
          Icons.arrow_back,
          size: 20,
          color: AppColors.of(context).onSurfaceMuted,
        ),
      ),
    );
  }

  Widget _buildHeader() {
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
            // Shield card 48×48 rounded-xl glass
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.7),
                borderRadius: BorderRadius.circular(AppRadius.lg),
                boxShadow: AppShadows.glass,
              ),
              child: const Icon(
                Icons.shield_outlined,
                size: 24,
                color: AppColors.primary,
              ),
            ),
            SizedBox(width: 12),
            Text(
              'Agree to Terms',
              style: GoogleFonts.plusJakartaSans(
                fontSize: 24,
                fontWeight: FontWeight.w700,
                color: AppColors.of(context).onSurfaceMuted,
                letterSpacing: -0.5,
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// Ordered fallback sections; API docs override by `type` when present, and
  /// any API-only types (e.g. `lease`) are appended after the fallback set.
  ///
  /// The fallback content is loaded from `assets/json/legal_fallback.json`
  /// via [LegalFallbackLoader]. Loaded once per screen mount and cached in
  /// [_fallback] so the rebuild loop is free of I/O.
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
    final isExpanded = _expandedIds.contains(id);
    return RepaintBoundary(
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 300),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(AppRadius.lg),
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
                            .copyWith(
                                color: AppColors.of(context).onSurfaceMuted),
                      ),
                      AnimatedRotation(
                        turns: isExpanded ? 0.5 : 0.0,
                        duration: const Duration(milliseconds: 250),
                        child: const Icon(
                          Icons.keyboard_arrow_down,
                          size: 20,
                          color: AppColors.onSurfaceVariant,
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
                            color: AppColors.divider,
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
                                              color: AppColors.onSurfaceVariant,
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
                          color: _accepted ? null : AppColors.divider,
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
                      SizedBox(width: 12),
                      Expanded(
                        child: RichText(
                          text: TextSpan(
                            style: GoogleFonts.plusJakartaSans(
                              fontSize: 13,
                              color: AppColors.onSurfaceVariant,
                              height: 1.6,
                            ),
                            children: [
                              const TextSpan(
                                text: 'I have read and agree to the ',
                              ),
                              TextSpan(
                                text: 'Terms of Service',
                                style: AppTypography.bodyMedium
                                    .copyWith(
                                        fontSize: 13,
                                        fontWeight: FontWeight.w600)
                                    .copyWith(
                                        color: AppColors.primary,
                                        decoration: TextDecoration.underline),
                                recognizer: TapGestureRecognizer()
                                  ..onTap = () {
                                    AppNavigator.push(
                                      context,
                                      const LegalPageScreen(
                                        documentType: LegalDocumentType.terms,
                                      ),
                                    );
                                  },
                              ),
                              const TextSpan(text: ' and '),
                              TextSpan(
                                text: 'Privacy Policy',
                                style: AppTypography.bodyMedium
                                    .copyWith(
                                        fontSize: 13,
                                        fontWeight: FontWeight.w600)
                                    .copyWith(
                                        color: AppColors.primary,
                                        decoration: TextDecoration.underline),
                                recognizer: TapGestureRecognizer()
                                  ..onTap = () {
                                    AppNavigator.push(
                                      context,
                                      const LegalPageScreen(
                                        documentType: LegalDocumentType.privacy,
                                      ),
                                    );
                                  },
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
                        'Continue',
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
