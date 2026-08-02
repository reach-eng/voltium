import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:voltium_rider/services/emergency_contacts_service.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:voltium_rider/theme/app_typography.dart';

class EmergencyContactsScreen extends ConsumerWidget {
  const EmergencyContactsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final service = ref.watch(emergencyContactsService);
    final colors = AppColors.of(context);

    return Scaffold(
      backgroundColor: colors.surface,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: Icon(
            Icons.arrow_back,
            color: colors.onSurface,
          ),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          'Emergency Contacts',
          style: AppTypography.titleMedium.copyWith(
            color: colors.onSurface,
            fontWeight: FontWeight.bold,
          ),
        ),
      ),
      body: service.contacts.isEmpty
          ? _buildEmptyState(context)
          : ListView.builder(
              addRepaintBoundaries: true,
              addAutomaticKeepAlives: true,
              itemExtent: 88.0,
              padding: Spacing.paddingMd,
              itemCount: service.contacts.length,
              itemBuilder: (context, index) {
                final contact = service.contacts[index];
                return _ContactCard(
                  contact: contact,
                  onCall: () => _callContact(contact.phone),
                  onSetPrimary: () => service.setPrimaryContact(contact.id),
                  onDelete: () => service.removeContact(contact.id),
                );
              },
            ),
      floatingActionButton: service.contacts.length < 5
          ? FloatingActionButton.extended(
              onPressed: () => _showAddContactDialog(context, service),
              backgroundColor: AppColors.primary,
              icon: const Icon(Icons.add),
              label: const Text('Add Contact'),
            )
          : null,
    );
  }

  Widget _buildEmptyState(BuildContext context) {
    final colors = AppColors.of(context);
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.contact_emergency,
            size: 64,
            color: colors.onSurfaceMuted,
          ),
          SizedBox(height: 16),
          Text(
            'No emergency contacts',
            style: AppTypography.titleMedium
                .copyWith(color: colors.onSurfaceVariant),
          ),
          SizedBox(height: 8),
          Text(
            'Add contacts to alert in case of emergency',
            style: GoogleFonts.plusJakartaSans(
              color: colors.onSurfaceVariant,
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _callContact(String phone) async {
    final uri = Uri(scheme: 'tel', path: phone);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    }
  }

  Future<void> _showAddContactDialog(
    BuildContext context,
    EmergencyContactsService service,
  ) async {
    final nameController = TextEditingController();
    final phoneController = TextEditingController();
    String relationship = 'Other';

    await showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Add Emergency Contact'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextFormField(
              controller: nameController,
              decoration: const InputDecoration(labelText: 'Name'),
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: phoneController,
              decoration: const InputDecoration(labelText: 'Phone Number'),
              keyboardType: TextInputType.phone,
            ),
            const SizedBox(height: 16),
            DropdownButtonFormField<String>(
              value: relationship,
              items: ['Parent', 'Spouse', 'Sibling', 'Friend', 'Other']
                  .map((r) => DropdownMenuItem(value: r, child: Text(r)))
                  .toList(),
              onChanged: (v) => relationship = v ?? 'Other',
              decoration: const InputDecoration(labelText: 'Relationship'),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () {
              if (nameController.text.isNotEmpty &&
                  phoneController.text.isNotEmpty) {
                service.addContact(
                  EmergencyContact(
                    id: DateTime.now().millisecondsSinceEpoch.toString(),
                    name: nameController.text,
                    phone: phoneController.text,
                    relationship: relationship,
                  ),
                );
                Navigator.pop(ctx);
              }
            },
            child: const Text('Add'),
          ),
        ],
      ),
    );
    nameController.dispose();
    phoneController.dispose();
  }
}

class _ContactCard extends ConsumerWidget {
  final EmergencyContact contact;
  final VoidCallback onCall;
  final VoidCallback onSetPrimary;
  final VoidCallback onDelete;

  const _ContactCard({
    required this.contact,
    required this.onCall,
    required this.onSetPrimary,
    required this.onDelete,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = AppColors.of(context);
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: contact.isPrimary
            ? Border.all(color: AppColors.primary, width: 2)
            : null,
      ),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: contact.isPrimary
              ? AppColors.primary
              : AppColors.onSurfaceVariant,
          child: Text(
            contact.name[0].toUpperCase(),
            style: GoogleFonts.plusJakartaSans(
              color: Colors.white,
              fontWeight: FontWeight.bold,
            ),
          ),
        ),
        title: Row(
          children: [
            Text(
              contact.name,
              style: GoogleFonts.plusJakartaSans(
                fontWeight: FontWeight.bold,
                color: colors.onSurface,
              ),
            ),
            if (contact.isPrimary) ...[
              SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: AppColors.primary,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  'PRIMARY',
                  style: AppTypography.labelSmall
                      .copyWith(fontSize: 10)
                      .copyWith(color: Colors.white),
                ),
              ),
            ],
          ],
        ),
        subtitle: Text(
          '${contact.relationship} • ${contact.phone}',
          style: GoogleFonts.plusJakartaSans(color: colors.onSurfaceVariant),
        ),
        trailing: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            IconButton(
              icon: const Icon(Icons.phone, color: AppColors.success),
              onPressed: onCall,
            ),
            PopupMenuButton(
              itemBuilder: (ctx) => [
                if (!contact.isPrimary)
                  const PopupMenuItem(
                    value: 'primary',
                    child: Row(
                      children: [
                        Icon(Icons.star, size: 20),
                        SizedBox(width: 8),
                        Text('Set as Primary'),
                      ],
                    ),
                  ),
                PopupMenuItem(
                  value: 'delete',
                  child: Row(
                    children: [
                      const Icon(Icons.delete,
                          color: AppColors.error, size: 20),
                      const SizedBox(width: 8),
                      Text('Delete',
                          style: GoogleFonts.plusJakartaSans(
                              color: AppColors.error)),
                    ],
                  ),
                ),
              ],
              onSelected: (value) {
                if (value == 'primary') onSetPrimary();
                if (value == 'delete') onDelete();
              },
            ),
          ],
        ),
      ),
    );
  }
}
