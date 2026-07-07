import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:mocktail/mocktail.dart';
import 'package:voltium_rider/app/app_state.dart';
import 'package:voltium_rider/features/dashboard/presentation/screens/pre_dashboard_screen.dart';
import 'package:voltium_rider/models/rider_model.dart';
import 'package:voltium_rider/providers/app_provider.dart';
import 'package:voltium_rider/providers/rider_provider.dart';
import 'package:voltium_rider/features/profile/domain/repository.dart';
import 'package:voltium_rider/features/rentals/domain/repository.dart';
import 'package:voltium_rider/core/network/files_repository.dart';

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
    return MultiProvider(
      providers: [
        ChangeNotifierProvider<AppProvider>(
          create: (_) => AppProvider(),
        ),
        ChangeNotifierProvider<RiderProvider>(
          create: (_) => RiderProvider(
            riderRepository: mockRiderRepo,
            rentalRepository: mockRentalRepo,
            filesRepository: mockFilesRepo,
          )..setRider(rider),
        ),
      ],
      child: MaterialApp(
        home: PreDashboardScreen(onStepNavigation: onNav),
      ),
    );
  }

  group('PreDashboardScreen Tests', () {
    testWidgets('Shows Start Registration CTA for NEW rider (Rank 0)', (tester) async {
      final rider = const RiderModel(
        id: '1',
        riderId: 'R-1',
        phone: '9999999999',
        name: '',
        lifecycleStatus: 'NEW',
      );

      await tester.pumpWidget(createScreenWithRider(rider, (state) {}));
      await tester.pumpAndSettle();

      expect(find.text('START REGISTRATION'), findsOneWidget);
    });

    testWidgets('Shows Book Vehicle CTA for GUARANTOR_SUBMITTED (Rank 3)', (tester) async {
      final rider = const RiderModel(
        id: '1',
        riderId: 'R-1',
        phone: '9999999999',
        lifecycleStatus: 'GUARANTOR_SUBMITTED',
        name: 'John Doe',
      );

      await tester.pumpWidget(createScreenWithRider(rider, (state) {}));
      await tester.pumpAndSettle();

      expect(find.text('BOOK VEHICLE'), findsOneWidget);
    });

    testWidgets('Shows Wallet TopUp for PLAN_SELECTED (Rank 4)', (tester) async {
      final rider = const RiderModel(
        id: '1',
        riderId: 'R-1',
        phone: '9999999999',
        lifecycleStatus: 'PLAN_SELECTED',
        name: 'John Doe',
        currentPlan: 'plan-1',
        walletBalance: 0,
      );

      await tester.pumpWidget(createScreenWithRider(rider, (state) {}));
      await tester.pumpAndSettle();

      expect(find.text('Top Up Wallet'), findsOneWidget);
    });
  });
}
