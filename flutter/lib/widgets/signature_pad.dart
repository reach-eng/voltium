import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

class SignaturePad extends StatefulWidget {
  final Color strokeColor;
  final Color backgroundColor;
  final double strokeWidth;
  final void Function(List<List<Offset>>)? onSignatureChanged;

  const SignaturePad({
    super.key,
    this.strokeColor = Colors.black,
    this.backgroundColor = Colors.white,
    this.strokeWidth = 3.0,
    this.onSignatureChanged,
  });

  @override
  State<SignaturePad> createState() => SignaturePadState();
}

class SignaturePadState extends State<SignaturePad> {
  final List<List<Offset>> _strokes = [];
  List<Offset> _currentStroke = [];

  void clear() {
    setState(() {
      _strokes.clear();
      _currentStroke = [];
    });
    widget.onSignatureChanged?.call(_strokes);
  }

  bool get isEmpty => _strokes.isEmpty && _currentStroke.isEmpty;

  List<List<Offset>> get strokes => _strokes;

  void _onPanStart(DragStartDetails details) {
    setState(() {
      _currentStroke = [details.localPosition];
    });
  }

  void _onPanUpdate(DragUpdateDetails details) {
    setState(() {
      _currentStroke = [..._currentStroke, details.localPosition];
    });
  }

  void _onPanEnd(DragEndDetails details) {
    setState(() {
      _strokes.add(_currentStroke);
      _currentStroke = [];
    });
    widget.onSignatureChanged?.call(_strokes);
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onPanStart: _onPanStart,
      onPanUpdate: _onPanUpdate,
      onPanEnd: _onPanEnd,
      child: Container(
        decoration: BoxDecoration(
          color: widget.backgroundColor,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.outlineVariant),
        ),
        child: CustomPaint(
          painter: _SignaturePainter(
            strokes: _strokes,
            currentStroke: _currentStroke,
            strokeColor: widget.strokeColor,
            strokeWidth: widget.strokeWidth,
          ),
          size: Size.infinite,
        ),
      ),
    );
  }
}

class _SignaturePainter extends CustomPainter {
  final List<List<Offset>> strokes;
  final List<Offset> currentStroke;
  final Color strokeColor;
  final double strokeWidth;

  _SignaturePainter({
    required this.strokes,
    required this.currentStroke,
    required this.strokeColor,
    required this.strokeWidth,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = strokeColor
      ..strokeWidth = strokeWidth
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..style = PaintingStyle.stroke;

    for (final stroke in strokes) {
      if (stroke.length < 2) continue;
      final path = Path();
      path.moveTo(stroke.first.dx, stroke.first.dy);
      for (int i = 1; i < stroke.length; i++) {
        path.lineTo(stroke[i].dx, stroke[i].dy);
      }
      canvas.drawPath(path, paint);
    }

    if (currentStroke.length >= 2) {
      final path = Path();
      path.moveTo(currentStroke.first.dx, currentStroke.first.dy);
      for (int i = 1; i < currentStroke.length; i++) {
        path.lineTo(currentStroke[i].dx, currentStroke[i].dy);
      }
      canvas.drawPath(path, paint);
    }
  }

  @override
  bool shouldRepaint(covariant _SignaturePainter oldDelegate) {
    return oldDelegate.strokes != strokes ||
        oldDelegate.currentStroke != currentStroke;
  }
}
