import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../data/troubleshooter_tree.dart';
import '../gen/app_localizations.dart';
import '../services/api_service.dart';

/// Result of a completed troubleshooting session.
class TroubleshooterResult {
  const TroubleshooterResult({
    required this.path,
    required this.resolution,
    required this.resolutionType,
    this.category,
  });

  final List<TroubleshooterAnswer> path;
  final String resolution;
  final String resolutionType;
  final String? category;

  Map<String, dynamic> toJson() => {
        'path': path.map((a) => a.toJson()).toList(),
        'resolution': resolution,
        'resolutionType': resolutionType,
        'category': category,
      };
}

/// Smart Troubleshooter screen for the VoltFleet Rider App.
///
/// Guides the rider through a diagnostic decision tree to self‑resolve common
/// EV issues or collect enough information for a support ticket.
///
/// State flow:
/// 1. [_Mode.categorySelect] — rider picks an issue category.
/// 2. [_Mode.question]      — animated yes/no questions.
/// 3. [_Mode.result]        — display resolution / support prompt.
class TroubleshooterScreen extends StatefulWidget {
  const TroubleshooterScreen({super.key});

  @override
  State<TroubleshooterScreen> createState() => _TroubleshooterScreenState();
}

class _TroubleshooterScreenState extends State<TroubleshooterScreen>
    with TickerProviderStateMixin {
  // ── Mode ───────────────────────────────────────────────────────────────────

  _Mode _mode = _Mode.categorySelect;

  // ── Category selection ─────────────────────────────────────────────────────

  TroubleshooterCategory? _selectedCategory;

  // ── Question traversal ─────────────────────────────────────────────────────

  TroubleshooterNode? _currentNode;
  final List<TroubleshooterAnswer> _path = [];
  int _stepIndex = 0;
  int _totalSteps = 1;

  // ── Result ─────────────────────────────────────────────────────────────────

  TroubleshooterResult? _result;

  // ── Animations ─────────────────────────────────────────────────────────────

  late final AnimationController _resultAnimController;
  late final Animation<double> _resultScaleAnim;
  late final Animation<double> _resultOpacityAnim;

  // ── Support ticket ─────────────────────────────────────────────────────────

  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    _resultAnimController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 500),
    );
    _resultScaleAnim = CurvedAnimation(
      parent: _resultAnimController,
      curve: Curves.elasticOut,
    );
    _resultOpacityAnim = CurvedAnimation(
      parent: _resultAnimController,
      curve: Curves.easeIn,
    );
  }

  @override
  void dispose() {
    _resultAnimController.dispose();
    super.dispose();
  }

  // ── Navigation helpers ─────────────────────────────────────────────────────

  void _selectCategory(TroubleshooterCategory category) {
    setState(() {
      _selectedCategory = category;
      _mode = _Mode.question;
      _path.clear();
      _stepIndex = 0;

      _currentNode = findNode(category.rootNodeId);
      if (_currentNode != null) {
        _totalSteps = maxTreeDepth(category.rootNodeId);
      }
    });
  }

  void _answerQuestion(bool answer) {
    if (_currentNode == null) return;

    // Record this step.
    _path.add(TroubleshooterAnswer(
      question: _currentNode!.question,
      answer: answer,
      nodeId: _currentNode!.id,
    ));

    // Determine next node.
    final nextId = answer ? _currentNode!.yesNodeId : _currentNode!.noNodeId;

    if (nextId == null) {
      // Should not happen in a well‑formed tree, but handle gracefully.
      _finishWithResult(
        resolution: 'Unable to determine the issue. Please contact support.',
        resolutionType: 'NEEDS_SUPPORT',
      );
      return;
    }

    final nextNode = findNode(nextId);
    if (nextNode == null) {
      _finishWithResult(
        resolution: 'Tree data error. Please contact support.',
        resolutionType: 'NEEDS_SUPPORT',
      );
      return;
    }

    if (nextNode.isLeaf) {
      _path.add(TroubleshooterAnswer(
        question: nextNode.question,
        answer: true, // leaf acceptance
        nodeId: nextNode.id,
      ));
      _finishWithResult(
        resolution: nextNode.resolution!,
        resolutionType: nextNode.resolutionType,
        category: nextNode.category,
      );
    } else {
      setState(() {
        _currentNode = nextNode;
        _stepIndex++;
      });
    }
  }

  void _goBack() {
    if (_path.isEmpty) {
      // Go back to category selection.
      setState(() {
        _mode = _Mode.categorySelect;
        _currentNode = null;
        _stepIndex = 0;
      });
      return;
    }

    // Remove the last answer.
    _path.removeLast();

    // Navigate back to the node referenced by the last answer, or to root.
    setState(() {
      if (_path.isEmpty) {
        _currentNode = findNode(_selectedCategory!.rootNodeId);
        _stepIndex = 0;
      } else {
        final lastAnswer = _path.last;
        _currentNode = findNode(lastAnswer.nodeId);
        // stepIndex is now the number of recorded answers.
        _stepIndex = _path.length;
      }
    });
  }

  void _finishWithResult({
    required String resolution,
    required String resolutionType,
    String? category,
  }) {
    setState(() {
      _result = TroubleshooterResult(
        path: List.unmodifiable(_path),
        resolution: resolution,
        resolutionType: resolutionType,
        category: category,
      );
      _mode = _Mode.result;
    });
    _resultAnimController.forward(from: 0);
  }

  void _resetToCategories() {
    setState(() {
      _mode = _Mode.categorySelect;
      _selectedCategory = null;
      _currentNode = null;
      _path.clear();
      _stepIndex = 0;
      _result = null;
      _isSubmitting = false;
    });
  }

  Future<void> _triggerSOS() async {
    final sosNumber = '112'; // Emergency services number

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Row(
          children: [
            Icon(Icons.warning, color: Colors.red),
            SizedBox(width: 8),
            Text('Emergency SOS'),
          ],
        ),
        content: Text('Call $sosNumber for emergency assistance?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () async {
              Navigator.pop(context);
              final uri = Uri.parse('tel:$sosNumber');
              if (await canLaunchUrl(uri)) {
                await launchUrl(uri);
              }
            },
            style: FilledButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('Call Now'),
          ),
        ],
      ),
    );
  }

  // ── Support ticket submission ──────────────────────────────────────────────

  Future<void> _createSupportTicket() async {
    if (_result == null || _isSubmitting) return;
    setState(() => _isSubmitting = true);

    try {
      final payload = {
        'type': 'TROUBLESHOOTER',
        'category': _result!.category,
        'resolutionType': _result!.resolutionType,
        'path': _result!.path.map((a) => a.toJson()).toList(),
        'resolution': _result!.resolution,
      };

      await ApiService().post('/api/support/ticket', body: payload);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(_ticketCreatedMessage()),
            backgroundColor: Colors.green,
          ),
        );
        _resetToCategories();
      }
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.message),
            backgroundColor: Colors.red,
          ),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(_errorMessage()),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  String _ticketCreatedMessage() {
    return 'Support ticket created successfully';
  }

  String _errorMessage() {
    return 'Something went wrong. Please try again.';
  }

  // ── Build ──────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;

    return Scaffold(
      backgroundColor: const Color(0xFFF5F7FA),
      appBar: _buildAppBar(l10n),
      body: SafeArea(
        child: AnimatedSwitcher(
          duration: const Duration(milliseconds: 300),
          switchInCurve: Curves.easeIn,
          switchOutCurve: Curves.easeOut,
          child: switch (_mode) {
            _Mode.categorySelect => _buildCategorySelect(l10n),
            _Mode.question => _buildQuestionView(l10n),
            _Mode.result => _buildResultView(l10n),
          },
        ),
      ),
    );
  }

  // ── AppBar ─────────────────────────────────────────────────────────────────

  PreferredSizeWidget _buildAppBar(AppLocalizations l10n) {
    return AppBar(
      title: Text(
        _mode == _Mode.categorySelect
            ? 'Smart Troubleshooter'
            : _mode == _Mode.question
                ? _selectedCategory?.label ?? 'Troubleshooter'
                : 'Result',
        style: const TextStyle(
          fontWeight: FontWeight.w700,
          fontSize: 18,
        ),
      ),
      backgroundColor: _vfBlue,
      foregroundColor: Colors.white,
      elevation: 0,
      leading: _mode == _Mode.categorySelect
          ? null
          : IconButton(
              icon: const Icon(Icons.arrow_back),
              onPressed: _goBack,
              tooltip: l10n.common_close,
            ),
      actions: [
        if (_mode != _Mode.categorySelect)
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _resetToCategories,
            tooltip: 'Start Over',
          ),
      ],
    );
  }

  // ── Category selection ─────────────────────────────────────────────────────

  Widget _buildCategorySelect(AppLocalizations l10n) {
    return SingleChildScrollView(
      key: const ValueKey<_Mode>(_Mode.categorySelect),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(height: 8),
          // Header illustration.
          _buildHeaderIcon(),
          const SizedBox(height: 16),
          Text(
            'What issue are you experiencing?',
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.w700,
                  color: const Color(0xFF1A1A2E),
                ),
          ),
          const SizedBox(height: 4),
          Text(
            'Select a category and we will guide you through a step‑by‑step diagnosis.',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: const Color(0xFF6B7280),
                ),
          ),
          const SizedBox(height: 20),
          ...troubleshooterCategories.map(_buildCategoryCard),
          const SizedBox(height: 32),
        ],
      ),
    );
  }

  Widget _buildHeaderIcon() {
    return Center(
      child: Container(
        width: 80,
        height: 80,
        decoration: BoxDecoration(
          color: _vfBlueLight,
          borderRadius: BorderRadius.circular(24),
        ),
        child: const Icon(
          Icons.build_circle_rounded,
          color: _vfBlue,
          size: 44,
        ),
      ),
    );
  }

  Widget _buildCategoryCard(TroubleshooterCategory category) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Card(
        elevation: 0,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        child: InkWell(
          onTap: () => _selectCategory(category),
          borderRadius: BorderRadius.circular(14),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            child: Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: Color(category.color).withOpacity(0.12),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(
                    _iconData(category.icon),
                    color: Color(category.color),
                    size: 22,
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Text(
                    category.label,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w600,
                          color: const Color(0xFF1A1A2E),
                        ),
                  ),
                ),
                Icon(
                  Icons.chevron_right,
                  color: const Color(0xFF9CA3AF),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  // ── Question view ──────────────────────────────────────────────────────────

  Widget _buildQuestionView(AppLocalizations l10n) {
    if (_currentNode == null) {
      return const SizedBox.shrink();
    }

    final displayStep = _stepIndex + 1;

    return SingleChildScrollView(
      key: ValueKey<_Mode>(_Mode.question),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Column(
        children: [
          const SizedBox(height: 8),

          // Step counter.
          _buildStepCounter(displayStep),

          const SizedBox(height: 20),

          // Question card with animated transition.
          AnimatedSwitcher(
            duration: const Duration(milliseconds: 350),
            switchInCurve: Curves.easeInCubic,
            switchOutCurve: Curves.easeOutCubic,
            transitionBuilder: (child, animation) {
              return FadeTransition(
                opacity: animation,
                child: SlideTransition(
                  position: Tween<Offset>(
                    begin: const Offset(0.05, 0.08),
                    end: Offset.zero,
                  ).animate(animation),
                  child: child,
                ),
              );
            },
            child: _buildQuestionCard(
              l10n,
              key: ValueKey<String>(_currentNode!.id),
            ),
          ),

          const SizedBox(height: 32),

          // Yes / No buttons.
          AnimatedSwitcher(
            duration: const Duration(milliseconds: 350),
            switchInCurve: Curves.easeInCubic,
            switchOutCurve: Curves.easeOutCubic,
            child: _buildActionButtons(
              key: ValueKey<String>(_currentNode!.id),
            ),
          ),

          // Path summary (collapsible).
          if (_path.isNotEmpty) ...[
            const SizedBox(height: 24),
            _buildPathSummary(),
          ],

          const SizedBox(height: 32),
        ],
      ),
    );
  }

  Widget _buildStepCounter(int currentStep) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      decoration: BoxDecoration(
        color: _vfBlueLight,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.timeline, size: 16, color: _vfBlue),
          const SizedBox(width: 6),
          Text(
            'Step $currentStep of $_totalSteps',
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: _vfBlue,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildQuestionCard(AppLocalizations l10n, {Key? key}) {
    final theme = Theme.of(context);
    final categoryColor =
        _selectedCategory != null ? Color(_selectedCategory!.color) : _vfBlue;

    return Card(
      key: key,
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
            // Icon.
            Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(
                color: categoryColor.withOpacity(0.12),
                borderRadius: BorderRadius.circular(18),
              ),
              child: _selectedCategory != null
                  ? Icon(
                      _iconData(_selectedCategory!.icon),
                      color: categoryColor,
                      size: 32,
                    )
                  : Icon(Icons.help_outline, color: categoryColor, size: 32),
            ),
            const SizedBox(height: 20),

            // Question text.
            Text(
              _currentNode!.question,
              textAlign: TextAlign.center,
              style: theme.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w700,
                fontSize: 17,
                color: const Color(0xFF1A1A2E),
                height: 1.4,
              ),
            ),
            const SizedBox(height: 8),

            // Hint.
            Text(
              'Answer honestly for the most accurate diagnosis.',
              textAlign: TextAlign.center,
              style: theme.textTheme.bodySmall?.copyWith(
                color: const Color(0xFF9CA3AF),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildActionButtons({Key? key}) {
    return Row(
      key: key,
      children: [
        // Yes button.
        Expanded(
          child: SizedBox(
            height: 52,
            child: FilledButton.icon(
              onPressed: () => _answerQuestion(true),
              style: FilledButton.styleFrom(
                backgroundColor: Colors.green,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
              icon: const Icon(Icons.check_circle_outline, size: 20),
              label: const Text(
                'Yes',
                style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
              ),
            ),
          ),
        ),
        const SizedBox(width: 12),

        // No button.
        Expanded(
          child: SizedBox(
            height: 52,
            child: FilledButton.icon(
              onPressed: () => _answerQuestion(false),
              style: FilledButton.styleFrom(
                backgroundColor: Colors.red.shade600,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
              icon: const Icon(Icons.cancel_outlined, size: 20),
              label: const Text(
                'No',
                style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildPathSummary() {
    final theme = Theme.of(context);
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      color: Colors.white,
      child: Theme(
        data: theme.copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          tilePadding: const EdgeInsets.symmetric(horizontal: 16),
          childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
          leading:
              const Icon(Icons.history, size: 18, color: Color(0xFF9CA3AF)),
          title: Text(
            'Your answers (${_path.length})',
            style: theme.textTheme.titleSmall?.copyWith(
              fontWeight: FontWeight.w600,
              color: const Color(0xFF6B7280),
            ),
          ),
          children: [
            for (final answer in _path)
              Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: Row(
                  children: [
                    Container(
                      width: 20,
                      height: 20,
                      decoration: BoxDecoration(
                        color: answer.answer
                            ? Colors.green.withOpacity(0.15)
                            : Colors.red.withOpacity(0.15),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Icon(
                        answer.answer ? Icons.check : Icons.close,
                        size: 12,
                        color: answer.answer ? Colors.green : Colors.red,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        answer.question,
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: const Color(0xFF4B5563),
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
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

  // ── Result view ────────────────────────────────────────────────────────────

  Widget _buildResultView(AppLocalizations l10n) {
    if (_result == null) return const SizedBox.shrink();

    return SingleChildScrollView(
      key: ValueKey<_Mode>(_Mode.result),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Column(
        children: [
          const SizedBox(height: 16),

          // Animated icon.
          ScaleTransition(
            scale: _resultScaleAnim,
            child: FadeTransition(
              opacity: _resultOpacityAnim,
              child: _buildResultIcon(),
            ),
          ),

          const SizedBox(height: 24),

          // Resolution card.
          FadeTransition(
            opacity: _resultOpacityAnim,
            child: _buildResolutionCard(l10n),
          ),

          // Path taken (for NEEDS_SUPPORT / FAILED).
          if (_result!.resolutionType == 'NEEDS_SUPPORT' ||
              _result!.resolutionType == 'FAILED') ...[
            const SizedBox(height: 16),
            FadeTransition(
              opacity: _resultOpacityAnim,
              child: _buildPathTakenCard(l10n),
            ),
            const SizedBox(height: 16),
            FadeTransition(
              opacity: _resultOpacityAnim,
              child: _buildSupportTicketButton(l10n),
            ),
          ],

          // DANGER SOS prompt.
          if (_result!.resolutionType == 'DANGER') ...[
            const SizedBox(height: 16),
            FadeTransition(
              opacity: _resultOpacityAnim,
              child: _buildSosButton(),
            ),
          ],

          const SizedBox(height: 16),

          // Start over.
          FadeTransition(
            opacity: _resultOpacityAnim,
            child: SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: _resetToCategories,
                style: OutlinedButton.styleFrom(
                  foregroundColor: _vfBlue,
                  side: const BorderSide(color: _vfBlue),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
                icon: const Icon(Icons.refresh, size: 18),
                label: Text(
                  'Troubleshoot Another Issue',
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
              ),
            ),
          ),

          const SizedBox(height: 32),
        ],
      ),
    );
  }

  Widget _buildResultIcon() {
    final (icon, color, bgColor) = switch (_result!.resolutionType) {
      'SUCCESS' => (
          Icons.check_circle_rounded,
          Colors.green,
          Colors.green.withOpacity(0.12),
        ),
      'FAILED' => (
          Icons.error_outline,
          Colors.orange,
          Colors.orange.withOpacity(0.12),
        ),
      'NEEDS_SUPPORT' => (
          Icons.support_agent_rounded,
          _vfBlue,
          _vfBlueLight,
        ),
      'DANGER' => (
          Icons.warning_rounded,
          Colors.red,
          Colors.red.withOpacity(0.12),
        ),
      _ => (
          Icons.info_outline,
          Colors.grey,
          Colors.grey.withOpacity(0.12),
        ),
    };

    return Container(
      width: 88,
      height: 88,
      decoration: BoxDecoration(
        color: bgColor,
        shape: BoxShape.circle,
      ),
      child: Icon(icon, color: color, size: 48),
    );
  }

  Widget _buildResolutionCard(AppLocalizations l10n) {
    final theme = Theme.of(context);
    final (title, titleColor) = switch (_result!.resolutionType) {
      'SUCCESS' => ('Issue Resolved', Colors.green),
      'FAILED' => ('Troubleshooting Tip', Colors.orange),
      'NEEDS_SUPPORT' => ('Support Required', _vfBlue),
      'DANGER' => ('Safety Warning', Colors.red),
      _ => ('Result', Colors.grey),
    };

    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: titleColor.withOpacity(0.3)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            Text(
              title,
              style: theme.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w700,
                color: titleColor,
              ),
            ),
            const SizedBox(height: 12),
            Text(
              _result!.resolution,
              textAlign: TextAlign.center,
              style: theme.textTheme.bodyMedium?.copyWith(
                color: const Color(0xFF1A1A2E),
                height: 1.5,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPathTakenCard(AppLocalizations l10n) {
    final theme = Theme.of(context);

    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      color: Colors.white,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.route, size: 18, color: Color(0xFF6B7280)),
                const SizedBox(width: 8),
                Text(
                  'Diagnostic path taken',
                  style: theme.textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                    color: const Color(0xFF1A1A2E),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            const Divider(height: 1),
            const SizedBox(height: 8),
            for (int i = 0; i < _result!.path.length; i++) ...[
              _buildPathStep(theme, i + 1, _result!.path[i]),
              if (i < _result!.path.length - 1) ...[
                Padding(
                  padding: const EdgeInsets.only(left: 13),
                  child: SizedBox(
                    height: 16,
                    child: VerticalDivider(
                      width: 2,
                      thickness: 1.5,
                      color: const Color(0xFFE5E7EB),
                    ),
                  ),
                ),
              ],
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildPathStep(
      ThemeData theme, int stepNumber, TroubleshooterAnswer answer) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Step number badge.
          Container(
            width: 28,
            height: 28,
            decoration: BoxDecoration(
              color: answer.answer
                  ? Colors.green.withOpacity(0.15)
                  : Colors.red.withOpacity(0.15),
              shape: BoxShape.circle,
            ),
            alignment: Alignment.center,
            child: Text(
              '$stepNumber',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: answer.answer ? Colors.green : Colors.red,
              ),
            ),
          ),
          const SizedBox(width: 10),
          // Question + answer.
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  answer.question,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: const Color(0xFF4B5563),
                  ),
                ),
                const SizedBox(height: 2),
                Row(
                  children: [
                    Icon(
                      answer.answer ? Icons.check : Icons.close,
                      size: 14,
                      color: answer.answer
                          ? Colors.green.shade700
                          : Colors.red.shade700,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      answer.answer ? 'Yes' : 'No',
                      style: theme.textTheme.labelSmall?.copyWith(
                        fontWeight: FontWeight.w700,
                        color: answer.answer
                            ? Colors.green.shade700
                            : Colors.red.shade700,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSupportTicketButton(AppLocalizations l10n) {
    return SizedBox(
      width: double.infinity,
      child: FilledButton.icon(
        onPressed: _isSubmitting ? null : _createSupportTicket,
        style: FilledButton.styleFrom(
          backgroundColor: _vfBlue,
          foregroundColor: Colors.white,
          disabledBackgroundColor: _vfBlue.withOpacity(0.5),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
          padding: const EdgeInsets.symmetric(vertical: 16),
        ),
        icon: _isSubmitting
            ? SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: Colors.white.withOpacity(0.8),
                ),
              )
            : const Icon(Icons.send_rounded, size: 18),
        label: Text(
          _isSubmitting ? 'Submitting...' : 'Create Support Ticket',
          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
        ),
      ),
    );
  }

  Widget _buildSosButton() {
    return SizedBox(
      width: double.infinity,
      child: FilledButton.icon(
        onPressed: () => _triggerSOS(),
        style: FilledButton.styleFrom(
          backgroundColor: Colors.red,
          foregroundColor: Colors.white,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
          padding: const EdgeInsets.symmetric(vertical: 16),
        ),
        icon: const Icon(Icons.warning_amber_rounded, size: 22),
        label: const Text(
          'Emergency SOS',
          style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
        ),
      ),
    );
  }

  // ── Icon helper ────────────────────────────────────────────────────────────

  IconData _iconData(String name) {
    return switch (name) {
      'speed' => Icons.speed_rounded,
      'display_settings' => Icons.display_settings_rounded,
      'battery_charging_full' => Icons.battery_charging_full_rounded,
      'hearing' => Icons.hearing_rounded,
      'lock_open' => Icons.lock_open_rounded,
      'gps_off' => Icons.gps_off_rounded,
      'tire_repair' => Icons.tire_repair_rounded,
      _ => Icons.help_outline_rounded,
    };
  }

  // ── Brand colours ──────────────────────────────────────────────────────────

  static const _vfBlue = Color(0xFF0053C1);
  static const _vfBlueLight = Color(0xFFE8F0FE);
}

// =============================================================================
// Internal enum
// =============================================================================

enum _Mode {
  categorySelect,
  question,
  result,
}
