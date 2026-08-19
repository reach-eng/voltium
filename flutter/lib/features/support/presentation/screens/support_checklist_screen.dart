import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:voltium_rider/utils/app_navigator.dart';
import 'troubleshooter_screen.dart';
import '../../../../theme/app_theme.dart';

import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:voltium_rider/theme/app_typography.dart';

class SupportChecklistScreen extends ConsumerStatefulWidget {
  const SupportChecklistScreen({super.key});

  @override
  ConsumerState<SupportChecklistScreen> createState() =>
      _SupportChecklistScreenState();
}

class _SupportChecklistScreenState
    extends ConsumerState<SupportChecklistScreen> {
  late List<bool> _checkedItems;

  @override
  void initState() {
    super.initState();
    final checklist =
        ref.read(supportProvider).supportConfig?.ticketChecklist ?? [];
    _checkedItems = List<bool>.filled(checklist.length, false);
  }

  bool get _allChecked => _checkedItems.every((item) => item);

  @override
  Widget build(BuildContext context) {
    final provider = ref.watch(supportProvider);
    final checklist = provider.supportConfig?.ticketChecklist ?? [];
    final colors = AppColors.of(context);

    return Scaffold(
      backgroundColor: colors.surface,
      appBar: AppBar(
        title: Text(
          'Support Checklist',
          style: GoogleFonts.plusJakartaSans(
            fontWeight: FontWeight.bold,
            color: colors.onSurface,
          ),
        ),
        backgroundColor: Colors.transparent,
        elevation: 0,
        centerTitle: false,
        iconTheme: IconThemeData(color: colors.onSurface),
      ),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: SingleChildScrollView(
                padding: Spacing.paddingLg,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'PLEASE VERIFY',
                      style: AppTypography.bodySmall
                          .copyWith(fontWeight: FontWeight.w800)
                          .copyWith(
                              color: colors.onSurfaceMuted, letterSpacing: 1.0),
                    ),
                    const SizedBox(height: 16),
                    Text(
                      'Before creating a ticket, please ensure you have completed these steps to help us resolve your issue faster.',
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 14,
                        color: colors.onSurface,
                        height: 1.5,
                      ),
                    ),
                    const SizedBox(height: 24),
                    ...List.generate(checklist.length, (index) {
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: _buildChecklistItem(index, checklist[index]),
                      );
                    }),
                  ],
                ),
              ),
            ),
            _buildActionButtons(),
          ],
        ),
      ),
    );
  }

  Widget _buildChecklistItem(int index, String text) {
    final colors = AppColors.of(context);
    return Container(
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(color: colors.outlineVariant.withValues(alpha: 0.5)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: CheckboxListTile(
        value: _checkedItems[index],
        onChanged: (val) {
          setState(() {
            _checkedItems[index] = val ?? false;
          });
        },
        title: Text(
          text,
          style: AppTypography.bodyMedium.copyWith(color: colors.onSurface),
        ),
        activeColor: AppColors.primary,
        shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.lg)),
        controlAffinity: ListTileControlAffinity.leading,
        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      ),
    );
  }

  Widget _buildActionButtons() {
    return Padding(
      padding: Spacing.paddingLg,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          ElevatedButton(
            onPressed: _allChecked
                ? () {
                    AppNavigator.pushReplacement(
                      context,
                      const TroubleshooterScreen(),
                    );
                  }
                : null,
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.white,
              minimumSize: const Size(double.infinity, 54),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(AppRadius.full),
              ),
              elevation: _allChecked ? 4 : 0,
              disabledBackgroundColor: AppColors.borderMedium,
              disabledForegroundColor: Colors.white70,
            ),
            child: Text(
              'Proceed to Support',
              style: AppTypography.titleSmall,
            ),
          ),
          const SizedBox(height: 12),
          Text(
            'Keep checking all items to proceed',
            style: AppTypography.bodySmall
                .copyWith(fontWeight: FontWeight.w600)
                .copyWith(
                    color: _allChecked ? Colors.transparent : AppColors.error),
          ),
        ],
      ),
    );
  }
}
