import 'package:flutter_test/flutter_test.dart';
import 'dashboard_page.dart';
import 'login_page.dart';
import 'wallet_page.dart';
import 'onboarding_page.dart';
import 'profile_page.dart';
import 'support_page.dart';
import 'settings_page.dart';
import 'app_page.dart';

class AppRobots {
  final WidgetTester tester;
  late final LoginPageObject login;
  late final DashboardPageObject dashboard;
  late final WalletPageObject wallet;
  late final OnboardingPageObject onboarding;
  late final ProfilePageObject profile;
  late final SupportPageObject support;
  late final SettingsPageObject settings;
  late final AppPageObject shared;

  AppRobots(this.tester) {
    login = LoginPageObject(tester);
    dashboard = DashboardPageObject(tester);
    wallet = WalletPageObject(tester);
    onboarding = OnboardingPageObject(tester);
    profile = ProfilePageObject(tester);
    support = SupportPageObject(tester);
    settings = SettingsPageObject(tester);
    shared = AppPageObject(tester);
  }
}
