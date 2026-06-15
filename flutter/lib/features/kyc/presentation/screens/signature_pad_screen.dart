import 'package:flutter/material.dart';
import 'dart:io';
import 'dart:ui' as ui;
import 'package:flutter/rendering.dart';
import 'package:path_provider/path_provider.dart';

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
      debugPrint('Error saving signature: $e');
      if (mounted) Navigator.of(context).pop();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
            icon: const Icon(Icons.close),
            onPressed: () => Navigator.pop(context)),
        title: const Text('Draw Signature',
            style: TextStyle(
                color: Color(0xFF111827), fontWeight: FontWeight.w600)),
        actions: [
          TextButton(
              onPressed: _clear,
              child: const Text('Clear',
                  style: TextStyle(color: Color(0xFF2563EB)))),
          TextButton(
              onPressed: _save,
              child: const Text('Save',
                  style: TextStyle(
                      color: Color(0xFF2563EB), fontWeight: FontWeight.w600))),
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
            Expanded(
              child: RepaintBoundary(
                key: _boundaryKey,
                child: Container(
                  decoration: BoxDecoration(
                    color: Colors.white,
                    border: Border.all(color: const Color(0xFFE5E7EB)),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Stack(
                    children: [
                      SizedBox.expand(),
                      GestureDetector(
                        behavior: HitTestBehavior.opaque,
                        onPanStart: (details) =>
                            _addPoint(details.localPosition),
                        onPanUpdate: (details) =>
                            _addPoint(details.localPosition),
                        onPanEnd: (_) => _endStroke(),
                        child: CustomPaint(
                          painter: _SignaturePainter(_points),
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
  _SignaturePainter(this.points);

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = const Color(0xFF111827)
      ..strokeCap = StrokeCap.round
      ..strokeWidth = 3;
    for (int i = 0; i < points.length - 1; i++) {
      if (points[i] != null && points[i + 1] != null)
        canvas.drawLine(points[i]!, points[i + 1]!, paint);
    }
  }

  @override
  bool shouldRepaint(covariant _SignaturePainter old) => true;
}
