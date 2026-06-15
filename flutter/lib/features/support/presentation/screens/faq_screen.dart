import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:voltium_rider/providers/app_provider.dart';
import 'package:voltium_rider/widgets/fade_up_widget.dart';
import 'dart:ui';

class FaqScreen extends StatefulWidget {
  const FaqScreen({super.key});

  @override
  State<FaqScreen> createState() => _FaqScreenState();
}

class _FaqScreenState extends State<FaqScreen> {
  String _searchQuery = '';
  String _activeCategory = 'All';
  String? _expandedId;

  Future<void> _callSupport() async {
    final uri = Uri.parse('tel:+919876543210');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    }
  }

  Future<void> _emailSupport() async {
    final uri = Uri.parse('mailto:support@voltium.app');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    }
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<AppProvider>();
    final faqs = provider.faqs;

    final categories = ['All', ...faqs.map((f) => f.category).toSet().toList()];

    final filteredFaqs = faqs.where((f) {
      final matchesSearch =
          f.question.toLowerCase().contains(_searchQuery.toLowerCase()) ||
              f.answer.toLowerCase().contains(_searchQuery.toLowerCase());
      final matchesCategory =
          _activeCategory == 'All' || f.category == _activeCategory;
      return matchesSearch && matchesCategory;
    }).toList();

    return Scaffold(
      backgroundColor: const Color(0xFFF1F5F9),
      body: Stack(
        children: [
          _buildMeshBackground(),
          SafeArea(
            child: Column(
              children: [
                _buildHeader(context),
                Expanded(
                  child: ListView(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 20, vertical: 20),
                    children: [
                      FadeUpWidget(
                        delay: 0,
                        child: _buildSearchBar(),
                      ),
                      const SizedBox(height: 24),
                      if (categories.length > 2)
                        FadeUpWidget(
                          delay: 100,
                          child: _buildCategoryScroller(categories),
                        ),
                      const SizedBox(height: 24),
                      _buildFaqList(filteredFaqs),
                      const SizedBox(height: 32),
                      FadeUpWidget(
                        delay: 400,
                        child: _buildContactSection(),
                      ),
                      const SizedBox(height: 48),
                    ],
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
            colors: [Color(0xFFF1F5F9), Color(0xFFF8FAFC)],
          ),
        ),
      ),
    );
  }

  Widget _buildHeader(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.8),
        border:
            Border(bottom: BorderSide(color: Colors.black.withOpacity(0.05))),
      ),
      child: Row(
        children: [
          InkWell(
            key: const Key('backButton'),
            onTap: () => Navigator.pop(context),
            child: Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: Colors.white,
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(
                      color: Colors.black.withOpacity(0.05), blurRadius: 10),
                ],
              ),
              child: const Icon(Icons.arrow_back,
                  size: 18, color: Color(0xFF1E293B)),
            ),
          ),
          const SizedBox(width: 16),
          const Text(
            'Help & FAQ',
            style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
                color: Color(0xFF1E293B)),
          ),
        ],
      ),
    );
  }

  Widget _buildSearchBar() {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.8),
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
              color: Colors.black.withOpacity(0.02),
              blurRadius: 20,
              offset: const Offset(0, 4)),
        ],
      ),
      child: TextField(
        onChanged: (v) => setState(() => _searchQuery = v),
        decoration: const InputDecoration(
          prefixIcon: Icon(Icons.search, color: Color(0xFF94A3B8), size: 18),
          hintText: 'Search help topics...',
          hintStyle: TextStyle(
              color: Color(0xFF94A3B8),
              fontSize: 14,
              fontWeight: FontWeight.w500),
          border: InputBorder.none,
          contentPadding: EdgeInsets.symmetric(horizontal: 20, vertical: 16),
        ),
      ),
    );
  }

  Widget _buildCategoryScroller(List<String> categories) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: categories.map((cat) {
          final isSelected = _activeCategory == cat;
          return Padding(
            padding: const EdgeInsets.only(right: 8),
            child: InkWell(
              onTap: () => setState(() => _activeCategory = cat),
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                decoration: BoxDecoration(
                  color: isSelected ? const Color(0xFF0053C1) : Colors.white,
                  borderRadius: BorderRadius.circular(99),
                  boxShadow: isSelected
                      ? [
                          BoxShadow(
                              color: const Color(0xFF0053C1).withOpacity(0.3),
                              blurRadius: 10,
                              offset: const Offset(0, 4))
                        ]
                      : [],
                ),
                child: Text(
                  cat,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    color: isSelected ? Colors.white : const Color(0xFF64748B),
                  ),
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildFaqList(List<dynamic> filteredFaqs) {
    if (filteredFaqs.isEmpty) {
      return Column(
        children: [
          const SizedBox(height: 60),
          Container(
            height: 64,
            width: 64,
            decoration: const BoxDecoration(
                color: Color(0xFFEFF6FF), shape: BoxShape.circle),
            child: const Icon(Icons.search, color: Color(0xFF0053C1), size: 24),
          ),
          const SizedBox(height: 16),
          const Text('No results found',
              style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF1E293B))),
          const Text("We couldn't find any match for your search.",
              style: TextStyle(fontSize: 13, color: Color(0xFF64748B))),
        ],
      );
    }

    return Column(
      children: filteredFaqs.asMap().entries.map((entry) {
        final idx = entry.key;
        final faq = entry.value;
        return Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: FadeUpWidget(
            delay: 150 + (idx * 50),
            child: _buildFaqItem(faq),
          ),
        );
      }).toList(),
    );
  }

  Widget _buildFaqItem(dynamic faq) {
    final isExpanded = _expandedId == faq.id;
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.black.withOpacity(0.05)),
      ),
      child: Column(
        children: [
          ListTile(
            onTap: () =>
                setState(() => _expandedId = isExpanded ? null : faq.id),
            title: Text(faq.question,
                style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF1E293B))),
            trailing: AnimatedRotation(
              duration: const Duration(milliseconds: 300),
              turns: isExpanded ? 0.5 : 0,
              child: const Icon(Icons.keyboard_arrow_down,
                  size: 18, color: Color(0xFF94A3B8)),
            ),
          ),
          if (isExpanded)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
              child: Text(
                faq.answer,
                style: const TextStyle(
                    fontSize: 13, height: 1.5, color: Color(0xFF64748B)),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildContactSection() {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(32),
        border: Border.all(color: Colors.black.withOpacity(0.05)),
      ),
      child: Column(
        children: [
          Row(
            children: [
              Container(
                height: 40,
                width: 40,
                decoration: BoxDecoration(
                    color: const Color(0xFFEFF6FF),
                    borderRadius: BorderRadius.circular(12)),
                child: const Icon(Icons.message_outlined,
                    color: Color(0xFF0053C1), size: 20),
              ),
              const SizedBox(width: 16),
              const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Still need help?',
                      style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF1E293B))),
                  Text('Our team is available 24/7 for you.',
                      style: TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                ],
              ),
            ],
          ),
          const SizedBox(height: 24),
          Row(
            children: [
              Expanded(
                child: GestureDetector(
                  onTap: _callSupport,
                  child: _buildContactButton(
                      Icons.phone_outlined,
                      'Call Support',
                      const Color(0xFFECFDF5),
                      const Color(0xFF15803D)),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: GestureDetector(
                  onTap: _emailSupport,
                  child: _buildContactButton(Icons.email_outlined, 'Email Us',
                      const Color(0xFFF5F3FF), const Color(0xFF7C3AED)),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildContactButton(
      IconData icon, String label, Color bg, Color text) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12),
      decoration:
          BoxDecoration(color: bg, borderRadius: BorderRadius.circular(16)),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, size: 14, color: text),
          const SizedBox(width: 8),
          Text(label,
              style: TextStyle(
                  fontSize: 12, fontWeight: FontWeight.bold, color: text)),
        ],
      ),
    );
  }
}
