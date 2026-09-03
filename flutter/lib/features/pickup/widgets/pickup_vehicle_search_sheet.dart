import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:voltium_rider/widgets/fluid_list_wrapper.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:voltium_rider/theme/app_typography.dart';

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
  static const Color _primary = AppColors.primary;
  static const Color _success = AppColors.success;

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
              final number =
                  (v['vehicleNumber'] as String? ?? '').toLowerCase();
              final model = (v['model'] as String? ?? '').toLowerCase();
              final plate = (v['licensePlate'] as String? ?? '').toLowerCase();
              return number.contains(q) ||
                  model.contains(q) ||
                  plate.contains(q);
            }).toList();
    });
  }

  String _label(Map<String, dynamic> v) {
    final number =
        v['vehicleNumber'] as String? ?? v['licensePlate'] as String? ?? '';
    final model = v['model'] as String? ?? '';
    return '$number${model.isNotEmpty ? ' • $model' : ''}';
  }

  String _battery(Map<String, dynamic> v) {
    final lvl = v['batteryLevel'];
    if (lvl == null) return '';
    return '${lvl.toStringAsFixed(0)}%';
  }

  Color _batteryColor(Map<String, dynamic> v) {
    final lvl = (v['batteryLevel'] as num?)?.toDouble() ?? 100;
    if (lvl >= 60) return _success;
    if (lvl >= 30) return AppColors.warning;
    return AppColors.error;
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;
    return GestureDetector(
      onTap: () => FocusScope.of(context).unfocus(),
      child: Container(
        decoration: BoxDecoration(
          color: colors.card,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
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
                color: colors.outlineVariant,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            SizedBox(height: 16),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      'Select Vehicle',
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 17,
                        fontWeight: FontWeight.w800,
                        color: colors.onSurface,
                      ),
                    ),
                  ),
                  Text(
                    '${widget.vehicles.length} available',
                    style: AppTypography.bodySmall
                        .copyWith(fontWeight: FontWeight.w600)
                        .copyWith(color: _success),
                  ),
                ],
              ),
            ),
            SizedBox(height: 14),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: TextFormField(
                controller: _searchCtrl,
                autofocus: true,
                style: GoogleFonts.plusJakartaSans(
                    fontSize: 14, color: colors.onSurface),
                decoration: InputDecoration(
                  hintText: 'Search by ID, model or plate…',
                  hintStyle: GoogleFonts.plusJakartaSans(
                    fontSize: 14,
                    color: colors.onSurfaceMuted.withValues(alpha: 0.7),
                  ),
                  prefixIcon:
                      const Icon(Icons.search, color: _primary, size: 20),
                  suffixIcon: _searchCtrl.text.isNotEmpty
                      ? IconButton(
                          tooltip: 'Clear search',
                          icon: Icon(
                            Icons.close,
                            size: 18,
                            color: colors.onSurfaceMuted,
                          ),
                          onPressed: () => _searchCtrl.clear(),
                        )
                      : null,
                  filled: true,
                  fillColor: colors.surfaceBright,
                  contentPadding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(AppRadius.md),
                    borderSide: BorderSide(color: colors.outlineVariant),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(AppRadius.md),
                    borderSide: BorderSide(color: colors.outlineVariant),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(AppRadius.md),
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
                      padding: Spacing.paddingXl,
                      child: Column(
                        children: [
                          Icon(
                            Icons.electric_moped_outlined,
                            size: 40,
                            color: colors.outlineVariant,
                          ),
                          SizedBox(height: 12),
                          Text(
                            'No vehicles match your search',
                            style: GoogleFonts.plusJakartaSans(
                              fontSize: 14,
                              color: colors.onSurfaceMuted,
                            ),
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
                        return FluidStaggeredItem(
                            index: i,
                            child: ListTile(
                              onTap: () {
                                widget.onSelected(v['id'] as String, _label(v));
                                Navigator.of(ctx).pop();
                              },
                              contentPadding: const EdgeInsets.symmetric(
                                horizontal: 20,
                                vertical: 4,
                              ),
                              leading: Container(
                                width: 42,
                                height: 42,
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  color: isSelected
                                      ? _primary.withValues(alpha: 0.1)
                                      : colors.surfaceBright,
                                ),
                                child: Icon(
                                  Icons.electric_moped_outlined,
                                  size: 20,
                                  color: isSelected
                                      ? _primary
                                      : colors.onSurfaceMuted,
                                ),
                              ),
                              title: Text(
                                v['vehicleNumber'] as String? ?? '',
                                style: AppTypography.labelLarge.copyWith(
                                    color: isSelected
                                        ? _primary
                                        : colors.onSurface),
                              ),
                              subtitle: Text(
                                [
                                  v['model'] as String? ?? '',
                                  if ((v['licensePlate'] as String?)
                                          ?.isNotEmpty ==
                                      true)
                                    v['licensePlate'] as String,
                                ].where((s) => s.isNotEmpty).join(' · '),
                                style: GoogleFonts.plusJakartaSans(
                                  fontSize: 12,
                                  color: AppColors.of(context).onSurfaceMuted,
                                ),
                              ),
                              trailing: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  if (battery.isNotEmpty) ...[
                                    Icon(
                                      Icons.battery_charging_full_rounded,
                                      size: 14,
                                      color: _batteryColor(v),
                                    ),
                                    SizedBox(width: 2),
                                    Text(
                                      battery,
                                      style: AppTypography.labelSmall.copyWith(
                                        color: _batteryColor(v),
                                      ),
                                    ),
                                    const SizedBox(width: 8),
                                  ],
                                  if (isSelected)
                                    const Icon(
                                      Icons.check_circle,
                                      color: _success,
                                      size: 20,
                                    ),
                                ],
                              ),
                            ));
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
