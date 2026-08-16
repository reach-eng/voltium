import 'package:universal_io/io.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:voltium_rider/models/support_model.dart';
import 'package:voltium_rider/widgets/image_source_sheet.dart';
import '../../../../theme/app_theme.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:voltium_rider/theme/app_typography.dart';
import '../../../../utils/app_logger.dart';

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
    'Dec',
  ];
  return months[month - 1];
}

Future<void> pickSupportPhoto(
  BuildContext context,
  ImagePicker picker,
  int currentCount,
  void Function(File) onPhotoPicked,
) async {
  if (currentCount >= 5) return;
  try {
    final source = await ImageSourceBottomSheet.show(context: context);
    if (source == null) return;
    final XFile? photo = await picker.pickImage(
      source: source,
      maxWidth: 1600,
      maxHeight: 1600,
      imageQuality: 85,
      requestFullMetadata: false,
    );
    if (photo != null) {
      onPhotoPicked(File(photo.path));
    }
  } catch (e) {
    appDebug('Support photo picker failed: $e');
  }
}

class RaiseTicketCard extends StatelessWidget {
  final Map<String, String> categoryMap;
  final String selectedCategory;
  final ValueChanged<String> onCategoryChanged;
  final TextEditingController messageController;
  final FocusNode descriptionFocusNode;
  final List<File> attachedPhotos;
  final bool isSubmitting;
  final VoidCallback onSubmit;
  final VoidCallback onPickPhoto;
  final void Function(File) onRemovePhoto;

  const RaiseTicketCard({
    super.key,
    required this.categoryMap,
    required this.selectedCategory,
    required this.onCategoryChanged,
    required this.messageController,
    required this.descriptionFocusNode,
    required this.attachedPhotos,
    required this.isSubmitting,
    required this.onSubmit,
    required this.onPickPhoto,
    required this.onRemovePhoto,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [AppColors.primary, AppColors.primaryLight],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(AppRadius.radiusBottomSheet),
        boxShadow: [
          BoxShadow(
            color: AppColors.primary.withValues(alpha: 0.2),
            blurRadius: 24,
            offset: const Offset(0, 12),
          ),
        ],
      ),
      padding: Spacing.paddingLg,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Container(
                height: 36,
                width: 36,
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(AppRadius.md),
                ),
                child: const Icon(
                  Icons.confirmation_number_outlined,
                  color: Colors.white,
                  size: 20,
                ),
              ),
              SizedBox(width: 12),
              Text(
                'Raise a Ticket',
                style: AppTypography.titleMedium.copyWith(color: Colors.white),
              ),
            ],
          ),
          SizedBox(height: 20),
          Text(
            'ISSUE TYPE',
            style: AppTypography.bodySmall
                .copyWith(fontWeight: FontWeight.w800, letterSpacing: 1.2)
                .copyWith(color: Colors.white60, letterSpacing: 1.2),
          ),
          SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(AppRadius.lg),
              border: Border.all(color: Colors.white.withValues(alpha: 0.2)),
            ),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<String>(
                key: const Key('issueTypeDropdown'),
                isExpanded: true,
                value: selectedCategory,
                dropdownColor: AppColors.of(context).onSurface,
                icon: const Icon(
                  Icons.keyboard_arrow_down,
                  color: Colors.white70,
                ),
                style: AppTypography.bodyMedium
                    .copyWith(fontWeight: FontWeight.w600)
                    .copyWith(color: Colors.white),
                onChanged: (value) {
                  if (value != null) onCategoryChanged(value);
                },
                items: categoryMap.entries.map((e) {
                  return DropdownMenuItem(value: e.value, child: Text(e.key));
                }).toList(),
              ),
            ),
          ),
          SizedBox(height: 16),
          Text(
            'DESCRIPTION',
            style: AppTypography.bodySmall
                .copyWith(fontWeight: FontWeight.w800, letterSpacing: 1.2)
                .copyWith(color: Colors.white60, letterSpacing: 1.2),
          ),
          SizedBox(height: 8),
          GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: () {
              descriptionFocusNode.requestFocus();
            },
            child: Container(
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(AppRadius.lg),
                border: Border.all(color: Colors.white.withValues(alpha: 0.2)),
              ),
              child: TextFormField(
                key: const Key('ticketDescriptionField'),
                focusNode: descriptionFocusNode,
                controller: messageController,
                maxLines: 3,
                style: GoogleFonts.plusJakartaSans(
                    color: Colors.white, fontSize: 14),
                decoration: InputDecoration(
                  contentPadding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
                  hintText: 'Describe the issue...',
                  hintStyle: GoogleFonts.plusJakartaSans(color: Colors.white38),
                  border: InputBorder.none,
                  suffixIcon: IconButton(
                    icon: const Icon(Icons.mic_none, color: Colors.white70),
                    onPressed: () {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text(
                            'Voice input: Speak now (feature coming soon)',
                          ),
                          backgroundColor: AppColors.primary,
                        ),
                      );
                    },
                  ),
                ),
              ),
            ),
          ),
          SizedBox(height: 16),
          Text(
            'ATTACH PHOTOS (MAX 5)',
            style: AppTypography.bodySmall
                .copyWith(fontWeight: FontWeight.w800, letterSpacing: 1.2)
                .copyWith(color: Colors.white60, letterSpacing: 1.2),
          ),
          const SizedBox(height: 8),
          SizedBox(
            height: 80,
            child: ListView(
              scrollDirection: Axis.horizontal,
              children: [
                ...attachedPhotos.map((file) {
                  return Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: Stack(
                      children: [
                        ClipRRect(
                          borderRadius: BorderRadius.circular(AppRadius.md),
                          child: Image.file(
                            file,
                            width: 80,
                            height: 80,
                            fit: BoxFit.cover,
                          ),
                        ),
                        Positioned(
                          top: 4,
                          right: 4,
                          child: GestureDetector(
                            onTap: () => onRemovePhoto(file),
                            child: Container(
                              padding: const EdgeInsets.all(2),
                              decoration: const BoxDecoration(
                                color: AppColors.error,
                                shape: BoxShape.circle,
                              ),
                              child: const Icon(
                                Icons.close,
                                size: 14,
                                color: Colors.white,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  );
                }),
                if (attachedPhotos.length < 5)
                  GestureDetector(
                    onTap: onPickPhoto,
                    child: Container(
                      width: 80,
                      height: 80,
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(AppRadius.md),
                        border: Border.all(
                            color: Colors.white.withValues(alpha: 0.3)),
                      ),
                      child: const Icon(
                        Icons.add_a_photo,
                        color: Colors.white70,
                        size: 24,
                      ),
                    ),
                  ),
              ],
            ),
          ),
          SizedBox(height: 24),
          ElevatedButton(
            key: const Key('raiseTicketButton'),
            onPressed: isSubmitting ? null : onSubmit,
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.white,
              foregroundColor: AppColors.primary,
              minimumSize: const Size(double.infinity, 54),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(AppRadius.full),
              ),
              elevation: 0,
            ),
            child: isSubmitting
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: AppColors.primary,
                    ),
                  )
                : Text(
                    'RAISE TICKET',
                    style: GoogleFonts.plusJakartaSans(
                      fontWeight: FontWeight.w800,
                      letterSpacing: 1,
                    ),
                  ),
          ),
        ],
      ),
    );
  }
}

class TicketListItem extends StatelessWidget {
  final IssueModel ticket;
  final VoidCallback? onTap;

  const TicketListItem({
    super.key,
    required this.ticket,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    Color statusColor;
    switch (ticket.status.toUpperCase()) {
      case 'RESOLVED':
        statusColor = AppColors.success;
        break;
      case 'IN_PROGRESS':
        statusColor = AppColors.warning;
        break;
      case 'OPEN':
        statusColor = AppColors.error;
        break;
      default:
        statusColor = AppColors.of(context).onSurfaceVariant;
    }

    final colors = AppColors.of(context);
    return Container(
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(AppRadius.radiusModal),
        border: Border.all(color: colors.outlineVariant.withValues(alpha: 0.5)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 20,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      padding: const EdgeInsets.all(Spacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                height: 40,
                width: 40,
                decoration: BoxDecoration(
                  color: AppColors.of(context).primarySurface,
                  borderRadius: BorderRadius.circular(AppRadius.md),
                ),
                child: const Icon(
                  Icons.help_center_outlined,
                  color: AppColors.primary,
                  size: 20,
                ),
              ),
              SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(
                          child: Text(
                            ticket.subject,
                            style: AppTypography.bodyMedium
                                .copyWith(fontWeight: FontWeight.w600)
                                .copyWith(color: colors.onSurface),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 2,
                          ),
                          decoration: BoxDecoration(
                            color: statusColor.withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(AppRadius.full),
                          ),
                          child: Text(
                            ticket.status.replaceAll('_', ' '),
                            style: AppTypography.bodySmall
                                .copyWith(
                                    fontWeight: FontWeight.w800,
                                    letterSpacing: 1.2)
                                .copyWith(color: statusColor),
                          ),
                        ),
                      ],
                    ),
                    SizedBox(height: 4),
                    Row(
                      children: [
                        const Icon(
                          Icons.access_time,
                          size: 10,
                          color: AppColors.slate400,
                        ),
                        SizedBox(width: 4),
                        Text(
                          '${ticket.createdAt.day} ${_getMonth(ticket.createdAt.month)}',
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 12,
                            color: AppColors.of(context).onSurfaceVariant,
                          ),
                        ),
                        SizedBox(width: 8),
                        Text(
                          '• ${ticket.ticketId}',
                          style: GoogleFonts.ibmPlexMono(
                            fontSize: 12,
                            color: AppColors.slate400,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
          ...[
            SizedBox(height: 12),
            Text(
              ticket.message,
              style: GoogleFonts.plusJakartaSans(
                fontSize: 12,
                color: AppColors.of(context).onSurfaceVariant,
                height: 1.5,
              ),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ],
      ),
    );
  }
}

// `TopActionCard` was removed in DARK-MODE-AUDIT 2026-08-14 PR2: it was
// never wired up to a screen and held a static `iconColor`/`iconBgColor`
// pair that bypassed the brightness-aware `ThemeColors` extension. If a
// future screen needs the same shape, prefer resolving the icon colors
// from `AppColors.of(context)` at the call site rather than baking them
// into the constructor.
