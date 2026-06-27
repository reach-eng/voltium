import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:voltium_rider/core/network/files_repository.dart';
import 'package:voltium_rider/features/wallet/domain/repository.dart';
import 'package:voltium_rider/features/wallet/domain/entity.dart' as entity;
import 'package:voltium_rider/providers/wallet_provider.dart';
import 'package:voltium_rider/models/transaction_model.dart';

class MockWalletRepository extends Mock implements WalletRepository {}
class MockFilesRepository extends Mock implements FilesRepository {}
class MockFile extends Mock implements File {}

void main() {
  setUpAll(() {
    registerFallbackValue(const entity.TopupRequest(
      riderId: 'test',
      amount: 100.0,
      method: 'UPI',
    ));
  });

  group('WalletProvider Tests', () {
    late MockWalletRepository mockWalletRepo;
    late MockFilesRepository mockFilesRepo;
    late WalletProvider walletProvider;

    setUp(() {
      mockWalletRepo = MockWalletRepository();
      mockFilesRepo = MockFilesRepository();
      walletProvider = WalletProvider(
        walletRepository: mockWalletRepo,
        filesRepository: mockFilesRepo,
      );
    });

    test('Initial state is correct', () {
      expect(walletProvider.transactions, isEmpty);
      expect(walletProvider.isRefreshingTransactions, isFalse);
      expect(walletProvider.isToppingUp, isFalse);
      expect(walletProvider.walletMinTopup, 0.0);
      expect(walletProvider.walletBalanceLow, isFalse);
      expect(walletProvider.currentBalance, 0.0);
    });

    test('setWalletBalanceWarning updates low balance states', () {
      walletProvider.setWalletBalanceWarning(true, balance: 45.0);

      expect(walletProvider.walletBalanceLow, isTrue);
      expect(walletProvider.currentBalance, 45.0);
    });

    test('setWalletSettings updates minimum topup value', () {
      walletProvider.setWalletSettings(150.0);

      expect(walletProvider.walletMinTopup, 150.0);
    });

    test('refreshTransactions loads mapped transaction models', () async {
      final now = DateTime.now();
      final mockEntities = [
        entity.TransactionEntity(
          id: 'tx-1',
          amountInPaise: 10000,
          type: 'CREDIT',
          purpose: 'Wallet Top Up',
          status: 'SUCCESS',
          createdAt: now,
        ),
        entity.TransactionEntity(
          id: 'tx-2',
          amountInPaise: 5000,
          type: 'DEBIT',
          purpose: 'Plan Payment',
          status: 'PENDING',
          createdAt: now,
        ),
      ];

      when(() => mockWalletRepo.getTransactionHistory('rider-123'))
          .thenAnswer((_) async => mockEntities);

      await walletProvider.refreshTransactions(riderId: 'rider-123');

      expect(walletProvider.transactions, hasLength(2));
      expect(walletProvider.transactions[0].id, 'tx-1');
      expect(walletProvider.transactions[0].amount, 100.0);
      expect(walletProvider.transactions[0].type, TransactionType.credit);
      expect(walletProvider.transactions[0].status, TransactionStatus.success);

      expect(walletProvider.transactions[1].id, 'tx-2');
      expect(walletProvider.transactions[1].amount, 50.0);
      expect(walletProvider.transactions[1].type, TransactionType.debit);
      expect(walletProvider.transactions[1].status, TransactionStatus.pending);
    });

    test('deleteTransactionHistory clears local list and calls repository', () async {
      when(() => mockWalletRepo.deleteTransactionHistory('rider-123'))
          .thenAnswer((_) async => {});

      await walletProvider.deleteTransactionHistory(riderId: 'rider-123');

      expect(walletProvider.transactions, isEmpty);
      verify(() => mockWalletRepo.deleteTransactionHistory('rider-123')).called(1);
    });

    test('topUpWallet uploads proof screenshot if image provided', () async {
      final mockFile = MockFile();
      when(() => mockFilesRepo.uploadFile(mockFile, 'TOPUP_PROOF'))
          .thenAnswer((_) async => 'https://s3.aws.com/proof.png');
      when(() => mockWalletRepo.submitTopup(any()))
          .thenAnswer((_) async => const entity.TopupRequest(
                riderId: 'rider-123',
                amount: 250.0,
                method: 'UPI',
                proofUrl: 'https://s3.aws.com/proof.png',
              ));
      when(() => mockWalletRepo.getTransactionHistory('rider-123'))
          .thenAnswer((_) async => []);

      await walletProvider.topUpWallet(
        amount: 250.0,
        method: 'UPI',
        image: mockFile,
        riderId: 'rider-123',
      );

      verify(() => mockFilesRepo.uploadFile(mockFile, 'TOPUP_PROOF')).called(1);
      verify(() => mockWalletRepo.submitTopup(any(
            that: isA<entity.TopupRequest>()
                .having((r) => r.proofUrl, 'proofUrl', 'https://s3.aws.com/proof.png'),
          ))).called(1);
      expect(walletProvider.isToppingUp, isFalse);
    });

    test('logout clears state values', () {
      walletProvider.setWalletBalanceWarning(true, balance: 20.0);
      walletProvider.setWalletSettings(200.0);

      walletProvider.logout();

      expect(walletProvider.transactions, isEmpty);
      expect(walletProvider.currentBalance, 0.0);
      expect(walletProvider.walletBalanceLow, isFalse);
      expect(walletProvider.isRefreshingTransactions, isFalse);
      expect(walletProvider.isToppingUp, isFalse);
    });
  });
}
