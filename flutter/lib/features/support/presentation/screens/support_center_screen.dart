import 'dart:io';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher_string.dart';
import 'package:image_picker/image_picker.dart';
import 'package:voltium_rider/models/support_model.dart';
import 'package:voltium_rider/providers/app_provider.dart';
import 'package:voltium_rider/widgets/fade_up_widget.dart';
import 'package:voltium_rider/features/support/presentation/widgets/support_widgets.dart';
import 'faq_screen.dart';

class SupportCenterScreen extends StatefulWidget {
  const SupportCenterScreen({super.key});

  @override
  State<SupportCenterScreen> createState() => _SupportCenterScreenState();
}

class _SupportCenterScreenState extends State<SupportCenterScreen> {
  final _messageController = TextEditingController();
  final FocusNode _descriptionFocusNode = FocusNode();
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
    _descriptionFocusNode.dispose();
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
                          child: RaiseTicketCard(
                            categoryMap: _categoryMap,
                            selectedCategory: _selectedCategory,
                            onCategoryChanged: (v) => setState(() => _selectedCategory = v!),
                            messageController: _messageController,
                            descriptionFocusNode: _descriptionFocusNode,
                            attachedPhotos: _attachedPhotos,
                            isSubmitting: _isSubmitting,
                            onSubmit: _handleSubmit,
                            onPickPhoto: _pickPhoto,
                            onRemovePhoto: (file) => setState(() => _attachedPhotos.remove(file)),
                          ),
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
          child: TopActionCard(
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
          child: TopActionCard(
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
          child: TopActionCard(
            key: const Key('emailLink'),
            icon: Icons.email_outlined,
            iconColor: const Color(0xFF9333EA),
            iconBgColor: const Color(0xFFFAF5FF),
            label: 'Email',
            onTap: () {
              final email =
                  provider.supportConfig?.supportEmail ?? 'support@voltium.app';
              try {
                launchUrlString('mailto:$email');
              } catch (_) {}
            },
          ),
        ),
      ],
    );
  }

  Future<void> _pickPhoto() async {
    await pickSupportPhoto(
      context,
      _picker,
      _attachedPhotos.length,
      (file) {
        if (mounted) setState(() => _attachedPhotos.add(file));
      },
    );
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
            child: TicketListItem(ticket: ticket),
          ),
        );
      }).toList(),
    );
  }

}
