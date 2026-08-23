import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:voltium_rider/services/emergency_contacts_service.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:voltium_rider/theme/app_typography.dart';
import 'package:voltium_rider/utils/dialer.dart';
import 'package:voltium_rider/widgets/dialogs.dart';

class EmergencyContactsScreen extends ConsumerStatefulWidget {
  const EmergencyContactsScreen({super.key});

  @override
  ConsumerState<EmergencyContactsScreen> createState() =>
      _EmergencyContactsScreenState();
}

class _EmergencyContactsScreenState
    extends ConsumerState<EmergencyContactsScreen> {
  // AUDIT FIX: tri-state hydration guard. The notifier hydrates from
  // SharedPreferences asynchronously (microtask kicked off in its own
  // build()); without this flag the empty state flashed for a frame
  // before the cached contacts landed.
  bool _hydrationSettled = false;

  @override
  void initState() {
    super.initState();
    _awaitHydration();
  }

  /// Mirrors the notifier's SharedPreferences read and yields one extra
  /// event-loop turn so the notifier's parallel hydration microtask has
  /// landed before the loading placeholder is cleared.
  Future<void> _awaitHydration() async {
    try {
      await SharedPreferences.getInstance();
    } catch (_) {
      // Test environments without the plugin: settle anyway — the
      // notifier fails to the same empty state.
    }
    await Future<void>.delayed(Duration.zero);
    if (!mounted) return;
    setState(() => _hydrationSettled = true);
  }

  @override
  Widget build(BuildContext context) {
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
      body: !_hydrationSettled && service.contacts.isEmpty
          ? const Center(child: CircularProgressIndicator())
          : service.contacts.isEmpty
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
                      onCall: () => _callContact(context, contact.phone),
                      onSetPrimary: () => ref
                          .read(emergencyContactsService.notifier)
                          .setPrimaryContact(contact.id),
                      onDelete: () =>
                          _confirmAndDeleteContact(context, ref, contact),
                    );
                  },
                ),
      floatingActionButton: service.contacts.length < 5
          ? FloatingActionButton.extended(
              onPressed: () => _showAddContactDialog(context, ref),
              backgroundColor: AppColors.primary,
              icon: const Icon(Icons.add),
              // LANGUAGE-AUDIT (2026-08-16) #5: hardcoded
              // English FAB label. Localised via `txtaddContact`.
              label: Text(AppLocalizations.of(context)!.txtaddContact),
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

  Future<void> _callContact(BuildContext context, String phone) async {
    // AUDIT FIX: shared guarded dialer — shows a toast fallback when no
    // dialer is available instead of silently doing nothing.
    await launchDialer(context, phone);
  }

  /// AUDIT FIX: deleting an emergency contact is destructive — require
  /// explicit confirmation before removing.
  Future<void> _confirmAndDeleteContact(
    BuildContext context,
    WidgetRef ref,
    EmergencyContact contact,
  ) async {
    // PR-4 (F-007 — 2026-08-22 deep audit): a yes/no confirm was
    // previously one tap away from a permanent delete of a
    // safety-critical contact. Require the rider to type the
    // contact's name to confirm — kid's playful taps and mis-taps
    // on adjacent rows are no longer enough.
    final confirmed = await showDestructivePhraseDialog(
      context: context,
      title: 'Remove ${contact.name}?',
      message: 'This contact will no longer be reachable from the SOS screen. '
          'A future emergency on the road could be made worse by '
          'removing a contact by accident.',
      phrase: contact.name,
      confirmText: 'Remove',
    );
    if (!confirmed) return;
    await ref.read(emergencyContactsService.notifier).removeContact(contact.id);
  }

  Future<void> _showAddContactDialog(
    BuildContext context,
    WidgetRef ref,
  ) async {
    final nameController = TextEditingController();
    final phoneController = TextEditingController();
    String relationship = 'Other';
    String? errorText;

    // LANGUAGE-AUDIT (2026-08-16) #5: dialog title + button labels
    // + form labels all use existing `txt*` ARB keys.
    final l10n = AppLocalizations.of(context)!;

    await showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          title: Text(l10n.txtaddEmergencyContact),
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
              if (errorText != null) ...[
                const SizedBox(height: 12),
                Text(
                  errorText!,
                  style:
                      AppTypography.bodySmall.copyWith(color: AppColors.error),
                ),
              ],
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: Text(l10n.txtcancel),
            ),
            FilledButton(
              onPressed: () {
                // AUDIT FIX: normalize before persisting — trim the name,
                // strip non-digits from the phone (allowing a single
                // leading '+') and require >= 10 digits so the stored
                // value is always safe to embed in a tel: URI.
                final name = nameController.text.trim();
                final raw = phoneController.text.trim();
                final digits = raw.replaceAll(RegExp(r'\D'), '');
                final phone = raw.startsWith('+') ? '+$digits' : digits;
                if (name.isEmpty || digits.length < 10) {
                  setDialogState(() {
                    errorText =
                        'Enter a name and a phone number with at least 10 digits.';
                  });
                  return;
                }
                ref.read(emergencyContactsService.notifier).addContact(
                      EmergencyContact(
                        // PR-VER-2026-08-07 (EMERGENCY P1-2): two contacts added
                        // within the same millisecond collided on the same id
                        // (breaking remove/update targeting). Microsecond
                        // timestamp + random suffix is unique per contact.
                        id: '${DateTime.now().microsecondsSinceEpoch}'
                            '-${Random().nextInt(1 << 32)}',
                        name: name,
                        phone: phone,
                        relationship: relationship,
                      ),
                    );
                Navigator.pop(ctx);
              },
              child: Text(l10n.txtadd),
            ),
          ],
        ),
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
          // AUDIT FIX: theme-derived background for the non-primary
          // avatar — the static onSurfaceVariant token was unreadable
          // in dark mode.
          backgroundColor:
              contact.isPrimary ? AppColors.primary : colors.primarySurface,
          child: Text(
            // AUDIT FIX: guard the RangeError on empty-string names.
            contact.name.isNotEmpty ? contact.name[0].toUpperCase() : '?',
            style: GoogleFonts.plusJakartaSans(
              color: contact.isPrimary ? Colors.white : colors.onSurface,
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
            // AUDIT FIX: call affordance now exposes a tooltip (and the
            // semantics label Tooltip provides) to screen readers.
            IconButton(
              icon: const Icon(Icons.phone, color: AppColors.success),
              tooltip: 'Call ${contact.name}',
              onPressed: onCall,
            ),
            PopupMenuButton(
              itemBuilder: (ctx) => [
                if (!contact.isPrimary)
                  // LANGUAGE-AUDIT (2026-08-16) #5: hardcoded
                  // English popup-menu labels. Localised via
                  // `txtsetAsPrimary` / `txtdelete`.
                  PopupMenuItem(
                    value: 'primary',
                    child: Row(
                      children: [
                        const Icon(Icons.star, size: 20),
                        const SizedBox(width: 8),
                        Text(AppLocalizations.of(context)!.txtsetAsPrimary),
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
                      Text(AppLocalizations.of(context)!.txtdelete,
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
