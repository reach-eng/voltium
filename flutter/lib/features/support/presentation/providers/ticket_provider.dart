import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:voltium_rider/features/support/domain/entity.dart';
import 'package:voltium_rider/features/support/domain/repository.dart';
import 'package:voltium_rider/features/support/presentation/providers/support_provider.dart';

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
    Future.microtask(() {
      if (ref.mounted) {
        fetchTickets();
      }
    });
    return TicketState(isLoading: true);
  }

  SupportRepository get _repo => ref.read(supportRepositoryProvider);

  Future<void> fetchTickets() async {
    if (!ref.mounted) return;
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final response = await _repo.fetchTickets();
      if (!ref.mounted) return;
      final dynamic rawList = response['tickets'] ??
          (response['data'] is Map<String, dynamic>
              ? (response['data'] as Map<String, dynamic>)['tickets']
              : (response['data'] is List ? response['data'] : null));
      if (rawList is List<dynamic>) {
        final parsed = rawList
            .map((e) => TicketEntity.fromJson(e as Map<String, dynamic>))
            .toList();
        state =
            state.copyWith(isLoading: false, tickets: parsed, clearError: true);
      } else {
        state = state.copyWith(isLoading: false, clearError: true);
      }
    } catch (e) {
      if (!ref.mounted) return;
      state = state.copyWith(
        isLoading: false,
        error: 'Failed to load tickets',
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
