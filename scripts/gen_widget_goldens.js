const fs = require('fs');
const path = require('path');

const widgets = [
  'dashboard/presentation/widgets/dashboard_stats_card',
  'dashboard/presentation/widgets/dashboard_action_button',
  'dashboard/presentation/widgets/dashboard_summary_list',
  'kyc/presentation/widgets/kyc_document_picker',
  'kyc/presentation/widgets/kyc_status_badge',
  'kyc/presentation/widgets/kyc_progress_stepper',
  'notifications/presentation/widgets/notification_list_item',
  'notifications/presentation/widgets/notification_badge',
  'pickup/presentation/widgets/pickup_location_map',
  'pickup/presentation/widgets/pickup_time_selector',
  'pickup/presentation/widgets/pickup_vehicle_card',
  'profile/presentation/widgets/earnings_summary_card',
  'profile/presentation/widgets/edit_profile_form',
  'profile/presentation/widgets/profile_avatar',
  'profile/presentation/widgets/profile_menu_item',
  'profile/presentation/widgets/profile_stat_item',
  'rewards/presentation/widgets/earnings_add_sheet',
  'rewards/presentation/widgets/earnings_chart',
  'rewards/presentation/widgets/earnings_widgets',
  'support/presentation/widgets/support_contact_card',
  'support/presentation/widgets/troubleshooter_step_card',
  'wallet/presentation/widgets/skeleton_wallet_card',
  'wallet/presentation/widgets/transaction_filter'
];

widgets.forEach(widget => {
  const parts = widget.split('/');
  const feature = parts[0];
  const widgetName = parts[parts.length - 1];
  const className = widgetName.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');
  
  const targetDir = path.join(__dirname, '../flutter/test/features', feature, 'presentation/widgets/goldens');
  const targetFile = path.join(__dirname, '../flutter/test/features', feature, 'presentation/widgets', `${widgetName}_golden_test.dart`);
  
  fs.mkdirSync(path.dirname(targetFile), { recursive: true });
  fs.mkdirSync(targetDir, { recursive: true });

  const content = `import 'package:flutter_test/flutter_test.dart';
import 'package:voltium/features/${widget}.dart';
import '../../../../../helpers/golden_test_helper.dart';

void main() {
  testWidgets('${className} golden test', (tester) async {
    await tester.pumpWidget(wrapForGolden(const ${className}()));
    await tester.pumpAndSettle();
    
    await expectLater(
      find.byType(${className}),
      matchesGoldenFile('goldens/${widgetName}.png'),
    );
  });
}
`;
  
  if (!fs.existsSync(targetFile)) {
    fs.writeFileSync(targetFile, content);
    console.log(`Generated ${targetFile}`);
  }
});
