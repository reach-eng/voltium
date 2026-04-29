import 'package:flutter/material.dart';

enum IntentType { delivery, personal }

class IntentOfUseScreen extends StatefulWidget {
  final VoidCallback? onNext;

  const IntentOfUseScreen({super.key, this.onNext});

  @override
  State<IntentOfUseScreen> createState() => _IntentOfUseScreenState();
}

class _IntentOfUseScreenState extends State<IntentOfUseScreen> {
  IntentType? _selectedIntent;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F7FA), // Light bluish background
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Color(0xFF0053C1)),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: const Text(
          'Intent of Use',
          style: TextStyle(
            color: Color(0xFF101828),
            fontSize: 18,
            fontWeight: FontWeight.w800, // Bold as in image
          ),
        ),
        centerTitle: false,
        titleSpacing: 0,
      ),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: SingleChildScrollView(
                padding:
                    const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    // Header text
                    RichText(
                      textAlign: TextAlign.center,
                      text: const TextSpan(
                        style: TextStyle(
                          fontSize: 32,
                          fontWeight: FontWeight.w900,
                          color: Color(0xFF101828),
                          height: 1.1,
                          fontFamily: 'Inter',
                        ),
                        children: [
                          TextSpan(text: 'How will you use\n'),
                          TextSpan(
                            text: 'VoltFleet',
                            style: TextStyle(color: Color(0xFF0053C1)),
                          ),
                          TextSpan(text: '?'),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                    const Text(
                      'Select your primary usage to help us customize your experience and support.',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: Color(0xFF475467),
                        fontSize: 15,
                        height: 1.4,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    const SizedBox(height: 32),

                    // Delivery Card
                    _buildIntentCard(
                      type: IntentType.delivery,
                      title: 'Deliver with Us',
                      description:
                          'Rent an EV for logistics, delivery, or commercial needs. Includes hub support.',
                      iconData: Icons.bolt,
                      iconBgColor: const Color(0xFF0053C1),
                      iconColor: Colors.white,
                    ),
                    const SizedBox(height: 16),

                    // Personal Card
                    _buildIntentCard(
                      type: IntentType.personal,
                      title: 'Personal Usage',
                      description:
                          'Daily commutes, weekend trips, or general city riding.',
                      iconData: Icons.directions_car,
                      iconBgColor: const Color(0xFFE2E8F0),
                      iconColor: const Color(0xFF0053C1),
                    ),
                    const SizedBox(height: 32),

                    // Info banner
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color:
                            const Color(0xFFE3EDFA), // Soft blue tint container
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(
                          color: const Color(0xFFD0E0F5),
                          width: 1,
                        ),
                      ),
                      child: const Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Icon(
                            Icons.info,
                            color: Color(0xFF0053C1),
                            size: 20,
                          ),
                          SizedBox(width: 12),
                          Expanded(
                            child: Text(
                              'Switching between types is possible later through account settings, though commercial access may require additional verification.',
                              style: TextStyle(
                                color: Color(0xFF475467),
                                fontSize: 13,
                                height: 1.4,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),
                  ],
                ),
              ),
            ),

            // Bottom Continue Button
            Padding(
              padding: const EdgeInsets.only(
                  left: 24, right: 24, bottom: 24, top: 16),
              child: SizedBox(
                width: double.infinity,
                height: 56,
                child: ElevatedButton(
                  onPressed: _selectedIntent == null
                      ? null
                      : () {
                          if (widget.onNext != null) {
                            widget.onNext!();
                          }
                        },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF0053C1),
                    disabledBackgroundColor: const Color(0xFF94B5E9),
                    foregroundColor: Colors.white,
                    disabledForegroundColor: Colors.white70,
                    elevation: 0,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(28),
                    ),
                  ),
                  child: const Text(
                    'Confirm Selection',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildIntentCard({
    required IntentType type,
    required String title,
    required String description,
    required IconData iconData,
    required Color iconBgColor,
    required Color iconColor,
  }) {
    final isSelected = _selectedIntent == type;

    return GestureDetector(
      onTap: () {
        setState(() {
          _selectedIntent = type;
        });
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFF0053C1) : Colors.white,
          borderRadius: BorderRadius.circular(28),
          border: Border.all(
            color: isSelected ? const Color(0xFF0053C1) : Colors.transparent,
            width: 2,
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.03),
              blurRadius: 15,
              offset: const Offset(0, 5),
            ),
          ],
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Icon
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                color: isSelected ? Colors.white : iconBgColor,
                shape: BoxShape.circle,
              ),
              child: Icon(
                iconData,
                color: isSelected ? const Color(0xFF0053C1) : iconColor,
                size: 28,
              ),
            ),
            const SizedBox(width: 16),

            // Text Content
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      color:
                          isSelected ? Colors.white : const Color(0xFF101828),
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    description,
                    style: TextStyle(
                      color: isSelected
                          ? Colors.white.withOpacity(0.85)
                          : const Color(0xFF475467),
                      fontSize: 14,
                      height: 1.4,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 12),

            // Radio Indicator
            Container(
              width: 24,
              height: 24,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: isSelected ? Colors.white : null,
                border: Border.all(
                  color: isSelected ? Colors.white : const Color(0xFFD0D5DD),
                  width: isSelected ? 6 : 2,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
