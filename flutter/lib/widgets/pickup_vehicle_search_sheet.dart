import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Searchable vehicle picker modal bottom sheet.
class VehicleSearchSheet extends StatefulWidget {
  final List<Map<String, dynamic>> vehicles;
  final String? selectedId;
  final void Function(String id, String label) onSelected;

  const VehicleSearchSheet({
    super.key,
    required this.vehicles,
    required this.selectedId,
    required this.onSelected,
  });

  @override
  State<VehicleSearchSheet> createState() => _VehicleSearchSheetState();
}

class _VehicleSearchSheetState extends State<VehicleSearchSheet> {
  static const Color _primary = Color(0xFF0053C1);
  static const Color _surface = Color(0xFFF8FAFC);
  static const Color _outline = Color(0xFFC2C6D6);
  static const Color _success = Color(0xFF10B981);
  static const Color _textDark = Color(0xFF141B2B);
  static const Color _textMuted = Color(0xFF737785);

  final TextEditingController _searchCtrl = TextEditingController();
  List<Map<String, dynamic>> _filtered = [];

  @override
  void initState() {
    super.initState();
    _filtered = widget.vehicles;
    _searchCtrl.addListener(_onSearch);
  }

  @override
  void dispose() {
    _searchCtrl.removeListener(_onSearch);
    _searchCtrl.dispose();
    super.dispose();
  }

  void _onSearch() {
    final q = _searchCtrl.text.trim().toLowerCase();
    setState(() {
      _filtered = q.isEmpty
          ? widget.vehicles
          : widget.vehicles.where((v) {
              final id = (v['vehicleId'] as String? ?? '').toLowerCase();
              final model = (v['model'] as String? ?? '').toLowerCase();
              final plate =
                  (v['licensePlate'] as String? ?? '').toLowerCase();
              return id.contains(q) || model.contains(q) || plate.contains(q);
            }).toList();
    });
  }

  String _label(Map<String, dynamic> v) {
    final id = v['vehicleId'] as String? ?? '';
    final model = v['model'] as String? ?? '';
    final plate = v['licensePlate'] as String? ?? '';
    return '$id${model.isNotEmpty ? ' · $model' : ''}${plate.isNotEmpty ? ' · $plate' : ''}';
  }

  String _battery(Map<String, dynamic> v) {
    final lvl = v['batteryLevel'];
    if (lvl == null) return '';
    return '${lvl.toStringAsFixed(0)}%';
  }

  Color _batteryColor(Map<String, dynamic> v) {
    final lvl = (v['batteryLevel'] as num?)?.toDouble() ?? 100;
    if (lvl >= 60) return _success;
    if (lvl >= 30) return const Color(0xFFF59E0B);
    return const Color(0xFFEF4444);
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;
    return GestureDetector(
      onTap: () => FocusScope.of(context).unfocus(),
      child: Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
        ),
        padding: EdgeInsets.only(bottom: bottomInset),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 12),
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: _outline,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 16),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      'Select Vehicle',
                      style: GoogleFonts.inter(
                        fontSize: 17,
                        fontWeight: FontWeight.w800,
                        color: _textDark,
                      ),
                    ),
                  ),
                  Text(
                    '${widget.vehicles.length} available',
                    style: GoogleFonts.inter(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: _success,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: TextField(
                controller: _searchCtrl,
                autofocus: true,
                style: GoogleFonts.inter(fontSize: 14, color: _textDark),
                decoration: InputDecoration(
                  hintText: 'Search by ID, model or plate…',
                  hintStyle: GoogleFonts.inter(
                      fontSize: 14, color: _textMuted.withOpacity(0.7)),
                  prefixIcon:
                      const Icon(Icons.search, color: _primary, size: 20),
                  suffixIcon: _searchCtrl.text.isNotEmpty
                      ? IconButton(
                          icon: const Icon(Icons.close,
                              size: 18, color: _textMuted),
                          onPressed: () => _searchCtrl.clear(),
                        )
                      : null,
                  filled: true,
                  fillColor: _surface,
                  contentPadding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: const BorderSide(color: _outline),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: const BorderSide(color: _outline),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: const BorderSide(color: _primary, width: 1.5),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 12),
            const Divider(height: 1),
            ConstrainedBox(
              constraints: BoxConstraints(
                maxHeight: MediaQuery.of(context).size.height * 0.45,
              ),
              child: _filtered.isEmpty
                  ? Padding(
                      padding: const EdgeInsets.all(32),
                      child: Column(
                        children: [
                          Icon(Icons.electric_moped_outlined,
                              size: 40, color: _outline),
                          const SizedBox(height: 12),
                          Text(
                            'No vehicles match your search',
                            style: GoogleFonts.inter(
                                fontSize: 14, color: _textMuted),
                          ),
                        ],
                      ),
                    )
                  : ListView.separated(
                      shrinkWrap: true,
                      itemCount: _filtered.length,
                      separatorBuilder: (_, __) =>
                          const Divider(height: 1, indent: 20, endIndent: 20),
                      itemBuilder: (ctx, i) {
                        final v = _filtered[i];
                        final isSelected = v['id'] == widget.selectedId;
                        final battery = _battery(v);
                        return ListTile(
                          onTap: () {
                            widget.onSelected(v['id'] as String, _label(v));
                            Navigator.of(ctx).pop();
                          },
                          contentPadding: const EdgeInsets.symmetric(
                              horizontal: 20, vertical: 4),
                          leading: Container(
                            width: 42,
                            height: 42,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: isSelected
                                  ? _primary.withOpacity(0.1)
                                  : _surface,
                            ),
                            child: Icon(
                              Icons.electric_moped_outlined,
                              size: 20,
                              color: isSelected ? _primary : _textMuted,
                            ),
                          ),
                          title: Text(
                            v['vehicleId'] as String? ?? '',
                            style: GoogleFonts.inter(
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                              color: isSelected ? _primary : _textDark,
                            ),
                          ),
                          subtitle: Text(
                            [
                              v['model'] as String? ?? '',
                              if ((v['licensePlate'] as String?)
                                      ?.isNotEmpty ==
                                  true)
                                v['licensePlate'] as String,
                            ].where((s) => s.isNotEmpty).join(' · '),
                            style: GoogleFonts.inter(
                                fontSize: 12, color: _textMuted),
                          ),
                          trailing: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              if (battery.isNotEmpty) ...[
                                Icon(Icons.battery_charging_full_rounded,
                                    size: 14, color: _batteryColor(v)),
                                const SizedBox(width: 2),
                                Text(
                                  battery,
                                  style: GoogleFonts.inter(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w700,
                                    color: _batteryColor(v),
                                  ),
                                ),
                                const SizedBox(width: 8),
                              ],
                              if (isSelected)
                                const Icon(Icons.check_circle,
                                    color: _success, size: 20),
                            ],
                          ),
                        );
                      },
                    ),
            ),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }
}
