const fs = require('fs');
const path = require('path');

const screens = [
  'auth/presentation/screens/auth_choice_screen',
  'dashboard/presentation/screens/dashboard/auth_wrapper',
  'kyc/presentation/screens/kyc/auth_wrapper',
  'kyc/presentation/screens/intent_of_use_screen',
  'notifications/presentation/screens/notification_preferences_screen',
  'notifications/presentation/screens/smart_notifications_screen',
  'onboarding/presentation/screens/welcome_screen',
  'onboarding/presentation/screens/privacy_consent_screen',
  'onboarding/presentation/screens/legal_page_screen',
  'rentals/presentation/screens/plan_success_screen',
  'support/presentation/screens/support_checklist_screen',
  'support/presentation/screens/ticket_status_screen',
  'support/presentation/screens/troubleshooter_result',
  'wallet/presentation/screens/history_screen',
  'wallet/presentation/screens/top_up_payment_sheet_screen'
];

screens.forEach(screen => {
  const parts = screen.split('/');
  const feature = parts[0];
  const screenName = parts[parts.length - 1];
  const className = screenName.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');
  
  const targetDir = path.join(__dirname, '../flutter/test/features', feature, 'presentation/screens/goldens');
  const targetFile = path.join(__dirname, '../flutter/test/features', feature, 'presentation/screens', `${screenName}_golden_test.dart`);
  
  fs.mkdirSync(path.dirname(targetFile), { recursive: true });
  fs.mkdirSync(targetDir, { recursive: true });

  const content = `import 'package:flutter_test/flutter_test.dart';
import 'package:voltium/features/${screen}.dart';
import '../../../../../helpers/golden_test_helper.dart';

void main() {
  testWidgets('${className} golden test', (tester) async {
    await tester.pumpWidget(wrapForGolden(const ${className}()));
    await tester.pumpAndSettle();
    
    await expectLater(
      find.byType(${className}),
      matchesGoldenFile('goldens/${screenName}.png'),
    );
  });
}
`;
  
  if (!fs.existsSync(targetFile)) {
    fs.writeFileSync(targetFile, content);
    console.log(`Generated ${targetFile}`);
  }
});
