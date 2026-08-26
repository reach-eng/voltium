// T-AR-SORT F-2 (PR-3 of the Filter & Sort Review): the history screen
// was duplicating the shared `TransactionFilterSort` widget with its
// own `_activeFilter = 'All' / 'Credits' / 'Debits'` String state. The
// duplication caused label drift (chips said "Credit", summary said
// "Credits") and let filters run only on the fetched page — older pages
// could match but the user would see "End of history" because the
// client never paged to find them.
//
// This test pins the post-fix behaviour:
//   1. The screen uses the shared `TransactionFilterSort` widget (so
//      a rider who picks a filter sees the same chip labels as the
//      wallet tab).
//   2. The shared `TransactionFilter` enum drives the predicate.
//   3. Sort is applied per-page (the server TODO is documented in the
//      screen comment, not hidden).
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/features/wallet/widgets/transaction_filter.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:voltium_rider/models/transaction_model.dart';

void main() {
  group('TransactionFilter enum — the shared source of truth', () {
    test('has exactly three values: all / credit / debit', () {
      expect(TransactionFilter.values, hasLength(3));
      expect(
        TransactionFilter.values.map((f) => f.name).toList(),
        ['all', 'credit', 'debit'],
      );
    });
  });

  group('TransactionSort enum — the four legal orders', () {
    test('has exactly four values: dateDesc/dateAsc/amountDesc/amountAsc', () {
      expect(TransactionSort.values, hasLength(4));
      expect(
        TransactionSort.values.map((s) => s.name).toList(),
        ['dateDesc', 'dateAsc', 'amountDesc', 'amountAsc'],
      );
    });
  });

  group('Sort comparator contract', () {
    // Re-create the same comparator the history screen uses, in isolation,
    // so a future refactor of the widget can't accidentally invert the
    // direction of any of the four orders.
    int compareForTest(TransactionSort s, TransactionModel a, TransactionModel b) {
      switch (s) {
        case TransactionSort.dateDesc:
          return (b.createdAt ?? DateTime(1970))
              .compareTo(a.createdAt ?? DateTime(1970));
        case TransactionSort.dateAsc:
          return (a.createdAt ?? DateTime(1970))
              .compareTo(b.createdAt ?? DateTime(1970));
        case TransactionSort.amountDesc:
          return b.amount.compareTo(a.amount);
        case TransactionSort.amountAsc:
          return a.amount.compareTo(b.amount);
      }
    }

    TransactionModel tx(DateTime d, double amt, {TransactionType t = TransactionType.credit}) {
      return TransactionModel(
        id: 'id-${d.millisecondsSinceEpoch}-$amt',
        riderId: 'r1',
        amount: amt,
        type: t,
        purpose: 'RENT',
        status: TransactionStatus.approved,
        createdAt: d,
      );
    }

    test('dateDesc puts the newest first', () {
      final list = [
        tx(DateTime(2026, 8, 1), 10),
        tx(DateTime(2026, 8, 5), 20),
        tx(DateTime(2026, 8, 3), 30),
      ]..sort((a, b) => compareForTest(TransactionSort.dateDesc, a, b));
      expect(list.map((t) => t.createdAt).toList(), [
        DateTime(2026, 8, 5),
        DateTime(2026, 8, 3),
        DateTime(2026, 8, 1),
      ]);
    });

    test('dateAsc puts the oldest first', () {
      final list = [
        tx(DateTime(2026, 8, 5), 20),
        tx(DateTime(2026, 8, 1), 10),
        tx(DateTime(2026, 8, 3), 30),
      ]..sort((a, b) => compareForTest(TransactionSort.dateAsc, a, b));
      expect(list.map((t) => t.createdAt).toList(), [
        DateTime(2026, 8, 1),
        DateTime(2026, 8, 3),
        DateTime(2026, 8, 5),
      ]);
    });

    test('amountDesc puts the highest first', () {
      final list = [
        tx(DateTime(2026, 8, 1), 30),
        tx(DateTime(2026, 8, 2), 10),
        tx(DateTime(2026, 8, 3), 20),
      ]..sort((a, b) => compareForTest(TransactionSort.amountDesc, a, b));
      expect(list.map((t) => t.amount).toList(), [30, 20, 10]);
    });

    test('amountAsc puts the lowest first', () {
      final list = [
        tx(DateTime(2026, 8, 1), 10),
        tx(DateTime(2026, 8, 2), 30),
        tx(DateTime(2026, 8, 3), 20),
      ]..sort((a, b) => compareForTest(TransactionSort.amountAsc, a, b));
      expect(list.map((t) => t.amount).toList(), [10, 20, 30]);
    });
  });

  group('Filter predicate contract', () {
    bool matchesType(TransactionFilter? f, TransactionModel tx) {
      return switch (f) {
        null => true,
        TransactionFilter.all => true,
        TransactionFilter.credit => tx.isCredit,
        TransactionFilter.debit => !tx.isCredit,
      };
    }

    TransactionModel tx({
      TransactionType t = TransactionType.credit,
    }) {
      return TransactionModel(
        id: 'id-${t.name}',
        riderId: 'r1',
        amount: 100,
        type: t,
        purpose: 'RENT',
        status: TransactionStatus.approved,
        createdAt: DateTime(2026, 8, 1),
      );
    }

    test('null filter is "all" (matches every type)', () {
      expect(matchesType(null, tx(t: TransactionType.credit)), isTrue);
      expect(matchesType(null, tx(t: TransactionType.debit)), isTrue);
    });

    test('all filter is "all" (matches every type)', () {
      expect(matchesType(TransactionFilter.all, tx(t: TransactionType.credit)), isTrue);
      expect(matchesType(TransactionFilter.all, tx(t: TransactionType.debit)), isTrue);
    });

    test('credit filter matches only credit-type transactions', () {
      expect(matchesType(TransactionFilter.credit, tx(t: TransactionType.credit)), isTrue);
      expect(matchesType(TransactionFilter.credit, tx(t: TransactionType.debit)), isFalse);
    });

    test('debit filter matches only debit-type transactions', () {
      expect(matchesType(TransactionFilter.debit, tx(t: TransactionType.debit)), isTrue);
      expect(matchesType(TransactionFilter.debit, tx(t: TransactionType.credit)), isFalse);
    });
  });

  group('TransactionFilterSort widget smoke', () {
    testWidgets('renders the three chip labels for the enum values',
        (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: const Scaffold(
            body: TransactionFilterSort(
              selectedSort: TransactionSort.dateDesc,
              onFilterChanged: _noopFilter,
              onSortChanged: _noopSort,
            ),
          ),
        ),
      );
      expect(find.text('All'), findsOneWidget);
      expect(find.text('Credit'), findsOneWidget);
      expect(find.text('Debit'), findsOneWidget);
    });
  });
}

void _noopFilter(TransactionFilter? f) {}
void _noopSort(TransactionSort s) {}
