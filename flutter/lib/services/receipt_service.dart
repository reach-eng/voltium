import 'package:share_plus/share_plus.dart';
import 'package:voltium_rider/core/network/api_client.dart';

class TransactionReceipt {
  final String transactionId;
  final String riderName;
  final String riderPhone;
  final DateTime date;
  final String type;
  final int amount;
  final String? purpose;
  final String? vehicleNumber;

  TransactionReceipt({
    required this.transactionId,
    required this.riderName,
    required this.riderPhone,
    required this.date,
    required this.type,
    required this.amount,
    this.purpose,
    this.vehicleNumber,
  });

  String get receiptUrl =>
      '${ApiClient().baseUrl}/api/rider/receipts/$transactionId';

  Future<void> share() async {
    final shortId = transactionId.length >= 8
        ? transactionId.substring(0, 8)
        : transactionId;
    await SharePlus.instance.share(
      ShareParams(
        text: 'Voltium Transaction Receipt (#$shortId):\n$receiptUrl',
      ),
    );
  }
}
