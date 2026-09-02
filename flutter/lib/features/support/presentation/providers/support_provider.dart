// R4.3c-4 — Riverpod v3 `SupportProvider` (Notifier + state).
//
// Same surface as the previous `ChangeNotifier`:
//   - `supportConfig`, `faqCategories`, `faqs`, `tickets`,
//     `isRefreshingTickets`
//   - `initSupportData`, `refreshFaqs`, `refreshTickets`,
//     `createTicket`, `logout`
//
// The notifier pulls its `SupportRepository` from a Riverpod
// provider so tests can inject fakes.
//
// Seed values for `supportPhone` / `supportEmail` come from
// `AppConfig` (lib/utils/app_config.dart) — the single source of
// truth for the support contact. They are the in-memory placeholder
// shown until the first successful `_repo.fetchSupportConfig()` call
// returns server-driven values.

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter/material.dart';

import 'package:voltium_rider/features/support/domain/repository.dart';
import 'package:voltium_rider/features/support/data/repository_impl.dart';
import 'package:voltium_rider/core/network/api_client.dart';
import 'package:voltium_rider/core/network/generated/api_client.dart';
import 'package:voltium_rider/models/support_model.dart';
import 'package:voltium_rider/utils/app_config.dart';

import '../../../../utils/app_logger.dart';

@immutable
class SupportState {
  final SupportConfig? supportConfig;
  final List<FaqCategory> faqCategories;
  final List<FaqItem> faqs;
  final List<IssueModel> tickets;
  final bool isRefreshingTickets;

  const SupportState({
    this.supportConfig,
    this.faqCategories = const [],
    this.faqs = const [],
    this.tickets = const [],
    this.isRefreshingTickets = false,
  });

  SupportState copyWith({
    SupportConfig? supportConfig,
    List<FaqCategory>? faqCategories,
    List<FaqItem>? faqs,
    List<IssueModel>? tickets,
    bool? isRefreshingTickets,
  }) =>
      SupportState(
        supportConfig: supportConfig ?? this.supportConfig,
        faqCategories: faqCategories ?? this.faqCategories,
        faqs: faqs ?? this.faqs,
        tickets: tickets ?? this.tickets,
        isRefreshingTickets: isRefreshingTickets ?? this.isRefreshingTickets,
      );
}

class SupportNotifier extends Notifier<SupportState> {
  @override
  SupportState build() => const SupportState();

  SupportRepository get _repo => ref.read(supportRepositoryProvider);

  /// Seed the in-memory support config + the static FAQ category list,
  /// then trigger a network refresh.
  void initSupportData() {
    state = state.copyWith(
      supportConfig: const SupportConfig(
        supportPhone: AppConfig.supportPhoneCompact,
        supportEmail: AppConfig.supportEmail,
        ticketChecklist: [
          'I have checked the vehicle battery levels.',
          'I have verified the internet connection on my device.',
          'I have attempted to restart the app.',
          'I have ensured I am at the assigned rental hub (if applicable).',
        ],
      ),
      faqCategories: const [
        FaqCategory(
          id: 'tech',
          title: 'Technical Issues',
          subtitle: 'App & Device help',
          articleCount: 12,
          icon: Icons.build_outlined,
        ),
        FaqCategory(
          id: 'payment',
          title: 'Payments & Wallet',
          subtitle: 'Billing & Top-ups',
          articleCount: 8,
          icon: Icons.credit_card_outlined,
        ),
        FaqCategory(
          id: 'vehicle',
          title: 'Vehicle Issues',
          subtitle: 'Moped & Battery',
          articleCount: 15,
          icon: Icons.electric_moped_outlined,
        ),
      ],
      faqs: const [
        FaqItem(
          id: '1',
          categoryId: 'tech',
          question: 'How do I start my rental?',
          answer:
              'To start your rental, locate your assigned vehicle at the hub, perform the pre-ride check in the app, and tap "Start Ride".',
        ),
        FaqItem(
          id: '2',
          categoryId: 'vehicle',
          question: 'What happens if the battery dies?',
          answer:
              'If your battery is low, navigate to the nearest swapping station shown on the map or contact support via the SOS button in an emergency.',
        ),
      ],
    );
    _fetchAll();
  }

  Future<void> _fetchAll() async {
    await Future.wait([refreshFaqs(), refreshTickets()]);
  }

  Future<void> refreshFaqs() async {
    try {
      final response = await _repo.fetchFaqs();
      final dynamic rawList = response['faqs'] ??
          (response['data'] is Map<String, dynamic>
              ? (response['data'] as Map<String, dynamic>)['faqs']
              : null);
      if (rawList is List<dynamic>) {
        state = state.copyWith(
          faqs: rawList
              .map((e) => FaqItem.fromJson(e as Map<String, dynamic>))
              .toList(),
        );
      }
    } catch (e) {
      appDebug('Failed to fetch FAQs: $e');
    }
  }

  Future<void> refreshTickets({String? riderId}) async {
    if (state.isRefreshingTickets) return;
    state = state.copyWith(isRefreshingTickets: true);
    try {
      final response = await _repo.fetchTickets();
      final dynamic rawList = response['tickets'] ??
          (response['data'] is Map<String, dynamic>
              ? (response['data'] as Map<String, dynamic>)['tickets']
              : null);
      if (rawList is List<dynamic>) {
        state = state.copyWith(
          tickets: rawList
              .map((e) => IssueModel.fromJson(e as Map<String, dynamic>))
              .toList(),
        );
      }
    } catch (e) {
      appDebug('Error fetching tickets: $e');
    } finally {
      state = state.copyWith(isRefreshingTickets: false);
    }
  }

  Future<void> createTicket({
    required String category,
    required String subject,
    required String message,
    String? riderId,
    String? attachments,
  }) async {
    try {
      await _repo.createTicket(
        category,
        subject,
        message,
        riderId: riderId ?? '',
        priority: 'MEDIUM',
        attachments: attachments,
      );
      await refreshTickets(riderId: riderId);
    } catch (e) {
      rethrow;
    }
  }

  void logout() {
    state = const SupportState();
  }
}

/// Backwards-compat type alias.
typedef SupportProvider = SupportNotifier;

/// Riverpod v3 provider for the support feature.
final supportProvider = NotifierProvider<SupportNotifier, SupportState>(
  SupportNotifier.new,
);

/// Repository provider — overridden in `main.dart` with the real impl.
final supportRepositoryProvider = Provider<SupportRepository>((ref) {
  return SupportRepositoryImpl(VoltiumApiClient(ApiClient()));
});
