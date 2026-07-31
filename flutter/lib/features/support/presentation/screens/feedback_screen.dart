import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:voltium_rider/core/network/api_client.dart';
import 'package:voltium_rider/widgets/fade_up_widget.dart';
import 'dart:ui';
import 'package:google_fonts/google_fonts.dart';
import '../../../../theme/app_theme.dart';
import 'package:voltium_rider/theme/app_typography.dart';

class TutorialTip {
  final String message;
  final String? anchorWidgetKey;
  final Offset? position;

  const TutorialTip({
    required this.message,
    this.anchorWidgetKey,
    this.position,
  });
}

class TutorialOverlay {
  static void show(BuildContext context, List<TutorialTip> tips) {
    showDialog(
      context: context,
      barrierDismissible: true,
      builder: (context) => TutorialDialog(tips: tips),
    );
  }

  static Future<void> showOnce(
    BuildContext context,
    String key,
    List<TutorialTip> tips,
  ) async {
    final prefs = await SharedPreferences.getInstance();
    final shown = prefs.getBool('tutorial_$key') ?? false;
    if (!shown && context.mounted) {
      show(context, tips);
      await prefs.setBool('tutorial_$key', true);
    }
  }
}

class TutorialDialog extends StatefulWidget {
  final List<TutorialTip> tips;
  final int startIndex;

  const TutorialDialog({
    super.key,
    required this.tips,
    this.startIndex = 0,
  });

  @override
  State<TutorialDialog> createState() => _TutorialDialogState();
}

class _TutorialDialogState extends State<TutorialDialog> {
  late int _currentIndex;

  @override
  void initState() {
    super.initState();
    _currentIndex = widget.startIndex;
  }

  @override
  Widget build(BuildContext context) {
    if (_currentIndex >= widget.tips.length) {
      return const SizedBox.shrink();
    }

    final tip = widget.tips[_currentIndex];

    return Dialog(
      backgroundColor: Colors.transparent,
      elevation: 0,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(AppRadius.xxl),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
          child: Container(
            padding: Spacing.paddingXl,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.9),
              borderRadius: BorderRadius.circular(AppRadius.xxl),
              border: Border.all(color: Colors.white.withValues(alpha: 0.2)),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  height: 64,
                  width: 64,
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 0.1),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.lightbulb_outline,
                    color: AppColors.primary,
                    size: 32,
                  ),
                ),
                SizedBox(height: 24),
                Text(
                  'Quick Tip',
                  style: AppTypography.titleLarge
                      .copyWith(color: AppColors.slate800),
                ),
                SizedBox(height: 12),
                Text(
                  tip.message,
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 15,
                    color: AppColors.slate500,
                    height: 1.5,
                  ),
                  textAlign: TextAlign.center,
                ),
                SizedBox(height: 32),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    if (_currentIndex > 0)
                      TextButton(
                        onPressed: () => setState(() => _currentIndex--),
                        child: Text(
                          'PREVIOUS',
                          style: AppTypography.bodySmall
                              .copyWith(
                                  fontWeight: FontWeight.w800,
                                  letterSpacing: 1.2)
                              .copyWith(
                                  color: AppColors.slate400, letterSpacing: 1),
                        ),
                      )
                    else
                      SizedBox(width: 80),
                    Text(
                      '${_currentIndex + 1}/${widget.tips.length}',
                      style: AppTypography.labelMedium
                          .copyWith(color: AppColors.slate400),
                    ),
                    TextButton(
                      onPressed: () {
                        if (_currentIndex < widget.tips.length - 1) {
                          setState(() => _currentIndex++);
                        } else {
                          Navigator.pop(context);
                        }
                      },
                      child: Text(
                        _currentIndex < widget.tips.length - 1
                            ? 'NEXT'
                            : 'GOT IT',
                        style: AppTypography.bodySmall
                            .copyWith(
                                fontWeight: FontWeight.w800, letterSpacing: 1.2)
                            .copyWith(
                                color: AppColors.primary, letterSpacing: 1),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class FeedbackScreen extends ConsumerStatefulWidget {
  final VoidCallback onSubmit;
  final VoidCallback? onCancel;

  const FeedbackScreen({
    super.key,
    required this.onSubmit,
    this.onCancel,
  });

  @override
  ConsumerState<FeedbackScreen> createState() => _FeedbackScreenState();
}

class _FeedbackScreenState extends ConsumerState<FeedbackScreen> {
  final _commentController = TextEditingController();
  int _rating = 0;
  bool _isSubmitting = false;

  @override
  void dispose() {
    _commentController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.iconBackground,
      body: Stack(
        children: [
          _buildMeshBackground(),
          SafeArea(
            child: Column(
              children: [
                _buildHeader(context),
                Expanded(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 24,
                      vertical: 16,
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        const SizedBox(height: 20),
                        FadeUpWidget(
                          delay: 0,
                          child: Container(
                            height: 80,
                            width: 80,
                            decoration: const BoxDecoration(
                              color: Colors.white,
                              shape: BoxShape.circle,
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.black12,
                                  blurRadius: 20,
                                  offset: Offset(0, 10),
                                ),
                              ],
                            ),
                            child: const Icon(
                              Icons.rate_review_outlined,
                              color: AppColors.primary,
                              size: 40,
                            ),
                          ),
                        ),
                        SizedBox(height: 32),
                        FadeUpWidget(
                          delay: 100,
                          child: Text(
                            'Share Your Thoughts',
                            style: AppTypography.headingMedium
                                .copyWith(color: AppColors.slate800),
                          ),
                        ),
                        SizedBox(height: 12),
                        FadeUpWidget(
                          delay: 200,
                          child: Text(
                            'Your feedback helps us improve the experience for everyone.',
                            style: GoogleFonts.plusJakartaSans(
                              fontSize: 15,
                              color: AppColors.slate500,
                              height: 1.5,
                            ),
                            textAlign: TextAlign.center,
                          ),
                        ),
                        const SizedBox(height: 48),
                        FadeUpWidget(
                          delay: 300,
                          child: _buildRatingStars(),
                        ),
                        const SizedBox(height: 48),
                        FadeUpWidget(
                          delay: 400,
                          child: _buildCommentField(),
                        ),
                        const SizedBox(height: 48),
                        FadeUpWidget(
                          delay: 500,
                          child: _buildSubmitButton(),
                        ),
                        const SizedBox(height: 32),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMeshBackground() {
    return Positioned.fill(
      child: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [AppColors.iconBackground, AppColors.royalBlueTint],
          ),
        ),
      ),
    );
  }

  Widget _buildHeader(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          InkWell(
            onTap: () => Navigator.maybePop(context),
            child: Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: Colors.white,
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.05),
                    blurRadius: 10,
                  ),
                ],
              ),
              child:
                  const Icon(Icons.close, size: 18, color: AppColors.slate800),
            ),
          ),
          Text(
            'Feedback',
            style:
                AppTypography.titleMedium.copyWith(color: AppColors.slate800),
          ),
          const SizedBox(width: 40), // Balance
        ],
      ),
    );
  }

  Widget _buildRatingStars() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: List.generate(5, (index) {
        final isSelected = index < _rating;
        return Padding(
          padding: const EdgeInsets.symmetric(horizontal: 8),
          child: InkWell(
            onTap: () => setState(() => _rating = index + 1),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              child: Icon(
                isSelected ? Icons.star_rounded : Icons.star_outline_rounded,
                color: isSelected ? AppColors.warning : AppColors.borderMedium,
                size: 48,
              ),
            ),
          ),
        );
      }),
    );
  }

  Widget _buildCommentField() {
    return Container(
      padding: Spacing.paddingSm,
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.6),
        borderRadius: BorderRadius.circular(AppRadius.xl),
        border: Border.all(color: Colors.white),
      ),
      child: TextFormField(
        controller: _commentController,
        maxLines: 4,
        style: GoogleFonts.plusJakartaSans(
            fontSize: 15, color: AppColors.slate800),
        decoration: InputDecoration(
          hintText: 'Tell us more about your experience...',
          hintStyle: GoogleFonts.plusJakartaSans(
              color: AppColors.slate400, fontSize: 14),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(AppRadius.lg),
            borderSide: BorderSide.none,
          ),
          filled: true,
          fillColor: Colors.white,
          contentPadding: const EdgeInsets.all(Spacing.md),
        ),
      ),
    );
  }

  Widget _buildSubmitButton() {
    final bool canSubmit = _rating > 0;
    return ElevatedButton(
      onPressed: (canSubmit && !_isSubmitting)
          ? () async {
              setState(() => _isSubmitting = true);
              try {
                await ApiClient().post(
                  '/api/support/feedback',
                  body: {
                    'rating': _rating,
                    'comment': _commentController.text.trim(),
                  },
                );
                if (mounted) {
                  widget.onSubmit();
                }
              } catch (e) {
                if (mounted) {
                  setState(() => _isSubmitting = false);
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content:
                          Text('Failed to submit feedback: ${e.toString()}'),
                      backgroundColor: AppColors.error,
                    ),
                  );
                }
              }
            }
          : null,
      style: ElevatedButton.styleFrom(
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        disabledBackgroundColor: AppColors.borderMedium,
        minimumSize: const Size(double.infinity, 56),
        shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.xl)),
        elevation: canSubmit ? 8 : 0,
        shadowColor: AppColors.primary.withValues(alpha: 0.4),
      ),
      child: _isSubmitting
          ? const SizedBox(
              height: 20,
              width: 20,
              child: CircularProgressIndicator(
                color: Colors.white,
                strokeWidth: 2,
              ),
            )
          : Text(
              'SUBMIT FEEDBACK',
              style: GoogleFonts.plusJakartaSans(
                  fontWeight: FontWeight.w800, letterSpacing: 1.2),
            ),
    );
  }
}

class RateAppPrompt {
  static Future<void> show(BuildContext context) async {
    final prefs = await SharedPreferences.getInstance();
    final launchCount = prefs.getInt('launch_count') ?? 0;
    final hasRated = prefs.getBool('has_rated') ?? false;

    if (launchCount >= 10 && !hasRated) {
      if (!context.mounted) return;

      showDialog(
        context: context,
        builder: (context) => Dialog(
          backgroundColor: Colors.transparent,
          child: Container(
            padding: Spacing.paddingXl,
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(AppRadius.xxl),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(
                  Icons.star_rounded,
                  color: AppColors.warning,
                  size: 64,
                ),
                SizedBox(height: 24),
                Text(
                  'Enjoying Voltium?',
                  style: AppTypography.headingSmall
                      .copyWith(color: AppColors.slate800),
                ),
                SizedBox(height: 12),
                Text(
                  'Take a moment to rate your experience. It helps us grow!',
                  textAlign: TextAlign.center,
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 15,
                    color: AppColors.slate500,
                    height: 1.5,
                  ),
                ),
                SizedBox(height: 32),
                ElevatedButton(
                  onPressed: () {
                    prefs.setBool('has_rated', true);
                    Navigator.pop(context);
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                    minimumSize: const Size(double.infinity, 54),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(AppRadius.full),
                    ),
                  ),
                  child: Text(
                    'RATE US',
                    style: GoogleFonts.plusJakartaSans(
                      fontWeight: FontWeight.bold,
                      letterSpacing: 1,
                    ),
                  ),
                ),
                SizedBox(height: 12),
                TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: Text(
                    'NOT NOW',
                    style: GoogleFonts.plusJakartaSans(
                      color: AppColors.slate400,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    }
  }
}
