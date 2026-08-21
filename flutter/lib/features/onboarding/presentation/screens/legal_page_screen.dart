import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cached_network_image/cached_network_image.dart';

import 'package:voltium_rider/models/rider_model.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart';
import '../../../../theme/app_theme.dart';
import 'package:voltium_rider/theme/app_typography.dart';
import 'package:voltium_rider/utils/app_config.dart';
import 'package:voltium_rider/features/onboarding/presentation/legal_fallback_loader.dart';
import 'package:voltium_rider/gen/app_localizations.dart';

part 'legal_page_content.dart';

// ─── Branding ────────────────────────────────────────────────────────────────
const _kBrandFull = 'Voltium Electric Mobility Private Limited';
const _kBrandShort = 'Voltium';
// CONSOLIDATED-FIX-2026-08-16 §4.14: support contact info centralised in
// `AppConfig` so the 3 hardcoded variants across legal/FAQ/support screens
// can't drift (see audit #5 P1-19 / #18 P1-1 / #19 P1-1).
const _kSupportEmail = AppConfig.supportEmail;
const _kSupportPhone = AppConfig.supportPhone;

// ─── Document Sections ───────────────────────────────────────────────────────

// =============================================================================
// LegalPageScreen – Document viewer with signatures & PDF download
// =============================================================================

class LegalPageScreen extends ConsumerStatefulWidget {
  /// Optional type filter. When null, shows every document.
  /// When set, shows only the matching section (terms-only = ['terms'], etc.).
  final LegalDocumentType? documentType;
  final VoidCallback? onBack;

  const LegalPageScreen({super.key, this.documentType, this.onBack});

  @override
  ConsumerState<LegalPageScreen> createState() => _LegalPageScreenState();
}

/// Filters which legal documents are shown on the page.
/// `null` (or [all]) shows everything; a specific value shows only that doc.
enum LegalDocumentType { all, terms, privacy, refund, guarantor }

/// State for LegalPageScreen managed via Riverpod Notifier.
class LegalPageState {
  final Set<int> expandedIndices;
  final bool isGeneratingPdf;

  const LegalPageState({
    this.expandedIndices = const {},
    this.isGeneratingPdf = false,
  });

  LegalPageState copyWith({
    Set<int>? expandedIndices,
    bool? isGeneratingPdf,
  }) {
    return LegalPageState(
      expandedIndices: expandedIndices ?? this.expandedIndices,
      isGeneratingPdf: isGeneratingPdf ?? this.isGeneratingPdf,
    );
  }
}

class LegalPageNotifier extends Notifier<LegalPageState> {
  @override
  LegalPageState build() => const LegalPageState();

  void toggleExpanded(int index) {
    final next = Set<int>.from(state.expandedIndices);
    if (next.contains(index)) {
      next.remove(index);
    } else {
      next.add(index);
    }
    state = state.copyWith(expandedIndices: next);
  }

  void setGeneratingPdf(bool value) {
    state = state.copyWith(isGeneratingPdf: value);
  }
}

final legalPageNotifierProvider =
    NotifierProvider<LegalPageNotifier, LegalPageState>(
  LegalPageNotifier.new,
);

class _LegalPageScreenState extends ConsumerState<LegalPageScreen>
    with TickerProviderStateMixin {
  late final AnimationController _entryCtrl;

  /// PR-29 (LEGAL P0): the inlined `$_k*` strings in
  /// `legal_page_content.dart` are kept as a `part` file because they
  /// need string interpolation (`$_kBrandShort`, `$_kBrandFull`).
  /// But the *primary* source of truth for the document body is now
  /// `assets/json/legal_fallback.json` (loaded by [LegalFallbackLoader]).
  /// This map is populated in `initState` and used to override the
  /// inlined content for any section that the JSON contains — the
  /// `part` copy becomes a last-resort fallback when the asset is
  /// missing.
  Map<String, ({String title, String content})> _fallback = const {};

  @override
  void initState() {
    super.initState();
    _entryCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    )..forward();
    // PR-29: load the JSON-backed legal copy. Best-effort: if the
    // asset fails to load (corrupt bundle, missing file) we fall
    // back to the inlined `part` copy so the rider still sees a
    // complete legal page.
    const LegalFallbackLoader().loadAll().then((docs) {
      if (!mounted) return;
      setState(() {
        _fallback = docs;
      });
    }).catchError((_) {
      // Asset missing or malformed JSON — silently keep the inlined
      // part file content. The error is already logged by
      // `rootBundle.loadString` and the inlined copy renders.
    });
  }

  @override
  void dispose() {
    _entryCtrl.dispose();
    super.dispose();
  }

  String get _currentDate => DateFormat('dd MMMM yyyy').format(DateTime.now());

  /// Sections the screen should show, based on the constructor filter.
  ///
  /// PR-29 (LEGAL P0): the inlined `part` file is the legacy source of
  /// truth. The legal team can update copy in
  /// `assets/json/legal_fallback.json` without a Flutter release, so
  /// we prefer the JSON content when available.
  List<_LegalSection> get _visibleSections {
    final type = widget.documentType;
    final filtered = (type == null || type == LegalDocumentType.all)
        ? List<_LegalSection>.from(_sections)
        : _sections.where((s) {
            switch (type) {
              case LegalDocumentType.terms:
                return s.id == 'terms';
              case LegalDocumentType.privacy:
                return s.id == 'privacy';
              case LegalDocumentType.refund:
                return s.id == 'refund';
              case LegalDocumentType.guarantor:
                return s.id == 'guarantor';
              case LegalDocumentType.all:
                return true;
            }
          }).toList();

    if (_fallback.isEmpty) return filtered;
    return filtered.map((s) {
      final override = _fallback[s.id];
      if (override == null) return s;
      return _LegalSection(
        id: s.id,
        title: override.title,
        content: override.content,
      );
    }).toList();
  }

  // ── Build ──────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final rider = ref.watch(riderProvider.select((p) => p.rider));
    final pageState = ref.watch(legalPageNotifierProvider);

    return Scaffold(
      backgroundColor: AppColors.of(context).surface,
      appBar: _buildAppBar(context),
      body: FadeTransition(
        opacity: CurvedAnimation(parent: _entryCtrl, curve: Curves.easeOut),
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 48),
          children: [
            // Document accordion cards
            Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(AppRadius.lg),
                boxShadow: AppShadows.card,
              ),
              clipBehavior: Clip.antiAlias,
              child: ListView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: _visibleSections.length,
                itemBuilder: (context, index) {
                  final section = _visibleSections[index];
                  final isExpanded = pageState.expandedIndices.contains(index);
                  final isGuarantor = section.id == 'guarantor';
                  final signerName = isGuarantor
                      ? (rider?.guarantorName ?? 'Guarantor')
                      : (rider?.name.isNotEmpty == true
                          ? rider!.name
                          : 'Rider');
                  final signatureUrl = isGuarantor
                      ? rider?.guarantorSignature
                      : rider?.signature;

                  return Column(
                    children: [
                      // ── Trigger row ──
                      Material(
                        color: Colors.transparent,
                        child: InkWell(
                          key: Key('legal_section_${section.id}'),
                          onTap: () => ref
                              .read(legalPageNotifierProvider.notifier)
                              .toggleExpanded(index),
                          child: Padding(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 20,
                              vertical: 18,
                            ),
                            child: Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    section.title,
                                    style: AppTypography.bodyMedium
                                        .copyWith(fontWeight: FontWeight.w800)
                                        .copyWith(
                                            color: AppColors.of(context)
                                                .onSurface),
                                  ),
                                ),
                                AnimatedRotation(
                                  turns: isExpanded ? 0.5 : 0.0,
                                  duration: const Duration(milliseconds: 250),
                                  child: const Icon(
                                    Icons.keyboard_arrow_down_rounded,
                                    color: AppColors.slate400,
                                    size: 22,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),

                      // ── Expandable content ──
                      AnimatedCrossFade(
                        firstChild: const SizedBox.shrink(),
                        secondChild: Padding(
                          padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              // Document body
                              ConstrainedBox(
                                constraints:
                                    const BoxConstraints(maxHeight: 320),
                                child: SingleChildScrollView(
                                  child: Text(
                                    section.content,
                                    style: GoogleFonts.plusJakartaSans(
                                      fontSize: 12,
                                      color: AppColors.of(context)
                                          .onSurfaceVariant,
                                      height: 1.7,
                                    ),
                                  ),
                                ),
                              ),

                              const SizedBox(height: 20),

                              // ── Divider ──
                              Container(
                                height: 1,
                                color: AppColors.of(context).iconBackground,
                              ),

                              const SizedBox(height: 20),

                              // ── Signed-by card ──
                              Container(
                                padding: const EdgeInsets.all(14),
                                decoration: BoxDecoration(
                                  color: AppColors.of(context).primarySurface,
                                  borderRadius:
                                      BorderRadius.circular(AppRadius.lg),
                                ),
                                child: Row(
                                  children: [
                                    // Avatar
                                    Container(
                                      width: 40,
                                      height: 40,
                                      decoration: const BoxDecoration(
                                        color: AppColors.primary,
                                        shape: BoxShape.circle,
                                      ),
                                      alignment: Alignment.center,
                                      child: Text(
                                        signerName.isNotEmpty
                                            ? signerName[0].toUpperCase()
                                            : '?',
                                        style: AppTypography.titleSmall
                                            .copyWith(color: Colors.white),
                                      ),
                                    ),
                                    const SizedBox(width: 12),
                                    // Info
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            AppLocalizations.of(context)
                                                    ?.txtsignedBy ??
                                                'SIGNED BY',
                                            style: AppTypography.bodySmall
                                                .copyWith(
                                                    fontWeight: FontWeight.w800,
                                                    letterSpacing: 1.2)
                                                .copyWith(
                                                    color: AppColors.of(context)
                                                        .onSurfaceVariant,
                                                    letterSpacing: 1.2),
                                          ),
                                          const SizedBox(height: 2),
                                          Text(
                                            signerName,
                                            style: GoogleFonts.plusJakartaSans(
                                              fontSize: 13,
                                              fontWeight: FontWeight.w800,
                                              color: AppColors.of(context)
                                                  .onSurface,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                    // Date
                                    Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.end,
                                      children: [
                                        Text(
                                          AppLocalizations.of(context)
                                                  ?.txtdate ??
                                              'DATE',
                                          style: AppTypography.bodySmall
                                              .copyWith(
                                                  fontWeight: FontWeight.w800,
                                                  letterSpacing: 1.2)
                                              .copyWith(
                                                  color: AppColors.of(context)
                                                      .onSurfaceVariant,
                                                  letterSpacing: 1.2),
                                        ),
                                        const SizedBox(height: 2),
                                        Text(
                                          _currentDate,
                                          style: GoogleFonts.plusJakartaSans(
                                            fontSize: 13,
                                            fontWeight: FontWeight.w800,
                                            color:
                                                AppColors.of(context).onSurface,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
                              ),

                              const SizedBox(height: 12),

                              // ── Signature box ──
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 16,
                                  vertical: 14,
                                ),
                                decoration: BoxDecoration(
                                  color: AppColors.of(context).card,
                                  borderRadius:
                                      BorderRadius.circular(AppRadius.lg),
                                  border: Border.all(
                                    color: AppColors.of(context)
                                        .outline
                                        .withValues(alpha: 0.2),
                                    style: BorderStyle.solid,
                                    width: 1,
                                  ),
                                ),
                                constraints:
                                    const BoxConstraints(minHeight: 72),
                                child: Row(
                                  children: [
                                    Expanded(
                                      child: (signatureUrl != null &&
                                              signatureUrl.isNotEmpty)
                                          ? CachedNetworkImage(
                                              imageUrl: signatureUrl,
                                              height: 40,
                                              fit: BoxFit.contain,
                                              alignment: Alignment.centerLeft,
                                              errorWidget: (_, __, ___) =>
                                                  _buildElectronicSignaturePlaceholder(
                                                context,
                                                signerName,
                                              ),
                                              placeholder: (_, __) =>
                                                  const SizedBox(
                                                height: 40,
                                                child: Center(
                                                  child: SizedBox(
                                                    width: 16,
                                                    height: 16,
                                                    child:
                                                        CircularProgressIndicator(
                                                            strokeWidth: 2),
                                                  ),
                                                ),
                                              ),
                                            )
                                          : _buildElectronicSignaturePlaceholder(
                                              context,
                                              signerName,
                                            ),
                                    ),
                                    // Photo thumbnail
                                    if (_getPhotoUrl(rider, isGuarantor) !=
                                        null)
                                      Container(
                                        width: 48,
                                        height: 48,
                                        margin: const EdgeInsets.only(left: 12),
                                        decoration: BoxDecoration(
                                          borderRadius: BorderRadius.circular(
                                              AppRadius.md),
                                          border: Border.all(
                                            color: AppColors.of(context)
                                                .outline
                                                .withValues(alpha: 0.2),
                                          ),
                                          boxShadow: AppShadows.card,
                                        ),
                                        clipBehavior: Clip.antiAlias,
                                        child: CachedNetworkImage(
                                          imageUrl:
                                              _getPhotoUrl(rider, isGuarantor)!,
                                          fit: BoxFit.cover,
                                          memCacheWidth: 96,
                                          memCacheHeight: 96,
                                          errorWidget: (_, __, ___) => Icon(
                                            Icons.person,
                                            color: AppColors.of(context)
                                                .onSurfaceVariant,
                                            size: 20,
                                          ),
                                        ),
                                      ),
                                  ],
                                ),
                              ),

                              const SizedBox(height: 16),

                              // ── Copy-on-request note ──
                              Container(
                                key: Key('pdf_on_request_${section.id}'),
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 14,
                                  vertical: 12,
                                ),
                                decoration: BoxDecoration(
                                  color: AppColors.of(context).primarySurface,
                                  borderRadius:
                                      BorderRadius.circular(AppRadius.lg),
                                ),
                                child: Row(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const Icon(
                                      Icons.info_outline,
                                      color: AppColors.primary,
                                      size: 18,
                                    ),
                                    const SizedBox(width: 8),
                                    Expanded(
                                      child: Text(
                                        'Your acceptance is recorded. To request a signed copy, email $_kSupportEmail.',
                                        style: GoogleFonts.plusJakartaSans(
                                          fontSize: 12,
                                          color: AppColors.of(context)
                                              .onSurfaceVariant,
                                          height: 1.5,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                        crossFadeState: isExpanded
                            ? CrossFadeState.showSecond
                            : CrossFadeState.showFirst,
                        duration: const Duration(milliseconds: 300),
                        sizeCurve: Curves.easeInOut,
                      ),

                      // Separator between sections
                      if (index < _visibleSections.length - 1)
                        Container(
                          height: 1,
                          color: AppColors.of(context)
                              .outline
                              .withValues(alpha: 0.2),
                        ),
                    ],
                  );
                },
              ),
            ),

            const SizedBox(height: 20),

            // ── Need Help? card ──
            Container(
              padding: Spacing.paddingMd,
              decoration: BoxDecoration(
                color: AppColors.of(context).card,
                borderRadius: BorderRadius.circular(AppRadius.lg),
                border: Border.all(
                    color:
                        AppColors.of(context).outline.withValues(alpha: 0.2)),
                boxShadow: AppShadows.card,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    AppLocalizations.of(context)?.txtneedHelp ?? 'NEED HELP?',
                    style: AppTypography.bodySmall
                        .copyWith(
                            fontWeight: FontWeight.w800, letterSpacing: 1.2)
                        .copyWith(
                            color: AppColors.of(context).onSurfaceVariant,
                            letterSpacing: 1.2),
                  ),
                  const SizedBox(height: 8),
                  RichText(
                    text: TextSpan(
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 12,
                        color: AppColors.of(context).onSurfaceVariant,
                        height: 1.5,
                      ),
                      children: [
                        TextSpan(
                          text: AppLocalizations.of(context)
                                  ?.txtlegalHelpText ??
                              'If you have any questions about our policies, please contact our support team at ',
                        ),
                        TextSpan(
                          text: _kSupportEmail,
                          style: GoogleFonts.plusJakartaSans(
                            fontWeight: FontWeight.w700,
                            color: AppColors.primary,
                          ),
                        ),
                        TextSpan(
                          text: AppLocalizations.of(context)?.txtorCall ??
                              ' or call ',
                        ),
                        TextSpan(
                          text: _kSupportPhone,
                          style: GoogleFonts.plusJakartaSans(
                            fontWeight: FontWeight.w700,
                            color: AppColors.primary,
                          ),
                        ),
                        const TextSpan(text: '.'),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  PreferredSizeWidget _buildAppBar(BuildContext context) {
    final type = widget.documentType;
    final l10n = AppLocalizations.of(context);
    String title;
    if (type == null || type == LegalDocumentType.all) {
      title = l10n?.txtlegal ?? 'Legal';
    } else {
      switch (type) {
        case LegalDocumentType.terms:
          title = l10n?.txttermsOfService ?? 'Terms of Service';
          break;
        case LegalDocumentType.privacy:
          title = l10n?.txtprivacyPolicy ?? 'Privacy Policy';
          break;
        case LegalDocumentType.refund:
          title = 'Refund Policy';
          break;
        case LegalDocumentType.guarantor:
          title = "Guarantor's Agreement";
          break;
        case LegalDocumentType.all:
          title = l10n?.txtlegal ?? 'Legal';
          break;
      }
    }
    return AppBar(
      backgroundColor: AppColors.of(context).surface,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      leading: IconButton(
        icon: Icon(Icons.arrow_back,
            color: AppColors.of(context).onSurface, size: 20),
        tooltip: AppLocalizations.of(context)?.txtback ?? 'Back',
        onPressed: () {
          if (widget.onBack != null) {
            widget.onBack!();
          } else if (Navigator.canPop(context)) {
            Navigator.pop(context);
          }
        },
      ),
      title: Text(
        title,
        style: AppTypography.headingSmall
            .copyWith(color: AppColors.of(context).onSurface),
      ),
    );
  }

  Widget _buildElectronicSignaturePlaceholder(
      BuildContext context, String name) {
    final l10n = AppLocalizations.of(context);
    return Row(
      children: [
        const Icon(Icons.edit_rounded, color: AppColors.primary, size: 16),
        const SizedBox(width: 8),
        Flexible(
          child: Text(
            '$name ${l10n?.txtelectronicSignature ?? "(Electronic Signature)"}',
            style: AppTypography.bodySmall.copyWith(
                fontStyle: FontStyle.italic,
                color: AppColors.of(context).onSurfaceVariant),
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ],
    );
  }

  String? _getPhotoUrl(RiderModel? rider, bool isGuarantor) {
    if (rider == null) return null;
    final url = isGuarantor ? rider.guarantorPhoto : rider.profilePhoto;
    return (url != null && url.isNotEmpty) ? url : null;
  }
}
