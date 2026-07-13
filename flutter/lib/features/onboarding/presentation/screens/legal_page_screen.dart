import 'package:universal_io/io.dart';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import 'package:path_provider/path_provider.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';
import 'package:http/http.dart' as http;
import 'package:cached_network_image/cached_network_image.dart';

import 'package:voltium_rider/models/rider_model.dart';
import 'package:voltium_rider/core/state/app_provider.dart';
import '../../../../theme/app_theme.dart';
import 'package:voltium_rider/theme/app_typography.dart';

part 'legal_page_content.dart';

// ─── Branding ────────────────────────────────────────────────────────────────
const _kBrandFull = 'Voltium Electric Mobility Private Limited';
const _kBrandShort = 'Voltium';
const _kSupportEmail = 'support@voltium.app';
const _kSupportPhone = '+91 1800-889-VOLT';

// ─── Document Sections ───────────────────────────────────────────────────────

// =============================================================================
// LegalPageScreen – Document viewer with signatures & PDF download
// =============================================================================

class LegalPageScreen extends StatefulWidget {
  /// Optional type filter. When null, shows every document.
  /// When set, shows only the matching section (terms-only = ['terms'], etc.).
  final LegalDocumentType? documentType;

  const LegalPageScreen({super.key, this.documentType});

  @override
  State<LegalPageScreen> createState() => _LegalPageScreenState();
}

/// Filters which legal documents are shown on the page.
/// `null` (or [all]) shows everything; a specific value shows only that doc.
enum LegalDocumentType { all, terms, privacy, refund, guarantor }

class _LegalPageScreenState extends State<LegalPageScreen>
    with TickerProviderStateMixin {
  final Set<int> _expandedIndices = {};
  bool _isGeneratingPdf = false;

  late final AnimationController _entryCtrl;

  @override
  void initState() {
    super.initState();
    _entryCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    )..forward();
  }

  @override
  void dispose() {
    _entryCtrl.dispose();
    super.dispose();
  }

  String get _currentDate => DateFormat('dd MMMM yyyy').format(DateTime.now());

  /// Sections the screen should show, based on the constructor filter.
  List<_LegalSection> get _visibleSections {
    final type = widget.documentType;
    if (type == null || type == LegalDocumentType.all) return _sections;
    return _sections.where((s) {
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
  }

  // ── PDF Generation ─────────────────────────────────────────────────────────

  Future<void> _downloadSignedPdf(
    _LegalSection section,
    RiderModel? rider,
  ) async {
    if (_isGeneratingPdf) return;
    setState(() => _isGeneratingPdf = true);

    try {
      final isGuarantor = section.id == 'guarantor';
      final signerName = isGuarantor
          ? (rider?.guarantorName ?? 'Guarantor')
          : (rider?.name.isNotEmpty == true ? rider!.name : 'Rider');

      final signatureUrl =
          isGuarantor ? rider?.guarantorSignature : rider?.signature;

      // Try to fetch signature image bytes
      Uint8List? sigBytes;
      if (signatureUrl != null && signatureUrl.isNotEmpty) {
        try {
          final response = await http.get(Uri.parse(signatureUrl));
          if (response.statusCode == 200) {
            sigBytes = response.bodyBytes;
          }
        } catch (_) {
          // signature image unavailable – will use text fallback
        }
      }

      final pdf = pw.Document();

      pdf.addPage(
        pw.MultiPage(
          pageFormat: PdfPageFormat.a4,
          margin: const pw.EdgeInsets.all(40),
          header: (context) => pw.Column(
            children: [
              pw.Row(
                mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                children: [
                  pw.Text(
                    _kBrandFull.toUpperCase(),
                    style: pw.TextStyle(
                      fontSize: 14,
                      fontWeight: pw.FontWeight.bold,
                      color: PdfColor.fromHex('#0053C1'),
                      letterSpacing: 2,
                    ),
                  ),
                  pw.Text(
                    _currentDate,
                    style: pw.TextStyle(
                      fontSize: 9,
                      color: PdfColor.fromHex('#64748B'),
                    ),
                  ),
                ],
              ),
              pw.SizedBox(height: 6),
              pw.Divider(
                color: PdfColor.fromHex('#0053C1'),
                thickness: 2,
              ),
              pw.SizedBox(height: 20),
              pw.Text(
                section.title.toUpperCase(),
                style: pw.TextStyle(
                  fontSize: 18,
                  fontWeight: pw.FontWeight.bold,
                  letterSpacing: 1,
                ),
              ),
              pw.SizedBox(height: 20),
            ],
          ),
          footer: (context) => pw.Column(
            children: [
              pw.Divider(color: PdfColor.fromHex('#E2E8F0')),
              pw.SizedBox(height: 12),
              pw.Row(
                mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                children: [
                  // Left: signer
                  pw.Column(
                    crossAxisAlignment: pw.CrossAxisAlignment.start,
                    children: [
                      pw.Text(
                        'ACCEPTED & SIGNED BY',
                        style: pw.TextStyle(
                          fontSize: 7,
                          fontWeight: pw.FontWeight.bold,
                          color: PdfColor.fromHex('#64748B'),
                          letterSpacing: 1,
                        ),
                      ),
                      pw.SizedBox(height: 6),
                      if (sigBytes != null)
                        pw.Image(
                          pw.MemoryImage(sigBytes),
                          height: 40,
                          fit: pw.BoxFit.contain,
                        )
                      else
                        pw.Container(
                          height: 40,
                          width: 150,
                          decoration: pw.BoxDecoration(
                            border: pw.Border(
                              bottom: pw.BorderSide(
                                color: PdfColor.fromHex('#CBD5E1'),
                              ),
                            ),
                          ),
                          alignment: pw.Alignment.bottomLeft,
                          child: pw.Text(
                            signerName,
                            style: pw.TextStyle(
                              fontSize: 14,
                              fontStyle: pw.FontStyle.italic,
                              color: PdfColor.fromHex('#475569'),
                            ),
                          ),
                        ),
                      pw.SizedBox(height: 4),
                      pw.Text(
                        signerName,
                        style: pw.TextStyle(
                          fontSize: 10,
                          fontWeight: pw.FontWeight.bold,
                        ),
                      ),
                      pw.Text(
                        _currentDate,
                        style: pw.TextStyle(
                          fontSize: 8,
                          color: PdfColor.fromHex('#64748B'),
                        ),
                      ),
                    ],
                  ),
                  // Right: company
                  pw.Column(
                    crossAxisAlignment: pw.CrossAxisAlignment.end,
                    children: [
                      pw.Text(
                        'FOR $_kBrandFull'.toUpperCase(),
                        style: pw.TextStyle(
                          fontSize: 7,
                          fontWeight: pw.FontWeight.bold,
                          color: PdfColor.fromHex('#64748B'),
                          letterSpacing: 1,
                        ),
                      ),
                      pw.SizedBox(height: 6),
                      pw.Container(
                        height: 40,
                        width: 150,
                        decoration: pw.BoxDecoration(
                          border: pw.Border(
                            bottom: pw.BorderSide(
                              color: PdfColor.fromHex('#CBD5E1'),
                            ),
                          ),
                        ),
                      ),
                      pw.SizedBox(height: 4),
                      pw.Text(
                        'Authorized Signatory',
                        style: pw.TextStyle(
                          fontSize: 10,
                          fontWeight: pw.FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ],
          ),
          build: (context) => [
            pw.Text(
              section.content,
              style: const pw.TextStyle(
                fontSize: 11,
                lineSpacing: 4,
              ),
            ),
          ],
        ),
      );

      final bytes = await pdf.save();
      final dir = await getTemporaryDirectory();
      final sanitizedTitle =
          section.title.replaceAll(RegExp(r"[^a-zA-Z0-9]"), '_');
      final file = File('${dir.path}/${sanitizedTitle}_$signerName.pdf');
      await file.writeAsBytes(bytes);

      await SharePlus.instance.share(
        ShareParams(
          files: [XFile(file.path)],
          title: '${section.title} — $_kBrandShort',
        ),
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Could not generate PDF: $e'),
            backgroundColor: AppColors.errorRed,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isGeneratingPdf = false);
    }
  }

  // ── Build ──────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final rider = context.watch<AppProvider>().rider;

    return Scaffold(
      backgroundColor: AppColors.surface,
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
                borderRadius: BorderRadius.circular(20),
                boxShadow: AppShadows.card,
              ),
              clipBehavior: Clip.antiAlias,
              child: ListView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: _visibleSections.length,
                itemBuilder: (context, index) {
                  final section = _visibleSections[index];
                  final isExpanded = _expandedIndices.contains(index);
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
                          onTap: () => setState(() {
                            if (isExpanded) {
                              _expandedIndices.remove(index);
                            } else {
                              _expandedIndices.add(index);
                            }
                          }),
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
                                    style: AppTypography.bodyMediumStrong
                                        .copyWith(color: AppColors.slate800),
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
                                      color: AppColors.slate500,
                                      height: 1.7,
                                    ),
                                  ),
                                ),
                              ),

                              const SizedBox(height: 20),

                              // ── Divider ──
                              Container(
                                height: 1,
                                color: AppColors.iconBackground,
                              ),

                              const SizedBox(height: 20),

                              // ── Signed-by card ──
                              Container(
                                padding: const EdgeInsets.all(14),
                                decoration: BoxDecoration(
                                  color: AppColors.surfaceBright,
                                  borderRadius: BorderRadius.circular(16),
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
                                            'SIGNED BY',
                                            style: AppTypography
                                                .bodySmallTracked
                                                .copyWith(
                                                    color: AppColors.slate400,
                                                    letterSpacing: 1.2),
                                          ),
                                          SizedBox(height: 2),
                                          Text(
                                            signerName,
                                            style: GoogleFonts.plusJakartaSans(
                                              fontSize: 13,
                                              fontWeight: FontWeight.w800,
                                              color: AppColors.slate800,
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
                                          'DATE',
                                          style: AppTypography.bodySmallTracked
                                              .copyWith(
                                                  color: AppColors.slate400,
                                                  letterSpacing: 1.2),
                                        ),
                                        SizedBox(height: 2),
                                        Text(
                                          _currentDate,
                                          style: GoogleFonts.plusJakartaSans(
                                            fontSize: 13,
                                            fontWeight: FontWeight.w800,
                                            color: AppColors.slate800,
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
                                  color: Colors.white,
                                  borderRadius: BorderRadius.circular(16),
                                  border: Border.all(
                                    color: AppColors.borderMedium,
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
                                          borderRadius:
                                              BorderRadius.circular(12),
                                          border: Border.all(
                                            color: AppColors.iconBackground,
                                          ),
                                          boxShadow: AppShadows.glass,
                                        ),
                                        clipBehavior: Clip.antiAlias,
                                        child: CachedNetworkImage(
                                          imageUrl:
                                              _getPhotoUrl(rider, isGuarantor)!,
                                          fit: BoxFit.cover,
                                          memCacheWidth: 96,
                                          memCacheHeight: 96,
                                          errorWidget: (_, __, ___) =>
                                              const Icon(
                                            Icons.person,
                                            color: AppColors.slate400,
                                            size: 20,
                                          ),
                                        ),
                                      ),
                                  ],
                                ),
                              ),

                              const SizedBox(height: 16),

                              // ── Download button ──
                              SizedBox(
                                width: double.infinity,
                                height: 48,
                                child: ElevatedButton.icon(
                                  key: Key('download_pdf_${section.id}'),
                                  onPressed: _isGeneratingPdf
                                      ? null
                                      : () =>
                                          _downloadSignedPdf(section, rider),
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: AppColors.primary,
                                    foregroundColor: Colors.white,
                                    elevation: 4,
                                    shadowColor: AppColors.primary
                                        .withValues(alpha: 0.25),
                                    shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(14),
                                    ),
                                  ),
                                  icon: _isGeneratingPdf
                                      ? const SizedBox(
                                          width: 16,
                                          height: 16,
                                          child: CircularProgressIndicator(
                                            strokeWidth: 2,
                                            color: Colors.white,
                                          ),
                                        )
                                      : const Icon(
                                          Icons.download_rounded,
                                          size: 18,
                                        ),
                                  label: Text(
                                    _isGeneratingPdf
                                        ? 'Generating…'
                                        : 'Download Signed PDF',
                                    style: GoogleFonts.plusJakartaSans(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w800,
                                    ),
                                  ),
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
                          color: AppColors.iconBackground,
                        ),
                    ],
                  );
                },
              ),
            ),

            const SizedBox(height: 20),

            // ── Need Help? card ──
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.iconBackground,
                borderRadius: BorderRadius.circular(16),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'NEED HELP?',
                    style: AppTypography.bodySmallTracked.copyWith(
                        color: AppColors.slate500, letterSpacing: 1.2),
                  ),
                  SizedBox(height: 8),
                  RichText(
                    text: TextSpan(
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 12,
                        color: AppColors.slate500,
                        height: 1.5,
                      ),
                      children: [
                        const TextSpan(
                          text:
                              'If you have any questions about our policies, please contact our support team at ',
                        ),
                        TextSpan(
                          text: _kSupportEmail,
                          style: GoogleFonts.plusJakartaSans(
                            fontWeight: FontWeight.w700,
                            color: AppColors.primary,
                          ),
                        ),
                        const TextSpan(text: ' or call '),
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
    String title;
    if (type == null || type == LegalDocumentType.all) {
      title = 'Legal';
    } else {
      switch (type) {
        case LegalDocumentType.terms:
          title = 'Terms of Service';
          break;
        case LegalDocumentType.privacy:
          title = 'Privacy Policy';
          break;
        case LegalDocumentType.refund:
          title = 'Refund Policy';
          break;
        case LegalDocumentType.guarantor:
          title = "Guarantor's Agreement";
          break;
        case LegalDocumentType.all:
          title = 'Legal';
          break;
      }
    }
    return AppBar(
      backgroundColor: AppColors.surface,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      leadingWidth: 68,
      leading: Padding(
        padding: const EdgeInsets.only(left: 20.0),
        child: UnconstrainedBox(
          child: Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: Colors.white,
              shape: BoxShape.circle,
              boxShadow: AppShadows.card,
            ),
            child: Material(
              color: Colors.transparent,
              child: InkWell(
                borderRadius: BorderRadius.circular(9999),
                onTap: () {
                  if (Navigator.canPop(context)) {
                    Navigator.pop(context);
                  }
                },
                child: const Icon(
                  Icons.arrow_back,
                  color: AppColors.slate800,
                  size: 20,
                ),
              ),
            ),
          ),
        ),
      ),
      title: Text(
        title,
        style: AppTypography.headingSmall.copyWith(color: AppColors.slate800),
      ),
    );
  }

  Widget _buildElectronicSignaturePlaceholder(String name) {
    return Row(
      children: [
        const Icon(Icons.edit_rounded, color: AppColors.primary, size: 16),
        SizedBox(width: 8),
        Flexible(
          child: Text(
            '$name (Electronic Signature)',
            style: AppTypography.bodySmall.copyWith(
                fontStyle: FontStyle.italic, color: AppColors.slate400),
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
