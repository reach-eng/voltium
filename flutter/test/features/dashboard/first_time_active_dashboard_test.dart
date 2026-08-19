import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:voltium_rider/models/rider_model.dart';
import 'package:voltium_rider/models/upcoming_rent_prompt.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:voltium_rider/features/dashboard/widgets/dashboard_profile_card.dart';
import 'package:voltium_rider/features/dashboard/widgets/dashboard_plan_card.dart';
import 'package:voltium_rider/features/dashboard/widgets/dashboard_wallet_card.dart';
import 'package:voltium_rider/features/dashboard/widgets/dashboard_normal_wallet_card.dart';
import 'package:voltium_rider/features/dashboard/widgets/dashboard_low_balance_card.dart';
import 'package:voltium_rider/features/dashboard/widgets/dashboard_referral_card.dart';
import 'package:voltium_rider/features/dashboard/widgets/dashboard_tl_card.dart';
import 'package:voltium_rider/features/dashboard/widgets/dashboard_scooter_banner.dart';
import 'package:voltium_rider/features/dashboard/widgets/dashboard_rent_prompt_card.dart';
import 'package:voltium_rider/features/dashboard/widgets/dashboard_sheets.dart';
import 'package:voltium_rider/features/rentals/presentation/screens/rental_details_screen.dart';
import 'package:voltium_rider/core/state/rider_provider.dart';

class _SeededRiderNotifier extends RiderNotifier {
  final RiderModel _seed;
  _SeededRiderNotifier(this._seed);

  @override
  RiderState build() => RiderState(
        rider: _seed,
        riderId: _seed.riderId.isNotEmpty ? _seed.riderId : _seed.id,
        phone: _seed.phone,
        dataState: DataState.fresh,
        hasFetchedOnce: true,
      );
}

Widget createLocalizedTestApp({
  required Widget child,
  Locale locale = const Locale('en'),
  ThemeMode themeMode = ThemeMode.light,
  List<dynamic> overrides = const [],
}) {
  return ProviderScope(
    overrides: overrides.cast(),
    child: MaterialApp(
      locale: locale,
      themeMode: themeMode,
      theme: AppTheme.lightTheme,
      darkTheme: AppTheme.darkTheme,
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: AppLocalizations.supportedLocales,
      home: Scaffold(body: child),
    ),
  );
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('First-Time Active Dashboard Component & Subscreen Tests', () {
    final firstTimeRider = RiderModel(
      id: 'rider-123',
      riderId: 'rider-123',
      name: 'Aditya Kumar',
      phone: '+919876543210',
      walletBalance: 2500,
      currentPlanPrice: 1200,
      paymentStreak: 3,
      currentPlan: 'WEEKLY',
      rentalStatus: 'ACTIVE',
      assignedVehicle: null,
      teamLeader: null,
      teamLeaderPhone: '+919876500000',
      pickupHub: 'South Hub',
      referralCode: 'VOLT2026',
      planStartDate: DateTime.now().subtract(const Duration(days: 2)),
      planEndDate: DateTime.now().add(const Duration(days: 5)),
      accountStatus: AccountStatus.active,
    );

    testWidgets('DashboardProfileCard displays unassigned vehicle fallback and rider name', (tester) async {
      await tester.pumpWidget(
        createLocalizedTestApp(
          child: DashboardProfileCard(
            rider: firstTimeRider,
            onTap: () {},
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Aditya Kumar'), findsOneWidget);
      expect(find.text('Vehicle Pending Assignment'), findsOneWidget);
    });

    testWidgets('DashboardProfileCard renders in Dark Mode without crashing', (tester) async {
      await tester.pumpWidget(
        createLocalizedTestApp(
          themeMode: ThemeMode.dark,
          child: DashboardProfileCard(
            rider: firstTimeRider.copyWith(name: ''),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Rider'), findsOneWidget);
      expect(find.text('Vehicle Pending Assignment'), findsOneWidget);
    });

    testWidgets('DashboardProfileCard renders in Hindi localization', (tester) async {
      await tester.pumpWidget(
        createLocalizedTestApp(
          locale: const Locale('hi'),
          child: DashboardProfileCard(
            rider: firstTimeRider.copyWith(name: ''),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('राइडर'), findsOneWidget);
      expect(find.text('वाहन आवंटन लंबित है'), findsOneWidget);
    });

    testWidgets('PlanCard renders weekly plan and time remaining correctly', (tester) async {
      await tester.pumpWidget(
        createLocalizedTestApp(
          child: PlanCard(
            currentPlan: 'WEEKLY',
            planEndDate: DateTime.now().add(const Duration(days: 5)),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('CURRENT SUBSCRIPTION'), findsOneWidget);
      expect(find.text('WEEKLY'), findsOneWidget);
      expect(find.text('TIME REMAINING'), findsOneWidget);
      expect(find.text('NEXT RECHARGE'), findsOneWidget);
    });

    testWidgets('PlanCard renders NO PLAN fallback when plan is empty', (tester) async {
      await tester.pumpWidget(
        createLocalizedTestApp(
          child: const PlanCard(
            currentPlan: null,
            compact: true,
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('NO PLAN'), findsOneWidget);
      expect(find.text('No Plan'), findsOneWidget);
    });

    testWidgets('DashboardNormalWalletCard renders balance, streak and triggers top-up', (tester) async {
      bool topUpTapped = false;
      await tester.pumpWidget(
        createLocalizedTestApp(
          child: DashboardNormalWalletCard(
            walletBalance: 3500,
            requiredPayment: 1200,
            paymentStreak: 3,
            colors: ThemeColors.light,
            amountTextColor: Colors.black,
            hasPulsatingRedAmountHalo: false,
            onTopUp: () {
              topUpTapped = true;
            },
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('TOTAL BALANCE'), findsOneWidget);
      expect(find.text('3/5 Days'), findsOneWidget);
      expect(find.textContaining('A minimum recharge of ₹1200'), findsOneWidget);

      await tester.tap(find.byIcon(Icons.add));
      await tester.pump();
      expect(topUpTapped, isTrue);
    });

    testWidgets('DashboardLowBalanceCard renders warning and triggers top-up', (tester) async {
      bool topUpTapped = false;
      await tester.pumpWidget(
        createLocalizedTestApp(
          child: DashboardLowBalanceCard(
            walletBalance: 200,
            requiredPayment: 1200,
            paymentStreak: 1,
            isDailyPlan: false,
            colors: ThemeColors.light,
            amountTextColor: Colors.red,
            hasPulsatingRedAmountHalo: false,
            onTopUp: () {
              topUpTapped = true;
            },
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('AVAILABLE BALANCE'), findsOneWidget);
      expect(find.textContaining('Top Up Now to Ride'), findsOneWidget);
      expect(find.text('Top Up Wallet'), findsOneWidget);

      await tester.tap(find.text('Top Up Wallet'));
      await tester.pump();
      expect(topUpTapped, isTrue);
    });

    testWidgets('ReferralCard displays code and supports copy action', (tester) async {
      bool copyTapped = false;
      await tester.pumpWidget(
        createLocalizedTestApp(
          child: ReferralCard(
            referralCode: 'VOLT2026',
            onCopy: () {
              copyTapped = true;
            },
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Refer & Earn'), findsOneWidget);
      expect(find.text('YOUR CODE'), findsOneWidget);
      expect(find.text('VOLT2026'), findsOneWidget);

      await tester.tap(find.byIcon(Icons.copy));
      await tester.pump();
      expect(copyTapped, isTrue);
    });

    testWidgets('TeamLeaderCard displays pending hub notice when unassigned', (tester) async {
      bool detailsTapped = false;
      await tester.pumpWidget(
        createLocalizedTestApp(
          child: TeamLeaderCard(
            teamLeaderName: null,
            onViewDetails: () {
              detailsTapped = true;
            },
            onCall: () {},
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Team Leader'), findsOneWidget);
      expect(find.text('Not assigned'), findsOneWidget);
      expect(find.text('Your hub will assign a team leader shortly'), findsOneWidget);

      await tester.tap(find.text('View Details'));
      await tester.pump();
      expect(detailsTapped, isTrue);
    });

    testWidgets('ScooterSubmissionBanner displays formatted submission details', (tester) async {
      await tester.pumpWidget(
        createLocalizedTestApp(
          child: const ScooterSubmissionBanner(
            submissionDate: '2026-08-20T10:00:00.000Z',
            pickupHub: 'South Hub Center',
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.textContaining('Scooter Submission'), findsOneWidget);
      expect(find.textContaining('Submission Date:'), findsOneWidget);
      expect(find.text('Hub Name: South Hub Center'), findsOneWidget);
    });

    testWidgets('DashboardRentPromptCard displays upcoming debit alert', (tester) async {
      final prompt = UpcomingRentPrompt(
        leaseId: 'lease-123',
        showPrompt: true,
        requiresTopUp: true,
        rentAmountInRupees: 1200,
        walletBalanceInRupees: 400,
        shortfallInRupees: 800,
        recommendedTopUpRupees: 800,
        dueDate: DateTime(2026, 8, 21, 6, 0),
        dueTimeFormatted: '6:00 AM',
      );

      await tester.pumpWidget(
        createLocalizedTestApp(
          child: DashboardRentPromptCard(prompt: prompt),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('UPCOMING RENT DEBIT'), findsOneWidget);
      expect(find.text('Top-up before tomorrow 6 AM'), findsOneWidget);
      expect(find.textContaining('shortfall: ₹800'), findsOneWidget);
      expect(find.text('Top up ₹800'), findsOneWidget);
    });

    testWidgets('RentalDetailsScreen displays plan, table, dark mode tokens, and actions', (tester) async {
      await tester.pumpWidget(
        createLocalizedTestApp(
          themeMode: ThemeMode.dark,
          overrides: [
            riderProvider.overrideWith(
              () => _SeededRiderNotifier(firstTimeRider),
            ),
          ],
          child: const RentalDetailsScreen(),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Rental Details'), findsOneWidget);
      expect(find.text('CURRENT PLAN'), findsOneWidget);
      expect(find.text('WEEKLY'), findsOneWidget);
      expect(find.text('Rental Information'), findsOneWidget);
      expect(find.text('Vehicle Pending Assignment'), findsOneWidget);
      expect(find.text('Pickup Hub'), findsOneWidget);
      expect(find.text('South Hub'), findsOneWidget);
      expect(find.text('Team Leader'), findsOneWidget);
      expect(find.text('Change Plan'), findsOneWidget);
      expect(find.text('End Rental'), findsOneWidget);
    });

    testWidgets('showTLDetailsSheet and showChangeTLReasonSheet open without errors', (tester) async {
      await tester.pumpWidget(
        createLocalizedTestApp(
          child: Builder(
            builder: (context) {
              return ElevatedButton(
                onPressed: () => showTLDetailsSheet(context, firstTimeRider),
                child: const Text('Open TL Sheet'),
              );
            },
          ),
        ),
      );
      await tester.pumpAndSettle();

      await tester.tap(find.text('Open TL Sheet'));
      await tester.pumpAndSettle();

      expect(find.text('Assigned Team Leader'), findsOneWidget);
      expect(find.text('Change TL'), findsOneWidget);
      expect(find.text('Close'), findsOneWidget);

      await tester.tap(find.text('Change TL'));
      await tester.pumpAndSettle();

      expect(find.text('Change Team Leader'), findsOneWidget);
      expect(find.text('Submit Request'), findsOneWidget);
    });

    testWidgets('showSubscriptionSheet and showIntentDialog open without errors', (tester) async {
      await tester.pumpWidget(
        createLocalizedTestApp(
          child: Builder(
            builder: (context) {
              return ElevatedButton(
                onPressed: () => showSubscriptionSheet(context, firstTimeRider),
                child: const Text('Open Sub Sheet'),
              );
            },
          ),
        ),
      );
      await tester.pumpAndSettle();

      await tester.tap(find.text('Open Sub Sheet'));
      await tester.pumpAndSettle();

      expect(find.text('Manage Subscription'), findsOneWidget);
      expect(find.text('Active'), findsOneWidget);
      expect(find.text('Request Plan Change'), findsOneWidget);
      expect(find.text('End Rental'), findsOneWidget);

      await tester.tap(find.text('Close'));
      await tester.pumpAndSettle();
    });
  });
}
