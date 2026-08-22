import 'package:universal_io/io.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

// AUDIT-FIX 2026-08-13 (M4-3): feedback_screen import removed —
// the "Rate Us" snackbar hijack is gone. Feedback is opt-in via
// the support center, not pushed via snackbar.
//
// import 'package:voltium_rider/features/support/presentation/screens/feedback_screen.dart';

import 'top_up_amount_screen.dart';
import 'top_up_proof_screen.dart';

import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/core/observability/posthog_service.dart';
import 'package:voltium_rider/core/network/api_error_messages.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:voltium_rider/utils/toast.dart';

class TopUpFlow extends ConsumerStatefulWidget {
  final int? initialAmount;
  const TopUpFlow({super.key, this.initialAmount});

  @override
  ConsumerState<TopUpFlow> createState() => _TopUpFlowState();
}

class _TopUpFlowState extends ConsumerState<TopUpFlow> {
  final PageController _pageController = PageController();

  late int _amount;
  File? _proofImage;
  int _currentPage = 0;

  @override
  void initState() {
    super.initState();
    _amount = (widget.initialAmount != null && widget.initialAmount! > 0)
        ? widget.initialAmount!
        : 2000;
  }

  void _nextPage() {
    _pageController.nextPage(
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeInOut,
    );
  }

  void _prevPage() {
    _pageController.previousPage(
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeInOut,
    );
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: _currentPage == 0,
      onPopInvokedWithResult: (didPop, result) {
        if (!didPop && _currentPage > 0) {
          _prevPage();
        }
      },
      child: Scaffold(
        body: PageView(
          controller: _pageController,
          physics: const NeverScrollableScrollPhysics(),
          onPageChanged: (page) => setState(() => _currentPage = page),
          children: [
            TopUpAmountScreen(
              securityDeposit: ref
                  .watch(riderProvider)
                  .rider
                  ?.activeRentalPlanSecurityDeposit
                  .toInt(),
              rentalPrice:
                  ref.watch(riderProvider).rider?.activeRentalPlanPrice.toInt(),
              onBack: () => Navigator.pop(context),
              onAmountChanged: (amount) => setState(() => _amount = amount),
              onProceed: (amount) {
                setState(() => _amount = amount);
                PostHogService.capture('wallet_top_up_initiated', properties: {
                  'amount': amount.toString(),
                });
                _nextPage();
              },
            ),
            TopUpProofScreen(
              amount: _amount,
              onBack: _prevPage,
              onEditAmount: _prevPage,
              onImageSelected: (img) => setState(() => _proofImage = img),
              // AUDIT FIX 2026-08-22 (PROOF-a): img is now nullable —
              // instant pay submits with no photo, so no fabricated file.
              // `topUpWallet` skips the upload when image is null.
              onSubmit: (img, method, upiRef) async {
                setState(() => _proofImage = img);
                final riderState = ref.read(riderProvider);
                final rId = riderState.riderId ??
                    riderState.rider?.id ??
                    riderState.rider?.riderId;
                if (rId == null || rId.isEmpty) {
                  if (context.mounted) {
                    Toast.info(
                      context,
                      'Rider profile is initializing. Please try again in a moment.',
                    );
                  }
                  return;
                }
                final wProvider = ref.read(walletProvider.notifier);

                // Hoisted above the try so the catch can branch copy on it.
                final securityDeposit = ref
                    .read(riderProvider)
                    .rider
                    ?.activeRentalPlanSecurityDeposit
                    .toInt();
                final isDeposit =
                    securityDeposit != null && _amount == securityDeposit;

                try {
                  await wProvider.topUpWallet(
                    riderId: rId,
                    amount: _amount.toDouble(),
                    method: method ?? 'CASH',
                    upiRef: upiRef,
                    image: _proofImage,
                  );
                  await ref.read(riderProvider.notifier).refreshFromApi();
                  PostHogService.capture('wallet_top_up_submitted',
                      properties: {
                        'amount': _amount.toString(),
                        'has_proof_image': (_proofImage != null).toString(),
                        'is_deposit': isDeposit.toString(),
                      });
                  PostHogService.capture('top_up_completed', properties: {
                    'amount': _amount.toString(),
                    'is_deposit': isDeposit.toString(),
                  });
                  if (isDeposit) {
                    PostHogService.capture('deposit_submitted', properties: {
                      'amount': _amount.toString(),
                    });
                  }
                  if (context.mounted) {
                    final nav = Navigator.of(context);
                    nav.pop();
                    Toast.success(
                      context,
                      AppLocalizations.of(context)!
                          .txttopUpProofSubmittedSuccessfully,
                    );
                  }
                } catch (e) {
                  if (context.mounted) {
                    // AUDIT FIX: deposit path uses the deposit copy; proof
                    // upload failures use the upload-specific copy (re-wires
                    // ARB keys orphaned when the legacy deposit workflow
                    // screen was deleted); everything else stays generic.
                    final msg = e.toString().contains('upload_failed')
                        ? AppLocalizations.of(context)!
                            .txtfailedToUploadProof('connection error')
                        : (isDeposit
                            ? AppLocalizations.of(context)!
                                .txtfailedToSubmitDeposit('connection error')
                            : safeErrorMessage(e, 'top-up'));
                    Toast.error(context, msg);
                  }
                }
              },
            ),
          ],
        ),
      ),
    );
  }
}
