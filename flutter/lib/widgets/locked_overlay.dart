import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/app_provider.dart';
import '../services/voltium_api_service.dart';
import '../core/platform/platform_info.dart';

class LockedOverlay extends StatefulWidget {
  const LockedOverlay({super.key});

  @override
  State<LockedOverlay> createState() => _LockedOverlayState();
}

class _LockedOverlayState extends State<LockedOverlay> with WidgetsBindingObserver {
  final TextEditingController _passwordController = TextEditingController();
  String _error = '';
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _passwordController.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _checkLockState();
    }
  }

  Future<void> _checkLockState() async {
    try {
      final response = await VoltiumApiService().get('/api/rider/device');
      final data = response['data'] as Map<String, dynamic>? ?? response;
      final adminLocked = data['isAdminLocked'] as bool?;
      if (mounted) {
        final provider = context.read<AppProvider>();
        if (adminLocked == true && !provider.lockedByAdmin) {
          provider.setLockedByAdmin(true);
        } else if (adminLocked == false && provider.lockedByAdmin) {
          provider.setLockedByAdmin(false);
        }
      }
    } catch (e) {
      debugPrint('Failed to poll lock state on resume: $e');
    }
  }

  Future<void> _verifyPassword() async {
    if (_loading) return;
    final password = _passwordController.text.trim();
    if (password.isEmpty) {
      setState(() => _error = 'Please enter password.');
      return;
    }

    setState(() {
      _loading = true;
      _error = '';
    });

    try {
      final response = await VoltiumApiService().post(
        '/api/rider/device/verify-lock',
        body: {'password': password},
      );

      final successVal = response['success'] as bool? ?? false;
      final data = response['data'] as Map<String, dynamic>?;
      final isValid = (data != null && data['success'] == true) || successVal;

      if (mounted) {
        if (isValid) {
          final provider = context.read<AppProvider>();
          provider.setLockedByAdmin(false);
          _passwordController.clear();
          setState(() {
            _error = '';
            _loading = false;
          });
        } else {
          final msg = response['message'] as String? ?? 'Incorrect Password. Contact Voltium support.';
          setState(() {
            _error = msg;
            _passwordController.clear();
            _loading = false;
          });
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = 'Verification failed. Please check your network and try again.';
          _loading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isLocked = context.select<AppProvider, bool>((p) => p.lockedByAdmin);
    if (!isLocked) return const SizedBox.shrink();

    if (PlatformInfo.isWeb) {
      return Scaffold(
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(32),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.lock_person_rounded, size: 64, color: Colors.amber),
                const SizedBox(height: 16),
                const Text(
                  'Your account has been locked by Voltium.',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 8),
                const Text(
                  'Please contact support to unlock.',
                  style: TextStyle(color: Colors.grey),
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
        ),
      );
    }

    return PopScope(
      canPop: false,
      child: Scaffold(
        backgroundColor: Colors.black,
        body: Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                Colors.black,
                Colors.red.withValues(alpha: 0.2),
                Colors.black,
              ],
            ),
          ),
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(32),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(
                    Icons.lock_person_rounded,
                    color: Colors.white,
                    size: 80,
                  ),
                  const SizedBox(height: 24),
                  const Text('VOLTIUM SOFT LOCK',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 28,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 2,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'This device is locked for rider deterrence. Force-quitting the app will keep it locked on next launch.',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.7),
                      fontSize: 16,
                    ),
                  ),
                  const SizedBox(height: 16),
                  const Text('Contact Voltium support to unlock',
                    style: TextStyle(
                      color: Colors.redAccent,
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 48),
                  Container(
                    constraints: const BoxConstraints(maxWidth: 300),
                    child: Column(
                      children: [
                        TextFormField(
                          controller: _passwordController,
                          obscureText: true,
                          keyboardType: TextInputType.text,
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 24,
                            letterSpacing: 4,
                          ),
                          decoration: InputDecoration(
                            counterText: '',
                            hintText: 'PASSWORD',
                            hintStyle: TextStyle(
                              color: Colors.white.withValues(alpha: 0.3),
                              letterSpacing: 0,
                            ),
                            enabledBorder: const UnderlineInputBorder(
                              borderSide: BorderSide(color: Colors.white24),
                            ),
                            focusedBorder: const UnderlineInputBorder(
                              borderSide: BorderSide(color: Colors.red),
                            ),
                          ),
                          onFieldSubmitted: (_) => _verifyPassword(),
                        ),
                        if (_error.isNotEmpty) ...[
                          const SizedBox(height: 16),
                          Text(
                            _error,
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                              color: Colors.redAccent,
                              fontSize: 13,
                            ),
                          ),
                        ],
                        const SizedBox(height: 32),
                        SizedBox(
                          width: double.infinity,
                          height: 56,
                          child: ElevatedButton(
                            onPressed: _loading ? null : _verifyPassword,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: Colors.white,
                              foregroundColor: Colors.black,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                              ),
                            ),
                            child: _loading
                                ? const SizedBox(
                                    height: 24,
                                    width: 24,
                                    child: CircularProgressIndicator(
                                      color: Colors.black,
                                      strokeWidth: 2,
                                    ),
                                  )
                                : const Text('UNLOCK',
                                    style: TextStyle(
                                      fontWeight: FontWeight.bold,
                                      fontSize: 16,
                                    ),
                                  ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 64),
                  Text('Voltium Security System v3.0',
                    style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.3),
                      fontSize: 12,
                      fontStyle: FontStyle.italic,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
