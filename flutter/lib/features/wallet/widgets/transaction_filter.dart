import 'package:flutter/material.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:google_fonts/google_fonts.dart';

enum TransactionFilter {
  all('All'),
  credit('Credit'),
  debit('Debit');

  final String label;
  const TransactionFilter(this.label);
}

enum TransactionSort {
  dateDesc('Newest First'),
  dateAsc('Oldest First'),
  amountDesc('Highest Amount'),
  amountAsc('Lowest Amount');

  final String label;
  const TransactionSort(this.label);
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
    final colors = AppColors.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Row(
        children: [
          Expanded(
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  FilterChip(
                    label: const Text('All'),
                    selected: selectedFilter == null,
                    onSelected: (_) => onFilterChanged(null),
                    selectedColor: colors.primarySurface,
                    checkmarkColor: AppColors.primary,
                    backgroundColor: colors.card,
                    labelStyle: GoogleFonts.plusJakartaSans(
                      color: selectedFilter == null
                          ? AppColors.primary
                          : colors.onSurfaceVariant,
                    ),
                  ),
                  const SizedBox(width: 8),
                  FilterChip(
                    label: const Text('Credit'),
                    selected: selectedFilter == TransactionFilter.credit,
                    onSelected: (_) =>
                        onFilterChanged(TransactionFilter.credit),
                    selectedColor: colors.primarySurface,
                    checkmarkColor: AppColors.primary,
                    backgroundColor: colors.card,
                    labelStyle: GoogleFonts.plusJakartaSans(
                      color: selectedFilter == TransactionFilter.credit
                          ? AppColors.primary
                          : colors.onSurfaceVariant,
                    ),
                  ),
                  const SizedBox(width: 8),
                  FilterChip(
                    label: const Text('Debit'),
                    selected: selectedFilter == TransactionFilter.debit,
                    onSelected: (_) => onFilterChanged(TransactionFilter.debit),
                    selectedColor: colors.primarySurface,
                    checkmarkColor: AppColors.primary,
                    backgroundColor: colors.card,
                    labelStyle: GoogleFonts.plusJakartaSans(
                      color: selectedFilter == TransactionFilter.debit
                          ? AppColors.primary
                          : colors.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(width: 8),
          PopupMenuButton<TransactionSort>(
            icon: Icon(Icons.sort, color: colors.onSurfaceMuted),
            color: colors.card,
            onSelected: onSortChanged,
            itemBuilder: (context) => TransactionSort.values.map((sort) {
              return PopupMenuItem(
                value: sort,
                child: Row(
                  children: [
                    if (sort == selectedSort)
                      const Icon(
                        Icons.check,
                        size: 16,
                        color: AppColors.primary,
                      )
                    else
                      const SizedBox(width: 16),
                    const SizedBox(width: 8),
                    Text(sort.label,
                        style: GoogleFonts.plusJakartaSans(
                            color: colors.onSurface)),
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

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Row(
      children: [
        Expanded(
          child: InkWell(
            onTap: () async {
              final date = await showDatePicker(
                context: context,
                initialDate: startDate ?? DateTime.now(),
                firstDate: DateTime(2020),
                lastDate: DateTime.now(),
              );
              if (date != null) {
                if (endDate != null && date.isAfter(endDate!)) {
                  // If start date is after end date, adjust end date to match start date
                  onChanged((date, date));
                } else {
                  onChanged((date, endDate));
                }
              }
            },
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
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
                    startDate != null
                        ? '${startDate!.day}/${startDate!.month}/${startDate!.year}'
                        : 'Start Date',
                    style: GoogleFonts.plusJakartaSans(
                      color: startDate != null
                          ? colors.onSurface
                          : colors.onSurfaceMuted,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 8),
          child: Text('to',
              style: GoogleFonts.plusJakartaSans(color: colors.onSurfaceMuted)),
        ),
        Expanded(
          child: InkWell(
            onTap: () async {
              final date = await showDatePicker(
                context: context,
                initialDate: endDate ?? DateTime.now(),
                firstDate: DateTime(2020),
                lastDate: DateTime.now(),
              );
              if (date != null) {
                if (startDate != null && date.isBefore(startDate!)) {
                  // If end date is before start date, adjust start date to match end date
                  onChanged((date, date));
                } else {
                  onChanged((startDate, date));
                }
              }
            },
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
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
                    endDate != null
                        ? '${endDate!.day}/${endDate!.month}/${endDate!.year}'
                        : 'End Date',
                    style: GoogleFonts.plusJakartaSans(
                      color: endDate != null
                          ? colors.onSurface
                          : colors.onSurfaceMuted,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}
