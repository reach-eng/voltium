import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:universal_io/io.dart';
import '../../../../theme/app_theme.dart';
import 'package:voltium_rider/features/support/presentation/screens/support_checklist_screen.dart';
import 'package:voltium_rider/core/observability/posthog_service.dart';
import 'package:voltium_rider/widgets/image_source_sheet.dart';
import 'package:voltium_rider/utils/app_constants.dart';

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
  File? _attachmentFile;

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
      final image =
          File('${Directory.systemTemp.path}/mock_ticket_attachment.png');
      setState(() => _attachmentFile = image);
      return;
    }
    final picked = await _picker.pickImage(
      source: source,
      imageQuality: 85,
      maxWidth: 1600,
      maxHeight: 1600,
      requestFullMetadata: false,
    );
    if (picked == null || !mounted) return;
    setState(() => _attachmentFile = File(picked.path));
  }

  Future<void> _showAttachmentSourceSheet() async {
    final source = await ImageSourceBottomSheet.show(context: context);
    if (source != null) await _pickAttachment(source);
  }

  Future<void> _submitTicket() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isLoading = true);

    try {
      // SUPPORT P0-4: upload the attachment (if any) first, then attach its
      // storage path to the ticket so the admin can view the evidence photo.
      String? uploadedUrl;
      final attachment = _attachmentFile;
      if (attachment != null) {
        uploadedUrl = await ref
            .read(filesRepositoryProvider)
            .uploadFile(attachment, 'support_ticket');
      }
      await ref.read(supportProvider.notifier).createTicket(
            category: _selectedCategory,
            subject: _subjectController.text.trim(),
            message: _messageController.text.trim(),
            riderId: ref.read(riderProvider).riderId,
            attachments: uploadedUrl,
          );
      PostHogService.capture('ticket_created', properties: {
        'category': _selectedCategory,
      });

      if (mounted) {
        // Capture navigator before pop so we can push after
        final nav = Navigator.of(context);
        nav.pop();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Ticket created successfully'),
            backgroundColor: AppColors.success,
          ),
        );
        // Show checklist after ticket creation
        WidgetsBinding.instance.addPostFrameCallback((_) {
          nav.push(MaterialPageRoute(
            builder: (_) => const SupportChecklistScreen(),
          ));
        });
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to create ticket: $e'),
            backgroundColor: AppColors.error,
          ),
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
    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: AppBar(
        backgroundColor: AppColors.surface,
        surfaceTintColor: Colors.transparent,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: AppColors.onSurface),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          'Create Ticket',
          style: GoogleFonts.plusJakartaSans(
            color: AppColors.onSurface,
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
                      .copyWith(color: AppColors.onSurface),
                ),
                SizedBox(height: 8),
                Text(
                  'Please fill out the form below to create a support ticket.',
                  style: GoogleFonts.plusJakartaSans(
                    color: AppColors.onSurfaceVariant,
                    fontSize: 14,
                  ),
                ),
                const SizedBox(height: 32),

                // Category Dropdown
                Text(
                  'Category',
                  style: GoogleFonts.plusJakartaSans(
                    color: AppColors.onSurface,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(AppRadius.md),
                    border: Border.all(color: AppColors.outlineVariant),
                  ),
                  child: DropdownButtonHideUnderline(
                    child: DropdownButton<String>(
                      value: _selectedCategory,
                      isExpanded: true,
                      dropdownColor: Colors.white,
                      icon: const Icon(Icons.keyboard_arrow_down,
                          color: AppColors.onSurfaceVariant),
                      style: GoogleFonts.plusJakartaSans(
                          color: AppColors.onSurface),
                      onChanged: (String? newValue) {
                        if (newValue != null) {
                          setState(() => _selectedCategory = newValue);
                        }
                      },
                      items: _categories
                          .map<DropdownMenuItem<String>>((String value) {
                        return DropdownMenuItem<String>(
                          value: value,
                          child: Text(
                            value.substring(0, 1) +
                                value.substring(1).toLowerCase(),
                          ),
                        );
                      }).toList(),
                    ),
                  ),
                ),
                const SizedBox(height: 24),

                // Subject TextField
                Text(
                  'Subject',
                  style: GoogleFonts.plusJakartaSans(
                    color: AppColors.onSurface,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                SizedBox(height: 8),
                TextFormField(
                  controller: _subjectController,
                  style:
                      GoogleFonts.plusJakartaSans(color: AppColors.onSurface),
                  decoration: InputDecoration(
                    hintText: 'Brief summary of the issue',
                    hintStyle: GoogleFonts.plusJakartaSans(
                        color: AppColors.onSurfaceDisabled),
                    filled: true,
                    fillColor: AppColors.of(context).iconBackground,
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
                    if (value == null || value.trim().isEmpty) {
                      return 'Please enter a subject';
                    }
                    if (value.trim().length < 5) {
                      return 'Subject must be at least 5 characters';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 24),

                // Message TextField
                Text(
                  'Message',
                  style: GoogleFonts.plusJakartaSans(
                    color: AppColors.onSurface,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                SizedBox(height: 8),
                TextFormField(
                  controller: _messageController,
                  style:
                      GoogleFonts.plusJakartaSans(color: AppColors.onSurface),
                  maxLines: 6,
                  decoration: InputDecoration(
                    hintText: 'Describe your issue in detail...',
                    hintStyle: GoogleFonts.plusJakartaSans(
                        color: AppColors.onSurfaceDisabled),
                    filled: true,
                    fillColor: AppColors.of(context).iconBackground,
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
                    if (value == null || value.trim().isEmpty) {
                      return 'Please enter a message';
                    }
                    if (value.trim().length < 10) {
                      return 'Message must be at least 10 characters';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 24),

                // Attachment Photo (SUPPORT P0-4)
                Text(
                  'Attachment (optional)',
                  style: GoogleFonts.plusJakartaSans(
                    color: AppColors.onSurface,
                    fontWeight: FontWeight.w600,
                  ),
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
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(AppRadius.lg),
                      border: Border.all(color: AppColors.outlineVariant),
                    ),
                    child: _attachmentFile == null
                        ? Column(
                            children: [
                              const Icon(
                                Icons.add_photo_alternate_outlined,
                                color: AppColors.primary,
                                size: 28,
                              ),
                              const SizedBox(height: 8),
                              Text(
                                'Add a photo',
                                style: AppTypography.labelLarge
                                    .copyWith(color: AppColors.onSurface),
                              ),
                              Text(
                                'Attach evidence for the issue (camera or gallery)',
                                style: GoogleFonts.plusJakartaSans(
                                  color: AppColors.of(context).onSurfaceMuted,
                                  fontSize: 13,
                                ),
                              ),
                            ],
                          )
                        : Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 16),
                            child: Row(
                              children: [
                                ClipRRect(
                                  borderRadius: BorderRadius.circular(8),
                                  child: Image.file(
                                    _attachmentFile!,
                                    width: 48,
                                    height: 48,
                                    fit: BoxFit.cover,
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Text(
                                    'Photo attached',
                                    style: AppTypography.labelLarge
                                        .copyWith(color: AppColors.onSurface),
                                  ),
                                ),
                                IconButton(
                                  key: const Key('removeTicketAttachment'),
                                  icon: Icon(Icons.close,
                                      size: 20,
                                      color:
                                          AppColors.of(context).onSurfaceMuted),
                                  onPressed: () =>
                                      setState(() => _attachmentFile = null),
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
