import 'package:flutter/material.dart';

class SortableColumn {
  final String label;
  final String key;
  final double? width;
  final bool numeric;

  const SortableColumn({
    required this.label,
    required this.key,
    this.width,
    this.numeric = false,
  });
}

class SortConfig {
  final String key;
  final bool ascending;

  const SortConfig({required this.key, required this.ascending});
}

class DataTableWidget<T> extends StatefulWidget {
  final List<T> data;
  final List<SortableColumn> columns;
  final Map<String, String> Function(T item) rowBuilder;
  final SortConfig? initialSort;
  final ValueChanged<SortConfig>? onSort;
  final Widget? emptyWidget;
  final bool showSearch;
  final String searchHint;

  const DataTableWidget({
    super.key,
    required this.data,
    required this.columns,
    required this.rowBuilder,
    this.initialSort,
    this.onSort,
    this.emptyWidget,
    this.showSearch = true,
    this.searchHint = 'Search...',
  });

  @override
  State<DataTableWidget<T>> createState() => _DataTableWidgetState<T>();
}

class _DataTableWidgetState<T> extends State<DataTableWidget<T>> {
  late List<T> _filteredData;
  late List<T> _sortedData;
  SortConfig? _sortConfig;
  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';

  @override
  void initState() {
    super.initState();
    _sortConfig = widget.initialSort;
    _filteredData = List.from(widget.data);
    _sortedData = List.from(widget.data);
    _applyFilters();
  }

  @override
  void didUpdateWidget(DataTableWidget<T> oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.data != oldWidget.data) {
      _filteredData = List.from(widget.data);
      _sortedData = List.from(widget.data);
      _applyFilters();
    }
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  void _applyFilters() {
    if (_searchQuery.isEmpty) {
      _filteredData = List.from(widget.data);
    } else {
      _filteredData = widget.data.where((item) {
        final values = widget.rowBuilder(item).values;
        return values
            .any((v) => v.toLowerCase().contains(_searchQuery.toLowerCase()));
      }).toList();
    }
    _applySort();
  }

  void _applySort() {
    if (_sortConfig == null) {
      _sortedData = List.from(_filteredData);
      return;
    }
    _sortedData = List.from(_filteredData);
    _sortedData.sort((a, b) {
      final aVal = widget.rowBuilder(a)[_sortConfig!.key] ?? '';
      final bVal = widget.rowBuilder(b)[_sortConfig!.key] ?? '';
      int result;
      if (aVal is num && bVal is num) {
        result = aVal.compareTo(bVal);
      } else {
        result = aVal.toString().compareTo(bVal.toString());
      }
      return _sortConfig!.ascending ? result : -result;
    });
    setState(() {});
  }

  void _onSort(String key) {
    final ascending =
        _sortConfig?.key == key ? !(_sortConfig?.ascending ?? true) : true;
    _sortConfig = SortConfig(key: key, ascending: ascending);
    _applySort();
    widget.onSort?.call(_sortConfig!);
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Column(
      children: [
        if (widget.showSearch)
          Padding(
            padding: const EdgeInsets.all(16),
            child: TextField(
              controller: _searchController,
              decoration: InputDecoration(
                hintText: widget.searchHint,
                prefixIcon: const Icon(Icons.search),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                suffixIcon: _searchQuery.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear),
                        onPressed: () {
                          _searchController.clear();
                          setState(() => _searchQuery = '');
                          _applyFilters();
                        },
                      )
                    : null,
              ),
              onChanged: (value) {
                setState(() => _searchQuery = value);
                _applyFilters();
              },
            ),
          ),
        Container(
          decoration: BoxDecoration(
            color: isDark ? const Color(0xFF1E293B) : Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
                color:
                    isDark ? const Color(0xFF334155) : const Color(0xFFE2E8F0)),
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: DataTable(
                headingRowColor: WidgetStateProperty.all(
                  isDark ? const Color(0xFF1E293B) : const Color(0xFFF5F7FA),
                ),
                headingTextStyle: TextStyle(
                  fontWeight: FontWeight.bold,
                  color: isDark
                      ? const Color(0xFFF1F5F9)
                      : const Color(0xFF101828),
                ),
                dataTextStyle: TextStyle(
                  color: isDark
                      ? const Color(0xFFF1F5F9)
                      : const Color(0xFF101828),
                ),
                columnSpacing: 24,
                horizontalMargin: 16,
                columns: widget.columns.map((col) {
                  final isSorted = _sortConfig?.key == col.key;
                  return DataColumn(
                    label: Row(
                      children: [
                        Text(col.label),
                        if (isSorted)
                          Icon(
                            _sortConfig!.ascending
                                ? Icons.arrow_upward
                                : Icons.arrow_downward,
                            size: 16,
                          ),
                      ],
                    ),
                    numeric: col.numeric,
                    onSort: (_, __) => _onSort(col.key),
                  );
                }).toList(),
                rows: _sortedData.map((item) {
                  final row = widget.rowBuilder(item);
                  return DataRow(
                    cells: widget.columns.map((col) {
                      return DataCell(
                        Text(row[col.key] ?? ''),
                      );
                    }).toList(),
                  );
                }).toList(),
              ),
            ),
          ),
        ),
        if (_sortedData.isEmpty && widget.emptyWidget != null)
          Padding(
            padding: const EdgeInsets.all(32),
            child: widget.emptyWidget,
          ),
      ],
    );
  }
}

class PaginatedDataTableWidget<T> extends StatefulWidget {
  final List<T> data;
  final List<SortableColumn> columns;
  final Map<String, String> Function(T item) rowBuilder;
  final int rowsPerPage;
  final SortConfig? initialSort;
  final Widget? emptyWidget;

  const PaginatedDataTableWidget({
    super.key,
    required this.data,
    required this.columns,
    required this.rowBuilder,
    this.rowsPerPage = 10,
    this.initialSort,
    this.emptyWidget,
  });

  @override
  State<PaginatedDataTableWidget<T>> createState() =>
      _PaginatedDataTableWidgetState<T>();
}

class _PaginatedDataTableWidgetState<T>
    extends State<PaginatedDataTableWidget<T>> {
  int _rowsPerPage = 10;
  int _sortColumnIndex = 0;
  bool _sortAscending = true;

  @override
  void initState() {
    super.initState();
    _rowsPerPage = widget.rowsPerPage;
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E293B) : Colors.white,
        borderRadius: BorderRadius.circular(12),
      ),
      child: PaginatedDataTable(
        header: null,
        columns: widget.columns.map((col) {
          return DataColumn(
            label: Text(col.label),
            numeric: col.numeric,
            onSort: (columnIndex, ascending) {
              setState(() {
                _sortColumnIndex = columnIndex;
                _sortAscending = ascending;
              });
            },
          );
        }).toList(),
        source: _DataSource<T>(
          data: widget.data,
          columns: widget.columns,
          rowBuilder: widget.rowBuilder,
        ),
        rowsPerPage: _rowsPerPage,
        availableRowsPerPage: const [5, 10, 20, 50],
        onRowsPerPageChanged: (value) {
          setState(() {
            _rowsPerPage = value ?? 10;
          });
        },
        sortColumnIndex: _sortColumnIndex,
        sortAscending: _sortAscending,
      ),
    );
  }
}

class _DataSource<T> extends DataTableSource {
  final List<T> data;
  final List<SortableColumn> columns;
  final Map<String, String> Function(T item) rowBuilder;

  _DataSource({
    required this.data,
    required this.columns,
    required this.rowBuilder,
  });

  @override
  DataRow? getRow(int index) {
    if (index >= data.length) return null;
    final item = data[index];
    final row = rowBuilder(item);
    return DataRow(
      cells: columns.map((col) => DataCell(Text(row[col.key] ?? ''))).toList(),
    );
  }

  @override
  bool get isRowCountApproximate => false;

  @override
  int get rowCount => data.length;

  @override
  int get selectedRowCount => 0;
}

class FilterChipBar extends StatelessWidget {
  final List<String> filters;
  final String? selectedFilter;
  final ValueChanged<String?> onFilterSelected;

  const FilterChipBar({
    super.key,
    required this.filters,
    this.selectedFilter,
    required this.onFilterSelected,
  });

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Row(
        children: [
          FilterChip(
            label: const Text('All'),
            selected: selectedFilter == null,
            onSelected: (_) => onFilterSelected(null),
          ),
          const SizedBox(width: 8),
          ...filters.map((filter) => Padding(
                padding: const EdgeInsets.only(right: 8),
                child: FilterChip(
                  label: Text(filter),
                  selected: selectedFilter == filter,
                  onSelected: (_) => onFilterSelected(filter),
                ),
              )),
        ],
      ),
    );
  }
}
