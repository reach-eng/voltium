import 'package:universal_io/io.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:voltium_rider/features/support/presentation/screens/feedback_screen.dart';

import 'top_up_amount_screen.dart';
import 'top_up_proof_screen.dart';

import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/core/observability/posthog_service.dart';

class TopUpFlow extends ConsumerStatefulWidget {
  const TopUpFlow({super.key});

  @override
  ConsumerState<TopUpFlow> createState() => _TopUpFlowState();
}

class _TopUpFlowState extends ConsumerState<TopUpFlow> {
  final PageController _pageController = PageController();

  int _amount = 2000;
  File? _proofImage;
  int _currentPage = 0;

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
              onSubmit: (img, method, upiRef) async {
                setState(() => _proofImage = img);
                final wProvider = ref.read(walletProvider.notifier);

                try {
                  await wProvider.topUpWallet(
                    riderId: ref.read(riderProvider).riderId!,
                    amount: _amount.toDouble(),
                    method: method ?? 'CASH',
                    upiRef: upiRef,
                    image: _proofImage,
                  );
                  await ref.read(riderProvider.notifier).refreshFromApi();
                  final securityDeposit = ref
                      .read(riderProvider)
                      .rider
                      ?.activeRentalPlanSecurityDeposit
                      .toInt();
                  final isDeposit =
                      securityDeposit != null && _amount == securityDeposit;
                  PostHogService.capture('wallet_top_up_submitted',
                      properties: {
                        'amount': _amount.toString(),
                        'has_proof_image': (_proofImage != null).toString(),
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
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content:
                            const Text('Top-up proof submitted successfully!'),
                        action: SnackBarAction(
                          label: 'Rate Us',
                          textColor: Colors.white,
                          onPressed: () {
                            nav.push(MaterialPageRoute(
                              builder: (ctx) => FeedbackScreen(
                                  onSubmit: () => Navigator.pop(ctx)),
                            ));
                          },
                        ),
                      ),
                    );
                  }
                } catch (e) {
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('Failed: $e')),
                    );
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
