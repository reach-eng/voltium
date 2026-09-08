import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/features/support/domain/entity.dart';
import 'package:voltium_rider/features/support/presentation/providers/ticket_provider.dart';
import 'package:voltium_rider/models/support_model.dart';
import 'package:voltium_rider/utils/app_config.dart';
import 'package:voltium_rider/utils/support_launcher.dart';

TicketEntity ticketWith(String status) => TicketEntity(
      id: 'id1',
      ticketId: '#ABC',
      subject: 's',
      status: TicketEntity.fromJson({
        'id': 'id1',
        'ticketId': '#ABC',
        'subject': 's',
        'status': status,
        'createdAt': DateTime.now().toIso8601String(),
        'updatedAt': DateTime.now().toIso8601String(),
      }).status,
      createdAt: DateTime.now(),
      updatedAt: DateTime.now(),
    );

void main() {
  group('P0-2 envelope parser', () {
    test('top-level tickets', () {
      final maps = extractTicketMaps({
        'tickets': [
          {'id': 'a'}
        ]
      });
      expect(maps.length, 1);
    });
    test('data.tickets envelope (success wrapper)', () {
      final maps = extractTicketMaps({
        'success': true,
        'data': {
          'tickets': [
            {'id': 'a'},
            {'id': 'b'}
          ]
        }
      });
      expect(maps.length, 2);
    });
    test('data list envelope', () {
      final maps = extractTicketMaps({
        'data': [
          {'id': 'a'}
        ]
      });
      expect(maps.length, 1);
    });
    test('empty on unknown shape', () {
      expect(extractTicketMaps({'foo': 1}), isEmpty);
    });
  });

  group('P0-3 FaqItem compat', () {
    test('server shape with category', () {
      final f = FaqItem.fromJson({
        'id': '1',
        'question': 'q',
        'answer': 'a',
        'category': 'Payments',
      });
      expect(f.categoryId, 'Payments');
    });
    test('legacy categoryId shape', () {
      final f = FaqItem.fromJson({
        'id': '1',
        'question': 'q',
        'answer': 'a',
        'categoryId': 'tech',
      });
      expect(f.categoryId, 'tech');
    });
    test('missing category falls back', () {
      final f = FaqItem.fromJson({'id': '1', 'question': 'q', 'answer': 'a'});
      expect(f.categoryId, 'general');
    });
  });

  group('P1-2 status sweep', () {
    test('WAITING_ON_RIDER parses', () {
      expect(
          ticketWith('WAITING_ON_RIDER').status, TicketStatus.waitingOnRider);
      expect(ticketWith('WAITING_ON_RIDER').statusKey, 'WAITING_ON_RIDER');
    });
    test('unknown defaults to open', () {
      expect(ticketWith('BOGUS').status, TicketStatus.open);
    });
    test('open filter includes legacy assigned', () {
      final state = TicketState(
        tickets: [ticketWith('OPEN'), ticketWith('ASSIGNED')],
        filter: TicketFilter.open,
      );
      expect(state.filteredTickets.length, 2);
    });
    test('waiting filter isolates', () {
      final state = TicketState(
        tickets: [ticketWith('OPEN'), ticketWith('WAITING_ON_RIDER')],
        filter: TicketFilter.waitingOnRider,
      );
      expect(state.filteredTickets.length, 1);
    });
    test('filter labels use spaces', () {
      expect(ticketFilterLabel(TicketFilter.inProgress), 'IN PROGRESS');
      expect(ticketFilterLabel(TicketFilter.waitingOnRider), 'WAITING');
    });
  });

  group('P0-1 phone sanitize', () {
    test('strips formatting keeps +', () {
      expect(
          SupportLauncher.sanitizePhone('+91 (555) 123-4567'), '+915551234567');
    });
    // P0-3 follow-up (2026-09-07): vanity letters are dialpad keys, not
    // noise. The old `\D` strip dialed a TRUNCATED WRONG NUMBER
    // (+911800889) for the server-driven support phone.
    test('maps vanity letters via T9 to the dialable number', () {
      expect(
          SupportLauncher.sanitizePhone('+91 1800-889-VOLT'), '+9118008898658');
      expect(SupportLauncher.sanitizePhone('+91 1800-889-VOLT'),
          AppConfig.supportPhoneCompact);
    });
    test('null/empty safe', () {
      expect(SupportLauncher.sanitizePhone(null), '');
      expect(SupportLauncher.sanitizePhone(''), '');
    });
  });
}
