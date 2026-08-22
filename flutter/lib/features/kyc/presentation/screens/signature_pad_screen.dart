import 'package:flutter/material.dart';
import 'package:universal_io/io.dart';
import 'dart:ui' as ui;
import 'package:flutter/rendering.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:path_provider/path_provider.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:voltium_rider/utils/toast.dart';
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

  /// AUDIT FIX (HIGH): a single tap produces [Offset, null] which renders
  /// nothing but previously passed the `_points.isEmpty` check — saving a
  /// blank PNG as a "valid" legal signature. Require at least one completed
  /// stroke with ≥2 renderable (non-null, consecutive) points.
  bool get _hasRenderableInk {
    int runLength = 0;
    for (final p in _points) {
      if (p == null) {
        if (runLength >= 2) return true;
        runLength = 0;
      } else {
        runLength++;
      }
    }
    return runLength >= 2;
  }

  Future<void> _save() async {
    // AUDIT FIX (MINOR): Save is disabled when nothing is drawn; this
    // guard stays as a backstop.
    if (!_hasRenderableInk) return;

    ui.Image? image;
    try {
      final boundary = _boundaryKey.currentContext?.findRenderObject()
          as RenderRepaintBoundary?;
      if (boundary == null) return;

      image = await boundary.toImage(pixelRatio: 3.0);
      final byteData = await image.toByteData(format: ui.ImageByteFormat.png);
      if (byteData == null) return;

      final bytes = byteData.buffer.asUint8List();
      final directory = await getTemporaryDirectory();
      // AUDIT FIX (MINOR): stable filename so repeated saves overwrite one
      // file instead of accumulating signature_<timestamp>.png files that
      // are never deleted.
      final path = '${directory.path}/signature.png';
      final file = File(path);
      await file.writeAsBytes(bytes);

      if (mounted) Navigator.of(context).pop(path);
    } catch (e) {
      appDebug('Error saving signature: $e');
      // AUDIT FIX (MINOR): on failure, tell the user and stay on the pad —
      // popping with null makes the caller treat it as a cancel.
      if (mounted) {
        Toast.error(context, 'Could not save signature. Please try again.');
      }
    } finally {
      // AUDIT FIX (MEDIUM): dispose the rendered image on every path,
      // including the byteData==null early-return.
      image?.dispose();
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final l10n = AppLocalizations.of(context);
    final canSave = _hasRenderableInk;
    return Scaffold(
      backgroundColor: colors.surface,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
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
            // AUDIT FIX (MINOR): disabled until at least one completed
            // stroke with renderable ink exists.
            onPressed: canSave ? _save : null,
            child: Text(
              l10n?.txtsave ?? 'Save',
              style: GoogleFonts.plusJakartaSans(
                color: canSave ? AppColors.primary : colors.onSurfaceVariant,
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
                        // AUDIT FIX (MEDIUM): without this handler a
                        // cancelled gesture never terminated the stroke, so
                        // the next stroke drew a straight line connecting to
                        // the previous one.
                        onPanCancel: _endStroke,
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
