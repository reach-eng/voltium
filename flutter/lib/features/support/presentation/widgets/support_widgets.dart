import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:voltium_rider/models/support_model.dart';

String _getMonth(int month) {
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
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
    final source = await showDialog<ImageSource>(
      context: context,
      builder: (ctx) => SimpleDialog(
        title: const Text('Select Photo Source'),
        children: [
          SimpleDialogOption(
            onPressed: () => Navigator.pop(ctx, ImageSource.camera),
            child: const ListTile(
                leading: Icon(Icons.camera_alt), title: Text('Camera')),
          ),
          SimpleDialogOption(
            onPressed: () => Navigator.pop(ctx, ImageSource.gallery),
            child: const ListTile(
                leading: Icon(Icons.photo_library), title: Text('Gallery')),
          ),
        ],
      ),
    );
    if (source == null) return;
    final XFile? photo = await picker.pickImage(
        source: source, maxWidth: 1024, maxHeight: 1024, imageQuality: 80);
    if (photo != null) {
      onPhotoPicked(File(photo.path));
    }
  } catch (_) {}
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
          colors: [Color(0xFF0053C1), Color(0xFF2176FF)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(32),
        boxShadow: [
          BoxShadow(
              color: const Color(0xFF0053C1).withOpacity(0.2),
              blurRadius: 24,
              offset: const Offset(0, 12)),
        ],
      ),
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Container(
                height: 36,
                width: 36,
                decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.2),
                    borderRadius: BorderRadius.circular(12)),
                child: const Icon(Icons.confirmation_number_outlined,
                    color: Colors.white, size: 20),
              ),
              const SizedBox(width: 12),
              const Text('Raise a Ticket',
                  style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: Colors.white)),
            ],
          ),
          const SizedBox(height: 20),
          const Text('ISSUE TYPE',
              style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w900,
                  color: Colors.white60,
                  letterSpacing: 1.2)),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.15),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.white.withOpacity(0.2))),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<String>(
                key: const Key('issueTypeDropdown'),
                isExpanded: true,
                value: selectedCategory,
                dropdownColor: const Color(0xFF1E293B),
                icon: const Icon(Icons.keyboard_arrow_down,
                    color: Colors.white70),
                style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w600,
                    fontSize: 14),
                onChanged: onCategoryChanged,
                items: categoryMap.entries.map((e) {
                  return DropdownMenuItem(value: e.value, child: Text(e.key));
                }).toList(),
              ),
            ),
          ),
          const SizedBox(height: 16),
          const Text('DESCRIPTION',
              style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w900,
                  color: Colors.white60,
                  letterSpacing: 1.2)),
          const SizedBox(height: 8),
          GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: () {
              descriptionFocusNode.requestFocus();
            },
            child: Container(
              decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: Colors.white.withOpacity(0.2))),
              child: TextField(
                key: const Key('ticketDescriptionField'),
                focusNode: descriptionFocusNode,
                controller: messageController,
                maxLines: 3,
                style: const TextStyle(color: Colors.white, fontSize: 14),
                decoration: InputDecoration(
                  contentPadding: const EdgeInsets.symmetric(
                      horizontal: 16, vertical: 16),
                  hintText: 'Describe the issue...',
                  hintStyle: const TextStyle(color: Colors.white38),
                  border: InputBorder.none,
                  suffixIcon: IconButton(
                    icon: const Icon(Icons.mic_none, color: Colors.white70),
                    onPressed: () {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                            content: Text(
                                'Voice input: Speak now (feature coming soon)'),
                            backgroundColor: Color(0xFF0053C1)),
                      );
                    },
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(height: 16),
          const Text('ATTACH PHOTOS (MAX 5)',
              style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w900,
                  color: Colors.white60,
                  letterSpacing: 1.2)),
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
                          borderRadius: BorderRadius.circular(12),
                          child: Image.file(file,
                              width: 80, height: 80, fit: BoxFit.cover),
                        ),
                        Positioned(
                          top: 4,
                          right: 4,
                          child: GestureDetector(
                            onTap: () => onRemovePhoto(file),
                            child: Container(
                              padding: const EdgeInsets.all(2),
                              decoration: const BoxDecoration(
                                  color: Colors.red, shape: BoxShape.circle),
                              child: const Icon(Icons.close,
                                  size: 14, color: Colors.white),
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
                        color: Colors.white.withOpacity(0.15),
                        borderRadius: BorderRadius.circular(12),
                        border:
                            Border.all(color: Colors.white.withOpacity(0.3)),
                      ),
                      child: const Icon(Icons.add_a_photo,
                          color: Colors.white70, size: 24),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          ElevatedButton(
            key: const Key('raiseTicketButton'),
            onPressed: isSubmitting ? null : onSubmit,
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.white,
              foregroundColor: const Color(0xFF0053C1),
              minimumSize: const Size(double.infinity, 54),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(9999)),
              elevation: 0,
            ),
            child: isSubmitting
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: Color(0xFF0053C1)))
                : const Text('RAISE TICKET',
                    style: TextStyle(
                        fontWeight: FontWeight.w900, letterSpacing: 1)),
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
        statusColor = const Color(0xFF10B981);
        break;
      case 'IN_PROGRESS':
        statusColor = const Color(0xFFF59E0B);
        break;
      case 'OPEN':
        statusColor = const Color(0xFFEF4444);
        break;
      default:
        statusColor = const Color(0xFF64748B);
    }

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
              color: Colors.black.withOpacity(0.02),
              blurRadius: 20,
              offset: const Offset(0, 8)),
        ],
      ),
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                height: 40,
                width: 40,
                decoration: BoxDecoration(
                    color: const Color(0xFFF1F5F9),
                    borderRadius: BorderRadius.circular(12)),
                child: const Icon(Icons.help_center_outlined,
                    color: Color(0xFF0053C1), size: 20),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(
                            child: Text(ticket.subject,
                                style: const TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.bold,
                                    color: Color(0xFF1E293B)),
                                overflow: TextOverflow.ellipsis)),
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(
                              color: statusColor.withOpacity(0.1),
                              borderRadius: BorderRadius.circular(99)),
                          child: Text(
                              ticket.status != null
                                  ? ticket.status!.replaceAll('_', ' ')
                                  : 'OPEN',
                              style: TextStyle(
                                  fontSize: 9,
                                  fontWeight: FontWeight.w900,
                                  color: statusColor)),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        const Icon(Icons.access_time,
                            size: 10, color: Color(0xFF94A3B8)),
                        const SizedBox(width: 4),
                        Text(
                            ticket.createdAt != null
                                ? '${ticket.createdAt!.day} ${_getMonth(ticket.createdAt!.month)}'
                                : '',
                            style: const TextStyle(
                                fontSize: 11, color: Color(0xFF64748B))),
                        const SizedBox(width: 8),
                        Text('• ${ticket.ticketId}',
                            style: const TextStyle(
                                fontSize: 10,
                                color: Color(0xFF94A3B8),
                                fontFamily: 'monospace')),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (ticket.message != null) ...[
            const SizedBox(height: 12),
            Text(ticket.message!,
                style: const TextStyle(
                    fontSize: 12, color: Color(0xFF64748B), height: 1.5),
                maxLines: 2,
                overflow: TextOverflow.ellipsis),
          ],
        ],
      ),
    );
  }
}

class TopActionCard extends StatelessWidget {
  final IconData icon;
  final Color iconColor;
  final Color iconBgColor;
  final String label;
  final VoidCallback onTap;

  const TopActionCard({
    super.key,
    required this.icon,
    required this.iconColor,
    required this.iconBgColor,
    required this.label,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.02),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 20),
            child: Column(
              children: [
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    color: iconBgColor,
                    shape: BoxShape.circle,
                  ),
                  child: Icon(icon, color: iconColor, size: 22),
                ),
                const SizedBox(height: 12),
                Text(
                  label,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF1E293B),
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
