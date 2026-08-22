import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:voltium_rider/core/network/api_client.dart';
import 'package:voltium_rider/core/network/generated/api_client.dart';
import 'package:voltium_rider/features/support/domain/entity.dart';
import 'package:voltium_rider/features/support/data/repository_impl.dart';

enum TicketFilter { all, open, assigned, inProgress, resolved, closed }

class TicketState {
  final bool isLoading;

  /// AUDIT FIX: fetch failures were indistinguishable from "no tickets" —
  /// riders saw an empty state instead of an error. Non-null when the last
  /// fetch failed.
  final String? error;
  final List<TicketEntity> tickets;
  final TicketFilter filter;

  TicketState({
    this.isLoading = false,
    this.error,
    this.tickets = const [],
    this.filter = TicketFilter.all,
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
    String? error,
    bool clearError = false,
    List<TicketEntity>? tickets,
    TicketFilter? filter,
  }) {
    return TicketState(
      isLoading: isLoading ?? this.isLoading,
      error: clearError ? null : (error ?? this.error),
      tickets: tickets ?? this.tickets,
      filter: filter ?? this.filter,
    );
  }
}

class SupportTicketsNotifier extends Notifier<TicketState> {
  @override
  TicketState build() {
    Future.microtask(() => fetchTickets());
    return TicketState(isLoading: true);
  }

  Future<void> fetchTickets() async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final repository = SupportRepositoryImpl(VoltiumApiClient(ApiClient()));
      final response = await repository.fetchTickets();
      final data = response['tickets'] as List<dynamic>?;
      if (data != null) {
        final parsed = data
            .map((e) => TicketEntity.fromJson(e as Map<String, dynamic>))
            .toList();
        state =
            state.copyWith(isLoading: false, tickets: parsed, clearError: true);
      } else {
        state = state.copyWith(isLoading: false, clearError: true);
      }
    } catch (e) {
      state = state.copyWith(isLoading: false, error: 'Failed to load tickets');
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
