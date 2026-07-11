import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/features/support/domain/entity.dart';
import 'package:voltium_rider/features/support/domain/repository.dart';

enum TicketFilter { all, open, assigned, inProgress, closed }

class TicketState {
  final bool isLoading;
  final List<TicketEntity> tickets;
  final TicketFilter filter;

  TicketState({
    this.isLoading = false,
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
    List<TicketEntity>? tickets,
    TicketFilter? filter,
  }) {
    return TicketState(
      isLoading: isLoading ?? this.isLoading,
      tickets: tickets ?? this.tickets,
      filter: filter ?? this.filter,
    );
  }
}

class SupportTicketsNotifier extends StateNotifier<TicketState> {
  final SupportRepository _repository;

  SupportTicketsNotifier(this._repository) : super(TicketState()) {
    fetchTickets();
  }

  Future<void> fetchTickets() async {
    state = state.copyWith(isLoading: true);
    try {
      final response = await _repository.fetchTickets();
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
      state = state.copyWith(isLoading: false);
    }
  }

  void setFilter(TicketFilter newFilter) {
    state = state.copyWith(filter: newFilter);
  }
}

final supportTicketsProvider =
    StateNotifierProvider<SupportTicketsNotifier, TicketState>((ref) {
  return SupportTicketsNotifier(ref.watch(supportRepositoryProvider));
});
