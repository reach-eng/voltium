import 'package:flutter/material.dart';

class PriceDisplay extends StatefulWidget {
  final double price;
  final String currency;
  final TextStyle? textStyle;
  final bool animate;
  final Duration duration;
  final bool showSign;

  const PriceDisplay({
    super.key,
    required this.price,
    this.currency = '\$',
    this.textStyle,
    this.animate = true,
    this.duration = const Duration(milliseconds: 500),
    this.showSign = false,
  });

  @override
  State<PriceDisplay> createState() => _PriceDisplayState();
}

class _PriceDisplayState extends State<PriceDisplay>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _animation;
  double _previousPrice = 0;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: widget.duration,
    );
    _animation = Tween<double>(begin: 0, end: widget.price).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeOut),
    );
    if (widget.animate) {
      _controller.forward();
    }
  }

  @override
  void didUpdateWidget(PriceDisplay oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.price != widget.price) {
      _previousPrice = oldWidget.price;
      _animation = Tween<double>(begin: _previousPrice, end: widget.price)
          .animate(CurvedAnimation(parent: _controller, curve: Curves.easeOut));
      _controller.forward(from: 0);
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  String _formatPrice(double value) {
    final sign = widget.showSign && value > 0 ? '+' : '';
    return '$sign${widget.currency}${value.toStringAsFixed(2)}';
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _animation,
      builder: (context, child) {
        return Text(
          _formatPrice(_animation.value),
          style: widget.textStyle ??
              const TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.bold,
              ),
        );
      },
    );
  }
}

class AnimatedPriceCounter extends StatefulWidget {
  final double targetValue;
  final String currency;
  final TextStyle? textStyle;
  final Duration duration;
  final int decimalPlaces;
  final bool useIntFormatting;

  const AnimatedPriceCounter({
    super.key,
    required this.targetValue,
    this.currency = '\$',
    this.textStyle,
    this.duration = const Duration(milliseconds: 1500),
    this.decimalPlaces = 2,
    this.useIntFormatting = true,
  });

  @override
  State<AnimatedPriceCounter> createState() => _AnimatedPriceCounterState();
}

class _AnimatedPriceCounterState extends State<AnimatedPriceCounter>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _animation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: widget.duration,
    );
    _animation = Tween<double>(begin: 0, end: widget.targetValue)
        .animate(CurvedAnimation(parent: _controller, curve: Curves.easeOut));
    _controller.forward();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  String _formatNumber(double value) {
    String result = value.toStringAsFixed(widget.decimalPlaces);
    if (widget.useIntFormatting) {
      final parts = result.split('.');
      final intPart = parts[0].replaceAllMapped(
        RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'),
        (Match m) => '${m[1]},',
      );
      result = intPart + (parts.length > 1 ? '.${parts[1]}' : '');
    }
    return result;
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _animation,
      builder: (context, child) {
        return Text(
          '${widget.currency}${_formatNumber(_animation.value)}',
          style: widget.textStyle ??
              const TextStyle(
                fontSize: 28,
                fontWeight: FontWeight.bold,
              ),
        );
      },
    );
  }
}

class PriceTag extends StatelessWidget {
  final double price;
  final String currency;
  final double? originalPrice;
  final Color? discountColor;
  final TextStyle? priceStyle;
  final TextStyle? originalPriceStyle;
  final TextStyle? discountStyle;

  const PriceTag({
    super.key,
    required this.price,
    this.currency = '\$',
    this.originalPrice,
    this.discountColor = Colors.red,
    this.priceStyle,
    this.originalPriceStyle,
    this.discountStyle,
  });

  @override
  Widget build(BuildContext context) {
    final hasDiscount = originalPrice != null && originalPrice! > price;
    final discountPercent = hasDiscount
        ? ((originalPrice! - price) / originalPrice! * 100).round()
        : 0;

    return Row(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        Text(
          '$currency${price.toStringAsFixed(2)}',
          style: priceStyle ??
              const TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
              ),
        ),
        if (hasDiscount) ...[
          const SizedBox(width: 8),
          Text(
            '$currency${originalPrice!.toStringAsFixed(2)}',
            style: originalPriceStyle ??
                const TextStyle(
                  fontSize: 14,
                  decoration: TextDecoration.lineThrough,
                  color: Colors.grey,
                ),
          ),
          const SizedBox(width: 4),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            decoration: BoxDecoration(
              color: discountColor,
              borderRadius: BorderRadius.circular(4),
            ),
            child: Text(
              '-$discountPercent%',
              style: discountStyle ??
                  const TextStyle(
                    color: Colors.white,
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                  ),
            ),
          ),
        ],
      ],
    );
  }
}

class PriceChangeIndicator extends StatefulWidget {
  final double oldPrice;
  final double newPrice;
  final String currency;
  final TextStyle? textStyle;
  final Duration duration;

  const PriceChangeIndicator({
    super.key,
    required this.oldPrice,
    required this.newPrice,
    this.currency = '\$',
    this.textStyle,
    this.duration = const Duration(milliseconds: 800),
  });

  @override
  State<PriceChangeIndicator> createState() => _PriceChangeIndicatorState();
}

class _PriceChangeIndicatorState extends State<PriceChangeIndicator>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _animation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: widget.duration,
    );
    _animation = Tween<double>(begin: widget.oldPrice, end: widget.newPrice)
        .animate(CurvedAnimation(parent: _controller, curve: Curves.easeOut));
    _controller.forward();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final change = widget.newPrice - widget.oldPrice;
    final isPositive = change >= 0;
    final percentChange = widget.oldPrice > 0
        ? (change / widget.oldPrice * 100).toStringAsFixed(1)
        : '0';

    return AnimatedBuilder(
      animation: _animation,
      builder: (context, child) {
        return Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              '${widget.currency}${_animation.value.toStringAsFixed(2)}',
              style: widget.textStyle ??
                  const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
            ),
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                color: isPositive
                    ? Colors.green.withValues(alpha: 0.1)
                    : Colors.red.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(4),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    isPositive ? Icons.arrow_upward : Icons.arrow_downward,
                    size: 12,
                    color: isPositive ? Colors.green : Colors.red,
                  ),
                  Text(
                    '$percentChange%',
                    style: TextStyle(
                      fontSize: 12,
                      color: isPositive ? Colors.green : Colors.red,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            ),
          ],
        );
      },
    );
  }
}
