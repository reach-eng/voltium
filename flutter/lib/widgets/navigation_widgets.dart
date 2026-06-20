import 'package:flutter/material.dart';

class BreadcrumbItem {
  final String label;
  final VoidCallback? onTap;
  final IconData? icon;

  BreadcrumbItem({
    required this.label,
    this.onTap,
    this.icon,
  });
}

class Breadcrumbs extends StatelessWidget {
  final List<BreadcrumbItem> items;
  final Color activeColor;
  final Color inactiveColor;
  final double fontSize;
  final String separator;

  const Breadcrumbs({
    super.key,
    required this.items,
    this.activeColor = Colors.amber,
    this.inactiveColor = Colors.grey,
    this.fontSize = 14,
    this.separator = '/',
  });

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: List.generate(items.length, (index) {
          final item = items[index];
          final isLast = index == items.length - 1;
          return Row(
            children: [
              InkWell(
                onTap: item.onTap,
                child: Text(
                  item.icon != null
                      ? '${item.icon != null ? '${item.icon!.codePoint} ' : ''}${item.label}'
                      : item.label,
                  style: TextStyle(
                    color: isLast ? activeColor : inactiveColor,
                    fontSize: fontSize,
                    fontWeight: isLast ? FontWeight.bold : FontWeight.normal,
                  ),
                ),
              ),
              if (!isLast)
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  child: Text(
                    separator,
                    style: TextStyle(
                      color: inactiveColor,
                      fontSize: fontSize,
                    ),
                  ),
                ),
            ],
          );
        }),
      ),
    );
  }
}

class AnimatedTabBar extends StatefulWidget {
  final List<String> tabs;
  final int initialIndex;
  final ValueChanged<int>? onTabChanged;
  final Color activeColor;
  final Color inactiveColor;
  final bool showIndicator;

  const AnimatedTabBar({
    super.key,
    required this.tabs,
    this.initialIndex = 0,
    this.onTabChanged,
    this.activeColor = Colors.amber,
    this.inactiveColor = Colors.grey,
    this.showIndicator = true,
  });

  @override
  State<AnimatedTabBar> createState() => _AnimatedTabBarState();
}

class _AnimatedTabBarState extends State<AnimatedTabBar>
    with SingleTickerProviderStateMixin {
  late int _currentIndex;
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _currentIndex = widget.initialIndex;
    _tabController = TabController(
      length: widget.tabs.length,
      vsync: this,
      initialIndex: _currentIndex,
    );
    _tabController.addListener(() {
      if (!_tabController.indexIsChanging) {
        setState(() {
          _currentIndex = _tabController.index;
        });
        widget.onTabChanged?.call(_tabController.index);
      }
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.grey.shade100,
        borderRadius: BorderRadius.circular(8),
      ),
      child: TabBar(
        controller: _tabController,
        labelColor: widget.activeColor,
        unselectedLabelColor: widget.inactiveColor,
        indicator: widget.showIndicator
            ? BoxDecoration(
                color: widget.activeColor,
                borderRadius: BorderRadius.circular(8),
              )
            : null,
        labelStyle: const TextStyle(fontWeight: FontWeight.bold),
        tabs: widget.tabs.map((tab) => Tab(text: tab)).toList(),
      ),
    );
  }
}

class CustomDrawer extends StatefulWidget {
  final Widget header;
  final List<DrawerItem> items;
  final Color backgroundColor;
  final Color activeColor;
  final double width;

  const CustomDrawer({
    super.key,
    required this.header,
    required this.items,
    this.backgroundColor = Colors.white,
    this.activeColor = Colors.amber,
    this.width = 280,
  });

  @override
  State<CustomDrawer> createState() => _CustomDrawerState();
}

class _CustomDrawerState extends State<CustomDrawer> {
  int? _selectedIndex;

  @override
  Widget build(BuildContext context) {
    return Drawer(
      width: widget.width,
      backgroundColor: widget.backgroundColor,
      child: Column(
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.only(top: 40),
            child: widget.header,
          ),
          const SizedBox(height: 16),
          Expanded(
            child: ListView.builder(
              itemCount: widget.items.length,
              itemBuilder: (context, index) {
                final item = widget.items[index];
                final isSelected = _selectedIndex == index;
                return ListTile(
                  leading: Icon(
                    item.icon,
                    color: isSelected ? widget.activeColor : Colors.grey,
                  ),
                  title: Text(
                    item.label,
                    style: TextStyle(
                      color: isSelected ? Colors.black : Colors.grey.shade700,
                      fontWeight:
                          isSelected ? FontWeight.bold : FontWeight.normal,
                    ),
                  ),
                  selected: isSelected,
                  selectedTileColor: widget.activeColor.withValues(alpha: 0.1),
                  onTap: () {
                    setState(() {
                      _selectedIndex = index;
                    });
                    item.onTap?.call();
                    if (item.closeOnTap != false) {
                      Navigator.pop(context);
                    }
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class DrawerItem {
  final String label;
  final IconData icon;
  final VoidCallback? onTap;
  final bool closeOnTap;

  DrawerItem({
    required this.label,
    required this.icon,
    this.onTap,
    this.closeOnTap = true,
  });
}

class SegmentedControl<T> extends StatefulWidget {
  final List<T> segments;
  final T selectedSegment;
  final ValueChanged<T>? onSegmentChanged;
  final Widget Function(T segment, bool isSelected)? segmentBuilder;

  const SegmentedControl({
    super.key,
    required this.segments,
    required this.selectedSegment,
    this.onSegmentChanged,
    this.segmentBuilder,
  });

  @override
  State<SegmentedControl<T>> createState() => _SegmentedControlState<T>();
}

class _SegmentedControlState<T> extends State<SegmentedControl<T>> {
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: Colors.grey.shade200,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: widget.segments.map((segment) {
          final isSelected = widget.selectedSegment == segment;
          return Expanded(
            child: GestureDetector(
              onTap: () {
                widget.onSegmentChanged?.call(segment);
              },
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 10,
                ),
                decoration: BoxDecoration(
                  color: isSelected ? Colors.amber : Colors.transparent,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: widget.segmentBuilder != null
                    ? widget.segmentBuilder!(segment, isSelected)
                    : Center(
                        child: Text(
                          segment.toString(),
                          style: TextStyle(
                            color: isSelected ? Colors.white : Colors.grey,
                            fontWeight: isSelected
                                ? FontWeight.bold
                                : FontWeight.normal,
                          ),
                        ),
                      ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }
}

class ExpandableDrawerItem extends StatefulWidget {
  final String title;
  final IconData icon;
  final List<DrawerItem> children;
  final bool initiallyExpanded;

  const ExpandableDrawerItem({
    super.key,
    required this.title,
    required this.icon,
    required this.children,
    this.initiallyExpanded = false,
  });

  @override
  State<ExpandableDrawerItem> createState() => _ExpandableDrawerItemState();
}

class _ExpandableDrawerItemState extends State<ExpandableDrawerItem> {
  late bool _isExpanded;

  @override
  void initState() {
    super.initState();
    _isExpanded = widget.initiallyExpanded;
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        ListTile(
          leading: Icon(widget.icon),
          title: Text(widget.title),
          trailing: Icon(
            _isExpanded ? Icons.expand_less : Icons.expand_more,
          ),
          onTap: () {
            setState(() {
              _isExpanded = !_isExpanded;
            });
          },
        ),
        if (_isExpanded)
          ...widget.children.map((child) => ListTile(
                leading: const SizedBox(width: 24),
                title: Text(child.label),
                onTap: () {
                  child.onTap?.call();
                  Navigator.pop(context);
                },
              ),),
      ],
    );
  }
}
