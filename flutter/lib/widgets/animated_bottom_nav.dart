import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../theme/app_theme.dart';

/// Matches web BottomNav.tsx exactly:
/// - Glass effect: white/95 + backdrop blur
/// - Border top: #E2E8F0 (vf-outline-variant)
/// - 80px height, 4 tabs: Home, Wallet, Support, Profile
/// - Active: primary/10 rounded-full pill behind icon (layoutId="nav-active")
/// - Active dot: 4px circle at bottom (layoutId="nav-dot")
/// - Icon color: primary when active, onSurfaceVariant when not
/// - Label: onSurface when active, onSurfaceVariant when not (12px, w700)
/// - Notification badge: red dot on Home + Support
/// - Spring slide-up entry animation

class AppBottomNav extends StatefulWidget {
  final int currentIndex;
  final ValueChanged<int> onTap;
  final int unreadCount;
  final List<Key>? tabKeys;

  const AppBottomNav({
    super.key,
    required this.currentIndex,
    required this.onTap,
    this.unreadCount = 0,
    this.tabKeys,
  });

  @override
  State<AppBottomNav> createState() => _AppBottomNavState();
}

class _AppBottomNavState extends State<AppBottomNav>
    with SingleTickerProviderStateMixin {
  late AnimationController _entryCtrl;
  late Animation<Offset> _slideAnim;
  late Animation<double> _fadeAnim;

  static const _tabs = [
    _TabInfo(icon: Icons.home_outlined, activeIcon: Icons.home, label: 'Home'),
    _TabInfo(
        icon: Icons.account_balance_wallet_outlined,
        activeIcon: Icons.account_balance_wallet,
        label: 'Wallet',),
    _TabInfo(
        icon: Icons.headset_mic_outlined,
        activeIcon: Icons.headset_mic,
        label: 'Support',),
    _TabInfo(
        icon: Icons.person_outline, activeIcon: Icons.person, label: 'Profile',),
  ];

  @override
  void initState() {
    super.initState();
    // Spring slide-up: delay 0.3s, matches web spring(300, 30)
    _entryCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 500),
    );
    _slideAnim = Tween<Offset>(
      begin: const Offset(0, 1),
      end: Offset.zero,
    ).animate(CurvedAnimation(
      parent: _entryCtrl,
      curve: const Interval(0.3, 1.0, curve: Curves.easeOutCubic),
    ),);
    _fadeAnim = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _entryCtrl,
        curve: const Interval(0.3, 0.8),
      ),
    );

    Future.delayed(const Duration(milliseconds: 100), () {
      if (mounted) _entryCtrl.forward();
    });
  }

  @override
  void dispose() {
    _entryCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SlideTransition(
      position: _slideAnim,
      child: FadeTransition(
        opacity: _fadeAnim,
        child: ClipRect(
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
            child: Container(
              height: 80 + MediaQuery.of(context).padding.bottom,
              decoration: BoxDecoration(
                // glass: white 95% opacity
                color: Colors.white.withValues(alpha: 0.95),
                border: const Border(
                  top: BorderSide(color: AppColors.outlineVariant, width: 1),
                ),
              ),
              child: SafeArea(
                top: false,
                child: SizedBox(
                  height: 80,
                  child: Row(
                    children: List.generate(_tabs.length, (index) {
                      return _NavButton(
                        key: widget.tabKeys != null &&
                                index < widget.tabKeys!.length
                            ? widget.tabKeys![index]
                            : null,
                        tab: _tabs[index],
                        isActive: index == widget.currentIndex,
                        hasNotification: (index == 0 || index == 2) &&
                            widget.unreadCount > 0,
                        onTap: () => widget.onTap(index),
                      );
                    }),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _TabInfo {
  final IconData icon;
  final IconData activeIcon;
  final String label;

  const _TabInfo({
    required this.icon,
    required this.activeIcon,
    required this.label,
  });
}

class _NavButton extends StatefulWidget {
  final _TabInfo tab;
  final bool isActive;
  final bool hasNotification;
  final VoidCallback onTap;

  const _NavButton({
    super.key,
    required this.tab,
    required this.isActive,
    required this.hasNotification,
    required this.onTap,
  });

  @override
  State<_NavButton> createState() => _NavButtonState();
}

class _NavButtonState extends State<_NavButton>
    with SingleTickerProviderStateMixin {
  late AnimationController _pillCtrl;
  late Animation<double> _pillFade;

  @override
  void initState() {
    super.initState();
    _pillCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 200),
      value: widget.isActive ? 1.0 : 0.0,
    );
    _pillFade = CurvedAnimation(parent: _pillCtrl, curve: Curves.easeOut);
  }

  @override
  void didUpdateWidget(_NavButton oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.isActive != oldWidget.isActive) {
      if (widget.isActive) {
        _pillCtrl.forward();
      } else {
        _pillCtrl.reverse();
      }
    }
  }

  @override
  void dispose() {
    _pillCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    const activeColor = AppColors.primary;
    const inactiveColor = AppColors.onSurfaceVariant;
    final iconColor = widget.isActive ? activeColor : inactiveColor;
    final labelColor = widget.isActive ? AppColors.onSurface : inactiveColor;

    return Expanded(
      child: GestureDetector(
        onTap: widget.onTap,
        behavior: HitTestBehavior.opaque,
        child: Stack(
          alignment: Alignment.bottomCenter,
          children: [
            Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                // Icon container with animated pill background
                SizedBox(
                  width: 64,
                  height: 32,
                  child: Stack(
                    alignment: Alignment.center,
                    children: [
                      // Active pill: bg-primary/10 rounded-full
                      FadeTransition(
                        opacity: _pillFade,
                        child: Container(
                          width: 64,
                          height: 32,
                          decoration: BoxDecoration(
                            color: activeColor.withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(999),
                          ),
                        ),
                      ),
                      // Icon
                      Stack(
                        clipBehavior: Clip.none,
                        children: [
                          Icon(
                            widget.isActive
                                ? widget.tab.activeIcon
                                : widget.tab.icon,
                            color: iconColor,
                            size: 20,
                          ),
                          // Notification badge
                          if (widget.hasNotification)
                            Positioned(
                              top: -4,
                              right: -6,
                              child: Container(
                                width: 8,
                                height: 8,
                                decoration: BoxDecoration(
                                  color: Colors.red,
                                  shape: BoxShape.circle,
                                  border: Border.all(
                                    color: Colors.white,
                                    width: 1.5,
                                  ),
                                ),
                              ),
                            ),
                        ],
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 4),

                // Label
                AnimatedDefaultTextStyle(
                  duration: const Duration(milliseconds: 200),
                  style: GoogleFonts.inter(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: labelColor,
                    letterSpacing: -0.2,
                  ),
                  child: Text(widget.tab.label),
                ),
              ],
            ),

            // Active dot at bottom (nav-dot)
            if (widget.isActive)
              Positioned(
                bottom: 4,
                child: AnimatedOpacity(
                  opacity: widget.isActive ? 1.0 : 0.0,
                  duration: const Duration(milliseconds: 200),
                  child: Container(
                    width: 4,
                    height: 4,
                    decoration: const BoxDecoration(
                      color: AppColors.primary,
                      shape: BoxShape.circle,
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
