import 'dart:io';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:image_picker/image_picker.dart';
import 'package:voltium_rider/providers/app_provider.dart';
import 'package:voltium_rider/models/hub_model.dart';
import 'package:voltium_rider/services/api_service.dart';
import 'package:voltium_rider/services/image_compression_service.dart';
import 'choose_plan_screen.dart';

class RentalDetailsScreen extends StatefulWidget {
  final VoidCallback? onBack;

  const RentalDetailsScreen({
    super.key,
    this.onBack,
  });

  @override
  State<RentalDetailsScreen> createState() => _RentalDetailsScreenState();
}

class _RentalDetailsScreenState extends State<RentalDetailsScreen> {
  final ImageCompressionService _compressionService = ImageCompressionService();
  List<HubModel> _hubs = [];
  bool _isLoadingHubs = true;
  String? _selectedHubId;

  String? _frontPhotoUrl;
  String? _backPhotoUrl;
  String? _leftPhotoUrl;
  String? _rightPhotoUrl;

  @override
  void initState() {
    super.initState();
    _fetchHubs();
  }

  Future<void> _fetchHubs() async {
    try {
      final response = await ApiService().fetchHubs();
      if (!mounted) return;
      if (response['success'] == true) {
        final List<dynamic> data = response['data'] ?? [];
        setState(() {
          _hubs = data.map((e) => HubModel.fromJson(e as Map<String, dynamic>)).toList();
          _isLoadingHubs = false;
          if (_hubs.isNotEmpty) {
            _selectedHubId = _hubs.first.id;
          }
        });
      } else {
        setState(() => _isLoadingHubs = false);
      }
    } catch (e) {
      if (mounted) setState(() => _isLoadingHubs = false);
    }
  }

  Future<void> _uploadImage(String type) async {
    try {
      final compressed = await _compressionService.pickAndCompress(
        source: ImageSource.camera,
        maxWidth: 1024,
        maxHeight: 1024,
        quality: 80,
      );
      if (compressed == null || !mounted) return;

      final url = await ApiService().uploadFile(File(compressed.path), 'return_verification');

      setState(() {
        if (type == 'Front') _frontPhotoUrl = url;
        else if (type == 'Back') _backPhotoUrl = url;
        else if (type == 'Left') _leftPhotoUrl = url;
        else if (type == 'Right') _rightPhotoUrl = url;
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Upload failed')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF3F4F6),
      bottomNavigationBar: _buildBottomNav(),
      body: Stack(
        children: [
          // Blue Background Header
          Container(
            height: 220,
            decoration: const BoxDecoration(
              color: Color(0xFF0053C1),
              borderRadius: BorderRadius.only(
                bottomLeft: Radius.circular(30),
                bottomRight: Radius.circular(30),
              ),
            ),
          ),
          SafeArea(
            child: Column(
              children: [
                _buildHeader(),
                Expanded(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                    physics: const BouncingScrollPhysics(),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        _buildTimeRemainingCard(),
                        const SizedBox(height: 20),
                        _buildVehicleInfoCard(),
                        const SizedBox(height: 16),
                        _buildChangePlanButton(),
                        const SizedBox(height: 24),
                        _buildEndRentalSection(),
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

  Widget _buildHeader() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          IconButton(
            icon: const Icon(Icons.arrow_back, color: Colors.white),
            onPressed: widget.onBack ?? () => Navigator.maybePop(context),
          ),
          Text(
            'Rental Details',
            style: GoogleFonts.inter(
              fontSize: 20,
              fontWeight: FontWeight.w700,
              color: Colors.white,
            ),
          ),
          IconButton(
            icon: const Icon(Icons.notifications_none, color: Colors.white),
            onPressed: () {},
          ),
        ],
      ),
    );
  }

  Widget _buildTimeRemainingCard() {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFFFBBF24), Color(0xFFF59E0B)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFFF59E0B).withOpacity(0.3),
            blurRadius: 15,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Positioned(
            right: -20,
            top: -10,
            child: Icon(
              Icons.schedule,
              size: 100,
              color: Colors.white.withOpacity(0.15),
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'TIME REMAINING',
                style: GoogleFonts.inter(
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                  color: Colors.white.withOpacity(0.9),
                  letterSpacing: 1.2,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                '04:23:15',
                style: GoogleFonts.inter(
                  fontSize: 42,
                  fontWeight: FontWeight.w900,
                  color: Colors.white,
                  letterSpacing: -1,
                ),
              ),
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: Colors.black.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.access_time, size: 14, color: Colors.white),
                    const SizedBox(width: 6),
                    Text(
                      'Returns at 6:00 PM today',
                      style: GoogleFonts.inter(
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                        color: Colors.white,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildVehicleInfoCard() {
    final rider = context.watch<AppProvider>().rider;
    final vehicleId = (rider?.assignedVehicle == null ||
            rider!.assignedVehicle!.isEmpty ||
            rider.assignedVehicle == 'Not Assigned')
        ? 'DL-8C-AB-1234'
        : rider.assignedVehicle!;

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
      ),
      padding: const EdgeInsets.all(20),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'VEHICLE ID',
                    style: GoogleFonts.inter(
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                      color: const Color(0xFF6B7280),
                      letterSpacing: 1.0,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    vehicleId,
                    style: GoogleFonts.inter(
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                      color: const Color(0xFF111827),
                      letterSpacing: 1.5,
                    ),
                  ),
                ],
              ),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFFEFF6FF),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(
                  Icons.electric_moped,
                  color: Color(0xFF0053C1),
                  size: 24,
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          Row(
            children: [
              Expanded(
                child: _buildInfoCell(
                  label: 'Battery',
                  value: '84%',
                  icon: Icons.battery_charging_full,
                  iconColor: const Color(0xFF10B981),
                ),
              ),
              Container(width: 1, height: 40, color: const Color(0xFFF3F4F6)),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.only(left: 16),
                  child: _buildInfoCell(
                    label: 'Range',
                    value: '210 km',
                    icon: Icons.route,
                    iconColor: const Color(0xFF3B82F6),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: _buildInfoCell(
                  label: 'Current Hub',
                  value: 'New Delhi C...',
                  icon: Icons.location_on_outlined,
                  iconColor: const Color(0xFF6B7280),
                ),
              ),
              Container(width: 1, height: 40, color: const Color(0xFFF3F4F6)),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.only(left: 16),
                  child: _buildInfoCell(
                    label: 'Started',
                    value: 'Oct 26, 9:00 AM',
                    icon: Icons.calendar_today_outlined,
                    iconColor: const Color(0xFF6B7280),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildInfoCell({
    required String label,
    required String value,
    required IconData icon,
    required Color iconColor,
  }) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFF9FAFB),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: GoogleFonts.inter(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: const Color(0xFF6B7280),
            ),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Icon(icon, size: 14, color: iconColor),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  value,
                  style: GoogleFonts.inter(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: const Color(0xFF111827),
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildChangePlanButton() {
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: const Color(0xFFF4F8FE),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE0E7FF)),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () {
            Navigator.push(
              context,
              MaterialPageRoute(
                builder: (_) => ChoosePlanScreen(
                  onNext: () => Navigator.pop(context),
                  onBack: () => Navigator.pop(context),
                ),
              ),
            );
          },
          borderRadius: BorderRadius.circular(16),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 16),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.swap_horiz, color: Color(0xFF0053C1), size: 18),
                const SizedBox(width: 8),
                Text(
                  'Change Plan',
                  style: GoogleFonts.inter(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: const Color(0xFF0053C1),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildEndRentalSection() {
    int uploadedCount = [
      _frontPhotoUrl,
      _backPhotoUrl,
      _leftPhotoUrl,
      _rightPhotoUrl
    ].where((url) => url != null).length;
    bool canComplete = uploadedCount == 4 && _selectedHubId != null;

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(4),
                decoration: const BoxDecoration(
                  color: Color(0xFFEFF6FF),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.check_circle_outline, color: Color(0xFF0053C1), size: 20),
              ),
              const SizedBox(width: 8),
              Text(
                'End Rental',
                style: GoogleFonts.inter(
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                  color: const Color(0xFF111827),
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          Text(
            'Return Hub',
            style: GoogleFonts.inter(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: const Color(0xFF4B5563),
            ),
          ),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            decoration: BoxDecoration(
              border: Border.all(color: const Color(0xFFE5E7EB)),
              borderRadius: BorderRadius.circular(12),
            ),
            child: DropdownButtonHideUnderline(
              child: _isLoadingHubs
                  ? const Padding(
                      padding: EdgeInsets.all(12),
                      child: CircularProgressIndicator(),
                    )
                  : DropdownButton<String>(
                      value: _selectedHubId,
                      isExpanded: true,
                      icon: const Icon(Icons.keyboard_arrow_down, color: Color(0xFF6B7280)),
                      items: _hubs.map((hub) {
                        return DropdownMenuItem<String>(
                          value: hub.id,
                          child: Text(
                            hub.name,
                            style: GoogleFonts.inter(
                              fontSize: 14,
                              color: const Color(0xFF111827),
                            ),
                          ),
                        );
                      }).toList(),
                      onChanged: (String? newValue) {
                        if (newValue != null) {
                          setState(() => _selectedHubId = newValue);
                        }
                      },
                    ),
            ),
          ),
          const SizedBox(height: 24),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Vehicle Condition Photos',
                style: GoogleFonts.inter(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: const Color(0xFF4B5563),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: const Color(0xFFF3F4F6),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  '$uploadedCount/4 Uploaded',
                  style: GoogleFonts.inter(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: const Color(0xFF6B7280),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 12,
            crossAxisSpacing: 12,
            childAspectRatio: 1.8,
            children: [
              _buildPhotoBox('Front'),
              _buildPhotoBox('Back'),
              _buildPhotoBox('Left'),
              _buildPhotoBox('Right'),
            ],
          ),
          const SizedBox(height: 24),
          InkWell(
            onTap: canComplete ? () {} : null,
            borderRadius: BorderRadius.circular(16),
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 16),
              decoration: BoxDecoration(
                color: canComplete ? const Color(0xFF0053C1) : const Color(0xFFF3F4F6),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    'Complete Return',
                    style: GoogleFonts.inter(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: canComplete ? Colors.white : const Color(0xFF9CA3AF),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Icon(
                    canComplete ? Icons.check_circle_outline : Icons.lock_outline, 
                    size: 16, 
                    color: canComplete ? Colors.white : const Color(0xFF9CA3AF)
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
          Center(
            child: Text(
              canComplete ? 'Ready to return vehicle.' : 'Upload all photos to unlock return.',
              style: GoogleFonts.inter(
                fontSize: 12,
                color: const Color(0xFF6B7280),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPhotoBox(String label) {
    bool isUploaded = false;
    if (label == 'Front' && _frontPhotoUrl != null) isUploaded = true;
    if (label == 'Back' && _backPhotoUrl != null) isUploaded = true;
    if (label == 'Left' && _leftPhotoUrl != null) isUploaded = true;
    if (label == 'Right' && _rightPhotoUrl != null) isUploaded = true;

    return InkWell(
      onTap: () => _uploadImage(label),
      borderRadius: BorderRadius.circular(12),
      child: Container(
        decoration: BoxDecoration(
          color: isUploaded ? const Color(0xFFEFF6FF) : Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isUploaded ? const Color(0xFF3B82F6) : const Color(0xFF93C5FD),
            width: 1,
            style: BorderStyle.solid,
          ),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              isUploaded ? Icons.check_circle : Icons.add_a_photo_outlined, 
              color: const Color(0xFF3B82F6), 
              size: 24
            ),
            const SizedBox(height: 8),
            Text(
              label,
              style: GoogleFonts.inter(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: const Color(0xFF0053C1),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBottomNav() {
    return BottomNavigationBar(
      type: BottomNavigationBarType.fixed,
      currentIndex: 0, 
      selectedItemColor: const Color(0xFF0053C1),
      unselectedItemColor: const Color(0xFF9CA3AF),
      showUnselectedLabels: true,
      selectedLabelStyle: GoogleFonts.inter(fontSize: 10, fontWeight: FontWeight.w600),
      unselectedLabelStyle: GoogleFonts.inter(fontSize: 10, fontWeight: FontWeight.w500),
      items: const [
        BottomNavigationBarItem(
          icon: Icon(Icons.home_outlined),
          label: 'Home',
        ),
        BottomNavigationBarItem(
          icon: Icon(Icons.account_balance_wallet_outlined),
          label: 'Wallet',
        ),
        BottomNavigationBarItem(
          icon: Icon(Icons.support_agent_outlined),
          label: 'Support',
        ),
        BottomNavigationBarItem(
          icon: Icon(Icons.person_outline),
          label: 'Profile',
        ),
      ],
    );
  }
}
