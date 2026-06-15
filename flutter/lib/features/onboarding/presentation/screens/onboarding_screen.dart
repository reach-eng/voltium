import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

class OnboardingService {
  static const String _keyOnboardingComplete = 'onboarding_complete';
  static const String _keyTutorialComplete = 'tutorial_complete';
  static const String _keyLaunchCount = 'launch_count';

  static final OnboardingService _instance = OnboardingService._internal();
  factory OnboardingService() => _instance;
  OnboardingService._internal();

  Future<bool> isOnboardingComplete() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_keyOnboardingComplete) ?? false;
  }

  Future<void> setOnboardingComplete() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_keyOnboardingComplete, true);
  }

  Future<bool> isFirstLaunch() async {
    final prefs = await SharedPreferences.getInstance();
    final count = prefs.getInt(_keyLaunchCount) ?? 0;
    return count == 0;
  }

  Future<void> incrementLaunchCount() async {
    final prefs = await SharedPreferences.getInstance();
    final count = prefs.getInt(_keyLaunchCount) ?? 0;
    await prefs.setInt(_keyLaunchCount, count + 1);
  }

  Future<bool> shouldShowTutorial() async {
    final prefs = await SharedPreferences.getInstance();
    return !(prefs.getBool(_keyTutorialComplete) ?? false);
  }

  Future<void> setTutorialComplete() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_keyTutorialComplete, true);
  }

  Future<void> resetOnboarding() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_keyOnboardingComplete, false);
    await prefs.setBool(_keyTutorialComplete, false);
    await prefs.setInt(_keyLaunchCount, 0);
  }
}

class OnboardingScreen extends StatefulWidget {
  final VoidCallback onComplete;
  final List<OnboardingPage> pages;
  final VoidCallback? onSkip;

  const OnboardingScreen({
    super.key,
    required this.onComplete,
    required this.pages,
    this.onSkip,
  });

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final PageController _pageController = PageController();
  int _currentPage = 0;

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            if (widget.onSkip != null)
              Align(
                alignment: Alignment.topRight,
                child: TextButton(
                  onPressed: widget.onSkip,
                  child: const Text('Skip'),
                ),
              ),
            Expanded(
              child: PageView.builder(
                controller: _pageController,
                onPageChanged: (index) => setState(() => _currentPage = index),
                itemCount: widget.pages.length,
                itemBuilder: (context, index) => widget.pages[index],
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(24),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: List.generate(
                      widget.pages.length,
                      (index) => Container(
                        margin: const EdgeInsets.only(right: 8),
                        width: _currentPage == index ? 24 : 8,
                        height: 8,
                        decoration: BoxDecoration(
                          color: _currentPage == index
                              ? const Color(0xFF0053C1)
                              : Colors.grey[300],
                          borderRadius: BorderRadius.circular(4),
                        ),
                      ),
                    ),
                  ),
                  ElevatedButton(
                    onPressed: () {
                      if (_currentPage < widget.pages.length - 1) {
                        _pageController.nextPage(
                          duration: const Duration(milliseconds: 300),
                          curve: Curves.easeInOut,
                        );
                      } else {
                        OnboardingService().setOnboardingComplete();
                        widget.onComplete();
                      }
                    },
                    child: Text(
                      _currentPage < widget.pages.length - 1
                          ? 'Next'
                          : 'Get Started',
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class OnboardingPage extends StatelessWidget {
  final IconData icon;
  final String title;
  final String description;
  final Color? iconColor;

  const OnboardingPage({
    super.key,
    required this.icon,
    required this.title,
    required this.description,
    this.iconColor,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(32),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            icon,
            size: 120,
            color: iconColor ?? const Color(0xFF0053C1),
          ),
          const SizedBox(height: 48),
          Text(
            title,
            style: const TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.bold,
              color: Color(0xFF101828),
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 16),
          Text(
            description,
            style: const TextStyle(
              fontSize: 16,
              color: Color(0xFF667085),
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}
