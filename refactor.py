import os
import re

test_dir = r"D:\voltium\flutter\integration_test\e2e_individual"

key_mapping = {
    "dashboardTab": ("app.dashboard", "dashboardTab"),
    "notificationBell": ("app.dashboard", "notificationBell"),
    "pointsBadge": ("app.dashboard", "pointsBadge"),
    "assignedVehicleCard": ("app.dashboard", "assignedVehicleCard"),
    "copyReferralButton": ("app.dashboard", "copyReferralButton"),
    
    "phoneInput": ("app.login", "phoneField"),
    "sendOtpButton": ("app.login", "getOtpButton"),
    "otpInputRow": ("app.login", "otpField"),
    "verifyOtpButton": ("app.login", "verifyOtpButton"),

    "topUpButton": ("app.wallet", "topUpButton"),
    "walletTopUpPurposeCard": ("app.wallet", "walletTopUpPurposeCard"),
    "securityDepositPurposeCard": ("app.wallet", "securityDepositPurposeCard"),
    "topUpAmountField": ("app.wallet", "topUpAmountField"),
    "submitTopUpButton": ("app.wallet", "submitTopUpButton"),
    "walletTab": ("app.wallet", "walletTab"),
    "amount500": ("app.wallet", "amount500"),
    "amount1000": ("app.wallet", "amount1000"),
    "amount2000": ("app.wallet", "amount2000"),
    "amount5000": ("app.wallet", "amount5000"),
    "customAmountField": ("app.wallet", "customAmountField"),
    "proceedToUpiButton": ("app.wallet", "proceedToUpiButton"),
}

generic_mapping = {
    "acceptCheckbox": "app.onboarding",
    "continueLegalButton": "app.onboarding",
    "continuePermissionsButton": "app.onboarding",
    "deliverWithUsCard": "app.onboarding",
    "nextOnboardingButton": "app.onboarding",
    "fullNameField": "app.onboarding",
    "emailField": "app.onboarding",
    "fatherNameField": "app.onboarding",
    "motherNameField": "app.onboarding",
    "guarantorNameField": "app.onboarding",
    "guarantorPhoneField": "app.onboarding",
    "guarantorFatherNameField": "app.onboarding",
    "guarantorMotherNameField": "app.onboarding",
    "completeOnboardingButton": "app.onboarding",
    "declarationCheckbox": "app.onboarding",
    "uploadProofArea": "app.onboarding",
    "submitProofButton": "app.onboarding",
    "allowLocationButton": "app.onboarding",
    "allowContactsButton": "app.onboarding",
    "allowCameraButton": "app.onboarding",
    "allowNotificationsButton": "app.onboarding",
    "getStartedButton": "app.onboarding",
    "loginWithPhoneButton": "app.onboarding",
    "continueToPaymentButton": "app.onboarding",
    
    "editProfileButton": "app.profile",
    "editFullNameField": "app.profile",
    "saveProfileButton": "app.profile",
    "profileNameField": "app.profile",
    "logoutButton": "app.profile",
    "profileTab": "app.profile",
    "historyButton": "app.profile",

    "supportTab": "app.support",
    "faqTile": "app.support",
    "raiseTicketTile": "app.support",
    "raiseTicketButton": "app.support",
    "ticketDescriptionField": "app.support",
    "submitTicketButton": "app.support",

    "settingsButton": "app.settings",
    "darkModeSwitch": "app.settings",
    "appSettingsLink": "app.settings",
    "backButton": "app.settings",
    
    "markAllReadButton": "app.dashboard",
    "notificationCard": "app.dashboard",
    "hubCard": "app.dashboard",
    "planCard_0": "app.dashboard",
    "confirmPlanButton": "app.dashboard",
    "confirmHubButton": "app.dashboard",
    
    "endRentalButton": "app.dashboard",
    "cancelReturnButton": "app.dashboard",
    "processReturnButton": "app.dashboard",
    "cancelReturnProcessButton": "app.dashboard",
}

for k, page in generic_mapping.items():
    key_mapping[k] = (page, k)

def refactor_file(file_path):
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Find all find.byKey(const Key('xxx')) and find.byKey(Key('xxx'))
    # Replace with corresponding POM locator
    def replacer(match):
        key = match.group(2)
        if key in key_mapping:
            page_obj, prop = key_mapping[key]
            return f"{page_obj}.{prop}"
        return f"app.shared.{key}"

    new_content = re.sub(r"find\.byKey\((const )?Key\('([^']+)'\)\)", replacer, content)
    
    if new_content == content:
        return # nothing changed

    # If something changed, we need to add the import and instantiate `final app = AppRobots(tester);`
    if "import '../pages/app_robots.dart';" not in new_content and "import '../../pages/app_robots.dart';" not in new_content:
        # Check depth
        if "e2e_individual" in file_path:
            import_str = "import '../pages/app_robots.dart';"
        else:
            import_str = "import '../../pages/app_robots.dart';"
            
        new_content = new_content.replace("import 'package:flutter_test/flutter_test.dart';", f"import 'package:flutter_test/flutter_test.dart';\n{import_str}")

    # Inject final app = AppRobots(tester); at the top of testWidgets or test blocks
    def inject_app_robots(match):
        header = match.group(0)
        return f"{header}\n    final app = AppRobots(tester);"

    # This regex matches testWidgets('...', (tester) async { or similar
    new_content = re.sub(r"testWidgets\([^,]+,\s*\([^)]*tester[^)]*\)\s*async\s*\{", inject_app_robots, new_content)

    with open(file_path, "w", encoding="utf-8") as f:
        f.write(new_content)

for f in os.listdir(test_dir):
    if f.endswith(".dart"):
        refactor_file(os.path.join(test_dir, f))

print("Refactored all tests.")
