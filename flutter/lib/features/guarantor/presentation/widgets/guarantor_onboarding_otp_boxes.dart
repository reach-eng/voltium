import 'package:flutter/material.dart';
import '../../../../theme/app_theme.dart';
import 'package:voltium_rider/theme/app_typography.dart';

class GuarantorOnboardingOtpBoxes extends StatelessWidget {
  final List<TextEditingController> otpControllers;
  final List<FocusNode> otpFocusNodes;
  final Function(int, String) onChanged;

  const GuarantorOnboardingOtpBoxes({
    super.key,
    required this.otpControllers,
    required this.otpFocusNodes,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: List.generate(6, (i) {
        return SizedBox(
          width: 40,
          height: 48,
          child: TextFormField(
            controller: otpControllers[i],
            focusNode: otpFocusNodes[i],
            keyboardType: TextInputType.number,
            maxLength: 1,
            textAlign: TextAlign.center,
            textInputAction:
                i < 5 ? TextInputAction.next : TextInputAction.done,
            style: AppTypography.titleMedium,
            decoration: InputDecoration(
              counterText: '',
              filled: true,
              fillColor: colors.iconBackground,
              contentPadding: EdgeInsets.zero,
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(AppRadius.sm),
                borderSide: BorderSide(color: colors.outlineVariant),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(AppRadius.sm),
                borderSide:
                    const BorderSide(color: AppColors.primary, width: 2),
              ),
            ),
            onChanged: (v) => onChanged(i, v),
          ),
        );
      }),
    );
  }
}
