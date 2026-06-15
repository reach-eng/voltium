import 'dart:io';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:path_provider/path_provider.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';
import 'package:http/http.dart' as http;

import 'package:voltium_rider/models/rider_model.dart';
import 'package:voltium_rider/providers/app_provider.dart';

// ─── Branding ────────────────────────────────────────────────────────────────
const _kBrandFull = 'Voltium Electric Mobility Private Limited';
const _kBrandShort = 'Voltium';
const _kSupportEmail = 'support@voltium.app';
const _kSupportPhone = '+91 1800-889-VOLT';

// ─── Document Sections ───────────────────────────────────────────────────────

class _LegalSection {
  final String id;
  final String title;
  final String content;
  const _LegalSection(
      {required this.id, required this.title, required this.content});
}

const _sections = <_LegalSection>[
  _LegalSection(
    id: 'terms',
    title: 'Terms of Service',
    content: '''$_kBrandFull ("Company", "we", "us", or "our") operates the $_kBrandShort electric vehicle rental platform. By accessing or using our services, you agree to be bound by these Terms of Service.

1. SERVICE DESCRIPTION: $_kBrandShort provides electric vehicle rental services to registered riders. All vehicles remain the property of $_kBrandShort and are provided on a rental basis only.

2. ELIGIBILITY: You must be at least 18 years of age, hold a valid driving license, and have completed KYC verification to use our services.

3. RENTAL PERIOD: Rentals are offered on weekly, bi-weekly, and monthly plans. The rental period begins at vehicle pickup and ends upon return inspection.

4. USER RESPONSIBILITIES: Riders are responsible for the vehicle's safety, daily maintenance, and adherence to traffic regulations. Any damage caused by negligence will be charged to the rider.

5. PAYMENT: All payments must be made through the $_kBrandShort platform. Security deposits are refundable subject to vehicle condition at return.

6. TERMINATION: $_kBrandShort reserves the right to terminate rental agreements for violation of terms, non-payment, or misuse of vehicles.

7. LIABILITY: $_kBrandShort's liability is limited to the rental value of the vehicle. We are not liable for indirect, incidental, or consequential damages.

8. GOVERNING LAW: These terms are governed by the laws of India. Any disputes shall be subject to the jurisdiction of courts in New Delhi.''',
  ),
  _LegalSection(
    id: 'privacy',
    title: 'Privacy Policy',
    content: '''$_kBrandShort is committed to protecting your privacy. This policy explains how we collect, use, and safeguard your personal information.

1. INFORMATION WE COLLECT: We collect personal identification information (name, phone, email, address, date of birth), government-issued IDs (Aadhaar, PAN), driving license details, bank account information for refunds, vehicle usage data, and GPS location data.

2. HOW WE USE YOUR DATA: Your data is used for identity verification and KYC compliance, rental agreement management, payment processing, customer support, safety and emergency services, and service improvement.

3. DATA SHARING: We may share your data with government authorities as required by law, our guarantor verification partners, payment processing banks, and insurance providers for claim processing.

4. DATA SECURITY: We implement industry-standard encryption, secure servers, and regular security audits. GPS data is encrypted and accessible only to authorized safety personnel.

5. DATA RETENTION: We retain your data for the duration of your account plus 7 years as required by Indian financial regulations.

6. YOUR RIGHTS: You have the right to access, correct, and delete your personal data. Requests can be submitted through the app or by contacting support.

7. COOKIES: We use essential cookies for app functionality and analytics cookies to improve our services. You can manage cookie preferences in app settings.''',
  ),
  _LegalSection(
    id: 'refund',
    title: 'Refund Policy',
    content: '''$_kBrandShort maintains a transparent and fair refund policy:

1. SECURITY DEPOSIT: Fully refundable upon vehicle return in good condition. Processing time is 7-10 business days. Deductions may apply for vehicle damage, missing accessories, or outstanding dues.

2. PLAN CANCELLATION: If you cancel within 24 hours of plan activation, a full refund is issued. After 24 hours, no refund is available for the current billing period.

3. WALLET TOP-UP: Wallet balances are non-refundable but can be used for future transactions, plan renewals, or transferred to another $_kBrandShort rider.

4. PROMOTIONAL CREDITS: Reward credits and promotional amounts are non-refundable and have validity periods as specified at the time of issuance.

5. DISPUTE RESOLUTION: For refund disputes, contact support within 30 days of the transaction. Provide transaction ID and reason for dispute. Our team will investigate and respond within 5 business days.

6. FORCE MAJEURE: In case of service disruptions due to natural disasters, government orders, or other force majeure events, refunds will be processed on a pro-rata basis.

7. REFUND METHOD: All refunds are processed to the original payment method. Bank account refunds may take 7-10 business days to reflect.''',
  ),
  _LegalSection(
    id: 'guarantor',
    title: "Guarantor's Agreement",
    content: '''1. AGREEMENT: This Guarantor's Agreement ("Agreement") is made between $_kBrandFull and the individual designated as the Guarantor for the Rider.

1. GUARANTEE: The Guarantor unconditionally and irrevocably guarantees the due and punctual payment of all rental fees, penalties, and damage costs incurred by the Rider.

2. LIABILITY: The Guarantor's liability is co-extensive with that of the Rider. In case of default by the Rider, the Company may proceed directly against the Guarantor without first exhausting remedies against the Rider.

3. VALIDITY: This guarantee remains valid for the entire duration of the Rider's association with $_kBrandShort and until all dues are cleared and the vehicle is returned in satisfactory condition.

4. DOCUMENTATION: The Guarantor agrees to provide valid identity proof, address proof, and a verification video as part of the onboarding process.

5. NOTIFICATIONS: The Guarantor consents to receive communications from $_kBrandShort regarding the Rider's account status, payments, and emergency situations.

6. INDEMNITY: The Guarantor agrees to indemnify $_kBrandShort against any losses, damages, or legal costs arising from the Rider's misuse of the vehicle or breach of contract.''',
  ),
];

// =============================================================================
// LegalPageScreen – Document viewer with signatures & PDF download
// =============================================================================

class LegalPageScreen extends StatefulWidget {
  const LegalPageScreen({super.key});

  @override
  State<LegalPageScreen> createState() => _LegalPageScreenState();
}

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

  String get _currentDate =>
      DateFormat('dd MMMM yyyy').format(DateTime.now());

  // ── PDF Generation ─────────────────────────────────────────────────────────

  Future<void> _downloadSignedPdf(
      _LegalSection section, RiderModel? rider) async {
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
      final file = File(
          '${dir.path}/${sanitizedTitle}_$signerName.pdf');
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
            backgroundColor: const Color(0xFFDC2626),
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
      backgroundColor: const Color(0xFFF1F5F9),
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
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.03),
                    blurRadius: 24,
                    offset: const Offset(0, 12),
                  ),
                ],
              ),
              clipBehavior: Clip.antiAlias,
              child: Column(
                children: List.generate(_sections.length, (index) {
                  final section = _sections[index];
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
                                horizontal: 20, vertical: 18),
                            child: Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    section.title,
                                    style: const TextStyle(
                                      fontSize: 14,
                                      fontWeight: FontWeight.w800,
                                      color: Color(0xFF1E293B),
                                    ),
                                  ),
                                ),
                                AnimatedRotation(
                                  turns: isExpanded ? 0.5 : 0.0,
                                  duration: const Duration(milliseconds: 250),
                                  child: const Icon(
                                    Icons.keyboard_arrow_down_rounded,
                                    color: Color(0xFF94A3B8),
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
                                    style: const TextStyle(
                                      fontSize: 12,
                                      color: Color(0xFF64748B),
                                      height: 1.7,
                                    ),
                                  ),
                                ),
                              ),

                              const SizedBox(height: 20),

                              // ── Divider ──
                              Container(
                                height: 1,
                                color: const Color(0xFFF1F5F9),
                              ),

                              const SizedBox(height: 20),

                              // ── Signed-by card ──
                              Container(
                                padding: const EdgeInsets.all(14),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFF8FAFC),
                                  borderRadius: BorderRadius.circular(16),
                                ),
                                child: Row(
                                  children: [
                                    // Avatar
                                    Container(
                                      width: 40,
                                      height: 40,
                                      decoration: const BoxDecoration(
                                        color: Color(0xFF0053C1),
                                        shape: BoxShape.circle,
                                      ),
                                      alignment: Alignment.center,
                                      child: Text(
                                        signerName.isNotEmpty
                                            ? signerName[0].toUpperCase()
                                            : '?',
                                        style: const TextStyle(
                                          color: Colors.white,
                                          fontSize: 16,
                                          fontWeight: FontWeight.w800,
                                        ),
                                      ),
                                    ),
                                    const SizedBox(width: 12),
                                    // Info
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          const Text(
                                            'SIGNED BY',
                                            style: TextStyle(
                                              fontSize: 9,
                                              fontWeight: FontWeight.w900,
                                              color: Color(0xFF94A3B8),
                                              letterSpacing: 1.2,
                                            ),
                                          ),
                                          const SizedBox(height: 2),
                                          Text(
                                            signerName,
                                            style: const TextStyle(
                                              fontSize: 13,
                                              fontWeight: FontWeight.w800,
                                              color: Color(0xFF1E293B),
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
                                        const Text(
                                          'DATE',
                                          style: TextStyle(
                                            fontSize: 9,
                                            fontWeight: FontWeight.w900,
                                            color: Color(0xFF94A3B8),
                                            letterSpacing: 1.2,
                                          ),
                                        ),
                                        const SizedBox(height: 2),
                                        Text(
                                          _currentDate,
                                          style: const TextStyle(
                                            fontSize: 13,
                                            fontWeight: FontWeight.w800,
                                            color: Color(0xFF1E293B),
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
                                    horizontal: 16, vertical: 14),
                                decoration: BoxDecoration(
                                  color: Colors.white,
                                  borderRadius: BorderRadius.circular(16),
                                  border: Border.all(
                                    color: const Color(0xFFCBD5E1),
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
                                          ? Image.network(
                                              signatureUrl,
                                              height: 40,
                                              fit: BoxFit.contain,
                                              alignment: Alignment.centerLeft,
                                              errorBuilder: (_, __, ___) =>
                                                  _buildElectronicSignaturePlaceholder(
                                                      signerName),
                                            )
                                          : _buildElectronicSignaturePlaceholder(
                                              signerName),
                                    ),
                                    // Photo thumbnail
                                    if (_getPhotoUrl(rider, isGuarantor) !=
                                        null)
                                      Container(
                                        width: 48,
                                        height: 48,
                                        margin:
                                            const EdgeInsets.only(left: 12),
                                        decoration: BoxDecoration(
                                          borderRadius:
                                              BorderRadius.circular(12),
                                          border: Border.all(
                                              color: const Color(0xFFF1F5F9)),
                                          boxShadow: [
                                            BoxShadow(
                                              color: Colors.black
                                                  .withOpacity(0.05),
                                              blurRadius: 4,
                                            ),
                                          ],
                                        ),
                                        clipBehavior: Clip.antiAlias,
                                        child: Image.network(
                                          _getPhotoUrl(rider, isGuarantor)!,
                                          fit: BoxFit.cover,
                                          cacheWidth: 96,
                                          cacheHeight: 96,
                                          errorBuilder: (_, __, ___) =>
                                              const Icon(Icons.person,
                                                  color: Color(0xFF94A3B8),
                                                  size: 20),
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
                                  key: Key(
                                      'download_pdf_${section.id}'),
                                  onPressed: _isGeneratingPdf
                                      ? null
                                      : () => _downloadSignedPdf(
                                          section, rider),
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor:
                                        const Color(0xFF0053C1),
                                    foregroundColor: Colors.white,
                                    elevation: 4,
                                    shadowColor: const Color(0xFF0053C1)
                                        .withOpacity(0.25),
                                    shape: RoundedRectangleBorder(
                                      borderRadius:
                                          BorderRadius.circular(14),
                                    ),
                                  ),
                                  icon: _isGeneratingPdf
                                      ? const SizedBox(
                                          width: 16,
                                          height: 16,
                                          child:
                                              CircularProgressIndicator(
                                            strokeWidth: 2,
                                            color: Colors.white,
                                          ),
                                        )
                                      : const Icon(Icons.download_rounded,
                                          size: 18),
                                  label: Text(
                                    _isGeneratingPdf
                                        ? 'Generating…'
                                        : 'Download Signed PDF',
                                    style: const TextStyle(
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
                      if (index < _sections.length - 1)
                        Container(
                          height: 1,
                          color: const Color(0xFFF1F5F9),
                        ),
                    ],
                  );
                }),
              ),
            ),

            const SizedBox(height: 20),

            // ── Need Help? card ──
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: const Color(0xFFF1F5F9),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'NEED HELP?',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w900,
                      color: Color(0xFF64748B),
                      letterSpacing: 1.2,
                    ),
                  ),
                  const SizedBox(height: 8),
                  RichText(
                    text: const TextSpan(
                      style: TextStyle(
                        fontSize: 12,
                        color: Color(0xFF64748B),
                        height: 1.5,
                      ),
                      children: [
                        TextSpan(
                            text:
                                'If you have any questions about our policies, please contact our support team at '),
                        TextSpan(
                          text: _kSupportEmail,
                          style: TextStyle(
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF0053C1),
                          ),
                        ),
                        TextSpan(text: ' or call '),
                        TextSpan(
                          text: _kSupportPhone,
                          style: TextStyle(
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF0053C1),
                          ),
                        ),
                        TextSpan(text: '.'),
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
    return AppBar(
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
                  offset: const Offset(0, 4),
                ),
              ],
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
                child: const Icon(Icons.arrow_back,
                    color: Color(0xFF1E293B), size: 20),
              ),
            ),
          ),
        ),
      ),
      title: const Text(
        'Legal',
        style: TextStyle(
          fontSize: 22,
          fontWeight: FontWeight.bold,
          color: Color(0xFF1E293B),
        ),
      ),
    );
  }

  Widget _buildElectronicSignaturePlaceholder(String name) {
    return Row(
      children: [
        const Icon(Icons.edit_rounded, color: Color(0xFF0053C1), size: 16),
        const SizedBox(width: 8),
        Flexible(
          child: Text(
            '$name (Electronic Signature)',
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w500,
              fontStyle: FontStyle.italic,
              color: Color(0xFF94A3B8),
            ),
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
