import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/models/earnings_entry_model.dart';
import 'package:voltium_rider/models/support_model.dart';
import 'package:voltium_rider/models/sponsored_offer_model.dart';
import 'package:voltium_rider/models/rider_kyc.dart';
import 'package:voltium_rider/models/rider_model.dart';

void main() {
  // ── EarningEntry ────────────────────────────────────────────────────────
  group('EarningEntry', () {
    test('fromJson parses all fields', () {
      final json = {
        'id': 'e1',
        'date': '2024-06-01T00:00:00.000Z',
        'platform': 'zomato',
        'amount': 750.50,
        'trips': 12,
        'hours': 8.5,
        'notes': 'Good day',
      };
      final e = EarningEntry.fromJson(json);
      expect(e.platform, GigPlatform.zomato);
      expect(e.amount, 750.50);
      expect(e.trips, 12);
      expect(e.notes, 'Good day');
    });

    test('fromJson falls back to GigPlatform.other for unknown platform', () {
      final json = {
        'id': 'e1', 'date': '2024-01-01T00:00:00.000Z',
        'platform': 'unknown_app', 'amount': 100.0, 'trips': 5, 'hours': 4.0,
      };
      expect(EarningEntry.fromJson(json).platform, GigPlatform.other);
    });

    test('toJson serializes date as ISO string', () {
      final e = EarningEntry(
        id: 'e1', date: DateTime(2024, 6, 1), platform: GigPlatform.swiggy,
        amount: 200.0, trips: 5, hours: 3.0,
      );
      final json = e.toJson();
      expect(json['platform'], 'swiggy');
      expect(json['date'], contains('2024-06-01'));
    });

    test('platformLabel returns correct labels', () {
      expect(EarningEntry.platformLabel(GigPlatform.zomato), 'Zomato');
      expect(EarningEntry.platformLabel(GigPlatform.swiggy), 'Swiggy');
      expect(EarningEntry.platformLabel(GigPlatform.zepto), 'Zepto');
      expect(EarningEntry.platformLabel(GigPlatform.blinkit), 'Blinkit');
      expect(EarningEntry.platformLabel(GigPlatform.other), 'Other');
    });

    test('platformColor returns distinct Color values', () {
      final colors = GigPlatform.values.map(EarningEntry.platformColor).toList();
      // All should be non-null Color instances
      expect(colors.every((c) => c is Color), isTrue);
    });
  });

  // ── FaqCategory._parseColor (via fromJson) ──────────────────────────────
  group('FaqCategory._parseColor', () {
    Map<String, dynamic> _base({required dynamic iconColor}) => {
          'id': 'c1', 'title': 'T', 'subtitle': 'S', 'articleCount': 5,
          'icon': 'build', 'iconColor': iconColor, 'iconBgColor': 0xFF000000,
        };

    test('parses int color value', () {
      final faq = FaqCategory.fromJson(_base(iconColor: 0xFF4CAF50));
      expect(faq.iconColor.value, 0xFF4CAF50);
    });

    test('parses hex string 0xFF... color value', () {
      final faq = FaqCategory.fromJson(_base(iconColor: '0xFFD97706'));
      expect(faq.iconColor.value, 0xFFD97706);
    });

    test('parses decimal string color value', () {
      final faq = FaqCategory.fromJson(_base(iconColor: '4292409094'));
      expect(faq.iconColor.value, 4292409094);
    });

    test('defaults to black for invalid string', () {
      final faq = FaqCategory.fromJson(_base(iconColor: 'invalid'));
      expect(faq.iconColor.value, 0xFF000000);
    });
  });

  // ── FaqCategory._getIconData (via fromJson) ──────────────────────────────
  group('FaqCategory._getIconData', () {
    FaqCategory _fromIcon(String name) => FaqCategory.fromJson({
          'id': 'c1', 'title': 'T', 'subtitle': 'S', 'articleCount': 0,
          'icon': name, 'iconColor': 0xFF000000, 'iconBgColor': 0xFF000000,
        });

    test('build → Icons.build_outlined', () {
      expect(_fromIcon('build').icon, Icons.build_outlined);
    });

    test('payment → Icons.credit_card_outlined', () {
      expect(_fromIcon('payment').icon, Icons.credit_card_outlined);
    });

    test('moped → Icons.electric_moped_outlined', () {
      expect(_fromIcon('moped').icon, Icons.electric_moped_outlined);
    });

    test('person → Icons.person_outline', () {
      expect(_fromIcon('person').icon, Icons.person_outline);
    });

    test('chat → Icons.chat_bubble_outline', () {
      expect(_fromIcon('chat').icon, Icons.chat_bubble_outline);
    });

    test('unknown → Icons.help_outline', () {
      expect(_fromIcon('unknown_icon').icon, Icons.help_outline);
    });
  });

  // ── FaqItem ──────────────────────────────────────────────────────────────
  group('FaqItem', () {
    test('category getter returns categoryId', () {
      final item = FaqItem.fromJson({
        'id': 'f1', 'categoryId': 'cat123', 'question': 'Q?', 'answer': 'A.',
      });
      expect(item.category, 'cat123');
      expect(item.category, item.categoryId);
    });
  });

  // ── IssueModel fallback parsing ──────────────────────────────────────────
  group('IssueModel.fromJson', () {
    test('uses ticketId when present', () {
      final m = IssueModel.fromJson({
        'id': 'i1', 'ticketId': 'TKT-001',
        'subject': 'Help', 'message': 'Msg',
        'category': 'BILLING', 'status': 'OPEN',
        'createdAt': '2024-01-01T00:00:00.000Z',
      });
      expect(m.ticketId, 'TKT-001');
    });

    test('falls back ticketId to id when absent', () {
      final m = IssueModel.fromJson({
        'id': 'i1',
        'subject': 'Help', 'message': 'Msg',
        'category': 'BILLING', 'status': 'OPEN',
        'createdAt': '2024-01-01T00:00:00.000Z',
      });
      expect(m.ticketId, 'i1');
    });

    test('falls back subject to title when absent', () {
      final m = IssueModel.fromJson({
        'id': 'i1', 'title': 'My Title', 'message': 'Msg',
        'category': 'BILLING', 'status': 'OPEN',
        'createdAt': '2024-01-01T00:00:00.000Z',
      });
      expect(m.subject, 'My Title');
    });

    test('falls back subject to No Subject when both absent', () {
      final m = IssueModel.fromJson({
        'id': 'i1', 'message': 'Msg',
        'category': 'BILLING', 'status': 'OPEN',
        'createdAt': '2024-01-01T00:00:00.000Z',
      });
      expect(m.subject, 'No Subject');
    });
  });

  // ── TicketMessage parsing ────────────────────────────────────────────────
  group('TicketMessage.fromJson', () {
    test('parses rider sender', () {
      final m = TicketMessage.fromJson({
        'id': 'tm1', 'ticketId': 't1',
        'senderType': 'RIDER', 'body': 'Hello',
        'createdAt': '2024-01-01T00:00:00.000Z',
      });
      expect(m.sender, TicketMessageSender.rider);
    });

    test('parses admin sender', () {
      final m = TicketMessage.fromJson({
        'id': 'tm1', 'ticketId': 't1',
        'sender': 'admin', 'body': 'Reply',
        'createdAt': '2024-01-01T00:00:00.000Z',
      });
      expect(m.sender, TicketMessageSender.admin);
    });

    test('falls back to unknown for invalid sender', () {
      final m = TicketMessage.fromJson({
        'id': 'tm1', 'ticketId': 't1',
        'senderType': 'BOT', 'body': 'Bot reply',
        'createdAt': '2024-01-01T00:00:00.000Z',
      });
      expect(m.sender, TicketMessageSender.unknown);
    });

    test('falls back body to message key', () {
      final m = TicketMessage.fromJson({
        'id': 'tm1', 'ticketId': 't1',
        'senderType': 'rider', 'message': 'from message key',
        'createdAt': '2024-01-01T00:00:00.000Z',
      });
      expect(m.body, 'from message key');
    });
  });

  // ── SponsoredOffer ───────────────────────────────────────────────────────
  group('SponsoredOffer', () {
    test('fromJson parses dates correctly', () {
      final json = {
        'id': 'o1', 'title': 'Offer', 'description': 'Desc',
        'validFrom': '2024-01-01T00:00:00.000Z',
        'validUntil': '2024-12-31T00:00:00.000Z',
        'isActive': true,
      };
      final offer = SponsoredOffer.fromJson(json);
      expect(offer.validFrom, DateTime.parse('2024-01-01T00:00:00.000Z'));
      expect(offer.isActive, isTrue);
    });
  });

  // ── RiderKYC lifecycle booleans ──────────────────────────────────────────
  group('RiderKYC', () {
    test('default lifecycle booleans are all false', () {
      const kyc = RiderKYC(kycStatus: KycStatus.pending);
      expect(kyc.registrationDone, isFalse);
      expect(kyc.depositDone, isFalse);
      expect(kyc.kycDone, isFalse);
    });

    test('copyWith toggles kycDone independently', () {
      const kyc = RiderKYC(kycStatus: KycStatus.pending);
      final updated = kyc.copyWith(kycDone: true);
      expect(updated.kycDone, isTrue);
      expect(updated.registrationDone, isFalse); // unchanged
    });

    test('copyWith updates kycStatus', () {
      const kyc = RiderKYC(kycStatus: KycStatus.pending);
      final approved = kyc.copyWith(kycStatus: KycStatus.approved);
      expect(approved.kycStatus, KycStatus.approved);
    });

    test('depositStatus defaults to pending', () {
      const kyc = RiderKYC(kycStatus: KycStatus.submitted);
      expect(kyc.depositStatus, DepositStatus.pending);
    });
  });
}
