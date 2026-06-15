import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/app_provider.dart';
import '../theme/app_theme.dart';

class LockedOverlay extends StatefulWidget {
  const LockedOverlay({super.key});

  @override
  State<LockedOverlay> createState() => _LockedOverlayState();
}

class _LockedOverlayState extends State<LockedOverlay> {
  final TextEditingController _passwordController = TextEditingController();
  String _error = '';

  void _verifyPassword() {
    final provider = context.read<AppProvider>();
    if (_passwordController.text == provider.lockPassword) {
      provider.setLockedByAdmin(false);
      _passwordController.clear();
      setState(() => _error = '');
    } else {
      setState(() {
        _error = 'Incorrect Password. Contact Ryd support.';
        _passwordController.clear();
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final isLocked = context.watch<AppProvider>().lockedByAdmin;
    if (!isLocked) return const SizedBox.shrink();

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
                Colors.red.withOpacity(0.2),
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
                  const Text(
                    'DEVICE LOCKED',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 28,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 2,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'This device has been remotely locked by the administrator.',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: Colors.white.withOpacity(0.7),
                      fontSize: 16,
                    ),
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'Contact Ryd support to unlock',
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
                        TextField(
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
                              color: Colors.white.withOpacity(0.3),
                              letterSpacing: 0,
                            ),
                            enabledBorder: const UnderlineInputBorder(
                              borderSide: BorderSide(color: Colors.white24),
                            ),
                            focusedBorder: const UnderlineInputBorder(
                              borderSide: BorderSide(color: Colors.red),
                            ),
                          ),
                          onSubmitted: (_) => _verifyPassword(),
                        ),
                        if (_error.isNotEmpty) ...[
                          const SizedBox(height: 16),
                          Text(
                            _error,
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                                color: Colors.redAccent, fontSize: 13),
                          ),
                        ],
                        const SizedBox(height: 32),
                        SizedBox(
                          width: double.infinity,
                          height: 56,
                          child: ElevatedButton(
                            onPressed: _verifyPassword,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: Colors.white,
                              foregroundColor: Colors.black,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                              ),
                            ),
                            child: const Text(
                              'UNLOCK',
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
                  Text(
                    'Ryd Security System v3.0',
                    style: TextStyle(
                      color: Colors.white.withOpacity(0.3),
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
