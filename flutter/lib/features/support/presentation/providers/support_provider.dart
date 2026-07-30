import 'package:flutter/material.dart';
import 'package:voltium_rider/features/support/domain/repository.dart';
import 'package:voltium_rider/models/support_model.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import '../../../../utils/app_logger.dart';

class SupportProvider extends ChangeNotifier {
  final SupportRepository _repository;

  SupportProvider({required SupportRepository repository})
      : _repository = repository;

  SupportConfig? _supportConfig;
  SupportConfig? get supportConfig => _supportConfig;

  List<FaqCategory> _faqCategories = [];
  List<FaqCategory> get faqCategories => _faqCategories;

  List<FaqItem> _faqs = [];
  List<FaqItem> get faqs => _faqs;

  List<IssueModel> _tickets = [];
  List<IssueModel> get tickets => _tickets;

  bool _isRefreshingTickets = false;
  bool get isRefreshingTickets => _isRefreshingTickets;

  void initSupportData() {
    _supportConfig = const SupportConfig(
      supportPhone: '+919876543210',
      supportEmail: 'support@voltium.app',
      ticketChecklist: [
        'I have checked the vehicle battery levels.',
        'I have verified the internet connection on my device.',
        'I have attempted to restart the app.',
        'I have ensured I am at the assigned rental hub (if applicable).',
      ],
    );

    _faqCategories = [
      const FaqCategory(
        id: 'tech',
        title: 'Technical Issues',
        subtitle: 'App & Device help',
        articleCount: 12,
        icon: Icons.build_outlined,
        iconColor: AppColors.warningDark,
        iconBgColor: AppColors.warningLight,
      ),
      const FaqCategory(
        id: 'payment',
        title: 'Payments & Wallet',
        subtitle: 'Billing & Top-ups',
        articleCount: 8,
        icon: Icons.credit_card_outlined,
        iconColor: AppColors.success,
        iconBgColor: AppColors.successSurface,
      ),
      const FaqCategory(
        id: 'vehicle',
        title: 'Vehicle Issues',
        subtitle: 'Moped & Battery',
        articleCount: 15,
        icon: Icons.electric_moped_outlined,
        iconColor: AppColors.primary,
        iconBgColor: AppColors.infoLight,
      ),
    ];

    _faqs = [
      const FaqItem(
        id: '1',
        categoryId: 'tech',
        question: 'How do I start my rental?',
        answer:
            'To start your rental, locate your assigned vehicle at the hub, perform the pre-ride check in the app, and tap "Start Ride".',
      ),
      const FaqItem(
        id: '2',
        categoryId: 'vehicle',
        question: 'What happens if the battery dies?',
        answer:
            'If your battery is low, navigate to the nearest swapping station shown on the map or contact support via the SOS button in an emergency.',
      ),
    ];
    _fetchAll();
  }

  Future<void> _fetchAll() async {
    await Future.wait([refreshFaqs(), refreshTickets()]);
    notifyListeners();
  }

  Future<void> refreshFaqs() async {
    try {
      final response = await _repository.fetchFaqs();
      if (response['success'] == true) {
        final data = response['data'] as Map<String, dynamic>?;
        if (data != null) {
          final faqsList = data['faqs'] as List<dynamic>? ?? [];
          _faqs = faqsList
              .map((e) => FaqItem.fromJson(e as Map<String, dynamic>))
              .toList();
          notifyListeners();
        }
      }
    } catch (e) {
      appDebug('Failed to fetch FAQs: $e');
    }
  }

  Future<void> refreshTickets({String? riderId}) async {
    if (_isRefreshingTickets) return;
    _isRefreshingTickets = true;
    notifyListeners();

    try {
      final response = await _repository.fetchTickets();
      if (response['success'] == true) {
        final data = response['data'] as Map<String, dynamic>?;
        if (data != null) {
          final ticketsList = data['tickets'] as List<dynamic>? ?? [];
          _tickets = ticketsList
              .map((e) => IssueModel.fromJson(e as Map<String, dynamic>))
              .toList();
          notifyListeners();
        }
      }
    } catch (e) {
      appDebug('Error fetching tickets: $e');
    } finally {
      _isRefreshingTickets = false;
      notifyListeners();
    }
  }

  Future<void> createTicket({
    required String category,
    required String subject,
    required String message,
    String? riderId,
  }) async {
    try {
      await _repository.createTicket(
        category,
        subject,
        message,
        riderId: riderId ?? '',
        priority: 'MEDIUM',
      );
      await refreshTickets(riderId: riderId);
    } catch (e) {
      rethrow;
    }
  }

  void logout() {
    _supportConfig = null;
    _faqCategories = [];
    _faqs = [];
    _tickets = [];
    _isRefreshingTickets = false;
    notifyListeners();
  }
}
