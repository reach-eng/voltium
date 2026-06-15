import 'package:flutter/material.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'user_onboarding_screen.dart';
import 'login_screen.dart';

class AuthChoiceScreen extends StatelessWidget {
  final VoidCallback? onCreateAccount;
  final VoidCallback? onLoginWithPhone;

  const AuthChoiceScreen(
      {Key? key, this.onCreateAccount, this.onLoginWithPhone})
      : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Ryd'),
        backgroundColor: AppColors.surface,
        elevation: 0,
      ),
      body: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            ElevatedButton(
              key: const Key('createAccountButton'),
              onPressed: onCreateAccount,
              style: ElevatedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 18),
                backgroundColor: AppColors.primary,
              ),
              child: const Text('Create Account',
                  style: TextStyle(
                      color: Colors.white,
                      fontSize: 16,
                      fontWeight: FontWeight.w700)),
            ),
            const SizedBox(height: 16),
            ElevatedButton(
              key: const Key('loginWithPhoneButton'),
              onPressed: onLoginWithPhone,
              style: ElevatedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 18),
                backgroundColor: AppColors.surfaceContainer,
                foregroundColor: AppColors.onSurface,
              ),
              child: const Text('Login with Phone',
                  style: TextStyle(
                      color: Colors.white,
                      fontSize: 16,
                      fontWeight: FontWeight.w700)),
            ),
          ],
        ),
      ),
    );
  }
}
