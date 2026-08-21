import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:mocktail/mocktail.dart';
import 'package:voltium_rider/app/app_state.dart';
import 'package:voltium_rider/features/dashboard/presentation/screens/legacy/pre_dashboard_screen.dart';
import 'package:voltium_rider/models/rider_model.dart';
import 'package:voltium_rider/core/state/rider_provider.dart';
import 'package:voltium_rider/features/profile/domain/repository.dart';
import 'package:voltium_rider/features/rentals/domain/repository.dart';
import 'package:voltium_rider/core/network/files_repository.dart';
import 'package:voltium_rider/features/dashboard/widgets/dashboard_wallet_card.dart';

class MockRiderRepository extends Mock implements RiderRepository {}

class MockRentalRepository extends Mock implements RentalRepository {}

class MockFilesRepository extends Mock implements FilesRepository {}

void main() {
  late MockRiderRepository mockRiderRepo;
  late MockRentalRepository mockRentalRepo;
  late MockFilesRepository mockFilesRepo;

  setUp(() {
    mockRiderRepo = MockRiderRepository();
    mockRentalRepo = MockRentalRepository();
    mockFilesRepo = MockFilesRepository();
  });

  Widget createScreenWithRider(RiderModel rider, Function(AuthState) onNav) {
    return ProviderScope(
      overrides: [
        riderRepositoryProvider.overrideWithValue(mockRiderRepo),
        rentalRepositoryProvider.overrideWithValue(mockRentalRepo),
        filesRepositoryProvider.overrideWithValue(mockFilesRepo),
        riderProvider.overrideWith(() => _TestRiderNotifier(rider)),
      ],
      child: MaterialApp(
        home: PreDashboardScreen(onStepNavigation: onNav),
      ),
    );
  }

  group('PreDashboardScreen Tests', () {
    testWidgets('Shows Start Registration CTA for NEW rider (Rank 0)',
        (tester) async {
      final rider = const RiderModel(
        id: '1',
        riderId: 'R-1',
        phone: '9999999999',
        name: '',
        lifecycleStatus: 'NEW',
      );

      await tester.pumpWidget(createScreenWithRider(rider, (state) {}));
      await tester.pump(const Duration(seconds: 1));
      await tester.pump();

      expect(find.text('START REGISTRATION'), findsOneWidget);
    });

    testWidgets('Shows Book Vehicle CTA for GUARANTOR_SUBMITTED (Rank 3)',
        (tester) async {
      final rider = const RiderModel(
        id: '1',
        riderId: 'R-1',
        phone: '9999999999',
        lifecycleStatus: 'GUARANTOR_SUBMITTED',
        name: 'John Doe',
        registrationDone: true,
        kycDone: true,
        kycStatus: KycStatus.approved,
        depositDone: true,
      );

      await tester.pumpWidget(createScreenWithRider(rider, (state) {}));
      await tester.pump(const Duration(seconds: 1));
      await tester.pump();

      expect(find.text('PICKUP YOUR VEHICLE'), findsOneWidget);
    });

    testWidgets('Shows Wallet TopUp for PLAN_SELECTED (Rank 9)',
        (tester) async {
      final rider = const RiderModel(
        id: '1',
        riderId: 'R-1',
        phone: '9999999999',
        lifecycleStatus: 'PLAN_SELECTED',
        name: 'John Doe',
        currentPlan: 'plan-1',
        walletBalance: 0,
        kycStatus: KycStatus.approved,
        depositStatus: DepositStatus.approved,
      );

      await tester.pumpWidget(createScreenWithRider(rider, (state) {}));
      await tester.pump(const Duration(seconds: 1));
      await tester.pump();

      expect(find.text('PICKUP YOUR VEHICLE'), findsOneWidget);
    });
  });
}

class _TestRiderNotifier extends RiderNotifier {
  final RiderModel _initialRider;
  _TestRiderNotifier(this._initialRider);

  @override
  RiderState build() {
    return RiderState(
      rider: _initialRider,
      riderId: _initialRider.riderId.isNotEmpty
          ? _initialRider.riderId
          : _initialRider.id,
      phone: _initialRider.phone,
    );
  }
}
