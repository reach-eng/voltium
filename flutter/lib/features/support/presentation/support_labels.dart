import 'package:voltium_rider/features/support/domain/entity.dart';
import 'package:voltium_rider/features/support/presentation/providers/ticket_provider.dart'
    show TicketFilter;

/// W-design fix (2026-08-26): raw `enum.name.toUpperCase()` rendered
/// "INPROGRESS" (missing space) as user-facing copy in the support
/// center filter chips and ticket rows. These extensions provide
/// human-readable labels; swap the bodies for l10n lookups when the
/// support surface joins the localization sweep.
extension TicketFilterLabel on TicketFilter {
  String get label {
    switch (this) {
      case TicketFilter.all:
        return 'All';
      case TicketFilter.open:
        return 'Open';
      case TicketFilter.assigned:
        return 'Assigned';
      case TicketFilter.inProgress:
        return 'In Progress';
      case TicketFilter.resolved:
        return 'Resolved';
      case TicketFilter.closed:
        return 'Closed';
    }
  }
}

extension TicketStatusLabel on TicketStatus {
  String get label {
    switch (this) {
      case TicketStatus.open:
        return 'Open';
      case TicketStatus.assigned:
        return 'Assigned';
      case TicketStatus.inProgress:
        return 'In Progress';
      case TicketStatus.resolved:
        return 'Resolved';
      case TicketStatus.closed:
        return 'Closed';
    }
  }
}
