import 'dart:async';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:provider/provider.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../../theme/app_theme.dart';
import '../../../../providers/rider_provider.dart';
import '../../../../providers/wallet_provider.dart';
import '../../../../widgets/animated_checkmark.dart';

class TopUpPaymentSheetScreen extends StatefulWidget {
  final int amount;
  final String purpose;
  final VoidCallback onBack;
  final VoidCallback onSuccess;

  const TopUpPaymentSheetScreen({
    super.key,
    required this.amount,
    required this.purpose,
    required this.onBack,
    required this.onSuccess,
  });

  @override
  State<TopUpPaymentSheetScreen> createState() => _TopUpPaymentSheetScreenState();
}

class _TopUpPaymentSheetScreenState extends State<TopUpPaymentSheetScreen>
    with WidgetsBindingObserver {
  bool _isProcessing = false;
  bool _isSuccess = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && _isProcessing) {
      // Simulate automatic payment listener when returning from UPI app
      _verifyPaymentAutomatically();
    }
  }

  Future<void> _launchUPI() async {
    final transactionRef = 'VOLT-${DateTime.now().millisecondsSinceEpoch}';
    final upiUrl =
        'upi://pay?pa=voltium@ybl&pn=Voltium&am=${widget.amount}&tr=$transactionRef&cu=INR';

    setState(() => _isProcessing = true);

    try {
      final uri = Uri.parse(upiUrl);
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      } else {
        // Fallback if no UPI app installed (or in simulator)
        _showUpiAppNotFoundDialog();
      }
    } catch (e) {
      _showUpiAppNotFoundDialog();
    }
  }

  void _showUpiAppNotFoundDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('UPI Apps Not Found'),
        content: const Text(
            'We couldn\'t open any UPI payment apps. Please scan the QR code to make payment or try again.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('OK'),
          ),
          TextButton(
            onPressed: () {
              Navigator.pop(context);
              _verifyPaymentAutomatically();
            },
            child: const Text('Simulate Pay (Sandbox)'),
          ),
        ],
      ),
    );
  }

  Future<void> _verifyPaymentAutomatically() async {
    setState(() {
      _isProcessing = true;
    });

    // Simulate API verification call delay
    await Future.delayed(const Duration(seconds: 2));

    if (!mounted) return;

    final riderId = context.read<RiderProvider>().riderId ?? '';
    await context.read<WalletProvider>().topUpWallet(
      amount: widget.amount.toDouble(),
      method: 'UPI',
      upiRef: 'AUTO_UPI',
      purpose: widget.purpose,
      riderId: riderId,
    );

    setState(() {
      _isProcessing = false;
      _isSuccess = true;
    });

    // Show checkmark animation for 1.5s, then navigate to success
    await Future.delayed(const Duration(milliseconds: 1500));
    if (mounted) {
      widget.onSuccess();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surfaceAlt,
      body: SafeArea(
        child: _isSuccess ? _buildSuccessState() : _buildPaymentState(),
      ),
    );
  }

  Widget _buildSuccessState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const AnimatedCheckmark(size: 80),
          const SizedBox(height: 24),
          Text(
            'Payment Confirmed!',
            style: GoogleFonts.inter(
              fontSize: 24,
              fontWeight: FontWeight.w900,
              color: AppColors.onSurface,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            '₹${widget.amount} credited to command wallet',
            style: GoogleFonts.inter(
              fontSize: 14,
              color: AppColors.onSurfaceVariant,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPaymentState() {
    return Column(
      children: [
        // Header
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Stack(
            alignment: Alignment.center,
            children: [
              Align(
                alignment: Alignment.centerLeft,
                child: GestureDetector(
                  key: const Key('backButton'),
                  onTap: widget.onBack,
                  child: Container(
                    width: 40,
                    height: 40,
                    decoration: const BoxDecoration(
                      color: Colors.white,
                      shape: BoxShape.circle,
                      boxShadow: AppShadows.glass,
                    ),
                    child: const Icon(
                      Icons.arrow_back,
                      size: 20,
                      color: AppColors.onSurface,
                    ),
                  ),
                ),
              ),
              Text(
                'Consolidated Pay',
                style: GoogleFonts.inter(
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                  color: AppColors.onSurface,
                  letterSpacing: 0.5,
                ),
              ),
            ],
          ),
        ),

        Expanded(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              children: [
                // Amount card
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(24),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.02),
                        blurRadius: 15,
                        offset: const Offset(0, 4),
                      )
                    ],
                  ),
                  child: Column(
                    children: [
                      Text(
                        widget.purpose == 'TOP_UP'
                            ? 'WALLET TOP-UP'
                            : 'SECURITY DEPOSIT',
                        style: GoogleFonts.inter(
                          fontSize: 10,
                          fontWeight: FontWeight.w900,
                          color: AppColors.primary,
                          letterSpacing: 1.2,
                        ),
                      ),
                      const SizedBox(height: 12),
                      Text(
                        '₹${widget.amount}',
                        style: GoogleFonts.inter(
                          fontSize: 36,
                          fontWeight: FontWeight.w900,
                          color: AppColors.onSurface,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Instant activation via UPI',
                        style: GoogleFonts.inter(
                          fontSize: 12,
                          color: AppColors.onSurfaceVariant,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),

                // QR Code custom design container
                Container(
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(28),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.02),
                        blurRadius: 20,
                        offset: const Offset(0, 4),
                      )
                    ],
                  ),
                  child: Column(
                    children: [
                      // Simulated dynamic QR Code graphic
                      Container(
                        width: 200,
                        height: 200,
                        decoration: BoxDecoration(
                          color: AppColors.surfaceAlt,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(
                            color: AppColors.outlineVariant,
                            width: 1.5,
                          ),
                        ),
                        child: Center(
                          child: Stack(
                            alignment: Alignment.center,
                            children: [
                              // QR pattern placeholder
                              Icon(
                                Icons.qr_code_2_rounded,
                                size: 160,
                                color: AppColors.onSurface.withValues(alpha: 0.8),
                              ),
                              // Central Voltium brand logo
                              Container(
                                width: 44,
                                height: 44,
                                decoration: const BoxDecoration(
                                  color: AppColors.primary,
                                  shape: BoxShape.circle,
                                  boxShadow: [
                                    BoxShadow(
                                      color: Colors.black26,
                                      blurRadius: 4,
                                    )
                                  ],
                                ),
                                child: const Icon(
                                  Icons.bolt,
                                  color: Colors.white,
                                  size: 24,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),
                      Text(
                        'Scan QR to Pay with any app',
                        style: GoogleFonts.inter(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: AppColors.onSurface,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'BHIM, GPay, PhonePe, Paytm, etc.',
                        style: GoogleFonts.inter(
                          fontSize: 11,
                          color: AppColors.onSurfaceVariant,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 32),

                if (_isProcessing)
                  const Column(
                    children: [
                      CircularProgressIndicator(color: AppColors.primary),
                      SizedBox(height: 16),
                      Text(
                        'Waiting for payment confirmation...',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
              ],
            ),
          ),
        ),

        // Pay Button
        if (!_isProcessing)
          Padding(
            padding: const EdgeInsets.all(24),
            child: SizedBox(
              width: double.infinity,
              height: 56,
              child: ElevatedButton.icon(
                key: const Key('payUpiButton'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(999),
                  ),
                  elevation: 0,
                ),
                onPressed: _launchUPI,
                icon: const Icon(Icons.flash_on),
                label: const Text(
                  'PAY VIA UPI APP',
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}
