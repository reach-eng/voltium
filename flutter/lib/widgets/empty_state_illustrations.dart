import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

class EmptyStateIllustration extends StatelessWidget {
  final EmptyStateType type;
  final String? title;
  final String? message;
  final VoidCallback? onAction;
  final String? actionLabel;

  const EmptyStateIllustration({
    super.key,
    required this.type,
    this.title,
    this.message,
    this.onAction,
    this.actionLabel,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            _buildIllustration(),
            const SizedBox(height: 24),
            Text(
              title ?? _defaultTitle,
              style: const TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
              textAlign: TextAlign.center,
            ),
            if (message != null) ...[
              const SizedBox(height: 8),
              Text(
                message!,
                style: TextStyle(
                  fontSize: 14,
                  color: Colors.grey.shade600,
                ),
                textAlign: TextAlign.center,
              ),
            ],
            if (onAction != null && actionLabel != null) ...[
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: onAction,
                child: Text(actionLabel!),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildIllustration() {
    return SizedBox(
      width: 150,
      height: 150,
      child: CustomPaint(
        painter: _EmptyStatePainter(type),
      ),
    );
  }

  String get _defaultTitle {
    switch (type) {
      case EmptyStateType.noRides:
        return 'No Rides Yet';
      case EmptyStateType.noNotifications:
        return 'No Notifications';
      case EmptyStateType.noBookings:
        return 'No Bookings';
      case EmptyStateType.noResults:
        return 'No Results Found';
      case EmptyStateType.noFavorites:
        return 'No Favorites';
      case EmptyStateType.noHistory:
        return 'No History';
      case EmptyStateType.error:
        return 'Something Went Wrong';
      case EmptyStateType.offline:
        return 'No Internet';
    }
  }
}

enum EmptyStateType {
  noRides,
  noNotifications,
  noBookings,
  noResults,
  noFavorites,
  noHistory,
  error,
  offline,
}

class _EmptyStatePainter extends CustomPainter {
  final EmptyStateType type;

  _EmptyStatePainter(this.type);

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = AppColors.outline
      ..strokeWidth = 3
      ..style = PaintingStyle.stroke;

    final fillPaint = Paint()
      ..color = AppColors.surfaceAlt
      ..style = PaintingStyle.fill;

    switch (type) {
      case EmptyStateType.noRides:
        _drawCar(canvas, size, paint, fillPaint);
        break;
      case EmptyStateType.noNotifications:
        _drawBell(canvas, size, paint, fillPaint);
        break;
      case EmptyStateType.noBookings:
        _drawCalendar(canvas, size, paint, fillPaint);
        break;
      case EmptyStateType.noResults:
        _drawSearch(canvas, size, paint, fillPaint);
        break;
      case EmptyStateType.noFavorites:
        _drawHeart(canvas, size, paint, fillPaint);
        break;
      case EmptyStateType.noHistory:
        _drawClock(canvas, size, paint, fillPaint);
        break;
      case EmptyStateType.error:
        _drawError(canvas, size, paint, fillPaint);
        break;
      case EmptyStateType.offline:
        _drawWifi(canvas, size, paint, fillPaint);
        break;
    }
  }

  void _drawCar(Canvas canvas, Size size, Paint paint, Paint fillPaint) {
    final center = Offset(size.width / 2, size.height / 2);
    final rect = RRect.fromRectAndRadius(
      Rect.fromCenter(center: center.translate(0, 10), width: 80, height: 40),
      const Radius.circular(8),
    );
    canvas.drawRRect(rect, fillPaint);
    canvas.drawRRect(rect, paint);
    canvas.drawCircle(center.translate(-20, 30), 10, paint);
    canvas.drawCircle(center.translate(20, 30), 10, paint);
    final roofPath = Path()
      ..moveTo(center.dx - 25, center.dy + 5)
      ..lineTo(center.dx - 15, center.dy - 15)
      ..lineTo(center.dx + 15, center.dy - 15)
      ..lineTo(center.dx + 25, center.dy + 5);
    canvas.drawPath(roofPath, paint);
  }

  void _drawBell(Canvas canvas, Size size, Paint paint, Paint fillPaint) {
    final center = Offset(size.width / 2, size.height / 2 - 10);
    final body = Path()
      ..moveTo(center.dx - 25, center.dy - 20)
      ..quadraticBezierTo(
          center.dx - 25, center.dy + 25, center.dx, center.dy + 25,)
      ..quadraticBezierTo(
          center.dx + 25, center.dy + 25, center.dx + 25, center.dy - 20,)
      ..close();
    canvas.drawPath(body, fillPaint);
    canvas.drawPath(body, paint);
    canvas.drawCircle(center.translate(0, 40), 6, paint);
    canvas.drawLine(
        center.translate(-30, -20), center.translate(-30, -35), paint,);
    canvas.drawLine(
        center.translate(30, -20), center.translate(30, -35), paint,);
    canvas.drawLine(
        center.translate(-15, -20), center.translate(-15, -30), paint,);
    canvas.drawLine(
        center.translate(15, -20), center.translate(15, -30), paint,);
  }

  void _drawCalendar(Canvas canvas, Size size, Paint paint, Paint fillPaint) {
    final center = Offset(size.width / 2, size.height / 2);
    final rect = Rect.fromCenter(center: center, width: 70, height: 70);
    canvas.drawRect(rect, fillPaint);
    canvas.drawRect(rect, paint);
    canvas.drawLine(
        center.translate(-35, -20), center.translate(35, -20), paint,);
    canvas.drawCircle(center.translate(-20, -30), 4, paint);
    canvas.drawCircle(center.translate(20, -30), 4, paint);
  }

  void _drawSearch(Canvas canvas, Size size, Paint paint, Paint fillPaint) {
    final center = Offset(size.width / 2, size.height / 2);
    canvas.drawCircle(center.translate(0, -10), 25, paint);
    canvas.drawLine(center.translate(18, 12), center.translate(35, 35), paint);
    for (var i = 0; i < 3; i++) {
      canvas.drawLine(
        center.translate(-30, 20 + i * 15),
        center.translate(-10, 20 + i * 15),
        paint,
      );
    }
  }

  void _drawHeart(Canvas canvas, Size size, Paint paint, Paint fillPaint) {
    final center = Offset(size.width / 2, size.height / 2);
    final path = Path()
      ..moveTo(center.dx, center.dy + 30)
      ..cubicTo(center.dx - 30, center.dy, center.dx - 30, center.dy - 25,
          center.dx, center.dy - 10,)
      ..cubicTo(center.dx + 30, center.dy - 25, center.dx + 30, center.dy,
          center.dx, center.dy + 30,);
    canvas.drawPath(path, fillPaint);
    canvas.drawPath(path, paint);
  }

  void _drawClock(Canvas canvas, Size size, Paint paint, Paint fillPaint) {
    final center = Offset(size.width / 2, size.height / 2);
    canvas.drawCircle(center, 35, fillPaint);
    canvas.drawCircle(center, 35, paint);
    canvas.drawLine(center, center.translate(0, -20), paint);
    canvas.drawLine(center, center.translate(15, 10), paint);
  }

  void _drawError(Canvas canvas, Size size, Paint paint, Paint fillPaint) {
    final center = Offset(size.width / 2, size.height / 2);
    canvas.drawCircle(center, 40, fillPaint);
    canvas.drawCircle(center, 40, paint);
    paint.strokeWidth = 4;
    canvas.drawLine(
        center.translate(-15, -15), center.translate(15, 15), paint,);
    canvas.drawLine(
        center.translate(15, -15), center.translate(-15, 15), paint,);
  }

  void _drawWifi(Canvas canvas, Size size, Paint paint, Paint fillPaint) {
    final center = Offset(size.width / 2, size.height / 2);
    paint.strokeWidth = 3;
    canvas.drawArc(
      Rect.fromCenter(center: center.translate(0, 20), width: 30, height: 30),
      3.14,
      3.14,
      false,
      paint,
    );
    canvas.drawArc(
      Rect.fromCenter(center: center.translate(0, 10), width: 50, height: 50),
      3.14,
      3.14,
      false,
      paint,
    );
    canvas.drawArc(
      Rect.fromCenter(center: center.translate(0, 0), width: 70, height: 70),
      3.14,
      3.14,
      false,
      paint,
    );
    paint.style = PaintingStyle.fill;
    canvas.drawCircle(center.translate(0, 30), 4, paint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
