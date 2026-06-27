import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../app/app_shell.dart';
import '../features/onboarding/presentation/screens/splash_screen.dart';
import '../features/onboarding/presentation/screens/welcome_screen.dart';
import '../features/onboarding/presentation/screens/legal_screen.dart';
import '../features/onboarding/presentation/screens/legal_page_screen.dart';
import '../features/onboarding/presentation/screens/privacy_consent_screen.dart';
import '../features/onboarding/presentation/screens/permissions_screen.dart';
import '../features/auth/presentation/screens/login_screen.dart';
import '../features/auth/presentation/screens/otp_verification_screen.dart';
import '../features/auth/presentation/screens/auth_choice_screen.dart';
import '../features/kyc/presentation/screens/intent_of_use_screen.dart';
import '../features/kyc/presentation/screens/user_onboarding_screen.dart';
import '../features/guarantor/presentation/screens/guarantor_onboarding_screen.dart';
import '../features/wallet/presentation/screens/top_up_amount_screen.dart';
import '../features/wallet/presentation/screens/top_up_purpose_screen.dart';
import '../features/wallet/presentation/screens/top_up_receipt_screen.dart';
import '../features/wallet/presentation/screens/top_up_upi_screen.dart';
import '../features/wallet/presentation/screens/top_up_proof_screen.dart';
import '../features/rentals/presentation/screens/choose_plan_screen.dart';
import '../features/rentals/presentation/screens/plan_success_screen.dart';
import '../features/rentals/presentation/screens/end_rental_screen.dart';
import '../features/pickup/presentation/screens/pickup_hub_screen.dart';
import '../features/pickup/presentation/screens/pickup_verification_screen.dart';
import '../features/pickup/presentation/screens/pickup_success_screen.dart';
import '../features/pickup/presentation/screens/tl_details_screen.dart';
import '../features/pickup/presentation/screens/vehicle_photos_screen.dart';
import '../features/dashboard/presentation/screens/pre_dashboard_screen.dart';
import '../features/support/presentation/screens/faq_screen.dart';
import '../features/referrals/presentation/screens/referral_screen.dart';
import '../features/kyc/presentation/screens/documents_screen.dart';
/// Shared navigator key so go_router can be accessed from non-widget contexts.
final _rootNavigatorKey = GlobalKey<NavigatorState>();

/// go_router configuration mirroring the existing AuthState state machine.
///
/// ⚠️ Migration in progress — the existing [AppRouter] widget still drives
/// navigation. When ready to switch:
///
///   1. In main.dart, replace `const AppRouter()` with your router entry point
///   2. Make screens use `context.go()` / `context.push()` instead of callbacks
///   3. Delete `flutter/lib/app/router.dart` + `router_body.dart` + `app_state.dart`
///   4. Remove `provider` from pubspec.yaml after Riverpod migration
final GoRouter appRouter = GoRouter(
  navigatorKey: _rootNavigatorKey,
  initialLocation: '/',
  debugLogDiagnostics: true,
  routes: [
    // ── Splash ──────────────────────────────────────────────────────────
    GoRoute(
      path: '/',
      builder: (_, __) => SplashScreen(
        onComplete: () {},
      ),
    ),

    // ── Auth / Onboarding ────────────────────────────────────────────────
    GoRoute(
      path: '/welcome',
      builder: (_, __) => WelcomeScreen(onContinue: () {}),
    ),

    GoRoute(
      path: '/auth-choice',
      builder: (_, __) => AuthChoiceScreen(
        onCreateAccount: () {},
        onLoginWithPhone: () {},
      ),
    ),

    GoRoute(
      path: '/legal',
      builder: (_, __) => LegalScreen(onNext: () {}),
    ),

    GoRoute(
      path: '/privacy-consent',
      builder: (_, __) => const PrivacyConsentScreen(),
    ),

    GoRoute(
      path: '/permissions',
      builder: (_, __) => PermissionsScreen(onNext: () {}),
    ),

    GoRoute(
      path: '/login',
      builder: (_, __) => LoginScreen(
        isSignUp: true,
        onNext: (_) {},
      ),
    ),

    GoRoute(
      path: '/otp',
      builder: (_, state) {
        final phone = state.extra as String? ?? '';
        return OtpVerificationScreen(
          phoneNumber: phone,
          onBack: () {},
          onNext: () {},
        );
      },
    ),

    // ── KYC / Profile ────────────────────────────────────────────────────
    GoRoute(
      path: '/intent',
      builder: (_, __) => IntentOfUseScreen(
        onBack: () {},
        onNext: () {},
      ),
    ),

    GoRoute(
      path: '/kyc/form',
      builder: (_, __) => UserOnboardingScreen(
        onBack: () {},
        onNext: () {},
      ),
    ),

    GoRoute(
      path: '/kyc/documents',
      builder: (_, __) => const MyDocumentsScreen(),
    ),

    // ── Guarantor ────────────────────────────────────────────────────────
    GoRoute(
      path: '/guarantor',
      builder: (_, __) => GuarantorOnboardingScreen(
        onBack: () {},
        onNext: () {},
      ),
    ),

    // ── Plans ────────────────────────────────────────────────────────────
    GoRoute(
      path: '/plans',
      builder: (_, __) => ChoosePlanScreen(
        onBack: () {},
        onNext: () {},
      ),
    ),

    GoRoute(
      path: '/plan-success',
      builder: (_, __) => PlanSuccessScreen(onNext: () {}),
    ),

    // ── Pickup ───────────────────────────────────────────────────────────
    GoRoute(
      path: '/pickup/hub',
      builder: (_, __) => PickupHubScreen(
        onBack: () {},
        onNext: (a, b, c, d, e, f, g, h, i) {},
      ),
    ),

    GoRoute(
      path: '/pickup/verify',
      builder: (_, __) => PickupVerificationScreen(
        hubId: '',
        vehicleId: '',
        emergencyContact: '',
        onBack: () {},
        onNext: () {},
      ),
    ),

    GoRoute(
      path: '/pickup/success',
      builder: (_, __) => PickupSuccessScreen(onFinish: () {}),
    ),

    // ── Wallet / Top-up ──────────────────────────────────────────────────
    GoRoute(
      path: '/wallet/topup/purpose',
      builder: (_, __) => TopUpPurposeScreen(
        onBack: () {},
        onContinue: (_) {},
      ),
    ),

    GoRoute(
      path: '/wallet/topup/amount',
      builder: (_, __) => TopUpAmountScreen(
        onBack: () {},
        onProceed: (_) {},
      ),
    ),

    GoRoute(
      path: '/wallet/topup/upi',
      builder: (_, __) => TopUpUpiScreen(
        amount: 0,
        purpose: 'TOP_UP',
        onBack: () {},
        onSubmit: () {},
        onEditAmount: () {},
      ),
    ),

    GoRoute(
      path: '/wallet/topup/proof',
      builder: (_, __) => TopUpProofScreen(
        amount: 0,
        onBack: () {},
        onEditAmount: () {},
        onSubmit: (_) {},
      ),
    ),

    GoRoute(
      path: '/wallet/topup/receipt',
      builder: (_, __) => TopUpReceiptScreen(
        amount: 0,
        purpose: 'TOP_UP',
        onBackToDashboard: () {},
      ),
    ),

    // ── Dashboard ────────────────────────────────────────────────────────
    GoRoute(
      path: '/dashboard',
      builder: (_, __) => const AppShell(),
    ),

    GoRoute(
      path: '/pre-dashboard',
      builder: (_, __) => PreDashboardScreen(
        onStepNavigation: (_) {},
      ),
    ),

    // ── Support ──────────────────────────────────────────────────────────
    GoRoute(
      path: '/support/faq',
      builder: (_, __) => const FaqScreen(),
    ),

    GoRoute(
      path: '/referral',
      builder: (_, __) => const ReferralScreen(),
    ),

    GoRoute(
      path: '/legal-page',
      builder: (_, __) => const LegalPageScreen(),
    ),

    // ── Rental ───────────────────────────────────────────────────────────
    GoRoute(
      path: '/rental/end',
      builder: (_, __) => EndRentalScreen(
        onBack: () {},
        onSuccess: () {},
      ),
    ),

    GoRoute(
      path: '/vehicle/photos',
      builder: (_, __) => const VehiclePhotosScreen(),
    ),

    GoRoute(
      path: '/tl-details',
      builder: (_, __) => const TlDetailsScreen(),
    ),
  ],
);
