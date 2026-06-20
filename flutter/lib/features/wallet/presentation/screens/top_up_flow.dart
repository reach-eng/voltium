import 'dart:io';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'package:voltium_rider/providers/app_provider.dart';
import 'top_up_purpose_screen.dart';
import 'top_up_amount_screen.dart';
import 'top_up_proof_screen.dart';

class TopUpFlow extends StatefulWidget {
  const TopUpFlow({super.key});

  @override
  State<TopUpFlow> createState() => _TopUpFlowState();
}

class _TopUpFlowState extends State<TopUpFlow> {
  final PageController _pageController = PageController();

  int _amount = 2000;
  File? _proofImage;
  // ignore: unused_field
  TopUpPurpose _purpose = TopUpPurpose.topUp;

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
    return Scaffold(
      body: PageView(
        controller: _pageController,
        physics: const NeverScrollableScrollPhysics(),
        children: [
          TopUpPurposeScreen(
            onBack: () => Navigator.pop(context),
            onPurposeSelected: (purpose) => setState(() => _purpose = purpose),
            onContinue: (purpose) {
              setState(() => _purpose = purpose);
              _nextPage();
            },
          ),
          TopUpAmountScreen(
            onBack: _prevPage,
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
              final provider = Provider.of<AppProvider>(context, listen: false);

              try {
                await provider.topUpWallet(
                  amount: _amount.toDouble(),
                  method: 'CASH',
                  upiRef: 'OFFLINE_PAYMENT',
                  image: _proofImage,
                );
                if (context.mounted) {
                  Navigator.pop(context);
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                        content: Text('Top-up proof submitted successfully!'),),
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
