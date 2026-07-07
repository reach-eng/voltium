import 'package:flutter/material.dart';
import '../models/rider_model.dart';
import '../models/deposit_record.dart';

class TopUpRequestSentCard extends StatelessWidget {
  final RiderModel rider;
  final int topUpAmount;
  final VoidCallback onResubmit;

  const TopUpRequestSentCard({
    Key? key,
    required this.rider,
    required this.topUpAmount,
    required this.onResubmit,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final record = rider.depositRecord;
    final isRejected = record?.status == DepositStatus.rejected;
    final statusText = isRejected ? 'Rejected' : 'Awaiting Admin Approval';
    final statusColor = isRejected ? Colors.red : Colors.orange;

    return Card(
      elevation: 4,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Top-up Request Sent',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: statusColor.withOpacity(0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                statusText,
                style: TextStyle(color: statusColor, fontWeight: FontWeight.w600),
              ),
            ),
            if (isRejected && record?.rejectionReason != null) ...[
              const SizedBox(height: 8),
              Text(
                'Reason: ${record!.rejectionReason}',
                style: const TextStyle(color: Colors.red),
              ),
            ],
            const SizedBox(height: 16),
            const Text(
              'Breakdown:',
              style: TextStyle(fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Security Deposit:'),
                Text('₹${rider.securityDeposit}'),
              ],
            ),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Rental Charges:'),
                Text('₹${topUpAmount - rider.securityDeposit}'),
              ],
            ),
            const Divider(),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Total:', style: TextStyle(fontWeight: FontWeight.bold)),
                Text('₹$topUpAmount', style: const TextStyle(fontWeight: FontWeight.bold)),
              ],
            ),
            if (isRejected) ...[
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: onResubmit,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.red,
                    foregroundColor: Colors.white,
                  ),
                  child: const Text('Resubmit'),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
