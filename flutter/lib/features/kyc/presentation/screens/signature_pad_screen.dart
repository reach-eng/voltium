import 'package:flutter/material.dart';
import 'package:universal_io/io.dart';
import 'dart:ui' as ui;
import 'package:flutter/rendering.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:path_provider/path_provider.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import '../../../../utils/app_logger.dart';

class SignaturePadScreen extends StatefulWidget {
  const SignaturePadScreen({super.key});

  @override
  State<SignaturePadScreen> createState() => _SignaturePadScreenState();
}

class _SignaturePadScreenState extends State<SignaturePadScreen> {
  final GlobalKey _boundaryKey = GlobalKey();
  final List<Offset?> _points = [];

  void _clear() => setState(() => _points.clear());

  void _addPoint(Offset point) {
    setState(() {
      _points.add(point);
    });
  }

  void _endStroke() {
    setState(() {
      _points.add(null);
    });
  }

  Future<void> _save() async {
    if (_points.isEmpty) {
      Navigator.of(context).pop();
      return;
    }

    try {
      final boundary = _boundaryKey.currentContext?.findRenderObject()
          as RenderRepaintBoundary?;
      if (boundary == null) return;

      final image = await boundary.toImage(pixelRatio: 3.0);
      final byteData = await image.toByteData(format: ui.ImageByteFormat.png);
      if (byteData == null) return;

      final bytes = byteData.buffer.asUint8List();
      final directory = await getTemporaryDirectory();
      final path =
          '${directory.path}/signature_${DateTime.now().millisecondsSinceEpoch}.png';
      final file = File(path);
      await file.writeAsBytes(bytes);

      if (mounted) Navigator.of(context).pop(path);
    } catch (e) {
      appDebug('Error saving signature: $e');
      if (mounted) Navigator.of(context).pop();
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      backgroundColor: colors.surface,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          tooltip: 'Close',
          icon: Icon(Icons.close, color: colors.onSurface),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          l10n?.txtdrawSignature ?? 'Draw Signature',
          style: GoogleFonts.plusJakartaSans(
            color: colors.onSurface,
            fontWeight: FontWeight.w600,
          ),
        ),
        actions: [
          TextButton(
            onPressed: _clear,
            child: Text(
              l10n?.txtclear ?? 'Clear',
              style: GoogleFonts.plusJakartaSans(color: AppColors.primary),
            ),
          ),
          TextButton(
            onPressed: _save,
            child: Text(
              l10n?.txtsave ?? 'Save',
              style: GoogleFonts.plusJakartaSans(
                color: AppColors.primary,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
      body: Padding(
        padding: Spacing.paddingLg,
        child: Column(
          children: [
            Expanded(
              child: RepaintBoundary(
                key: _boundaryKey,
                child: Container(
                  decoration: BoxDecoration(
                    color: Colors.white,
                    border: Border.all(
                      color: colors.outlineVariant,
                      width: 1.5,
                    ),
                    borderRadius: BorderRadius.circular(AppRadius.md),
                  ),
                  child: Stack(
                    children: [
                      const SizedBox.expand(),
                      GestureDetector(
                        behavior: HitTestBehavior.opaque,
                        onPanStart: (details) =>
                            _addPoint(details.localPosition),
                        onPanUpdate: (details) =>
                            _addPoint(details.localPosition),
                        onPanEnd: (_) => _endStroke(),
                        child: CustomPaint(
                          painter: _SignaturePainter(
                            _points,
                            color: AppColors.of(context).onSurface,
                          ),
                          size: Size.infinite,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SignaturePainter extends CustomPainter {
  final List<Offset?> points;
  final Color color;
  _SignaturePainter(this.points, {required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..strokeCap = StrokeCap.round
      ..strokeWidth = 3;
    for (int i = 0; i < points.length - 1; i++) {
      if (points[i] != null && points[i + 1] != null) {
        canvas.drawLine(points[i]!, points[i + 1]!, paint);
      }
    }
  }

  @override
  bool shouldRepaint(covariant _SignaturePainter old) =>
      old.points.length != points.length;
}
