import 'dart:io';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher_string.dart';
import 'package:image_picker/image_picker.dart';
import '../models/support_model.dart';
import '../providers/app_provider.dart';
import '../widgets/fade_up_widget.dart';
import 'faq_screen.dart';

class SupportCenterScreen extends StatefulWidget {
  const SupportCenterScreen({super.key});

  @override
  State<SupportCenterScreen> createState() => _SupportCenterScreenState();
}

class _SupportCenterScreenState extends State<SupportCenterScreen> {
  final _messageController = TextEditingController();
  String _selectedCategory = 'GENERAL';
  bool _isSubmitting = false;
  final List<File> _attachedPhotos = [];
  final ImagePicker _picker = ImagePicker();

  final Map<String, String> _categoryMap = {
    'Technical Issues': 'TECHNICAL',
    'Payments & Wallet': 'PAYMENT',
    'Vehicle Issues': 'VEHICLE',
    'Battery Issues': 'BATTERY',
    'Account & KYC': 'GENERAL',
    'General Inquiry': 'INQUIRY',
  };

  @override
  void dispose() {
    _messageController.dispose();
    super.dispose();
  }

  Future<void> _handleSubmit() async {
    if (_messageController.text.isEmpty) return;

    setState(() => _isSubmitting = true);
    try {
      final categoryLabel = _categoryMap.keys
          .firstWhere((k) => _categoryMap[k] == _selectedCategory);
      final subject =
          "$categoryLabel: ${_messageController.text.length > 30 ? _messageController.text.substring(0, 30) + '...' : _messageController.text}";

      await context.read<AppProvider>().createTicket(
            category: _selectedCategory,
            subject: subject,
            message: _messageController.text,
          );

      _messageController.clear();
      _attachedPhotos.clear();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text('Ticket raised successfully!'),
              backgroundColor: Colors.green),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text('Failed to create ticket. Please try again.'),
              backgroundColor: Color(0xFFEF4444)),
        );
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<AppProvider>();
    return Scaffold(
      backgroundColor: const Color(0xFFF1F5F9),
      body: Stack(
        children: [
          _buildMeshBackground(),
          SafeArea(
            child: Column(
              children: [
                _buildHeader(context),
                Expanded(
                  child: SingleChildScrollView(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        FadeUpWidget(
                          delay: 0,
                          child: _buildTopActions(provider),
                        ),
                        const SizedBox(height: 24),
                        FadeUpWidget(
                          delay: 100,
                          child: _buildRaiseTicketCard(),
                        ),
                        const SizedBox(height: 32),
                        FadeUpWidget(
                          delay: 200,
                          child: _buildHistoryHeader(provider.tickets.length),
                        ),
                        const SizedBox(height: 12),
                        _buildTicketList(provider),
                        const SizedBox(height: 48),
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
    return Positioned.fill(
      child: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0xFFF1F5F9), Color(0xFFF8FAFC)],
          ),
        ),
      ),
    );
  }

  Widget _buildHeader(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      child: Row(
        children: [
          InkWell(
            key: const Key('backButton'),
            onTap: () => Navigator.maybePop(context),
            child: Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: Colors.white,
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(
                      color: Colors.black.withOpacity(0.05), blurRadius: 10),
                ],
              ),
              child: const Icon(Icons.arrow_back,
                  size: 18, color: Color(0xFF1E293B)),
            ),
          ),
          const SizedBox(width: 16),
          const Text(
            'Support Center',
            style: TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.bold,
                color: Color(0xFF1E293B)),
          ),
        ],
      ),
    );
  }

  Widget _buildTopActions(AppProvider provider) {
    return Row(
      children: [
        Expanded(
          child: _TopActionCard(
            key: const Key('faqLink'),
            icon: Icons.help_outline,
            iconColor: const Color(0xFF2563EB),
            iconBgColor: const Color(0xFFEFF6FF),
            label: 'FAQ',
            onTap: () {
              Navigator.push(context,
                  MaterialPageRoute(builder: (_) => const FaqScreen()));
            },
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: _TopActionCard(
            key: const Key('callUsLink'),
            icon: Icons.phone_outlined,
            iconColor: const Color(0xFF16A34A),
            iconBgColor: const Color(0xFFF0FDF4),
            label: 'Call Us',
            onTap: () {
              final phone =
                  provider.supportConfig?.supportPhone ?? '+91 1800 123 4567';
              try {
                launchUrlString('tel:$phone');
              } catch (_) {}
            },
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: _TopActionCard(
            key: const Key('emailLink'),
            icon: Icons.email_outlined,
            iconColor: const Color(0xFF9333EA),
            iconBgColor: const Color(0xFFFAF5FF),
            label: 'Email',
            onTap: () {
              final email =
                  provider.supportConfig?.supportEmail ?? 'support@voltium.in';
              try {
                launchUrlString('mailto:$email');
              } catch (_) {}
            },
          ),
        ),
      ],
    );
  }

  Widget _buildRaiseTicketCard() {
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
                value: _selectedCategory,
                dropdownColor: const Color(0xFF1E293B),
                icon: const Icon(Icons.keyboard_arrow_down,
                    color: Colors.white70),
                style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w600,
                    fontSize: 14),
                onChanged: (v) => setState(() => _selectedCategory = v!),
                items: _categoryMap.entries.map((e) {
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
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.15),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.white.withOpacity(0.2))),
            child: TextField(
              key: const Key('ticketDescriptionField'),
              controller: _messageController,
              maxLines: 3,
              style: const TextStyle(color: Colors.white, fontSize: 14),
              decoration: InputDecoration(
                hintText: 'Describe the issue...',
                hintStyle: const TextStyle(color: Colors.white38),
                border: InputBorder.none,
                suffixIcon: IconButton(
                  icon: const Icon(
                    Icons.mic_none,
                    color: Colors.white70,
                  ),
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
          const SizedBox(height: 16),
          // Photo attachments (max 5)
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
                ..._attachedPhotos.map((file) {
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
                            onTap: () =>
                                setState(() => _attachedPhotos.remove(file)),
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
                if (_attachedPhotos.length < 5)
                  GestureDetector(
                    onTap: _pickPhoto,
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
            onPressed: _isSubmitting ? null : _handleSubmit,
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.white,
              foregroundColor: const Color(0xFF0053C1),
              minimumSize: const Size(double.infinity, 54),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(9999)),
              elevation: 0,
            ),
            child: _isSubmitting
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

  Future<void> _pickPhoto() async {
    if (_attachedPhotos.length >= 5) return;
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
      final XFile? photo = await _picker.pickImage(
          source: source, maxWidth: 1024, maxHeight: 1024, imageQuality: 80);
      if (photo != null && mounted) {
        setState(() => _attachedPhotos.add(File(photo.path)));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text('Failed to pick photo'),
              backgroundColor: Color(0xFFEF4444)),
        );
      }
    }
  }

  Widget _buildHistoryHeader(int count) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        const Text('TICKET HISTORY',
            style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w900,
                color: Color(0xFF64748B),
                letterSpacing: 1.2)),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
          decoration: BoxDecoration(
              color: const Color(0xFFE2E8F0),
              borderRadius: BorderRadius.circular(99)),
          child: Text('$count TOTAL',
              style: const TextStyle(
                  fontSize: 9,
                  fontWeight: FontWeight.w900,
                  color: Color(0xFF64748B))),
        ),
      ],
    );
  }

  Widget _buildTicketList(AppProvider provider) {
    if (provider.tickets.isEmpty) {
      return Container(
        padding: const EdgeInsets.symmetric(vertical: 40),
        decoration: BoxDecoration(
          color: Colors.white.withOpacity(0.5),
          borderRadius: BorderRadius.circular(24),
          border: Border.all(
              color: Colors.black.withOpacity(0.05), style: BorderStyle.solid),
        ),
        child: Column(
          children: [
            Icon(Icons.message_outlined,
                color: Colors.black.withOpacity(0.1), size: 40),
            const SizedBox(height: 12),
            const Text('No tickets found',
                style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF1E293B))),
            const Text('Raise a new ticket above for assistance',
                style: TextStyle(fontSize: 11, color: Color(0xFF64748B))),
          ],
        ),
      );
    }

    return Column(
      children: provider.tickets.asMap().entries.map((entry) {
        final idx = entry.key;
        final ticket = entry.value;
        return Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: FadeUpWidget(
            delay: 300 + (idx * 50),
            child: _buildTicketItem(ticket),
          ),
        );
      }).toList(),
    );
  }

  Widget _buildTicketItem(IssueModel ticket) {
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
      'Dec'
    ];
    return months[month - 1];
  }
}

class _TopActionCard extends StatelessWidget {
  final IconData icon;
  final Color iconColor;
  final Color iconBgColor;
  final String label;
  final VoidCallback onTap;

  const _TopActionCard({
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
