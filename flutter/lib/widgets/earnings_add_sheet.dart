import 'package:flutter/material.dart';
import '../models/earnings_entry_model.dart';
import '../theme/app_theme.dart';

/// Bottom sheet for adding a new earnings entry.
class AddEarningSheet extends StatefulWidget {
  final DateTime defaultDate;

  const AddEarningSheet({super.key, required this.defaultDate});

  @override
  State<AddEarningSheet> createState() => _AddEarningSheetState();
}

class _AddEarningSheetState extends State<AddEarningSheet> {
  late DateTime _selectedDate;
  GigPlatform _selectedPlatform = GigPlatform.zomato;
  final _amountController = TextEditingController();
  final _tripsController = TextEditingController();
  final _hoursController = TextEditingController();
  final _notesController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _selectedDate = widget.defaultDate;
  }

  @override
  void dispose() {
    _amountController.dispose();
    _tripsController.dispose();
    _hoursController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  void _submit() {
    final amount = double.tryParse(_amountController.text);
    final trips = int.tryParse(_tripsController.text);
    final hours = double.tryParse(_hoursController.text);

    if (amount == null || amount <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter a valid amount')),
      );
      return;
    }
    if (trips == null || trips <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter valid trips count')),
      );
      return;
    }
    if (hours == null || hours <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter valid hours')),
      );
      return;
    }

    Navigator.of(context).pop({
      'date': _selectedDate,
      'platform': _selectedPlatform,
      'amount': amount,
      'trips': trips,
      'hours': hours,
      'notes': _notesController.text.isEmpty ? null : _notesController.text,
    });
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate,
      firstDate: DateTime.now().subtract(const Duration(days: 90)),
      lastDate: DateTime.now(),
    );
    if (picked != null && mounted) {
      setState(() => _selectedDate = picked);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Add Earning',
                  style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF1E293B),),
                ),
                InkWell(
                  onTap: () => Navigator.of(context).pop(),
                  child: Container(
                    padding: const EdgeInsets.all(8),
                    decoration: const BoxDecoration(
                      color: AppColors.iconBackground,
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.close,
                        size: 18, color: AppColors.slate500,),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),
            _buildInputField(
              label: 'PLATFORM',
              child: DropdownButtonFormField<GigPlatform>(
                initialValue: _selectedPlatform,
                decoration: InputDecoration(
                  filled: true,
                  fillColor: AppColors.iconBackground,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(16),
                    borderSide: BorderSide.none,
                  ),
                  contentPadding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                ),
                items: GigPlatform.values.map((p) {
                  return DropdownMenuItem(
                    value: p,
                    child: Text(EarningEntry.platformLabel(p)),
                  );
                }).toList(),
                onChanged: (v) => setState(() => _selectedPlatform = v!),
              ),
            ),
            const SizedBox(height: 16),
            _buildInputField(
              label: 'AMOUNT (\u20B9)',
              child: TextFormField(
                controller: _amountController,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                decoration: InputDecoration(
                  filled: true,
                  fillColor: AppColors.iconBackground,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(16),
                    borderSide: BorderSide.none,
                  ),
                  contentPadding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  hintText: '0',
                ),
              ),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: _buildInputField(
                    label: 'TRIPS',
                    child: TextFormField(
                      controller: _tripsController,
                      keyboardType: TextInputType.number,
                      decoration: InputDecoration(
                        filled: true,
                        fillColor: AppColors.iconBackground,
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(16),
                          borderSide: BorderSide.none,
                        ),
                        contentPadding: const EdgeInsets.symmetric(
                            horizontal: 16, vertical: 12,),
                        hintText: '0',
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _buildInputField(
                    label: 'HOURS ONLINE',
                    child: TextFormField(
                      controller: _hoursController,
                      keyboardType:
                          const TextInputType.numberWithOptions(decimal: true),
                      decoration: InputDecoration(
                        filled: true,
                        fillColor: AppColors.iconBackground,
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(16),
                          borderSide: BorderSide.none,
                        ),
                        contentPadding: const EdgeInsets.symmetric(
                            horizontal: 16, vertical: 12,),
                        hintText: '0',
                      ),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            _buildInputField(
              label: 'DATE',
              child: InkWell(
                onTap: _pickDate,
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  decoration: BoxDecoration(
                    color: AppColors.iconBackground,
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        '${_selectedDate.day}/${_selectedDate.month}/${_selectedDate.year}',
                        style: const TextStyle(
                            fontSize: 14, color: Color(0xFF1E293B),),
                      ),
                      const Icon(Icons.calendar_today,
                          size: 16, color: AppColors.slate500,),
                    ],
                  ),
                ),
              ),
            ),
            const SizedBox(height: 16),
            _buildInputField(
              label: 'NOTES (OPTIONAL)',
              child: TextFormField(
                controller: _notesController,
                maxLines: 2,
                decoration: InputDecoration(
                  filled: true,
                  fillColor: AppColors.iconBackground,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(16),
                    borderSide: BorderSide.none,
                  ),
                  contentPadding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  hintText: 'Add any notes...',
                ),
              ),
            ),
            const SizedBox(height: 24),
            FilledButton(
              onPressed: _submit,
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.primary,
                minimumSize: const Size(double.infinity, 56),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(AppRadius.full),
                ),
              ),
              child: const Text('Submit',
                style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: Colors.white,),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildInputField({required String label, required Widget child}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontSize: 9,
            fontWeight: FontWeight.w900,
            color: AppColors.slate500,
            letterSpacing: 1.5,
          ),
        ),
        const SizedBox(height: 6),
        child,
      ],
    );
  }
}
