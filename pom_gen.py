import os

key_mapping = {
    "dashboardTab": ("dashboardPage", "dashboardTab"),
    "notificationBell": ("dashboardPage", "notificationBell"),
    "pointsBadge": ("dashboardPage", "pointsBadge"),
    "assignedVehicleCard": ("dashboardPage", "assignedVehicleCard"),
    "copyReferralButton": ("dashboardPage", "copyReferralButton"),
    
    "phoneInput": ("loginPage", "phoneField"),
    "sendOtpButton": ("loginPage", "getOtpButton"),
    "otpInputRow": ("loginPage", "otpField"),
    "verifyOtpButton": ("loginPage", "verifyOtpButton"),

    "topUpButton": ("walletPage", "topUpButton"),
    "walletTopUpPurposeCard": ("walletPage", "walletTopUpPurposeCard"),
    "securityDepositPurposeCard": ("walletPage", "securityDepositPurposeCard"),
    "topUpAmountField": ("walletPage", "topUpAmountField"),
    "submitTopUpButton": ("walletPage", "submitTopUpButton"),
    "walletTab": ("walletPage", "walletTab"),
    "amount500": ("walletPage", "amount500"),
    "amount1000": ("walletPage", "amount1000"),
    "amount2000": ("walletPage", "amount2000"),
    "amount5000": ("walletPage", "amount5000"),
    "customAmountField": ("walletPage", "customAmountField"),
    "proceedToUpiButton": ("walletPage", "proceedToUpiButton"),
}

generic_mapping = {
    "acceptCheckbox": "onboardingPage",
    "continueLegalButton": "onboardingPage",
    "continuePermissionsButton": "onboardingPage",
    "deliverWithUsCard": "onboardingPage",
    "nextOnboardingButton": "onboardingPage",
    "fullNameField": "onboardingPage",
    "emailField": "onboardingPage",
    "fatherNameField": "onboardingPage",
    "motherNameField": "onboardingPage",
    "guarantorNameField": "onboardingPage",
    "guarantorPhoneField": "onboardingPage",
    "guarantorFatherNameField": "onboardingPage",
    "guarantorMotherNameField": "onboardingPage",
    "completeOnboardingButton": "onboardingPage",
    "declarationCheckbox": "onboardingPage",
    "uploadProofArea": "onboardingPage",
    "submitProofButton": "onboardingPage",
    "allowLocationButton": "onboardingPage",
    "allowContactsButton": "onboardingPage",
    "allowCameraButton": "onboardingPage",
    "allowNotificationsButton": "onboardingPage",
    "getStartedButton": "onboardingPage",
    "loginWithPhoneButton": "onboardingPage",
    "continueToPaymentButton": "onboardingPage",
    
    "editProfileButton": "profilePage",
    "editFullNameField": "profilePage",
    "saveProfileButton": "profilePage",
    "profileNameField": "profilePage",
    "logoutButton": "profilePage",
    "profileTab": "profilePage",
    "historyButton": "profilePage",

    "supportTab": "supportPage",
    "faqTile": "supportPage",
    "raiseTicketTile": "supportPage",
    "raiseTicketButton": "supportPage",
    "ticketDescriptionField": "supportPage",
    "submitTicketButton": "supportPage",

    "settingsButton": "settingsPage",
    "darkModeSwitch": "settingsPage",
    "appSettingsLink": "settingsPage",
    "backButton": "settingsPage",
    
    "markAllReadButton": "dashboardPage",
    "notificationCard": "dashboardPage",
    "hubCard": "dashboardPage",
    "planCard_0": "dashboardPage",
    "confirmPlanButton": "dashboardPage",
    "confirmHubButton": "dashboardPage",
    
    "endRentalButton": "dashboardPage",
    "cancelReturnButton": "dashboardPage",
    "processReturnButton": "dashboardPage",
    "cancelReturnProcessButton": "dashboardPage",
}

for k, page in generic_mapping.items():
    key_mapping[k] = (page, k)

pages_dir = r"D:\voltium\flutter\integration_test\pages"
os.makedirs(pages_dir, exist_ok=True)

page_definitions = {}
for key, (page_var, prop_name) in key_mapping.items():
    if page_var not in page_definitions:
        page_definitions[page_var] = []
    page_definitions[page_var].append((key, prop_name))

for page_var, props in page_definitions.items():
    class_name = page_var[0].upper() + page_var[1:] + "Object"
    if page_var == "appPage":
        class_name = "AppPageObject"
    
    file_name = page_var.replace("Page", "_page") + ".dart"
    file_path = os.path.join(pages_dir, file_name)
    
    content = "import 'package:flutter/material.dart';\nimport 'package:flutter_test/flutter_test.dart';\nimport '../helpers/test_helpers.dart';\n\n"
    content += f"class {class_name} {{\n  final WidgetTester tester;\n\n  {class_name}(this.tester);\n\n  // Locators\n"
    
    seen_props = set()
    for key, prop in props:
        if prop not in seen_props:
            content += f"  Finder get {prop} => find.byKey(const Key('{key}'));\n"
            seen_props.add(prop)
            
    content += "}\n"
    
    # Don't overwrite login, dashboard, wallet if they have actions, just append to them if needed. But it's easier to overwrite and re-add if needed, actually NO, let's not overwrite if they exist, or let's read and append!
    if os.path.exists(file_path):
        with open(file_path, "r", encoding="utf-8") as f:
            existing = f.read()
        for key, prop in props:
            if f"get {prop} =>" not in existing:
                # insert before the last brace or in locators
                existing = existing.replace("// Actions", f"  Finder get {prop} => find.byKey(const Key('{key}'));\n\n  // Actions")
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(existing)
    else:
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(content)

# Generate app_robots.dart
app_robots_content = """import 'package:flutter_test/flutter_test.dart';
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
"""

with open(os.path.join(pages_dir, "app_robots.dart"), "w", encoding="utf-8") as f:
    f.write(app_robots_content)
    
# Generate app_page.dart for fallbacks
with open(os.path.join(pages_dir, "app_page.dart"), "w", encoding="utf-8") as f:
    f.write("import 'package:flutter/material.dart';\nimport 'package:flutter_test/flutter_test.dart';\n\nclass AppPageObject {\n  final WidgetTester tester;\n  AppPageObject(this.tester);\n}\n")

print("POMs updated and AppRobots created.")
