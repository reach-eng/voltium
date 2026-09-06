import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:voltium_rider/core/network/api_client.dart';
import 'package:voltium_rider/core/network/generated/api_client.dart';
import 'package:voltium_rider/features/support/domain/entity.dart';
import 'package:voltium_rider/features/support/domain/repository.dart';
import 'package:voltium_rider/features/support/data/repository_impl.dart';
import 'package:voltium_rider/features/support/presentation/providers/support_provider.dart'
    show supportRepositoryProvider;

enum TicketFilter { all, open, assigned, inProgress, resolved, closed }

class TicketState {
  final bool isLoading;
  final List<TicketEntity> tickets;
  final TicketFilter filter;
  // AUDIT-2026-09-07 (Phase 6): set by `fetchTickets` on failure;
  // cleared on the next successful fetch. Read by `RecentTicketsContainer`
  // to drive ErrorStateWidget with a retry button.
  final String? error;

  TicketState({
    this.isLoading = false,
    this.tickets = const [],
    this.filter = TicketFilter.all,
    this.error,
  });

  List<TicketEntity> get filteredTickets {
    if (filter == TicketFilter.all) return tickets;
    return tickets.where((t) {
      final normalizedStatus = t.status.name.toLowerCase();
      return normalizedStatus == filter.name.toLowerCase();
    }).toList();
  }

  TicketState copyWith({
    bool? isLoading,
    List<TicketEntity>? tickets,
    TicketFilter? filter,
    String? error,
    bool clearError = false,
  }) {
    return TicketState(
      isLoading: isLoading ?? this.isLoading,
      tickets: tickets ?? this.tickets,
      filter: filter ?? this.filter,
      error: clearError ? null : (error ?? this.error),
    );
  }
}

class SupportTicketsNotifier extends Notifier<TicketState> {
  @override
  TicketState build() {
    Future.microtask(() => fetchTickets());
    return TicketState(isLoading: true);
  }

  SupportRepository get _repo {
    try {
      return ref.read(supportRepositoryProvider);
    } catch (_) {
      return SupportRepositoryImpl(VoltiumApiClient(ApiClient()));
    }
  }

  Future<void> fetchTickets() async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final response = await _repo.fetchTickets();
      final data = response['tickets'] as List<dynamic>?;
      if (data != null) {
        final parsed = data
            .map((e) => TicketEntity.fromJson(e as Map<String, dynamic>))
            .toList();
        state = state.copyWith(isLoading: false, tickets: parsed);
      } else {
        state = state.copyWith(isLoading: false);
      }
    } catch (e) {
      // AUDIT-2026-09-07 (Phase 6): surface the failure to the UI so
      // ErrorStateWidget can render a retry button instead of
      // silently leaving the tickets list empty.
      state = state.copyWith(
        isLoading: false,
        error: "Couldn't load your tickets.",
      );
    }
  }

  void setFilter(TicketFilter newFilter) {
    state = state.copyWith(filter: newFilter);
  }

  /// Reset ticket state on logout so the next rider never sees the
  /// previous rider's tickets (audit #4 P0-1).
  void reset() => state = TicketState();
}

final supportTicketsProvider =
    NotifierProvider<SupportTicketsNotifier, TicketState>(
        SupportTicketsNotifier.new);
