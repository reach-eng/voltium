import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/app_provider.dart';
import '../utils/app_navigator.dart';
import 'troubleshooter_screen.dart';

class SupportChecklistScreen extends StatefulWidget {
  const SupportChecklistScreen({super.key});

  @override
  State<SupportChecklistScreen> createState() => _SupportChecklistScreenState();
}

class _SupportChecklistScreenState extends State<SupportChecklistScreen> {
  late List<bool> _checkedItems;

  @override
  void initState() {
    super.initState();
    final checklist =
        context.read<AppProvider>().supportConfig?.ticketChecklist ?? [];
    _checkedItems = List<bool>.filled(checklist.length, false);
  }

  bool get _allChecked => _checkedItems.every((item) => item);

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<AppProvider>();
    final checklist = provider.supportConfig?.ticketChecklist ?? [];

    return Scaffold(
      backgroundColor: const Color(0xFFF1F5F9),
      appBar: AppBar(
        title: const Text('Support Checklist',
            style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.transparent,
        elevation: 0,
        centerTitle: false,
      ),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'PLEASE VERIFY',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF64748B),
                        letterSpacing: 1.0,
                      ),
                    ),
                    const SizedBox(height: 16),
                    const Text(
                      'Before creating a ticket, please ensure you have completed these steps to help us resolve your issue faster.',
                      style: TextStyle(
                        fontSize: 14,
                        color: Color(0xFF1E293B),
                        height: 1.5,
                      ),
                    ),
                    const SizedBox(height: 24),
                    ...List.generate(checklist.length, (index) {
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: _buildChecklistItem(index, checklist[index]),
                      );
                    }),
                  ],
                ),
              ),
            ),
            _buildActionButtons(),
          ],
        ),
      ),
    );
  }

  Widget _buildChecklistItem(int index, String text) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: CheckboxListTile(
        value: _checkedItems[index],
        onChanged: (val) {
          setState(() {
            _checkedItems[index] = val ?? false;
          });
        },
        title: Text(
          text,
          style: const TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w500,
            color: Color(0xFF1E293B),
          ),
        ),
        activeColor: const Color(0xFF2563EB),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        controlAffinity: ListTileControlAffinity.leading,
        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      ),
    );
  }

  Widget _buildActionButtons() {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          ElevatedButton(
            onPressed: _allChecked
                ? () {
                    AppNavigator.pushReplacement(
                        context, const TroubleshooterScreen());
                  }
                : null,
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF2563EB),
              foregroundColor: Colors.white,
              minimumSize: const Size(double.infinity, 54),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(27)),
              elevation: _allChecked ? 4 : 0,
              disabledBackgroundColor: const Color(0xFFCBD5E1),
              disabledForegroundColor: Colors.white70,
            ),
            child: const Text(
              'Proceed to Support',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
          ),
          const SizedBox(height: 12),
          Text(
            'Keep checking all items to proceed',
            style: TextStyle(
              fontSize: 12,
              color: _allChecked ? Colors.transparent : Colors.redAccent,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}
