import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/core/state/rider_provider.dart';
import 'package:voltium_rider/features/wallet/presentation/screens/history_screen.dart';
import 'package:voltium_rider/features/wallet/presentation/providers/wallet_provider.dart';
import 'package:voltium_rider/features/wallet/domain/repository.dart';
import 'package:voltium_rider/features/wallet/domain/entity.dart' as entity;
import 'package:voltium_rider/models/rider_model.dart';
import 'package:voltium_rider/theme/app_theme.dart';

class _FakePagedWalletRepository implements WalletRepository {
  final Map<int, List<entity.TransactionEntity>> pagedData;

  _FakePagedWalletRepository(this.pagedData);

  @override
  Future<entity.TopupRequest> submitTopup(entity.TopupRequest request) async {
    return request;
  }

  @override
  Future<List<entity.TransactionEntity>> getTransactionHistory(String riderId,
      {int page = 1, int limit = 20}) async {
    return pagedData[page] ?? [];
  }
}

class _SeededRiderNotifier extends RiderNotifier {
  _SeededRiderNotifier(this._seed);
  final RiderModel _seed;

  @override
  RiderState build() => RiderState(
        rider: _seed,
        riderId: _seed.riderId.isNotEmpty ? _seed.riderId : _seed.id,
        phone: _seed.phone,
        dataState: DataState.fresh,
        hasFetchedOnce: true,
      );
}

void main() {
  Widget buildTestHost({
    required WalletRepository repo,
    VoidCallback? onBack,
  }) {
    return ProviderScope(
      overrides: [
        walletRepositoryProvider.overrideWithValue(repo),
        riderProvider.overrideWith(() => _SeededRiderNotifier(
              const RiderModel(
                id: 'rider_123',
                riderId: 'rider_123',
                name: 'Test Rider',
                phone: '9999999999',
                lifecycleStatus: 'ACTIVE',
              ),
            )),
      ],
      child: MaterialApp(
        theme: AppTheme.lightTheme,
        home: HistoryScreen(
          riderId: 'rider_123',
          onBack: onBack,
        ),
      ),
    );
  }

  group('HistoryScreen Tests', () {
    testWidgets(
        'displays correct summary totals from multi-page transactions (N-4)',
        (tester) async {
      tester.view.physicalSize = const Size(800, 1600);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      // 100 items on page 1 (50 rs each = 5000), 50 items on page 2 (20 rs each = 1000)
      final repo = _FakePagedWalletRepository({
        1: List.generate(
          100,
          (i) => entity.TransactionEntity(
            id: 'p1_$i',
            amountInRupees: 50.0,
            type: 'CREDIT',
            status: 'SUCCESS',
            purpose: 'TOP_UP',
            createdAt: DateTime.now().subtract(Duration(minutes: i)),
          ),
        ),
        2: List.generate(
          50,
          (i) => entity.TransactionEntity(
            id: 'p2_$i',
            amountInRupees: 20.0,
            type: 'DEBIT',
            status: 'SUCCESS',
            purpose: 'RENT_PAYMENT',
            createdAt: DateTime.now().subtract(Duration(hours: 1, minutes: i)),
          ),
        ),
      });

      await tester.pumpWidget(buildTestHost(repo: repo));
      await tester.pumpAndSettle();

      // Verify Header and Summary Card values reflect all 150 items
      expect(find.text('Transaction History'), findsOneWidget);
      expect(find.text('+₹5000'), findsOneWidget);
      expect(find.text('-₹1000'), findsOneWidget);
      expect(find.text('₹4000'), findsOneWidget);
    });

    testWidgets('filters transactions by tab', (tester) async {
      tester.view.physicalSize = const Size(800, 1600);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      final repo = _FakePagedWalletRepository({
        1: [
          entity.TransactionEntity(
            id: 'tx_credit',
            amountInRupees: 500.0,
            type: 'CREDIT',
            status: 'SUCCESS',
            purpose: 'WALLET_TOPUP',
            createdAt: DateTime.now(),
          ),
          entity.TransactionEntity(
            id: 'tx_debit',
            amountInRupees: 200.0,
            type: 'DEBIT',
            status: 'SUCCESS',
            purpose: 'RENT_CHARGE',
            createdAt: DateTime.now().subtract(const Duration(minutes: 5)),
          ),
        ],
      });

      await tester.pumpWidget(buildTestHost(repo: repo));
      await tester.pumpAndSettle();

      // Tap Credits tab
      await tester.tap(find.text('Credits'));
      await tester.pumpAndSettle();

      expect(find.text('+₹500'), findsWidgets);

      // Tap Debits tab
      await tester.tap(find.text('Debits'));
      await tester.pumpAndSettle();

      expect(find.text('-₹200'), findsWidgets);
    });
  });
}
