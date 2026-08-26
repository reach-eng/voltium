import 'package:flutter/material.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:voltium_rider/theme/app_theme.dart';

/// Transaction list filters + sort control.
///
/// W5-design fixes (2026-08-26):
///  - P0: chips inherit the shared ChipTheme (dark-correct selected
///    colors) instead of hand-rolled static `AppColors.primary` overrides
///    that were invisible on dark surfaces (~1.7:1).
///  - P1: the previously-dead [TransactionFilter] enum now drives the
///    chip row (labels localized via l10n), removing the triplicated
///    copy-paste blocks and hardcoded English.
///  - P2: sort button gained a tooltip + active-sort tint so a applied
///    non-default ordering is visible without opening the menu.
///  - P3: date fields are 44dp-min Semantics(button) targets with
///    localized placeholders.
enum TransactionFilter { all, credit, debit }

enum TransactionSort { dateDesc, dateAsc, amountDesc, amountAsc }

String _filterLabel(AppLocalizations l10n, TransactionFilter f) {
  switch (f) {
    case TransactionFilter.all:
      return l10n.history_all;
    case TransactionFilter.credit:
      return l10n.history_filterCredit;
    case TransactionFilter.debit:
      return l10n.history_filterDebit;
  }
}

String _sortLabel(AppLocalizations l10n, TransactionSort s) {
  switch (s) {
    case TransactionSort.dateDesc:
      return l10n.history_sortNewest;
    case TransactionSort.dateAsc:
      return l10n.history_sortOldest;
    case TransactionSort.amountDesc:
      return l10n.history_sortHighest;
    case TransactionSort.amountAsc:
      return l10n.history_sortLowest;
  }
}

class TransactionFilterSort extends StatelessWidget {
  final TransactionFilter? selectedFilter;
  final TransactionSort selectedSort;
  final ValueChanged<TransactionFilter?> onFilterChanged;
  final ValueChanged<TransactionSort> onSortChanged;

  const TransactionFilterSort({
    super.key,
    this.selectedFilter,
    required this.selectedSort,
    required this.onFilterChanged,
    required this.onSortChanged,
  });

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final colors = AppColors.of(context);
    final sortActive = selectedSort != TransactionSort.dateDesc;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Row(
        children: [
          Expanded(
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  for (final f in TransactionFilter.values) ...[
                    FilterChip(
                      label: Text(_filterLabel(l10n, f)),
                      selected: selectedFilter == f ||
                          (f == TransactionFilter.all && selectedFilter == null),
                      onSelected: (_) => onFilterChanged(
                        f == TransactionFilter.all ? null : f,
                      ),
                    ),
                    const SizedBox(width: 8),
                  ],
                ],
              ),
            ),
          ),
          const SizedBox(width: 8),
          PopupMenuButton<TransactionSort>(
            // P2: visible affordance that a non-default sort is active +
            // screen-reader label (icon-only button otherwise anonymous).
            tooltip: l10n.history_sortTooltip,
            icon: Icon(
              Icons.sort,
              color: sortActive ? Theme.of(context).colorScheme.primary : colors.onSurfaceMuted,
            ),
            color: colors.card,
            onSelected: onSortChanged,
            itemBuilder: (context) => TransactionSort.values.map((sort) {
              final isSelected = sort == selectedSort;
              return PopupMenuItem(
                value: sort,
                child: Row(
                  children: [
                    SizedBox(
                      width: 16,
                      child: isSelected
                          ? const Icon(Icons.check, size: 16)
                          : null,
                    ),
                    const SizedBox(width: 8),
                    Text(_sortLabel(l10n, sort)),
                  ],
                ),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }
}

class DateRangePicker extends StatelessWidget {
  final DateTime? startDate;
  final DateTime? endDate;
  final ValueChanged<(DateTime?, DateTime?)> onChanged;

  const DateRangePicker({
    super.key,
    this.startDate,
    this.endDate,
    required this.onChanged,
  });

  Future<void> _pick(
    BuildContext context, {
    required bool isStart,
  }) async {
    final current = isStart ? startDate : endDate;
    final date = await showDatePicker(
      context: context,
      initialDate: current ?? DateTime.now(),
      firstDate: DateTime(2020),
      lastDate: DateTime.now(),
    );
    if (date == null) return;

    if (isStart) {
      // If start date is after end date, adjust end date to match start date
      if (endDate != null && date.isAfter(endDate!)) {
        onChanged((date, date));
      } else {
        onChanged((date, endDate));
      }
    } else {
      // If end date is before start date, adjust start date to match end date
      if (startDate != null && date.isBefore(startDate!)) {
        onChanged((date, date));
      } else {
        onChanged((startDate, date));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final colors = AppColors.of(context);

    Widget field({
      required bool isStart,
      required String semanticLabel,
      required String placeholder,
      required DateTime? value,
    }) {
      return Expanded(
        child: Semantics(
          button: true,
          label: semanticLabel,
          child: InkWell(
            onTap: () => _pick(context, isStart: isStart),
            borderRadius: BorderRadius.circular(AppRadius.md),
            child: Container(
              constraints: const BoxConstraints(minHeight: 44),
              padding:
                  const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                border: Border.all(color: colors.outline),
                borderRadius: BorderRadius.circular(AppRadius.md),
                color: colors.card,
              ),
              child: Row(
                children: [
                  Icon(
                    Icons.calendar_today,
                    size: 16,
                    color: colors.onSurfaceMuted,
                  ),
                  const SizedBox(width: 8),
                  Text(
                    value != null
                        ? '${value.day}/${value.month}/${value.year}'
                        : placeholder,
                    style: TextStyle(
                      fontSize: 13,
                      color: value != null
                          ? colors.onSurface
                          : colors.onSurfaceMuted,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
    }

    return Row(
      children: [
        field(
          isStart: true,
          semanticLabel: l10n.txtstartDate,
          placeholder: l10n.txtstartDate,
          value: startDate,
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 8),
          child: Text(
            l10n.history_to,
            style: TextStyle(color: colors.onSurfaceMuted, fontSize: 13),
          ),
        ),
        field(
          isStart: false,
          semanticLabel: l10n.txtendDate,
          placeholder: l10n.txtendDate,
          value: endDate,
        ),
      ],
    );
  }
}
