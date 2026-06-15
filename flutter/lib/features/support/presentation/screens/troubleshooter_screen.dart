import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../data/troubleshooter_tree.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:voltium_rider/services/api_service.dart';

import 'troubleshooter_result.dart';
import '../widgets/troubleshooter_widgets.dart';

/// Smart Troubleshooter screen for the Ryd Rider App.
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

      await ApiService().post('/api/support/tickets', body: payload);

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
      backgroundColor: vfBlue,
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
          const TroubleshooterHeaderIcon(),
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
          ...troubleshooterCategories.map(
            (cat) => CategoryCard(
              icon: tsIconData(cat.icon),
              color: Color(cat.color),
              title: cat.label,
              onTap: () => _selectCategory(cat),
            ),
          ),
          const SizedBox(height: 32),
        ],
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
          TroubleshooterStepCounter(
            currentStep: displayStep,
            totalSteps: _totalSteps,
          ),

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
            child: QuestionCard(
              question: _currentNode!.question,
              icon: _selectedCategory != null
                  ? tsIconData(_selectedCategory!.icon)
                  : Icons.help_outline,
              categoryColor: _selectedCategory != null
                  ? Color(_selectedCategory!.color)
                  : vfBlue,
              key: ValueKey<String>(_currentNode!.id),
            ),
          ),

          const SizedBox(height: 32),

          // Yes / No buttons.
          AnimatedSwitcher(
            duration: const Duration(milliseconds: 350),
            switchInCurve: Curves.easeInCubic,
            switchOutCurve: Curves.easeOutCubic,
            child: ActionButtons(
              onYes: () => _answerQuestion(true),
              onNo: () => _answerQuestion(false),
              key: ValueKey<String>(_currentNode!.id),
            ),
          ),

          // Path summary (collapsible).
          if (_path.isNotEmpty) ...[
            const SizedBox(height: 24),
            PathSummary(path: _path),
          ],

          const SizedBox(height: 32),
        ],
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
              child: TroubleshooterResultIcon(
                resolutionType: _result!.resolutionType,
              ),
            ),
          ),

          const SizedBox(height: 24),

          // Resolution card.
          FadeTransition(
            opacity: _resultOpacityAnim,
            child: ResolutionCard(
              resolution: _result!.resolution,
              resolutionType: _result!.resolutionType,
            ),
          ),

          // Path taken (for NEEDS_SUPPORT / FAILED).
          if (_result!.resolutionType == 'NEEDS_SUPPORT' ||
              _result!.resolutionType == 'FAILED') ...[
            const SizedBox(height: 16),
            FadeTransition(
              opacity: _resultOpacityAnim,
              child: TroubleshooterPathTakenCard(
                path: _result!.path,
              ),
            ),
            const SizedBox(height: 16),
            FadeTransition(
              opacity: _resultOpacityAnim,
              child: TroubleshooterSupportTicketButton(
                onPressed: _isSubmitting ? null : _createSupportTicket,
                isSubmitting: _isSubmitting,
              ),
            ),
          ],

          // DANGER SOS prompt.
          if (_result!.resolutionType == 'DANGER') ...[
            const SizedBox(height: 16),
            FadeTransition(
              opacity: _resultOpacityAnim,
              child: TroubleshooterSosButton(
                onPressed: _triggerSOS,
              ),
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
                  foregroundColor: vfBlue,
                  side: const BorderSide(color: vfBlue),
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






}

// =============================================================================
// Internal enum
// =============================================================================

enum _Mode {
  categorySelect,
  question,
  result,
}
