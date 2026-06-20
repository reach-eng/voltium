import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

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
    return Container(
      height: 48,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.outline),
      ),
      child: Row(
        children: [
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 12),
            child: Icon(Icons.search, color: Color(0xFF667085), size: 20),
          ),
          Expanded(
            child: TextFormField(
              controller: _controller,
              decoration: InputDecoration(
                hintText: widget.hintText,
                hintStyle: const TextStyle(color: AppColors.onSurfaceDisabled),
                border: InputBorder.none,
                contentPadding: EdgeInsets.zero,
              ),
            ),
          ),
          if (_hasText)
            IconButton(
              icon: const Icon(Icons.clear, size: 20, color: Color(0xFF667085)),
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
              selectedColor: AppColors.primaryLighter,
              checkmarkColor: AppColors.primary,
              labelStyle: TextStyle(
                color: isSelected
                    ? AppColors.primary
                    : AppColors.onSurfaceVariant,
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
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.outline),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<String>(
          value: value,
          icon: const Icon(Icons.sort, size: 20, color: Color(0xFF667085)),
          items: options.map((option) {
            return DropdownMenuItem(
              value: option,
              child: Text(option, style: const TextStyle(fontSize: 14)),
            );
          }).toList(),
          onChanged: onChanged,
        ),
      ),
    );
  }
}
