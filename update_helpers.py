import re

file_path = r"D:\voltium\flutter\integration_test\helpers\test_helpers.dart"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Add AppRobots import
if "import '../pages/app_robots.dart';" not in content:
    content = content.replace("import 'package:integration_test/integration_test.dart';", "import 'package:integration_test/integration_test.dart';\nimport '../pages/app_robots.dart';")

content = content.replace("find.byKey(const Key('dashboardTab'))", "AppRobots(tester).dashboard.dashboardTab")
content = content.replace("find.byKey(const Key('phoneInput'))", "AppRobots(tester).login.phoneField")
content = content.replace("find.byKey(const Key('acceptCheckbox'))", "AppRobots(tester).onboarding.acceptCheckbox")
content = content.replace("find.byKey(const Key('continueLegalButton'))", "AppRobots(tester).onboarding.continueLegalButton")
content = content.replace("find.byKey(const Key('continuePermissionsButton'))", "AppRobots(tester).onboarding.continuePermissionsButton")
content = content.replace("find.byKey(const Key('loginWithPhoneButton'))", "AppRobots(tester).onboarding.loginWithPhoneButton")
content = content.replace("find.byKey(const Key('allowLocationButton'))", "AppRobots(tester).onboarding.allowLocationButton")
content = content.replace("find.byKey(const Key('allowContactsButton'))", "AppRobots(tester).onboarding.allowContactsButton")
content = content.replace("find.byKey(const Key('allowCameraButton'))", "AppRobots(tester).onboarding.allowCameraButton")
content = content.replace("find.byKey(const Key('allowNotificationsButton'))", "AppRobots(tester).onboarding.allowNotificationsButton")
content = content.replace("find.byKey(const Key('nextOnboardingButton'))", "AppRobots(tester).onboarding.nextOnboardingButton")
content = content.replace("find.byKey(const Key('fullNameField'))", "AppRobots(tester).onboarding.fullNameField")
content = content.replace("find.byKey(const Key('emailField'))", "AppRobots(tester).onboarding.emailField")
content = content.replace("find.byKey(const Key('fatherNameField'))", "AppRobots(tester).onboarding.fatherNameField")
content = content.replace("find.byKey(const Key('motherNameField'))", "AppRobots(tester).onboarding.motherNameField")
content = content.replace("find.byKey(const Key('completeOnboardingButton'))", "AppRobots(tester).onboarding.completeOnboardingButton")
content = content.replace("find.byKey(const Key('guarantorNameField'))", "AppRobots(tester).onboarding.guarantorNameField")
content = content.replace("find.byKey(const Key('guarantorPhoneField'))", "AppRobots(tester).onboarding.guarantorPhoneField")
content = content.replace("find.byKey(const Key('guarantorFatherNameField'))", "AppRobots(tester).onboarding.guarantorFatherNameField")
content = content.replace("find.byKey(const Key('guarantorMotherNameField'))", "AppRobots(tester).onboarding.guarantorMotherNameField")

content = content.replace("find.byKey(const Key('notificationBell'))", "AppRobots(tester).dashboard.notificationBell")
content = content.replace("find.byKey(const Key('assignedVehicleCard'))", "AppRobots(tester).dashboard.assignedVehicleCard")
content = content.replace("find.byKey(const Key('backButton'))", "AppRobots(tester).settings.backButton")
content = content.replace("find.byKey(const Key('sendOtpButton'))", "AppRobots(tester).login.getOtpButton")

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Updated test_helpers.dart")
