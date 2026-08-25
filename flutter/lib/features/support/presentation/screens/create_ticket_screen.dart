import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:universal_io/io.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import '../../../../theme/app_theme.dart';
import 'package:voltium_rider/features/support/presentation/screens/support_checklist_screen.dart';
import 'package:voltium_rider/core/observability/posthog_service.dart';
import 'package:voltium_rider/widgets/image_source_sheet.dart';
import 'package:voltium_rider/utils/app_constants.dart';
import 'package:voltium_rider/utils/app_logger.dart';
import 'package:voltium_rider/utils/toast.dart';

import 'package:voltium_rider/core/network/file_category.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/theme/app_typography.dart';

class CreateTicketScreen extends ConsumerStatefulWidget {
  const CreateTicketScreen({super.key});

  @override
  ConsumerState<CreateTicketScreen> createState() => _CreateTicketScreenState();
}

class _CreateTicketScreenState extends ConsumerState<CreateTicketScreen> {
  final _formKey = GlobalKey<FormState>();
  String _selectedCategory = 'TECHNICAL';
  final _subjectController = TextEditingController();
  final _messageController = TextEditingController();
  bool _isLoading = false;
  final ImagePicker _picker = ImagePicker();
  // CONSOLIDATED-FIX-2026-08-16 §4.13: up to 3 attachment photos so the
  // rider can show multiple angles of the damage / issue.
  static const int _maxAttachments = 3;
  static const int _subjectMaxLength = 120;
  static const int _messageMaxLength = 4000;
  final List<File> _attachmentFiles = [];

  /// AUDIT FIX: URLs for files that already uploaded successfully. A retry
  /// after a partial failure skips these instead of re-uploading everything.
  final Map<int, String> _uploadedUrlByIndex = {};

  final List<String> _categories = [
    'TECHNICAL',
    'PAYMENT',
    'VEHICLE',
    'GENERAL',
  ];

  @override
  void dispose() {
    _subjectController.dispose();
    _messageController.dispose();
    super.dispose();
  }

  Future<void> _pickAttachment(ImageSource source) async {
    if (AppConstants.isTestMode) {
      // AUDIT FIX: this branch runs AFTER awaiting the source bottom sheet,
      // so guard setState against an unmounted widget.
      if (!mounted) return;
      final image =
          File('${Directory.systemTemp.path}/mock_ticket_attachment.png');
      setState(() {
        if (_attachmentFiles.length < _maxAttachments) {
          _attachmentFiles.add(image);
          _uploadedUrlByIndex.remove(_attachmentFiles.length - 1);
        }
      });
      return;
    }
    if (_attachmentFiles.length >= _maxAttachments) return;
    final picked = await _picker.pickImage(
      source: source,
      imageQuality: 85,
      maxWidth: 1600,
      maxHeight: 1600,
      requestFullMetadata: false,
    );
    if (picked == null || !mounted) return;
    setState(() => _attachmentFiles.add(File(picked.path)));
  }

  void _removeAttachment(int index) {
    setState(() {
      _attachmentFiles.removeAt(index);
      // Re-key the uploaded-URL ledger to the new indices.
      final rebuilt = <int, String>{};
      _uploadedUrlByIndex.forEach((k, v) {
        if (k == index) return; // removed slot's URL is dropped
        final newKey = k > index ? k - 1 : k;
        rebuilt[newKey] = v;
      });
      _uploadedUrlByIndex
        ..clear()
        ..addAll(rebuilt);
    });
  }

  String _prettyCategory(String value) =>
      value.substring(0, 1) + value.substring(1).toLowerCase();

  Future<void> _showAttachmentSourceSheet() async {
    if (_attachmentFiles.length >= _maxAttachments) {
      Toast.warning(
        context,
        AppLocalizations.of(context)!
            .txtupToNPhotosPerTicket(_maxAttachments.toString()),
      );
      return;
    }
    final source = await ImageSourceBottomSheet.show(context: context);
    if (source != null) await _pickAttachment(source);
  }

  Future<void> _submitTicket() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isLoading = true);

    try {
      // SUPPORT P0-4: upload each attachment and pass the comma-separated
      // URLs to the server. Mirrors the KYC upload pattern (the files
      // endpoint is idempotent on duplicate uploads).
      //
      // AUDIT FIX: per-file results — one failed upload no longer discards
      // the already-uploaded URLs; retry skips completed slots.
      final repo = ref.read(filesRepositoryProvider);
      final uploadedUrls = List<String>.filled(_attachmentFiles.length, '');
      for (var i = 0; i < _attachmentFiles.length; i++) {
        final cached = _uploadedUrlByIndex[i];
        if (cached != null && cached.isNotEmpty) {
          uploadedUrls[i] = cached;
          continue;
        }
        try {
          final url = await repo.uploadFile(
              _attachmentFiles[i], FileCategory.supportAttachment);
          uploadedUrls[i] = url;
          if (url.isNotEmpty) _uploadedUrlByIndex[i] = url;
        } catch (e) {
          appDebug('Attachment $i upload failed: $e', tag: 'SUPPORT');
          rethrow;
        }
      }
      final attachmentsCsv = uploadedUrls.where((u) => u.isNotEmpty).join(',');
      await ref.read(supportProvider.notifier).createTicket(
            category: _selectedCategory,
            subject: _subjectController.text.trim(),
            message: _messageController.text.trim(),
            riderId: ref.read(riderProvider).riderId,
            attachments: attachmentsCsv.isEmpty ? null : attachmentsCsv,
          );
      PostHogService.capture('ticket_created', properties: {
        'category': _selectedCategory,
        'attachment_count': _attachmentFiles.length,
      });

      if (mounted) {
        // AUDIT FIX: capture the localized success string BEFORE popping —
        // after nav.pop() the old context is defunct.
        final successMessage =
            AppLocalizations.of(context)!.txtticketCreatedSuccessfully;
        // Capture navigator before pop so we can push after
        final nav = Navigator.of(context);
        nav.pop();
        Toast.success(context, successMessage);
        // Show checklist after ticket creation
        WidgetsBinding.instance.addPostFrameCallback((_) {
          nav.push(MaterialPageRoute(
            builder: (_) => const SupportChecklistScreen(),
          ));
        });
      }
    } catch (e) {
      appDebug('Ticket submission failed: $e', tag: 'SUPPORT');
      if (mounted) {
        // AUDIT FIX: don't leak raw exception text into the toast.
        Toast.error(
          context,
          AppLocalizations.of(context)!.txtfailedToCreateTicket(
              'please check your connection and retry'),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Scaffold(
      backgroundColor: colors.surface,
      appBar: AppBar(
        backgroundColor: colors.surface,
        surfaceTintColor: Colors.transparent,
        leading: IconButton(
          icon: Icon(Icons.arrow_back, color: colors.onSurface),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          'Create Ticket',
          style: GoogleFonts.plusJakartaSans(
            color: colors.onSurface,
            fontWeight: FontWeight.bold,
          ),
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24.0),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'How can we help you?',
                  style: AppTypography.headingMedium
                      .copyWith(color: colors.onSurface),
                ),
                const SizedBox(height: 8),
                Text(
                  'Please fill out the form below to create a support ticket.',
                  style: GoogleFonts.plusJakartaSans(
                    color: colors.onSurfaceVariant,
                    fontSize: 14,
                  ),
                ),
                const SizedBox(height: 32),

                // Category Dropdown
                Text(
                  'Category',
                  style: GoogleFonts.plusJakartaSans(
                    color: colors.onSurface,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  decoration: BoxDecoration(
                    color: colors.card,
                    borderRadius: BorderRadius.circular(AppRadius.md),
                    border: Border.all(color: colors.outlineVariant),
                  ),
                  child: DropdownButtonHideUnderline(
                    child: DropdownButton<String>(
                      value: _selectedCategory,
                      isExpanded: true,
                      dropdownColor: colors.card,
                      icon: Icon(Icons.keyboard_arrow_down,
                          color: colors.onSurfaceVariant),
                      style:
                          GoogleFonts.plusJakartaSans(color: colors.onSurface),
                      onChanged: (String? newValue) {
                        if (newValue != null) {
                          setState(() => _selectedCategory = newValue);
                        }
                      },
                      items: _categories
                          .map<DropdownMenuItem<String>>((String value) {
                        return DropdownMenuItem<String>(
                          value: value,
                          child: Text(_prettyCategory(value)),
                        );
                      }).toList(),
                    ),
                  ),
                ),
                const SizedBox(height: 24),

                // Subject TextField
                Text(
                  AppLocalizations.of(context)?.txtsubject ?? 'Subject',
                  style: GoogleFonts.plusJakartaSans(
                    color: colors.onSurface,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 8),
                TextFormField(
                  controller: _subjectController,
                  style: GoogleFonts.plusJakartaSans(color: colors.onSurface),
                  // AUDIT FIX: cap unbounded paste before it ships to the API.
                  maxLength: _subjectMaxLength,
                  buildCounter: (_,
                          {required currentLength,
                          required isFocused,
                          maxLength}) =>
                      null, // counter hidden; limit still enforced
                  decoration: InputDecoration(
                    hintText: 'Brief summary of the issue',
                    hintStyle: GoogleFonts.plusJakartaSans(
                        color: colors.onSurfaceMuted),
                    filled: true,
                    fillColor: colors.iconBackground,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(AppRadius.lg),
                      borderSide: BorderSide.none,
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(AppRadius.lg),
                      borderSide: BorderSide.none,
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(AppRadius.lg),
                      borderSide:
                          const BorderSide(color: AppColors.primary, width: 2),
                    ),
                    contentPadding: Spacing.paddingMd,
                  ),
                  validator: (value) {
                    // T-114: validator messages go through l10n with an
                    // English fallback. The screen was previously
                    // hardcoded English; a Hindi rider saw "Please
                    // enter a subject" in English while the rest of
                    // the screen was translated.
                    final l10n = AppLocalizations.of(context);
                    if (value == null || value.trim().isEmpty) {
                      return l10n?.txtsubjectRequired ??
                          'Please enter a subject';
                    }
                    if (value.trim().length < 5) {
                      return l10n?.txtsubjectTooShort ??
                          'Subject must be at least 5 characters';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 24),

                // Message TextField
                Text(
                  AppLocalizations.of(context)?.txtmessage ?? 'Message',
                  style: GoogleFonts.plusJakartaSans(
                    color: colors.onSurface,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 8),
                TextFormField(
                  controller: _messageController,
                  style: GoogleFonts.plusJakartaSans(color: colors.onSurface),
                  maxLines: 6,
                  // AUDIT FIX: cap unbounded paste before it ships to the API.
                  maxLength: _messageMaxLength,
                  buildCounter: (_,
                          {required currentLength,
                          required isFocused,
                          maxLength}) =>
                      null, // counter hidden; limit still enforced
                  decoration: InputDecoration(
                    hintText:
                        AppLocalizations.of(context)?.txtdescribeIssueHint ??
                            'Describe your issue in detail...',
                    hintStyle: GoogleFonts.plusJakartaSans(
                        color: colors.onSurfaceMuted),
                    filled: true,
                    fillColor: colors.iconBackground,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(AppRadius.lg),
                      borderSide: BorderSide.none,
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(AppRadius.lg),
                      borderSide: BorderSide.none,
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(AppRadius.lg),
                      borderSide:
                          const BorderSide(color: AppColors.primary, width: 2),
                    ),
                    contentPadding: Spacing.paddingMd,
                  ),
                  validator: (value) {
                    // T-114: see note above on l10n fallbacks.
                    final l10n = AppLocalizations.of(context);
                    if (value == null || value.trim().isEmpty) {
                      return l10n?.txtmessageRequired ??
                          'Please enter a message';
                    }
                    if (value.trim().length < 10) {
                      return l10n?.txtmessageTooShort ??
                          'Message must be at least 10 characters';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 24),

                // Attachment Photo (SUPPORT P0-4) — up to 3 photos so the
                // rider can show multiple angles of the damage.
                Row(
                  children: [
                    Text(
                      'Photos (optional, up to $_maxAttachments)',
                      style: GoogleFonts.plusJakartaSans(
                        color: colors.onSurface,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const Spacer(),
                    Text(
                      '${_attachmentFiles.length}/$_maxAttachments',
                      style: GoogleFonts.plusJakartaSans(
                        color: colors.onSurfaceMuted,
                        fontSize: 13,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                InkWell(
                  key: const Key('ticketAttachmentPicker'),
                  borderRadius: BorderRadius.circular(AppRadius.lg),
                  onTap: _showAttachmentSourceSheet,
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(vertical: 24),
                    decoration: BoxDecoration(
                      color: colors.card,
                      borderRadius: BorderRadius.circular(AppRadius.lg),
                      border: Border.all(color: colors.outlineVariant),
                    ),
                    child: _attachmentFiles.isEmpty
                        ? Column(
                            children: [
                              const Icon(
                                Icons.add_photo_alternate_outlined,
                                color: AppColors.primary,
                                size: 28,
                              ),
                              const SizedBox(height: 8),
                              Text(
                                'Add photos',
                                style: AppTypography.labelLarge
                                    .copyWith(color: colors.onSurface),
                              ),
                              Text(
                                'Attach evidence for the issue (camera or gallery)',
                                style: GoogleFonts.plusJakartaSans(
                                  color: colors.onSurfaceMuted,
                                  fontSize: 13,
                                ),
                              ),
                            ],
                          )
                        : Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 16),
                            child: Wrap(
                              spacing: 8,
                              runSpacing: 8,
                              children: [
                                for (var i = 0;
                                    i < _attachmentFiles.length;
                                    i++)
                                  Stack(
                                    clipBehavior: Clip.none,
                                    children: [
                                      ClipRRect(
                                        borderRadius: BorderRadius.circular(8),
                                        child: Image.file(
                                          _attachmentFiles[i],
                                          width: 64,
                                          height: 64,
                                          fit: BoxFit.cover,
                                          // AUDIT FIX: decode at thumbnail
                                          // resolution, not the full capture.
                                          cacheWidth: 128,
                                        ),
                                      ),
                                      // AUDIT FIX: visual badge stays 24px but
                                      // the hit target is now ≥48dp.
                                      Positioned(
                                        top: -12,
                                        right: -12,
                                        child: SizedBox(
                                          width: 48,
                                          height: 48,
                                          child: IconButton(
                                            key: Key(
                                                'removeTicketAttachment_$i'),
                                            padding: EdgeInsets.zero,
                                            icon: Container(
                                              decoration: BoxDecoration(
                                                color: Colors.black54,
                                                borderRadius:
                                                    BorderRadius.circular(12),
                                              ),
                                              child: const Icon(Icons.close,
                                                  size: 16,
                                                  color: Colors.white),
                                            ),
                                            onPressed: () =>
                                                _removeAttachment(i),
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                if (_attachmentFiles.length < _maxAttachments)
                                  InkWell(
                                    key: const Key('addAnotherAttachment'),
                                    onTap: _showAttachmentSourceSheet,
                                    child: Container(
                                      width: 64,
                                      height: 64,
                                      decoration: BoxDecoration(
                                        color: colors.iconBackground,
                                        borderRadius: BorderRadius.circular(8),
                                        border: Border.all(
                                            color: colors.outlineVariant),
                                      ),
                                      child: const Icon(
                                        Icons.add_a_photo_outlined,
                                        color: AppColors.primary,
                                        size: 24,
                                      ),
                                    ),
                                  ),
                              ],
                            ),
                          ),
                  ),
                ),
                const SizedBox(height: 32),

                // Submit Button
                SizedBox(
                  width: double.infinity,
                  height: 56,
                  child: ElevatedButton(
                    onPressed: _isLoading ? null : _submitTicket,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(AppRadius.lg),
                      ),
                      elevation: 0,
                    ),
                    child: _isLoading
                        ? const SizedBox(
                            width: 24,
                            height: 24,
                            child: CircularProgressIndicator(
                              color: Colors.white,
                              strokeWidth: 2,
                            ),
                          )
                        : Text(
                            'Submit Ticket',
                            style: AppTypography.titleSmall,
                          ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
