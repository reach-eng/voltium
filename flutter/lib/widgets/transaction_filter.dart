import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

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
                    selectedColor: AppColors.primaryLighter,
                    checkmarkColor: AppColors.primary,
                  ),
                  const SizedBox(width: 8),
                  FilterChip(
                    label: const Text('Credit'),
                    selected: selectedFilter == TransactionFilter.credit,
                    onSelected: (_) =>
                        onFilterChanged(TransactionFilter.credit),
                    selectedColor: const Color(0xFFDCFCE7),
                    checkmarkColor: const Color(0xFF16A34A),
                  ),
                  const SizedBox(width: 8),
                  FilterChip(
                    label: const Text('Debit'),
                    selected: selectedFilter == TransactionFilter.debit,
                    onSelected: (_) => onFilterChanged(TransactionFilter.debit),
                    selectedColor: const Color(0xFFFEF3F2),
                    checkmarkColor: const Color(0xFFD92D20),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(width: 8),
          PopupMenuButton<TransactionSort>(
            icon: const Icon(Icons.sort, color: Color(0xFF667085)),
            onSelected: onSortChanged,
            itemBuilder: (context) => TransactionSort.values.map((sort) {
              return PopupMenuItem(
                value: sort,
                child: Row(
                  children: [
                    if (sort == selectedSort)
                      const Icon(Icons.check,
                          size: 16, color: AppColors.primary,)
                    else
                      const SizedBox(width: 16),
                    const SizedBox(width: 8),
                    Text(sort.label),
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
                onChanged((date, endDate));
              }
            },
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                border: Border.all(color: AppColors.outline),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                children: [
                  const Icon(Icons.calendar_today,
                      size: 16, color: Color(0xFF667085),),
                  const SizedBox(width: 8),
                  Text(
                    startDate != null
                        ? '${startDate!.day}/${startDate!.month}/${startDate!.year}'
                        : 'Start Date',
                    style: TextStyle(
                      color: startDate != null
                          ? AppColors.onSurface
                          : AppColors.onSurfaceDisabled,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: 8),
          child: Text('to', style: TextStyle(color: Color(0xFF667085))),
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
                onChanged((startDate, date));
              }
            },
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                border: Border.all(color: AppColors.outline),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                children: [
                  const Icon(Icons.calendar_today,
                      size: 16, color: Color(0xFF667085),),
                  const SizedBox(width: 8),
                  Text(
                    endDate != null
                        ? '${endDate!.day}/${endDate!.month}/${endDate!.year}'
                        : 'End Date',
                    style: TextStyle(
                      color: endDate != null
                          ? AppColors.onSurface
                          : AppColors.onSurfaceDisabled,
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
