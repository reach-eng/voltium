import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:path_provider/path_provider.dart';
import 'dart:io';
import 'package:share_plus/share_plus.dart';

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

  Future<File> generatePdf() async {
    final pdf = pw.Document();

    pdf.addPage(
      pw.Page(
        pageFormat: PdfPageFormat.a4,
        build: (context) {
          return pw.Column(
            crossAxisAlignment: pw.CrossAxisAlignment.start,
            children: [
              pw.Center(
                child: pw.Text(
                  'VOLT FLEET',
                  style: pw.TextStyle(
                    fontSize: 24,
                    fontWeight: pw.FontWeight.bold,
                  ),
                ),
              ),
              pw.SizedBox(height: 8),
              pw.Center(
                child: pw.Text(
                  'Electric Vehicle Rental Service',
                  style: const pw.TextStyle(fontSize: 12),
                ),
              ),
              pw.Divider(thickness: 2),
              pw.SizedBox(height: 20),
              pw.Row(
                mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                children: [
                  pw.Column(
                    crossAxisAlignment: pw.CrossAxisAlignment.start,
                    children: [
                      pw.Text('Transaction Receipt',
                          style: pw.TextStyle(
                              fontSize: 18, fontWeight: pw.FontWeight.bold)),
                      pw.SizedBox(height: 4),
                      pw.Text('ID: ${transactionId.substring(0, 8)}...',
                          style: const pw.TextStyle(fontSize: 10)),
                    ],
                  ),
                  pw.Column(
                    crossAxisAlignment: pw.CrossAxisAlignment.end,
                    children: [
                      pw.Text('Date: ${_formatDate(date)}',
                          style: const pw.TextStyle(fontSize: 10)),
                      pw.Text('Time: ${_formatTime(date)}',
                          style: const pw.TextStyle(fontSize: 10)),
                    ],
                  ),
                ],
              ),
              pw.SizedBox(height: 20),
              pw.Container(
                padding: const pw.EdgeInsets.all(16),
                decoration: pw.BoxDecoration(
                  border: pw.Border.all(color: PdfColors.grey300),
                  borderRadius: pw.BorderRadius.circular(8),
                ),
                child: pw.Column(
                  crossAxisAlignment: pw.CrossAxisAlignment.start,
                  children: [
                    _buildRow('Rider Name', riderName),
                    _buildRow('Phone', riderPhone),
                    if (vehicleNumber != null)
                      _buildRow('Vehicle', vehicleNumber!),
                    _buildRow('Transaction Type', type.toUpperCase()),
                    if (purpose != null) _buildRow('Purpose', purpose!),
                  ],
                ),
              ),
              pw.SizedBox(height: 20),
              pw.Container(
                padding: const pw.EdgeInsets.all(16),
                decoration: pw.BoxDecoration(
                  color: type == 'CREDIT' ? PdfColors.green50 : PdfColors.red50,
                  borderRadius: pw.BorderRadius.circular(8),
                ),
                child: pw.Row(
                  mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                  children: [
                    pw.Text(
                      'Amount ${type == 'CREDIT' ? 'Credited' : 'Debited'}',
                      style: pw.TextStyle(
                          fontSize: 14, fontWeight: pw.FontWeight.bold),
                    ),
                    pw.Text(
                      '₹${(amount / 100).toStringAsFixed(2)}',
                      style: pw.TextStyle(
                        fontSize: 24,
                        fontWeight: pw.FontWeight.bold,
                        color: type == 'CREDIT'
                            ? PdfColors.green700
                            : PdfColors.red700,
                      ),
                    ),
                  ],
                ),
              ),
              pw.SizedBox(height: 40),
              pw.Divider(),
              pw.SizedBox(height: 8),
              pw.Center(
                child: pw.Text(
                  'Thank you for using Ryd!',
                  style: const pw.TextStyle(fontSize: 10),
                ),
              ),
              pw.Center(
                child: pw.Text(
                  'This is a computer-generated receipt.',
                  style: const pw.TextStyle(fontSize: 8, color: PdfColors.grey),
                ),
              ),
            ],
          );
        },
      ),
    );

    final output = await getTemporaryDirectory();
    final file =
        File('${output.path}/receipt_${transactionId.substring(0, 8)}.pdf');
    await file.writeAsBytes(await pdf.save());
    return file;
  }

  pw.Widget _buildRow(String label, String value) {
    return pw.Padding(
      padding: const pw.EdgeInsets.symmetric(vertical: 4),
      child: pw.Row(
        mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
        children: [
          pw.Text(label,
              style:
                  const pw.TextStyle(fontSize: 12, color: PdfColors.grey700)),
          pw.Text(value,
              style:
                  pw.TextStyle(fontSize: 12, fontWeight: pw.FontWeight.bold)),
        ],
      ),
    );
  }

  String _formatDate(DateTime date) {
    return '${date.day.toString().padLeft(2, '0')}/${date.month.toString().padLeft(2, '0')}/${date.year}';
  }

  String _formatTime(DateTime date) {
    return '${date.hour.toString().padLeft(2, '0')}:${date.minute.toString().padLeft(2, '0')}';
  }

  Future<void> share() async {
    final file = await generatePdf();
    await Share.shareXFiles([XFile(file.path)],
        text: 'Ryd Transaction Receipt');
  }
}
