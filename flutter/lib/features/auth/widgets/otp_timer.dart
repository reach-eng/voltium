import 'dart:async';
import 'package:flutter/material.dart';

class OTPTimer extends StatefulWidget {
  final int seconds;
  final VoidCallback? onResend;
  final TextStyle? textStyle;
  final String resendText;
  final Color activeColor;

  const OTPTimer({
    super.key,
    this.seconds = 60,
    this.onResend,
    this.textStyle,
    this.resendText = 'Resend OTP',
    this.activeColor = Colors.amber,
  });

  @override
  State<OTPTimer> createState() => _OTPTimerState();
}

class _OTPTimerState extends State<OTPTimer> {
  late int _remainingSeconds;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _remainingSeconds = widget.seconds;
    _startTimer();
  }

  void _startTimer() {
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_remainingSeconds > 0) {
        setState(() {
          _remainingSeconds--;
        });
      } else {
        timer.cancel();
      }
    });
  }

  void _resend() {
    _timer?.cancel();
    setState(() {
      _remainingSeconds = widget.seconds;
    });
    _startTimer();
    widget.onResend?.call();
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isActive = _remainingSeconds == 0;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (!isActive)
          Text(
            '$_remainingSeconds',
            style: widget.textStyle ??
                TextStyle(
                  color: widget.activeColor,
                  fontWeight: FontWeight.bold,
                  fontSize: 16,
                ),
          ),
        const SizedBox(width: 8),
        GestureDetector(
          onTap: isActive ? _resend : null,
          child: Text(
            isActive ? widget.resendText : 'seconds',
            style: widget.textStyle?.copyWith(
                  color: isActive ? widget.activeColor : Colors.grey,
                ) ??
                TextStyle(
                  color: isActive ? widget.activeColor : Colors.grey,
                  fontWeight: isActive ? FontWeight.bold : FontWeight.normal,
                ),
          ),
        ),
      ],
    );
  }
}

class AnimatedOTPTimer extends StatefulWidget {
  final int seconds;
  final VoidCallback? onResend;
  final TextStyle? textStyle;
  final String resendText;
  final Color activeColor;

  const AnimatedOTPTimer({
    super.key,
    this.seconds = 60,
    this.onResend,
    this.textStyle,
    this.resendText = 'Resend OTP',
    this.activeColor = Colors.amber,
  });

  @override
  State<AnimatedOTPTimer> createState() => _AnimatedOTPTimerState();
}

class _AnimatedOTPTimerState extends State<AnimatedOTPTimer>
    with SingleTickerProviderStateMixin {
  late int _remainingSeconds;
  late AnimationController _controller;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _remainingSeconds = widget.seconds;
    _controller = AnimationController(
      vsync: this,
      duration: Duration(seconds: widget.seconds),
    )..addStatusListener((status) {
        if (status == AnimationStatus.completed) {
          setState(() {
            _remainingSeconds = 0;
          });
        }
      });
    _controller.forward();
  }

  void _resend() {
    _controller.reset();
    _controller.forward();
    setState(() {
      _remainingSeconds = widget.seconds;
    });
    widget.onResend?.call();
  }

  @override
  void dispose() {
    _timer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        return Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            SizedBox(
              width: 30,
              height: 30,
              child: CircularProgressIndicator(
                value: 1 - _controller.value,
                strokeWidth: 3,
                color: widget.activeColor,
                backgroundColor: Colors.grey.shade300,
              ),
            ),
            const SizedBox(width: 8),
            Text(
              _remainingSeconds > 0
                  ? '${(_remainingSeconds * (1 - _controller.value)).ceil()}s'
                  : widget.resendText,
              style: widget.textStyle ??
                  TextStyle(
                    color: _remainingSeconds > 0
                        ? Colors.grey
                        : widget.activeColor,
                    fontWeight: _remainingSeconds > 0
                        ? FontWeight.normal
                        : FontWeight.bold,
                  ),
            ),
            if (_remainingSeconds == 0) ...[
              const SizedBox(width: 8),
              GestureDetector(
                onTap: _resend,
                child: Icon(
                  Icons.refresh,
                  color: widget.activeColor,
                  size: 20,
                ),
              ),
            ],
          ],
        );
      },
    );
  }
}
