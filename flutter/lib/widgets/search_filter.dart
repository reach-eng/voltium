import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import 'package:google_fonts/google_fonts.dart';

class SearchBar extends StatefulWidget {
  final String hintText;
  final ValueChanged<String>? onChanged;
  final VoidCallback? onClear;
  final TextEditingController? controller;
  final Duration debounceDelay;

  const SearchBar({
    super.key,
    this.hintText = 'Search...',
    this.onChanged,
    this.onClear,
    this.controller,
    this.debounceDelay = const Duration(milliseconds: 300),
  });

  @override
  State<SearchBar> createState() => _SearchBarState();
}

class _SearchBarState extends State<SearchBar> {
  late TextEditingController _controller;
  bool _hasText = false;

  @override
  void initState() {
    super.initState();
    _controller = widget.controller ?? TextEditingController();
    _controller.addListener(_onTextChanged);
    _hasText = _controller.text.isNotEmpty;
  }

  void _onTextChanged() {
    final hasText = _controller.text.isNotEmpty;
    if (hasText != _hasText) {
      setState(() => _hasText = hasText);
    }
    widget.onChanged?.call(_controller.text);
  }

  @override
  void dispose() {
    if (widget.controller == null) {
      _controller.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Container(
      height: 48,
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: colors.outline),
      ),
      child: Row(
        children: [
          Icon(Icons.search, color: colors.onSurfaceMuted, size: 20),
          const SizedBox(width: 8),
          Expanded(
            child: TextFormField(
              controller: _controller,
              style: GoogleFonts.plusJakartaSans(color: colors.onSurface),
              decoration: InputDecoration(
                hintText: widget.hintText,
                hintStyle:
                    GoogleFonts.plusJakartaSans(color: colors.onSurfaceMuted),
                border: InputBorder.none,
                contentPadding: EdgeInsets.zero,
              ),
            ),
          ),
          if (_hasText)
            IconButton(
              tooltip: 'Clear search',
              icon: Icon(Icons.clear, size: 20, color: colors.onSurfaceMuted),
              onPressed: () {
                _controller.clear();
                widget.onClear?.call();
              },
            ),
        ],
      ),
    );
  }
}

class FilterChipList extends StatelessWidget {
  final List<String> items;
  final String? selected;
  final ValueChanged<String> onSelected;

  const FilterChipList({
    super.key,
    required this.items,
    this.selected,
    required this.onSelected,
  });

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: items.map((item) {
          final isSelected = item == selected;
          return Padding(
            padding: const EdgeInsets.only(right: 8),
            child: FilterChip(
              label: Text(item),
              selected: isSelected,
              onSelected: (_) => onSelected(item),
              selectedColor: colors.primarySurface,
              checkmarkColor: AppColors.primary,
              backgroundColor: colors.card,
              labelStyle: GoogleFonts.plusJakartaSans(
                color: isSelected ? AppColors.primary : colors.onSurfaceVariant,
              ),
            ),
          );
        }).toList(),
      ),
    );
  }
}

class SortDropdown extends StatelessWidget {
  final List<String> options;
  final String value;
  final ValueChanged<String?> onChanged;

  const SortDropdown({
    super.key,
    required this.options,
    required this.value,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12),
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: colors.outline),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<String>(
          value: value,
          dropdownColor: colors.card,
          icon: Icon(Icons.sort, size: 20, color: colors.onSurfaceMuted),
          items: options.map((option) {
            return DropdownMenuItem(
              value: option,
              child: Text(option,
                  style: GoogleFonts.plusJakartaSans(
                      fontSize: 14, color: colors.onSurface)),
            );
          }).toList(),
          onChanged: onChanged,
        ),
      ),
    );
  }
}
