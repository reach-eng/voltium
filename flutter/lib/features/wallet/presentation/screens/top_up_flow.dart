import 'package:universal_io/io.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:voltium_rider/features/support/presentation/screens/feedback_screen.dart';

import 'top_up_amount_screen.dart';
import 'top_up_proof_screen.dart';

import 'package:voltium_rider/core/state/riverpod_providers.dart';

class TopUpFlow extends ConsumerStatefulWidget {
  const TopUpFlow({super.key});

  @override
  ConsumerState<TopUpFlow> createState() => _TopUpFlowState();
}

class _TopUpFlowState extends ConsumerState<TopUpFlow> {
  final PageController _pageController = PageController();

  int _amount = 2000;
  File? _proofImage;


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
    final provider = ref.watch(appProvider);
    return Scaffold(
      body: PageView(
        controller: _pageController,
        physics: const NeverScrollableScrollPhysics(),
        children: [
          TopUpAmountScreen(
            securityDeposit: ref.watch(appProvider).rider?.activeRentalPlanSecurityDeposit.toInt(),
            rentalPrice: ref.watch(appProvider).rider?.activeRentalPlanPrice.toInt(),
            onBack: () => Navigator.pop(context),
            onAmountChanged: (amount) => setState(() => _amount = amount),
            onProceed: (amount) {
              setState(() => _amount = amount);
              _nextPage();
            },
          ),
          TopUpProofScreen(
            amount: _amount,
            onBack: _prevPage,
            onEditAmount: _prevPage,
            onImageSelected: (img) => setState(() => _proofImage = img),
            onSubmit: (img) async {
              setState(() => _proofImage = img);
              final provider = ref.read(appProvider);

              try {
                await provider.topUpWallet(
                  amount: _amount.toDouble(),
                  method: 'CASH',
                  upiRef: 'OFFLINE_PAYMENT',
                  image: _proofImage,
                );
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
    );
  }
}
